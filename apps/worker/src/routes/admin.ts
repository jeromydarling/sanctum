/** Admin-only endpoints. */
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';
import { sendEmail, emailLayout } from '../email/index.js';

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

/**
 * POST /api/admin/message { user_id, title, body, email? } — reach ONE customer
 * from the admin CRM: an in-app notification plus (optionally) an email.
 */
export async function handleAdminMessage(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  if (auth.role !== 'admin') return err('Admins only', 403);
  const b = await readJson<{ user_id?: string; title?: string; body?: string; email?: boolean }>(req);
  if (!b.user_id) return err('A recipient is required', 422);
  if (!b.title?.trim()) return err('A message title is required', 422);

  const profile = await env.DB.prepare('SELECT id, email FROM profiles WHERE id = ?')
    .bind(b.user_id).first<{ id: string; email: string }>();
  if (!profile) return err('Recipient not found', 404);

  const ts = nowISO();
  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, is_read, action_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'announcement', 0, NULL, ?, ?)`,
  ).bind(genId('ntf'), profile.id, b.title.trim(), b.body || null, ts, ts).run();

  let emailed = false;
  if (b.email && profile.email) {
    const res = await sendEmail(env, {
      to: profile.email,
      subject: b.title.trim(),
      html: emailLayout(b.title.trim(), `<p>${(b.body || '').replace(/[<>]/g, '')}</p>`, { label: 'Open Sanctum', url: `${env.APP_URL || ''}/operator` }),
    });
    emailed = res.sent;
  }
  return json({ ok: true, emailed });
}
