/**
 * Operator announcements — a one-to-many alert an operator sends to their active
 * tenants and/or renters with upcoming bookings. Each recipient gets an in-app
 * notification (if they have an account) plus an email.
 *
 * Fan-out is queued, not synchronous: the request resolves recipients and writes
 * one `announcement_deliveries` row each, then returns immediately. A 1-minute
 * cron drains the queue in the background (with retries), so a facility with
 * hundreds of tenants never blocks the request or hits per-invocation limits.
 */
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';
import { operatesFacility } from '../db.js';
import { sendEmail, emailLayout } from '../email/index.js';

type Audience = 'tenants' | 'renters' | 'all';
interface Recipient { userId: string | null; email: string | null }

const DRAIN_BATCH = 90; // stay well under the per-invocation subrequest budget
const MAX_ATTEMPTS = 5;
const DEFAULT_PURGE_TOKEN = 'sanctum-e2e-purge';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Collect deduped recipients for the chosen audience. */
async function collectRecipients(env: Env, facilityId: string, audience: Audience): Promise<Recipient[]> {
  const out = new Map<string, Recipient>();
  const add = (key: string, r: Recipient) => { if (key && !out.has(key)) out.set(key, r); };

  if (audience === 'tenants' || audience === 'all') {
    const leases = (await env.DB.prepare(
      "SELECT renter_id, tenant_email FROM leases WHERE facility_id = ? AND status = 'active'",
    ).bind(facilityId).all<{ renter_id: string | null; tenant_email: string | null }>()).results || [];
    for (const l of leases) {
      if (l.renter_id) {
        const p = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?').bind(l.renter_id).first<{ email: string | null }>();
        add(`u:${l.renter_id}`, { userId: l.renter_id, email: p?.email || l.tenant_email || null });
      } else if (l.tenant_email) {
        add(`e:${l.tenant_email.toLowerCase()}`, { userId: null, email: l.tenant_email });
      }
    }
  }
  if (audience === 'renters' || audience === 'all') {
    const now = nowISO();
    const rows = (await env.DB.prepare(
      "SELECT DISTINCT renter_id FROM bookings WHERE facility_id = ? AND status IN ('approved','confirmed') AND start_time >= ?",
    ).bind(facilityId, now).all<{ renter_id: string }>()).results || [];
    for (const r of rows) {
      const p = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?').bind(r.renter_id).first<{ email: string | null }>();
      add(`u:${r.renter_id}`, { userId: r.renter_id, email: p?.email || null });
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
  const ts = nowISO();
  const announcementId = genId('anc');

  await env.DB.prepare(
    `INSERT INTO announcements (id, facility_id, title, body, audience, recipient_count, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(announcementId, b.facility_id, title, bodyText || null, audience, rcpts.length, auth.id, ts).run();

  // Enqueue one delivery per recipient — fast inserts, no sends in the request.
  for (const r of rcpts) {
    await env.DB.prepare(
      `INSERT INTO announcement_deliveries (id, announcement_id, user_id, email, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
    ).bind(genId('del'), announcementId, r.userId, r.email, ts).run();
  }

  return json({ ok: true, recipients: rcpts.length, queued: rcpts.length });
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

/**
 * Drain a batch of pending deliveries: notification + email each, mark sent.
 * Runs from the 1-minute cron (and the daily sweep as a backstop). Returns the
 * number processed. Failures retry up to MAX_ATTEMPTS, then park as 'failed'.
 */
export async function drainAnnouncementQueue(env: Env): Promise<number> {
  const rows = (await env.DB.prepare(
    "SELECT * FROM announcement_deliveries WHERE status = 'pending' ORDER BY created_at LIMIT ?",
  ).bind(DRAIN_BATCH).all<Record<string, unknown>>()).results || [];
  if (!rows.length) return 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annCache = new Map<string, { title: string; body: string | null; facility_name: string } | null>();
  let processed = 0;

  for (const d of rows) {
    const annId = d.announcement_id as string;
    try {
      if (!annCache.has(annId)) {
        annCache.set(annId, await env.DB.prepare(
          `SELECT a.title, a.body, f.name AS facility_name
             FROM announcements a JOIN facilities f ON f.id = a.facility_id WHERE a.id = ?`,
        ).bind(annId).first<{ title: string; body: string | null; facility_name: string }>());
      }
      const ann = annCache.get(annId);
      if (!ann) { // orphaned delivery — nothing to send
        await env.DB.prepare("UPDATE announcement_deliveries SET status = 'failed' WHERE id = ?").bind(d.id).run();
        continue;
      }
      const title = ann.title;
      const bodyText = ann.body || '';
      const facName = ann.facility_name || 'your space';

      if (d.user_id) {
        const ts = nowISO();
        await env.DB.prepare(
          `INSERT INTO notifications (id, user_id, title, body, type, is_read, action_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'announcement', 0, NULL, ?, ?)`,
        ).bind(genId('ntf'), d.user_id, title, bodyText || null, ts, ts).run();
      }
      if (d.email) {
        await sendEmail(env, {
          to: d.email as string,
          subject: `${facName}: ${title}`,
          html: emailLayout(title, `<p style="white-space:pre-wrap">${escapeHtml(bodyText)}</p><p style="color:#8a8a8a;font-size:13px;margin-top:20px">— ${escapeHtml(facName)}</p>`),
        });
      }
      await env.DB.prepare("UPDATE announcement_deliveries SET status = 'sent', attempts = attempts + 1 WHERE id = ?").bind(d.id).run();
      processed++;
    } catch (e) {
      console.error('[announce:drain]', d.id, e);
      const attempts = Number(d.attempts || 0) + 1;
      await env.DB.prepare('UPDATE announcement_deliveries SET status = ?, attempts = ? WHERE id = ?')
        .bind(attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', attempts, d.id).run();
    }
  }
  return processed;
}

/**
 * POST /api/admin/test/drain-announcements?token=...
 * Token-guarded manual flush of the announcement queue — lets the E2E rig (and
 * an operator in a pinch) process pending deliveries on demand instead of
 * waiting for the cron. Awaits the drain so the response reflects the result.
 */
export async function handleDrainAnnouncements(env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get('token') || '';
  if (token !== (env.E2E_ADMIN_TOKEN || DEFAULT_PURGE_TOKEN)) return err('Forbidden', 403);
  const processed = await drainAnnouncementQueue(env);
  return json({ ok: true, processed });
}
