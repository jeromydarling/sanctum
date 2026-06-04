/**
 * QuickBooks Online live sync. Real OAuth2 + Sales Receipt push, gated on
 * QBO_CLIENT_ID / QBO_CLIENT_SECRET (set in the dashboard, like Stripe). When
 * unconfigured it degrades to {demo:true} so nothing breaks.
 *
 * Tokens live in D1 (facilities.qbo_*), never in the repo.
 */
import { platformFeeCents } from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, nowISO } from '../http.js';
import { operatesFacility } from '../db.js';

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens';

function apiBase(env: Env): string {
  return env.QBO_ENV === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}
function configured(env: Env): boolean {
  return !!(env.QBO_CLIENT_ID && env.QBO_CLIENT_SECRET);
}
function redirectUri(env: Env): string {
  return `${env.APP_URL || ''}/api/qbo/callback`;
}

/** GET /api/qbo/connect?facility_id= -> { url } */
export async function handleQboConnect(env: Env, url: URL, auth: AuthContext): Promise<Response> {
  const facilityId = url.searchParams.get('facility_id') || '';
  if (!(await operatesFacility(env, auth.id, facilityId))) return err('Not permitted', 403);
  if (!configured(env)) return json({ demo: true, error: 'QuickBooks isn\'t enabled yet.' });

  const params = new URLSearchParams({
    client_id: env.QBO_CLIENT_ID!,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri(env),
    state: facilityId,
  });
  return json({ url: `${AUTH_URL}?${params.toString()}` });
}

/** GET /api/qbo/callback?code=&state=&realmId= (Intuit redirects here). */
export async function handleQboCallback(env: Env, url: URL): Promise<Response> {
  const code = url.searchParams.get('code');
  const facilityId = url.searchParams.get('state');
  const realmId = url.searchParams.get('realmId');
  const base = env.APP_URL || '';
  if (!code || !facilityId || !realmId || !configured(env)) {
    return Response.redirect(`${base}/operator/financials?qbo=error`, 302);
  }
  try {
    const tok = await exchange(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri(env) });
    await storeTokens(env, facilityId, realmId, tok);
    return Response.redirect(`${base}/operator/financials?qbo=connected`, 302);
  } catch (e) {
    console.error('[qbo:callback]', e);
    return Response.redirect(`${base}/operator/financials?qbo=error`, 302);
  }
}

/** GET /api/qbo/status?facility_id= -> { connected, realm_id } */
export async function handleQboStatus(env: Env, url: URL, auth: AuthContext): Promise<Response> {
  const facilityId = url.searchParams.get('facility_id') || '';
  if (!(await operatesFacility(env, auth.id, facilityId)) && auth.role !== 'admin') return err('Not permitted', 403);
  const f = await env.DB.prepare('SELECT qbo_realm_id FROM facilities WHERE id = ?').bind(facilityId).first<{ qbo_realm_id: string | null }>();
  return json({ connected: !!f?.qbo_realm_id, realm_id: f?.qbo_realm_id || null, available: configured(env) });
}

/** POST /api/qbo/disconnect { facility_id } */
export async function handleQboDisconnect(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id } = await readJson<{ facility_id?: string }>(req);
  if (!facility_id || !(await operatesFacility(env, auth.id, facility_id))) return err('Not permitted', 403);
  await env.DB.prepare('UPDATE facilities SET qbo_realm_id = NULL, qbo_access_token = NULL, qbo_refresh_token = NULL, qbo_token_expires_at = NULL, updated_at = ? WHERE id = ?')
    .bind(nowISO(), facility_id).run();
  return json({ ok: true });
}

/** POST /api/qbo/sync { facility_id, year } -> push the year's transactions as Sales Receipts. */
export async function handleQboSync(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id, year } = await readJson<{ facility_id?: string; year?: number }>(req);
  if (!facility_id || !(await operatesFacility(env, auth.id, facility_id))) return err('Not permitted', 403);

  const fac = await env.DB.prepare('SELECT * FROM facilities WHERE id = ?').bind(facility_id).first<Record<string, unknown>>();
  if (!fac?.qbo_realm_id) return err('Connect QuickBooks first', 400);

  const token = await ensureToken(env, fac);
  if (!token) return err('QuickBooks session expired — please reconnect.', 401);
  const realm = fac.qbo_realm_id as string;
  const yr = Number(year) || new Date().getFullYear();

  let itemId: string;
  try {
    itemId = await ensureRentalItem(env, realm, token);
  } catch (e) {
    return err(`Couldn't prepare a QuickBooks item: ${(e as Error).message}`, 502);
  }

  const txns = await transactionsForYear(env, facility_id, yr);
  let synced = 0;
  const errors: string[] = [];
  for (const t of txns) {
    try {
      await qboPost(env, realm, token, '/salesreceipt', {
        TxnDate: t.date.slice(0, 10),
        PrivateNote: `Sanctum: ${t.type} — ${t.description} (customer ${t.customer}; platform fee ${(t.fee / 100).toFixed(2)})`,
        Line: [{
          Amount: Number((t.gross / 100).toFixed(2)),
          DetailType: 'SalesItemLineDetail',
          Description: t.description.slice(0, 1000),
          SalesItemLineDetail: { ItemRef: { value: itemId } },
        }],
      });
      synced++;
    } catch (e) {
      errors.push((e as Error).message);
      if (errors.length > 5) break;
    }
  }
  return json({ ok: true, synced, total: txns.length, errors: errors.slice(0, 3) });
}

