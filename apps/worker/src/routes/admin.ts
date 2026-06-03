/** Admin-only endpoints. */
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';

export async function handleAdminErrors(env: Env, auth: AuthContext): Promise<Response> {
  if (auth.role !== 'admin') return err('Admins only', 403);
  const res = await env.DB.prepare(
    'SELECT id, incident_id, source, message, url, created_at FROM error_logs ORDER BY created_at DESC LIMIT 100',
  ).all<Record<string, unknown>>();
  return json({ errors: res.results || [] });
}

/** POST /api/admin/announce { title, body } — broadcast to every facility operator. */
export async function handleAdminAnnounce(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  if (auth.role !== 'admin') return err('Admins only', 403);
  const b = await readJson<{ title?: string; body?: string }>(req);
  if (!b.title?.trim()) return err('A title is required', 422);

  const operators = (await env.DB.prepare("SELECT id FROM profiles WHERE role IN ('operator','staff')").all<{ id: string }>()).results || [];
  const ts = nowISO();
  if (operators.length) {
    const stmts = operators.map((o) =>
      env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, is_read, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'announcement', 0, ?, ?)`,
      ).bind(genId('ntf'), o.id, b.title!.trim(), b.body || null, ts, ts),
    );
    await env.DB.batch(stmts);
  }
  return json({ ok: true, recipients: operators.length });
}
