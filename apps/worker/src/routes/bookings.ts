/**
 * Dedicated booking endpoints. These BYPASS the generic upsert because they
 * involve money (recomputed server-side) and conflict checks (double-booking).
 */
import {
  computeBookingPrice,
  durationMinutes,
  leaseConflicts,
  type BookingStatus,
  type Lease,
} from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO, clientIP } from '../http.js';
import { operatesFacility } from '../db.js';
import { insertBookingViaLock } from '../booking-lock.js';
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
  /** Pay-what-you-can amount for donation-mode spaces. */
  donation_cents?: number;
  /** Typed name = e-signature of the use agreement. */
  signer_name?: string;
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
  // Reject times reserved by an active recurring tenant/lease on this space.
  const leaseRows = (await env.DB.prepare(
    "SELECT * FROM leases WHERE space_id = ? AND status = 'active'",
  ).bind(space_id).all<Record<string, unknown>>()).results || [];
  for (const lr of leaseRows) {
    const lease = { ...lr, weekdays: parseWeekdays(lr.weekdays) } as unknown as Lease;
    if (leaseConflicts(lease, start_time, end_time)) {
      return err('That time is reserved by a recurring tenant of this space.', 409, { conflict: true });
    }
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
  const pricingMode = (space.pricing_mode as string) || 'standard';

  let price = computeBookingPrice({
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

  // Rent-or-donate: a free space costs nothing; a donation space is pay-what-you-can.
  if (pricingMode === 'free') {
    price = { ...price, spaceSubtotalCents: 0, discountCents: 0, subtotalCents: resourceFeesCents, totalCents: resourceFeesCents, platformFeeCents: Math.round((resourceFeesCents * feePercent) / 100) };
  } else if (pricingMode === 'donation') {
    const donation = Math.max(0, Math.round(Number(body.donation_cents) || 0));
    const subtotal = donation + resourceFeesCents;
    price = { ...price, spaceSubtotalCents: donation, discountCents: 0, subtotalCents: subtotal, totalCents: subtotal, platformFeeCents: Math.round((subtotal * feePercent) / 100) };
  }

  // Operator-created walk-in bookings are auto-confirmed; otherwise honor approval setting.
  const isManual = !!body.manual && (await operatesFacility(env, auth.id, facility_id));
  const requiresApproval = Number(facility.requires_approval) === 1;
  const id = genId('bkg');
  const ts = nowISO();
  const status: BookingStatus = isManual ? 'confirmed' : requiresApproval ? 'pending' : 'approved';
  const operatorNotes = isManual && body.walkin_name ? `Walk-in: ${body.walkin_name}` : null;

  // E-signature audit: a renter who types their name signs the use agreement.
  const signer = (body.signer_name || '').trim() || null;
  const signed = signer && !isManual ? 1 : 0;
  const signedAt = signed ? ts : null;
  const signerIp = signed ? clientIP(req) : null;

  // Atomic conflict-check + insert via the per-space Durable Object lock. This
  // closes the race where two simultaneous requests for the same slot both pass
  // a plain SELECT conflict check and both insert.
  const lockResult = await insertBookingViaLock(env, {
    id, facility_id, space_id, renter_id: auth.id, event_name: body.event_name.trim(),
    event_type: body.event_type || null, event_description: body.event_description || null,
    expected_attendance: body.expected_attendance || null, start_time, end_time,
    setup_start_time: body.setup_start_time || null, subtotal_cents: price.subtotalCents,
    deposit_cents: price.depositCents, resource_fees_cents: price.resourceFeesCents,
    discount_cents: price.discountCents, total_cents: price.totalCents,
    platform_fee_cents: price.platformFeeCents, status, coi_uploaded: 0,
    agreement_signed: signed, agreement_signed_at: signedAt, agreement_signer: signer,
    agreement_ip: signerIp, resource_ids: JSON.stringify(resourceIds),
    renter_notes: body.renter_notes || null, operator_notes: operatorNotes,
    created_at: ts, updated_at: ts,
  }, buffer);
  if (lockResult.conflict) {
    return err('That time was just booked by someone else for this space.', 409, { conflict: true });
  }

  // Notify the operator in-app + email (skip for self-created walk-ins). Wording
  // depends on whether this facility gates bookings behind manual approval.
  const heads = requiresApproval
    ? { title: 'New booking request', verb: 'A new request came in', cta: 'Review the request' }
    : { title: 'New booking', verb: 'A new booking came in', cta: 'View the booking' };
  if (!isManual) await notify(env, facility.operator_id as string, {
    title: heads.title,
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
        subject: `${heads.title}: ${body.event_name}`,
        html: emailLayout(
          heads.title,
          `<p>${heads.verb} for <strong>${escapeHtml(body.event_name)}</strong> on ${formatDate(start_time)}.</p>`,
          { label: heads.cta, url: `${env.APP_URL || ''}/operator/bookings/${id}` },
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

function parseWeekdays(v: unknown): number[] {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
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
