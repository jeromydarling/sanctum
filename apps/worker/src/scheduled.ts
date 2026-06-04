/** Cron: daily COI-expiry sweep + monthly idempotent auto-invoicing. */
import { platformFeeCents, leaseMonthlyAmountCents, type Lease } from '@sanctum/shared';
import type { Env } from './types.js';
import { genId, nowISO } from './http.js';
import { sendEmail, emailLayout } from './email/index.js';

export async function runScheduled(env: Env): Promise<void> {
  await coiExpirySweep(env);
  await eventReminders(env);
  await reviewRequests(env);
  await monthlyAutoInvoicing(env);
}

/** Once-per-booking idempotency guard for reminders. Returns true if first time. */
async function claimReminder(env: Env, bookingId: string, kind: string): Promise<boolean> {
  const res = await env.DB.prepare(
    'INSERT INTO reminder_log (id, booking_id, kind) VALUES (?, ?, ?) ON CONFLICT(booking_id, kind) DO NOTHING',
  ).bind(genId('rem'), bookingId, kind).run();
  return ((res.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
}

async function renterEmail(env: Env, renterId: string): Promise<string | null> {
  const r = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?').bind(renterId).first<{ email: string }>();
  return r?.email || null;
}

/** Remind renters the day before their upcoming event. */
async function eventReminders(env: Env): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 36 * 3600 * 1000).toISOString();
  const nowIso = now.toISOString();
  const bookings = (
    await env.DB.prepare(
      `SELECT * FROM bookings WHERE status IN ('approved','confirmed') AND start_time > ? AND start_time <= ?`,
    ).bind(nowIso, windowEnd).all<Record<string, unknown>>()
  ).results || [];

  for (const b of bookings) {
    if (!(await claimReminder(env, b.id as string, 'event'))) continue;
    const email = await renterEmail(env, b.renter_id as string);
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, body, type, is_read, action_url, created_at, updated_at)
       VALUES (?, ?, 'Your event is coming up', ?, 'reminder', 0, ?, ?, ?)`,
    ).bind(genId('ntf'), b.renter_id, `${b.event_name} is almost here.`, `/renter/bookings/${b.id}`, nowIso, nowIso).run();
    if (email) {
      await sendEmail(env, {
        to: email,
        subject: `Reminder: ${b.event_name} is coming up`,
        html: emailLayout('Your event is almost here', `<p>Just a friendly reminder that <strong>${b.event_name}</strong> is happening soon. We can't wait to host you!</p>`),
      });
    }
  }
}

/** Invite renters to review the day after a completed event. */
async function reviewRequests(env: Env): Promise<void> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString();
  const nowIso = now.toISOString();
  const bookings = (
    await env.DB.prepare(
      `SELECT b.* FROM bookings b
       WHERE b.status IN ('confirmed','completed') AND b.end_time <= ? AND b.end_time >= ?
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)`,
    ).bind(dayAgo, threeDaysAgo).all<Record<string, unknown>>()
  ).results || [];

  for (const b of bookings) {
    if (!(await claimReminder(env, b.id as string, 'review'))) continue;
    const email = await renterEmail(env, b.renter_id as string);
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, body, type, is_read, action_url, created_at, updated_at)
       VALUES (?, ?, 'How was your event?', ?, 'review', 0, ?, ?, ?)`,
    ).bind(genId('ntf'), b.renter_id, `Share how ${b.event_name} went.`, `/renter/bookings/${b.id}`, nowIso, nowIso).run();
    if (email) {
      await sendEmail(env, {
        to: email,
        subject: `How was ${b.event_name}?`,
        html: emailLayout('How was your event?', `<p>We hope <strong>${b.event_name}</strong> was wonderful. Would you take a moment to share how it went? It helps the community find great spaces.</p>`,
          { label: 'Leave a review', url: `${env.APP_URL || ''}/renter/bookings/${b.id}` }),
      });
    }
  }
}

/** Notify renters + operators about COIs expiring within 14 days or already expired. */
async function coiExpirySweep(env: Env): Promise<void> {
  const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const docs = (
    await env.DB.prepare(
      `SELECT * FROM compliance_docs
       WHERE doc_type = 'certificate_of_insurance'
       AND status = 'approved' AND expiration_date IS NOT NULL AND expiration_date <= ?`,
    ).bind(soon).all<Record<string, unknown>>()
  ).results || [];

  for (const d of docs) {
    const expDate = d.expiration_date as string;
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, body, type, is_read, created_at, updated_at)
       VALUES (?, ?, 'Insurance expiring', ?, 'compliance', 0, ?, ?)`,
    ).bind(genId('ntf'), d.renter_id, `Your certificate of insurance expires ${expDate}. Please upload a renewal.`, nowISO(), nowISO()).run();

    const renter = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?').bind(d.renter_id).first<{ email: string }>();
    if (renter?.email) {
      await sendEmail(env, {
        to: renter.email,
        subject: 'Your certificate of insurance is expiring',
        html: emailLayout('Insurance renewal needed', `<p>Your certificate of insurance on file expires on <strong>${expDate}</strong>. Please upload a current certificate to keep your bookings active.</p>`),
      });
    }
  }
}

