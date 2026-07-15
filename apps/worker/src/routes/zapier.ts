/**
 * Zapier outbound webhooks — the no-Intuit-review path to QuickBooks (and
 * anything else). An operator pastes their Zapier "Catch Hook" URL into their
 * Financials settings; Sanctum POSTs a flat JSON payload every time one of their
 * bookings or tenant invoices is paid. Their Zap maps the fields into a
 * QuickBooks Sales Receipt. No tokens, no OAuth, no code on our side per account.
 *
 * The URL is stored on facilities.zapier_webhook_url and locked to
 * hooks.zapier.com so it can never be pointed at an internal address (SSRF).
 */
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, nowISO } from '../http.js';
import { operatesFacility } from '../db.js';

const ZAPIER_HOST = 'hooks.zapier.com';
const POST_TIMEOUT_MS = 6000;

/** A Zapier catch-hook URL, or null. Only https://hooks.zapier.com/... is allowed. */
export function validZapierUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return null;
    if (u.hostname !== ZAPIER_HOST) return null;
    return u.toString();
  } catch {
    return null;
  }
}

interface ZapierPayload {
  event: 'booking.paid' | 'invoice.paid' | 'test';
  facility_id: string;
  facility_name: string;
  date: string; // ISO
  type: string; // human label, e.g. "Booking" / "Tenant invoice"
  customer: string;
  description: string;
  reference: string; // booking id or invoice number
  // Money — both a dollars string (easy Zapier mapping) and raw cents.
  currency: 'USD';
  amount: string; // gross, dollars e.g. "700.00"
  gross_cents: number;
  platform_fee: string; // dollars
  platform_fee_cents: number;
  net: string; // gross - fee, dollars (what the operator nets)
  net_cents: number;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Fire the webhook. Never throws and is time-bounded — a broken customer Zap
 *  must never break the money path or hold a response open. */
async function post(url: string, payload: ZapierPayload): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return res.status;
  } catch (e) {
    console.error('[zapier:post]', (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function hookFor(env: Env, facilityId: string): Promise<{ url: string; name: string } | null> {
  const f = await env.DB.prepare('SELECT name, zapier_webhook_url FROM facilities WHERE id = ?')
    .bind(facilityId)
    .first<{ name: string; zapier_webhook_url: string | null }>();
  if (!f?.zapier_webhook_url) return null;
  const url = validZapierUrl(f.zapier_webhook_url);
  if (!url) return null;
  return { url, name: f.name };
}

/** Emit booking.paid. `booking` is a full bookings row. Safe to await. */
export async function emitBookingPaid(env: Env, booking: Record<string, unknown>): Promise<void> {
  const hook = await hookFor(env, booking.facility_id as string);
  if (!hook) return;
  const renter = await env.DB.prepare('SELECT full_name, organization_name FROM profiles WHERE id = ?')
    .bind(booking.renter_id)
    .first<{ full_name: string | null; organization_name: string | null }>();
  const gross = Number(booking.subtotal_cents || booking.total_cents || 0);
  const fee = Number(booking.platform_fee_cents || 0);
  await post(hook.url, {
    event: 'booking.paid',
    facility_id: booking.facility_id as string,
    facility_name: hook.name,
    date: (booking.balance_paid_at as string) || nowISO(),
    type: 'Booking',
    customer: renter?.full_name || renter?.organization_name || 'Renter',
    description: String(booking.event_name || 'Booking'),
    reference: String(booking.id || ''),
    currency: 'USD',
    amount: dollars(gross),
    gross_cents: gross,
    platform_fee: dollars(fee),
    platform_fee_cents: fee,
    net: dollars(gross - fee),
    net_cents: gross - fee,
  });
}

/** Emit invoice.paid. `inv` is a full invoices row. Only standalone (tenant)
 *  invoices fire — booking-linked invoices are already covered by booking.paid. */
export async function emitInvoicePaid(env: Env, inv: Record<string, unknown>): Promise<void> {
  if (inv.booking_id) return;
  const hook = await hookFor(env, inv.facility_id as string);
  if (!hook) return;
  const gross = Number(inv.total_cents || 0);
  const fee = Number(inv.platform_fee_cents || 0);
  await post(hook.url, {
    event: 'invoice.paid',
    facility_id: inv.facility_id as string,
    facility_name: hook.name,
    date: (inv.paid_at as string) || nowISO(),
    type: 'Tenant invoice',
    customer: 'Tenant',
    description: String(inv.invoice_number || 'Invoice'),
    reference: String(inv.invoice_number || ''),
    currency: 'USD',
    amount: dollars(gross),
    gross_cents: gross,
    platform_fee: dollars(fee),
    platform_fee_cents: fee,
    net: dollars(gross - fee),
    net_cents: gross - fee,
  });
}

// ---- Operator-facing endpoints ----

/** GET /api/qbo/zapier?facility_id= -> { url } */
export async function handleZapierGet(env: Env, url: URL, auth: AuthContext): Promise<Response> {
  const facilityId = url.searchParams.get('facility_id') || '';
  if (!(await operatesFacility(env, auth.id, facilityId)) && auth.role !== 'admin') return err('Not permitted', 403);
  const f = await env.DB.prepare('SELECT zapier_webhook_url FROM facilities WHERE id = ?')
    .bind(facilityId)
    .first<{ zapier_webhook_url: string | null }>();
  return json({ url: f?.zapier_webhook_url || '' });
}

/** POST /api/qbo/zapier { facility_id, url } — set or clear (empty url clears). */
export async function handleZapierSet(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id, url } = await readJson<{ facility_id?: string; url?: string }>(req);
  if (!facility_id || !(await operatesFacility(env, auth.id, facility_id))) return err('Not permitted', 403);
  const raw = (url || '').trim();
  let toStore: string | null = null;
  if (raw) {
    const valid = validZapierUrl(raw);
    if (!valid) return err('That doesn\'t look like a Zapier webhook URL. It should start with https://hooks.zapier.com/', 422);
    toStore = valid;
  }
  await env.DB.prepare('UPDATE facilities SET zapier_webhook_url = ?, updated_at = ? WHERE id = ?')
    .bind(toStore, nowISO(), facility_id)
    .run();
  return json({ ok: true, url: toStore || '' });
}

/** POST /api/qbo/zapier/test { facility_id } — send a sample payload right now. */
export async function handleZapierTest(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id } = await readJson<{ facility_id?: string }>(req);
  if (!facility_id || !(await operatesFacility(env, auth.id, facility_id))) return err('Not permitted', 403);
  const hook = await hookFor(env, facility_id);
  if (!hook) return err('Add a valid Zapier webhook URL first.', 400);
  const status = await post(hook.url, {
    event: 'test',
    facility_id,
    facility_name: hook.name,
    date: nowISO(),
    type: 'Test',
    customer: 'Sanctum test',
    description: 'Test event from Sanctum — you can safely ignore or delete this in QuickBooks.',
    reference: 'TEST',
    currency: 'USD',
    amount: '1.00',
    gross_cents: 100,
    platform_fee: '0.00',
    platform_fee_cents: 0,
    net: '1.00',
    net_cents: 100,
  });
  if (status === null) return err('Couldn\'t reach Zapier — double-check the URL and that your Zap is on.', 502);
  return json({ ok: true, status });
}
