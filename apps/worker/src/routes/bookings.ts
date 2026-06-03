/**
 * Dedicated booking endpoints. These BYPASS the generic upsert because they
 * involve money (recomputed server-side) and conflict checks (double-booking).
 */
import {
  computeBookingPrice,
  durationMinutes,
  type BookingStatus,
} from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';
import { operatesFacility } from '../db.js';
import { sendEmail, emailLayout } from '../email/index.js';

interface CreateBookingBody {
  facility_id?: string;
  space_id?: string;
  event_name?: string;
  event_type?: string;
  event_description?: string;
  expected_attendance?: number;
  start_time?: string;
  end_time?: string;
  setup_start_time?: string;
  resource_ids?: string[];
  renter_notes?: string;
  discount_percent?: number;
  /** Operator-created walk-in booking (auto-confirmed). */
  manual?: boolean;
  walkin_name?: string;
}

const ACTIVE_STATUSES = ['pending', 'approved', 'confirmed'];

export async function handleCreateBooking(
  env: Env,
  req: Request,
  auth: AuthContext,
): Promise<Response> {
  const body = await readJson<CreateBookingBody>(req);
  const { facility_id, space_id, start_time, end_time } = body;
  if (!facility_id || !space_id || !start_time || !end_time) {
    return err('facility_id, space_id, start_time and end_time are required', 422);
  }
  if (!body.event_name?.trim()) return err('An event name is required', 422);

  const minutes = durationMinutes(start_time, end_time);
  if (minutes <= 0) return err('End time must be after start time', 422);

  const space = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?')
    .bind(space_id)
    .first<Record<string, unknown>>();
  if (!space) return err('Space not found', 404);
  if (space.facility_id !== facility_id) return err('Space does not belong to that facility', 400);

  const facility = await env.DB.prepare('SELECT * FROM facilities WHERE id = ?')
    .bind(facility_id)
    .first<Record<string, unknown>>();
  if (!facility) return err('Facility not found', 404);

  // --- Double-booking conflict check (server-side, includes buffer) ---
  const buffer = Number(space.buffer_minutes || 0);
  const conflict = await hasConflict(env, space_id, start_time, end_time, buffer, null);
  if (conflict) {
    return err('That time overlaps an existing booking for this space.', 409, { conflict: true });
  }
  // Reject times the operator has blocked off (maintenance, internal events, holidays).
  const blocked = await env.DB.prepare(
    'SELECT id FROM availability_blocks WHERE space_id = ? AND start_time < ? AND end_time > ?',
  ).bind(space_id, end_time, start_time).first();
  if (blocked) {
    return err('That time is unavailable for this space.', 409, { conflict: true });
  }

  // --- Recompute money server-side; never trust client amounts ---
  const resourceIds = Array.isArray(body.resource_ids) ? body.resource_ids : [];
  const resourceFeesCents = await computeResourceFees(env, facility_id, resourceIds, minutes);

  // Apply an automatic discount from the facility's pricing rules based on the
  // renter's organization type (e.g. nonprofit 25%, school 10%).
  const renterProfile = await env.DB.prepare('SELECT organization_type FROM profiles WHERE id = ?')
    .bind(auth.id).first<{ organization_type: string | null }>();
  let discountPercent = clampDiscount(body.discount_percent);
  if (renterProfile?.organization_type) {
    const rule = await env.DB.prepare(
      'SELECT discount_percent FROM pricing_rules WHERE facility_id = ? AND org_type = ?',
    ).bind(facility_id, renterProfile.organization_type).first<{ discount_percent: number }>();
    if (rule) discountPercent = Math.max(discountPercent, clampDiscount(rule.discount_percent));
  }

  const isWeekend = [0, 6].includes(new Date(start_time).getUTCDay());
  const feePercent = parseFloat(env.PLATFORM_FEE_PERCENT || '1.5');
  const price = computeBookingPrice({
    startTime: start_time,
    endTime: end_time,
    hourlyRateCents: Number(space.hourly_rate_cents || 0),
    halfDayRateCents: space.half_day_rate_cents as number | null,
    fullDayRateCents: space.full_day_rate_cents as number | null,
    weekendHourlyRateCents: space.weekend_hourly_rate_cents as number | null,
    resourceFeesCents,
    depositCents: Number(space.deposit_amount_cents || 0),
    discountPercent,
    isWeekend,
    platformFeePercent: feePercent,
  });

  // Operator-created walk-in bookings are auto-confirmed; otherwise honor approval setting.
  const isManual = !!body.manual && (await operatesFacility(env, auth.id, facility_id));
  const requiresApproval = Number(facility.requires_approval) === 1;
  const id = genId('bkg');
  const ts = nowISO();
  const status: BookingStatus = isManual ? 'confirmed' : requiresApproval ? 'pending' : 'approved';
  const operatorNotes = isManual && body.walkin_name ? `Walk-in: ${body.walkin_name}` : null;

  await env.DB.prepare(
    `INSERT INTO bookings (
      id, facility_id, space_id, renter_id, event_name, event_type,
      event_description, expected_attendance, start_time, end_time, setup_start_time,
      subtotal_cents, deposit_cents, resource_fees_cents, discount_cents, total_cents,
      platform_fee_cents, status, coi_uploaded, agreement_signed, resource_ids,
      renter_notes, operator_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, facility_id, space_id, auth.id, body.event_name.trim(), body.event_type || null,
      body.event_description || null, body.expected_attendance || null, start_time, end_time,
      body.setup_start_time || null,
      price.subtotalCents, price.depositCents, price.resourceFeesCents, price.discountCents,
      price.totalCents, price.platformFeeCents, status, JSON.stringify(resourceIds),
      body.renter_notes || null, operatorNotes, ts, ts,
    )
    .run();

  // Notify the operator in-app + email (skip for self-created walk-ins).
  if (!isManual) await notify(env, facility.operator_id as string, {
    title: 'New booking request',
    body: `${body.event_name} on ${formatDate(start_time)}`,
    action_url: `/operator/bookings/${id}`,
  });
  if (!isManual) {
    // Prefer the facility's public contact email; fall back to the operator's account email.
    let hostEmail = (facility.email as string | null) || null;
    if (!hostEmail) {
      const op = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?')
        .bind(facility.operator_id).first<{ email: string }>();
      hostEmail = op?.email || null;
    }
    if (hostEmail) {
      await sendEmail(env, {
        to: hostEmail,
        subject: `New booking request: ${body.event_name}`,
        html: emailLayout(
          'New booking request',
          `<p>A new request came in for <strong>${escapeHtml(body.event_name)}</strong> on ${formatDate(start_time)}.</p>`,
          { label: 'Review the request', url: `${env.APP_URL || ''}/operator/bookings/${id}` },
        ),
      });
    }
  }

  const saved = await getBooking(env, id);
  return json({ ok: true, booking: saved });
}

interface StatusBody {
  base_updated_at?: string;
  reason?: string;
}

export async function handleBookingStatus(
  env: Env,
  req: Request,
  auth: AuthContext,
  bookingId: string,
  action: 'approve' | 'deny' | 'cancel' | 'confirm' | 'complete',
): Promise<Response> {
  const body = await readJson<StatusBody>(req);
  const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(bookingId)
    .first<Record<string, unknown>>();
  if (!booking) return err('Booking not found', 404);

  const isOperator = await operatesFacility(env, auth.id, booking.facility_id as string);
  const isRenter = booking.renter_id === auth.id;
  const isAdmin = auth.role === 'admin';

  // Authorization per action.
  const operatorActions = ['approve', 'deny', 'confirm', 'complete'];
  if (operatorActions.includes(action) && !(isOperator || isAdmin)) {
    return err('Only the facility operator can do that', 403);
  }
  if (action === 'cancel' && !(isOperator || isRenter || isAdmin)) {
    return err('You cannot cancel this booking', 403);
  }

  // Optimistic concurrency.
  if (body.base_updated_at && booking.updated_at !== body.base_updated_at) {
    return err('This booking changed since you loaded it. Refreshing…', 409, { conflict: true });
  }

  const map: Record<string, BookingStatus> = {
    approve: 'approved',
    deny: 'denied',
    cancel: 'cancelled',
    confirm: 'confirmed',
    complete: 'completed',
  };
  const newStatus = map[action];

  // On approve/confirm, re-check conflicts (another booking may have landed).
  if (action === 'approve' || action === 'confirm') {
    const buffer = await spaceBuffer(env, booking.space_id as string);
    const conflict = await hasConflict(
      env, booking.space_id as string, booking.start_time as string,
      booking.end_time as string, buffer, bookingId,
    );
    if (conflict) return err('Another booking now conflicts with this time.', 409, { conflict: true });
  }

  const ts = nowISO();
  await env.DB.prepare(
    `UPDATE bookings SET status = ?, denial_reason = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(
      newStatus,
      action === 'deny' ? body.reason || 'Not available' : booking.denial_reason || null,
      action === 'cancel' ? body.reason || null : booking.cancellation_reason || null,
      ts,
      bookingId,
    )
    .run();

  // Notify the renter on operator-driven status changes (in-app + email to the tenant).
  const renter = await env.DB.prepare('SELECT email, full_name FROM profiles WHERE id = ?')
    .bind(booking.renter_id).first<{ email: string; full_name: string | null }>();
  const bookingUrl = `${env.APP_URL || ''}/renter/bookings/${bookingId}`;

  if (action === 'approve') {
    await notify(env, booking.renter_id as string, {
      title: 'Booking approved 🎉',
      body: `${booking.event_name} is approved. Next: insurance & payment.`,
      action_url: `/renter/bookings/${bookingId}`,
    });
    if (renter?.email) {
      await sendEmail(env, {
        to: renter.email,
        subject: `Your booking is approved: ${booking.event_name}`,
        html: emailLayout(
          'Your booking is approved 🎉',
          `<p>Good news${renter.full_name ? `, ${escapeHtml(renter.full_name.split(' ')[0])}` : ''} — your request for <strong>${escapeHtml(String(booking.event_name))}</strong> on ${formatDate(booking.start_time as string)} has been approved.</p>
           <p>Next steps: upload your certificate of insurance (if required) and complete payment to confirm your date.</p>`,
          { label: 'View your booking', url: bookingUrl },
        ),
      });
    }
  } else if (action === 'deny') {
    await notify(env, booking.renter_id as string, {
      title: 'Booking update',
      body: `Your request for ${booking.event_name} couldn't be confirmed.`,
      action_url: `/renter/bookings/${bookingId}`,
    });
    if (renter?.email) {
      await sendEmail(env, {
        to: renter.email,
        subject: `Update on your booking request: ${booking.event_name}`,
        html: emailLayout(
          'Update on your request',
          `<p>Thank you for your interest in hosting <strong>${escapeHtml(String(booking.event_name))}</strong>. Unfortunately we weren't able to confirm this booking.</p>
           ${body.reason ? `<p><em>${escapeHtml(body.reason)}</em></p>` : ''}
           <p>We'd be glad to help you find another time or space that works.</p>`,
          { label: 'Browse spaces', url: `${env.APP_URL || ''}/renter` },
        ),
      });
    }
  } else if (action === 'cancel') {
    // Let the other party know about a cancellation.
    if (renter?.email) {
      await sendEmail(env, {
        to: renter.email,
        subject: `Booking cancelled: ${booking.event_name}`,
        html: emailLayout('Your booking was cancelled', `<p>Your booking for <strong>${escapeHtml(String(booking.event_name))}</strong> on ${formatDate(booking.start_time as string)} has been cancelled.${body.reason ? ` Reason: ${escapeHtml(body.reason)}` : ''}</p>`),
      });
    }
  }

  const saved = await getBooking(env, bookingId);
  return json({ ok: true, booking: saved });
}

// ---- helpers ----

async function hasConflict(
  env: Env,
  spaceId: string,
  start: string,
  end: string,
  bufferMinutes: number,
  excludeId: string | null,
): Promise<boolean> {
  const bufStart = new Date(new Date(start).getTime() - bufferMinutes * 60000).toISOString();
  const bufEnd = new Date(new Date(end).getTime() + bufferMinutes * 60000).toISOString();
  const ph = ACTIVE_STATUSES.map(() => '?').join(',');
  const sql =
    `SELECT id FROM bookings WHERE space_id = ? AND status IN (${ph}) ` +
    `AND start_time < ? AND end_time > ?` +
    (excludeId ? ' AND id != ?' : '');
  const binds: unknown[] = [spaceId, ...ACTIVE_STATUSES, bufEnd, bufStart];
  if (excludeId) binds.push(excludeId);
  const row = await env.DB.prepare(sql).bind(...binds).first();
  return !!row;
}

async function spaceBuffer(env: Env, spaceId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT buffer_minutes FROM spaces WHERE id = ?')
    .bind(spaceId)
    .first<{ buffer_minutes: number }>();
  return Number(row?.buffer_minutes || 0);
}

async function computeResourceFees(
  env: Env,
  facilityId: string,
  resourceIds: string[],
  minutes: number,
): Promise<number> {
  if (!resourceIds.length) return 0;
  const ph = resourceIds.map(() => '?').join(',');
  const res = await env.DB.prepare(
    `SELECT hourly_rate_cents, flat_rate_cents FROM resources WHERE facility_id = ? AND id IN (${ph})`,
  )
    .bind(facilityId, ...resourceIds)
    .all<{ hourly_rate_cents: number; flat_rate_cents: number }>();
  const hours = minutes / 60;
  let total = 0;
  for (const r of res.results || []) {
    total += Number(r.flat_rate_cents || 0) + Math.round((Number(r.hourly_rate_cents || 0)) * hours);
  }
  return total;
}

async function getBooking(env: Env, id: string): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return null;
  try {
    row.resource_ids = JSON.parse((row.resource_ids as string) || '[]');
  } catch {
    row.resource_ids = [];
  }
  return row;
}

async function notify(
  env: Env,
  userId: string,
  n: { title: string; body: string; action_url?: string },
): Promise<void> {
  const ts = nowISO();
  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, is_read, action_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'booking', 0, ?, ?, ?)`,
  )
    .bind(genId('ntf'), userId, n.title, n.body, n.action_url || null, ts, ts)
    .run();
}

function clampDiscount(p: number | undefined): number {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, p));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

export { notify };