// ---- OAuth / tokens ----
async function exchange(env: Env, body: Record<string, string>): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const basic = btoa(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return res.json();
}

async function storeTokens(env: Env, facilityId: string, realmId: string, tok: { access_token: string; refresh_token: string; expires_in: number }): Promise<void> {
  const expires = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  await env.DB.prepare('UPDATE facilities SET qbo_realm_id = ?, qbo_access_token = ?, qbo_refresh_token = ?, qbo_token_expires_at = ?, updated_at = ? WHERE id = ?')
    .bind(realmId, tok.access_token, tok.refresh_token, expires, nowISO(), facilityId).run();
}

async function ensureToken(env: Env, fac: Record<string, unknown>): Promise<string | null> {
  const expires = fac.qbo_token_expires_at as string | null;
  if (fac.qbo_access_token && expires && new Date(expires).getTime() > Date.now()) {
    return fac.qbo_access_token as string;
  }
  if (!fac.qbo_refresh_token) return null;
  try {
    const tok = await exchange(env, { grant_type: 'refresh_token', refresh_token: fac.qbo_refresh_token as string });
    await storeTokens(env, fac.id as string, fac.qbo_realm_id as string, tok);
    return tok.access_token;
  } catch {
    return null;
  }
}

// ---- QBO API ----
async function qboGet(env: Env, realm: string, token: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBase(env)}/v3/company/${realm}${path}${path.includes('?') ? '&' : '?'}minorversion=70`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`qbo GET ${res.status}`);
  return res.json();
}
async function qboPost(env: Env, realm: string, token: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBase(env)}/v3/company/${realm}${path}?minorversion=70`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`qbo POST ${path} ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json();
}

/** Find a "Facility Rental" service item, creating it (with an income account) if needed. */
async function ensureRentalItem(env: Env, realm: string, token: string): Promise<string> {
  const q = await qboGet(env, realm, token, `/query?query=${encodeURIComponent("select * from Item where Name = 'Facility Rental'")}`);
  const existing = ((q.QueryResponse as Record<string, unknown>)?.Item as Array<{ Id: string }> | undefined)?.[0];
  if (existing) return existing.Id;

  const accountsQ = await qboGet(env, realm, token, `/query?query=${encodeURIComponent("select * from Account where AccountType = 'Income' maxresults 1")}`);
  const account = ((accountsQ.QueryResponse as Record<string, unknown>)?.Account as Array<{ Id: string }> | undefined)?.[0];
  if (!account) throw new Error('no income account found in QuickBooks');

  const created = await qboPost(env, realm, token, '/item', {
    Name: 'Facility Rental', Type: 'Service', IncomeAccountRef: { value: account.Id },
  });
  return (created.Item as { Id: string }).Id;
}

interface Txn { date: string; type: string; customer: string; description: string; gross: number; fee: number; }
async function transactionsForYear(env: Env, facilityId: string, year: number): Promise<Txn[]> {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const out: Txn[] = [];

  const bookings = (await env.DB.prepare(
    "SELECT * FROM bookings WHERE facility_id = ? AND status IN ('confirmed','completed')",
  ).bind(facilityId).all<Record<string, unknown>>()).results || [];
  for (const b of bookings) {
    const date = (b.balance_paid_at as string) || (b.start_time as string);
    if (date < start || date >= end) continue;
    const renter = await env.DB.prepare('SELECT full_name, organization_name FROM profiles WHERE id = ?').bind(b.renter_id).first<{ full_name: string | null; organization_name: string | null }>();
    out.push({
      date, type: 'Booking', customer: renter?.full_name || renter?.organization_name || 'Renter',
      description: String(b.event_name), gross: Number(b.subtotal_cents || 0), fee: Number(b.platform_fee_cents || 0),
    });
  }

  const invoices = (await env.DB.prepare(
    "SELECT * FROM invoices WHERE facility_id = ? AND booking_id IS NULL AND status IN ('paid','sent','overdue')",
  ).bind(facilityId).all<Record<string, unknown>>()).results || [];
  for (const inv of invoices) {
    const date = (inv.paid_at as string) || (inv.created_at as string);
    if (date < start || date >= end) continue;
    out.push({
      date, type: 'Tenant invoice', customer: 'Tenant',
      description: String(inv.invoice_number), gross: Number(inv.total_cents || 0),
      fee: Number(inv.platform_fee_cents || platformFeeCents(Number(inv.total_cents || 0))),
    });
  }
  return out;
}