/** Generate invoices for the prior month's confirmed/completed bookings. Idempotent per (period, facility). */
async function monthlyAutoInvoicing(env: Env): Promise<void> {
  const now = new Date();
  // Only run the heavy job on the 1st of the month.
  if (now.getUTCDate() !== 1) return;

  const firstThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const period = firstPrev.toISOString().slice(0, 7); // YYYY-MM
  const start = firstPrev.toISOString();
  const end = firstThis.toISOString();

  const facilities = (await env.DB.prepare('SELECT id FROM facilities').all<{ id: string }>()).results || [];
  for (const f of facilities) {
    // Idempotency guard.
    const guard = await env.DB.prepare('INSERT INTO billing_runs (id, period, facility_id) VALUES (?, ?, ?) ON CONFLICT(period, facility_id) DO NOTHING')
      .bind(genId('run'), period, f.id).run();
    const changes = (guard.meta as { changes?: number } | undefined)?.changes ?? 0;
    if (changes === 0) continue;

    const bookings = (
      await env.DB.prepare(
        `SELECT * FROM bookings WHERE facility_id = ? AND status IN ('confirmed','completed')
         AND balance_paid_at IS NULL AND start_time >= ? AND start_time < ?`,
      ).bind(f.id, start, end).all<Record<string, unknown>>()
    ).results || [];

    for (const b of bookings) {
      const subtotal = Number(b.subtotal_cents || 0);
      if (subtotal <= 0) continue;
      const fee = platformFeeCents(subtotal, parseFloat(env.PLATFORM_FEE_PERCENT || '1.5'));
      const id = genId('inv');
      const ts = nowISO();
      const number = `INV-${period.replace('-', '')}-${id.slice(-5).toUpperCase()}`;
      const items = [{ label: b.event_name, quantity: 1, unit_cents: subtotal, amount_cents: subtotal }];
      await env.DB.prepare(
        `INSERT INTO invoices (id, facility_id, booking_id, renter_id, invoice_number, line_items,
          subtotal_cents, tax_cents, total_cents, platform_fee_cents, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'sent', ?, ?)`,
      ).bind(id, f.id, b.id, b.renter_id, number, JSON.stringify(items), subtotal, subtotal, fee, ts, ts).run();
    }

    // Recurring tenants/leases: one invoice per active lease for the prior month.
    const leases = (
      await env.DB.prepare("SELECT * FROM leases WHERE facility_id = ? AND status = 'active'").bind(f.id).all<Record<string, unknown>>()
    ).results || [];
    const prevYear = firstPrev.getUTCFullYear();
    const prevMonth = firstPrev.getUTCMonth();
    for (const lr of leases) {
      const lease = { ...lr, weekdays: parseWeekdays(lr.weekdays) } as unknown as Lease;
      // Only bill once the lease has started.
      if (new Date(lease.start_date).getTime() >= firstThis.getTime()) continue;
      const amount = leaseMonthlyAmountCents(lease, prevYear, prevMonth);
      if (amount <= 0) continue;
      const fee = platformFeeCents(amount, parseFloat(env.PLATFORM_FEE_PERCENT || '1.5'));
      const id = genId('inv');
      const ts = nowISO();
      const number = `INV-${period.replace('-', '')}-${id.slice(-5).toUpperCase()}`;
      const label = `${lease.title} — ${firstPrev.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
      const items = [{ label, quantity: 1, unit_cents: amount, amount_cents: amount }];
      await env.DB.prepare(
        `INSERT INTO invoices (id, facility_id, booking_id, renter_id, invoice_number, line_items,
          subtotal_cents, tax_cents, total_cents, platform_fee_cents, status, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, 'sent', ?, ?)`,
      ).bind(id, f.id, lease.renter_id || '', number, JSON.stringify(items), amount, amount, fee, ts, ts).run();
    }
  }
}

function parseWeekdays(v: unknown): number[] {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
}
