/**
 * Operator announcements — a one-to-many alert an operator sends to their active
 * tenants and/or renters with upcoming bookings. Each recipient gets an in-app
 * notification (if they have an account) plus an email. Recorded for history.
 */
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';
import { operatesFacility } from '../db.js';
import { sendEmail, emailLayout } from '../email/index.js';

type Audience = 'tenants' | 'renters' | 'all';
interface Recipient { userId: string | null; email: string | null; name: string | null }

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Collect deduped recipients for the chosen audience. */
async function collectRecipients(env: Env, facilityId: string, audience: Audience): Promise<Recipient[]> {
  const out = new Map<string, Recipient>();
  const add = (key: string, r: Recipient) => { if (key && !out.has(key)) out.set(key, r); };

  if (audience === 'tenants' || audience === 'all') {
    const leases = (await env.DB.prepare(
      "SELECT renter_id, tenant_email, tenant_name FROM leases WHERE facility_id = ? AND status = 'active'",
    ).bind(facilityId).all<{ renter_id: string | null; tenant_email: string | null; tenant_name: string | null }>()).results || [];
    for (const l of leases) {
      if (l.renter_id) {
        const p = await env.DB.prepare('SELECT email, full_name FROM profiles WHERE id = ?').bind(l.renter_id).first<{ email: string | null; full_name: string | null }>();
        add(`u:${l.renter_id}`, { userId: l.renter_id, email: p?.email || l.tenant_email || null, name: p?.full_name || l.tenant_name || null });
      } else if (l.tenant_email) {
        add(`e:${l.tenant_email.toLowerCase()}`, { userId: null, email: l.tenant_email, name: l.tenant_name || null });
      }
    }
  }
  if (audience === 'renters' || audience === 'all') {
    const now = nowISO();
    const rows = (await env.DB.prepare(
      "SELECT DISTINCT renter_id FROM bookings WHERE facility_id = ? AND status IN ('approved','confirmed') AND start_time >= ?",
    ).bind(facilityId, now).all<{ renter_id: string }>()).results || [];
    for (const r of rows) {
      const p = await env.DB.prepare('SELECT email, full_name FROM profiles WHERE id = ?').bind(r.renter_id).first<{ email: string | null; full_name: string | null }>();
      add(`u:${r.renter_id}`, { userId: r.renter_id, email: p?.email || null, name: p?.full_name || null });
    }
  }
  return [...out.values()];
}

/** POST /api/operator/announce { facility_id, title, body, audience } */
export async function handleAnnounce(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const b = await readJson<{ facility_id?: string; title?: string; body?: string; audience?: Audience }>(req);
  if (!b.facility_id || !(await operatesFacility(env, auth.id, b.facility_id))) return err('Not permitted', 403);
  const title = (b.title || '').trim();
  if (!title) return err('A subject is required', 422);
  const audience: Audience = b.audience === 'tenants' || b.audience === 'renters' ? b.audience : 'all';
  const bodyText = (b.body || '').trim();

  const rcpts = await collectRecipients(env, b.facility_id, audience);
  const fac = await env.DB.prepare('SELECT name FROM facilities WHERE id = ?').bind(b.facility_id).first<{ name: string }>();
  const facName = fac?.name || 'your space';
  const ts = nowISO();
  const bodyHtml = `<p style="white-space:pre-wrap">${escapeHtml(bodyText)}</p>`;

  let emailed = 0;
  for (const r of rcpts) {
    if (r.userId) {
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, is_read, action_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'announcement', 0, NULL, ?, ?)`,
      ).bind(genId('ntf'), r.userId, title, bodyText || null, ts, ts).run();
    }
    if (r.email) {
      const res = await sendEmail(env, {
        to: r.email,
        subject: `${facName}: ${title}`,
        html: emailLayout(title, `${bodyHtml}<p style="color:#8a8a8a;font-size:13px;margin-top:20px">— ${escapeHtml(facName)}</p>`),
      });
      if (res.sent) emailed++;
    }
  }

  await env.DB.prepare(
    `INSERT INTO announcements (id, facility_id, title, body, audience, recipient_count, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(genId('anc'), b.facility_id, title, bodyText || null, audience, rcpts.length, auth.id, ts).run();

  return json({ ok: true, recipients: rcpts.length, emailed });
}

/** GET /api/operator/announcements?facility_id= — recent sent history. */
export async function handleAnnouncementHistory(env: Env, url: URL, auth: AuthContext): Promise<Response> {
  const facilityId = url.searchParams.get('facility_id') || '';
  if (!(await operatesFacility(env, auth.id, facilityId)) && auth.role !== 'admin') return err('Not permitted', 403);
  const rows = (await env.DB.prepare(
    'SELECT id, title, body, audience, recipient_count, created_at FROM announcements WHERE facility_id = ? ORDER BY created_at DESC LIMIT 50',
  ).bind(facilityId).all<Record<string, unknown>>()).results || [];
  return json({ announcements: rows });
}
