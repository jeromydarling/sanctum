/** Telemetry sink + GDPR account export/delete. */
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';

export async function handleTelemetry(env: Env, req: Request): Promise<Response> {
  const b = await readJson<{ message?: string; stack?: string; url?: string; user_id?: string }>(req);
  const incidentId = genId('inc');
  try {
    await env.DB.prepare(
      `INSERT INTO error_logs (id, incident_id, user_id, source, message, stack, url, created_at)
       VALUES (?, ?, ?, 'client', ?, ?, ?, ?)`,
    )
      .bind(genId('err'), incidentId, b.user_id || null, (b.message || '').slice(0, 2000), (b.stack || '').slice(0, 4000), b.url || null, nowISO())
      .run();
  } catch (e) {
    console.error('[telemetry]', e);
  }
  console.error(`[client-error] ${incidentId}: ${b.message}`);
  return json({ ok: true, incident_id: incidentId });
}

const USER_OWNED_TABLES: { table: string; col: string }[] = [
  { table: 'bookings', col: 'renter_id' },
  { table: 'compliance_docs', col: 'renter_id' },
  { table: 'invoices', col: 'renter_id' },
  { table: 'reviews', col: 'renter_id' },
  { table: 'event_microsites', col: 'renter_id' },
  { table: 'notifications', col: 'user_id' },
];

export async function handleExport(env: Env, auth: AuthContext): Promise<Response> {
  const data: Record<string, unknown> = {};
  data.profile = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(auth.id).first();
  data.facilities = (await env.DB.prepare('SELECT * FROM facilities WHERE operator_id = ?').bind(auth.id).all()).results;
  for (const { table, col } of USER_OWNED_TABLES) {
    data[table] = (await env.DB.prepare(`SELECT * FROM ${table} WHERE ${col} = ?`).bind(auth.id).all()).results;
  }
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="sanctum-export-${auth.id}.json"`,
    },
  });
}

// Every table scoped to a facility — erased when that facility's owner is removed.
const FACILITY_CHILD_TABLES = [
  'spaces', 'resources', 'reviews', 'leads', 'compliance_docs', 'bookings',
  'invoices', 'event_microsites', 'pricing_rules', 'availability_blocks',
  'leases', 'crm_interactions', 'billing_runs',
  // NOTE: tenant_interactions was dropped in migration 0014 — do not reference it.
];
// Tables scoped directly to a user id (beyond USER_OWNED_TABLES above).
const USER_SCOPED_TABLES: { table: string; col: string }[] = [
  { table: 'password_resets', col: 'user_id' },
  { table: 'email_verifications', col: 'user_id' },
  { table: 'ai_usage', col: 'user_id' },
];

/**
 * Erase a user and EVERY row that hangs off them — their facilities' children,
 * their owned networks, their personal records, and finally their identity.
 * Shared by the self-serve account-delete and the E2E purge endpoint.
 */
export async function eraseUser(env: Env, userId: string): Promise<void> {
  const facs = (await env.DB.prepare('SELECT id FROM facilities WHERE operator_id = ?').bind(userId).all<{ id: string }>()).results || [];
  const nets = (await env.DB.prepare('SELECT id FROM networks WHERE owner_id = ?').bind(userId).all<{ id: string }>()).results || [];
  const stmts: D1PreparedStatement[] = [];

  for (const { table, col } of [...USER_OWNED_TABLES, ...USER_SCOPED_TABLES]) {
    stmts.push(env.DB.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).bind(userId));
  }
  for (const f of facs) {
    for (const t of FACILITY_CHILD_TABLES) {
      stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE facility_id = ?`).bind(f.id));
    }
  }
  for (const n of nets) {
    stmts.push(env.DB.prepare('DELETE FROM network_invites WHERE network_id = ?').bind(n.id));
    // Detach any member facilities (owned by others) so nothing dangles.
    stmts.push(env.DB.prepare('UPDATE facilities SET network_id = NULL WHERE network_id = ?').bind(n.id));
  }
  stmts.push(env.DB.prepare('DELETE FROM networks WHERE owner_id = ?').bind(userId));
  stmts.push(env.DB.prepare('DELETE FROM facilities WHERE operator_id = ?').bind(userId));
  stmts.push(env.DB.prepare('DELETE FROM auth_credentials WHERE user_id = ?').bind(userId));
  stmts.push(env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(userId));
  await env.DB.batch(stmts);
}

export async function handleDeleteAccount(env: Env, auth: AuthContext): Promise<Response> {
  await eraseUser(env, auth.id);
  return json({ ok: true });
}

/** Low-value default guard for the purge endpoint (NOT a credential — the real
 * protection is the hard e2e+ email restriction below). Override via secret. */
const DEFAULT_PURGE_TOKEN = 'sanctum-e2e-purge';
/** Only throwaway test accounts may EVER be purged, token or not. */
const E2E_EMAIL_RE = /^e2e\+/i;

/**
 * POST /api/admin/purge-user?token=...&email=...
 * Token-guarded teardown for the E2E rig. Deletes the user + ALL child rows.
 * Doubly safe on a public repo: restricted to e2e+* emails, so it can never
 * erase a real account even if the guard token is known.
 */
export async function handlePurgeUser(env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get('token') || '';
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const expected = env.E2E_ADMIN_TOKEN || DEFAULT_PURGE_TOKEN;
  if (token !== expected) return err('Forbidden', 403);
  if (!E2E_EMAIL_RE.test(email)) return err('Purge is restricted to e2e+ test accounts', 422);

  const cred = await env.DB.prepare('SELECT user_id FROM auth_credentials WHERE email = ?')
    .bind(email).first<{ user_id: string }>();
  const prof = cred
    ? null
    : await env.DB.prepare('SELECT id AS user_id FROM profiles WHERE email = ?').bind(email).first<{ user_id: string }>();
  const userId = cred?.user_id || prof?.user_id;
  if (!userId) return json({ ok: true, purged: false, reason: 'no such account' });

  await eraseUser(env, userId);
  return json({ ok: true, purged: true, user_id: userId });
}

/**
 * GET /api/admin/test/emails?token=...&to=...
 * Token-guarded read of the outbound-email log so the E2E rig can assert the
 * email pipeline fired. Restricted to e2e+* recipients — never exposes a real
 * person's email metadata.
 */
export async function handleTestEmails(env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get('token') || '';
  const to = (url.searchParams.get('to') || '').trim().toLowerCase();
  if (token !== (env.E2E_ADMIN_TOKEN || DEFAULT_PURGE_TOKEN)) return err('Forbidden', 403);
  if (!E2E_EMAIL_RE.test(to)) return err('Restricted to e2e+ test recipients', 422);
  const rows = (await env.DB.prepare(
    'SELECT subject, sent, created_at FROM email_log WHERE to_addr = ? ORDER BY created_at DESC LIMIT 20',
  ).bind(to).all<Record<string, unknown>>()).results || [];
  return json({ emails: rows });
}
