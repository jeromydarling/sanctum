/** Cron: daily COI-expiry sweep + monthly idempotent auto-invoicing. */
import { platformFeeCents } from '@sanctum/shared';
import type { Env } from './types.js';
import { genId, nowISO } from './http.js';
import { sendEmail, emailLayout } from './email/index.js';

export async function runScheduled(env: Env): Promise<void> {
  await coiExpirySweep(env);
  await monthlyAutoInvoicing(env);
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
  }
}
