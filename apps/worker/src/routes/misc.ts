/** Telemetry sink + GDPR account export/delete. */
import type { Env, AuthContext } from '../types.js';
import { json, readJson, genId, nowISO } from '../http.js';

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

export async function handleDeleteAccount(env: Env, auth: AuthContext): Promise<Response> {
  // Erase every row the user owns, then their facilities' children, then identity.
  const facs = (await env.DB.prepare('SELECT id FROM facilities WHERE operator_id = ?').bind(auth.id).all<{ id: string }>()).results || [];
  const stmts: D1PreparedStatement[] = [];
  for (const { table, col } of USER_OWNED_TABLES) {
    stmts.push(env.DB.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).bind(auth.id));
  }
  for (const f of facs) {
    for (const t of ['spaces', 'resources', 'reviews', 'leads', 'compliance_docs', 'bookings', 'invoices', 'event_microsites']) {
      stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE facility_id = ?`).bind(f.id));
    }
  }
  stmts.push(env.DB.prepare('DELETE FROM facilities WHERE operator_id = ?').bind(auth.id));
  stmts.push(env.DB.prepare('DELETE FROM auth_credentials WHERE user_id = ?').bind(auth.id));
  stmts.push(env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(auth.id));
  await env.DB.batch(stmts);
  return json({ ok: true });
}
