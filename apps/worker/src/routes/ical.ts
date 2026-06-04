/**
 * Two-way calendar sync (no third party — iCal is a standard).
 *  - Export: a token-gated .ics feed the operator subscribes to in Google/Outlook.
 *  - Import: fetch the church's own calendar and block those times so a rental can
 *    never collide with the church's own events.
 */
import { leaseOccurrences, type Lease } from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';
import { operatesFacility } from '../db.js';

function b64urlToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseWeekdays(v: unknown): number[] {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
}

/** GET /api/ical/subscribe-url?facility_id= — returns (and lazily creates) the feed URL. */
export async function handleSubscribeUrl(env: Env, url: URL, auth: AuthContext): Promise<Response> {
  const facilityId = url.searchParams.get('facility_id') || '';
  if (!(await operatesFacility(env, auth.id, facilityId))) return err('Not permitted', 403);
  let row = await env.DB.prepare('SELECT ical_token FROM facilities WHERE id = ?').bind(facilityId).first<{ ical_token: string | null }>();
  let token = row?.ical_token || null;
  if (!token) {
    token = b64urlToken();
    await env.DB.prepare('UPDATE facilities SET ical_token = ?, updated_at = ? WHERE id = ?').bind(token, nowISO(), facilityId).run();
  }
  return json({ url: `${env.APP_URL || ''}/api/ical/${token}.ics` });
}

function icsEscape(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** GET /api/ical/:token.ics — the outbound feed (bookings + recurring tenants). */
export async function handleIcalExport(env: Env, token: string): Promise<Response> {
  const facility = await env.DB.prepare('SELECT id, name FROM facilities WHERE ical_token = ?')
    .bind(token).first<{ id: string; name: string }>();
  if (!facility) return new Response('Not found', { status: 404 });

  const now = Date.now();
  const horizon = new Date(now + 180 * 86400000);
  const bookings = (await env.DB.prepare(
    "SELECT id, event_name, start_time, end_time FROM bookings WHERE facility_id = ? AND status IN ('approved','confirmed','completed') AND end_time >= ?",
  ).bind(facility.id, new Date(now - 86400000).toISOString()).all<Record<string, unknown>>()).results || [];

  const leaseRows = (await env.DB.prepare("SELECT * FROM leases WHERE facility_id = ? AND status = 'active'").bind(facility.id).all<Record<string, unknown>>()).results || [];

  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sanctum//EN', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(facility.name)} — Sanctum`,
  ];
  const stamp = toIcsDate(nowISO());

  for (const b of bookings) {
    lines.push('BEGIN:VEVENT', `UID:${b.id}@sanctum.garden`, `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsDate(b.start_time as string)}`, `DTEND:${toIcsDate(b.end_time as string)}`,
      `SUMMARY:${icsEscape(b.event_name as string)}`, 'END:VEVENT');
  }
  for (const lr of leaseRows) {
    const lease = { ...lr, weekdays: parseWeekdays(lr.weekdays) } as unknown as Lease;
    for (const o of leaseOccurrences(lease, new Date(now), horizon)) {
      lines.push('BEGIN:VEVENT', `UID:${lease.id}-${toIcsDate(o.start)}@sanctum.garden`, `DTSTAMP:${stamp}`,
        `DTSTART:${toIcsDate(o.start)}`, `DTEND:${toIcsDate(o.end)}`,
        `SUMMARY:${icsEscape(lease.title)} (recurring)`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
  });
}

/** Minimal iCal parser: unfold, split VEVENTs, pull DTSTART/DTEND/SUMMARY. */
interface ParsedEvent { start: string; end: string; summary: string }
export function parseICS(text: string): ParsedEvent[] {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n/);
  const events: ParsedEvent[] = [];
  let cur: Partial<ParsedEvent> & { _start?: string; _end?: string } | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur?._start) {
        const start = parseIcsDate(cur._start);
        if (start) {
          const end = cur._end ? parseIcsDate(cur._end) : null;
          events.push({
            start,
            end: end || new Date(new Date(start).getTime() + 3600000).toISOString(),
            summary: cur.summary || 'Busy',
          });
        }
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx);
      const val = line.slice(idx + 1);
      const name = key.split(';')[0].toUpperCase();
      if (name === 'DTSTART') cur._start = val;
      else if (name === 'DTEND') cur._end = val;
      else if (name === 'SUMMARY') cur.summary = val.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').replace(/\\\\/g, '\\');
    }
  }
  return events;
}

function parseIcsDate(v: string): string | null {
  const s = v.trim();
  // All-day: YYYYMMDD
  const allDay = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (allDay) return new Date(Date.UTC(+allDay[1], +allDay[2] - 1, +allDay[3])).toISOString();
  // Date-time: YYYYMMDDTHHMMSS(Z)?
  const dt = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dt) return new Date(Date.UTC(+dt[1], +dt[2] - 1, +dt[3], +dt[4], +dt[5], +dt[6])).toISOString();
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Re-import a facility's external calendar into availability_blocks (source='ical'). */
export async function syncFacilityCalendar(env: Env, facilityId: string): Promise<number> {
  const facility = await env.DB.prepare('SELECT external_ical_url FROM facilities WHERE id = ?')
    .bind(facilityId).first<{ external_ical_url: string | null }>();
  if (!facility?.external_ical_url) return 0;

  let text: string;
  try {
    const res = await fetch(facility.external_ical_url, { headers: { Accept: 'text/calendar' } });
    if (!res.ok) return 0;
    text = await res.text();
  } catch {
    return 0;
  }
  const now = Date.now();
  const horizon = now + 180 * 86400000;
  const events = parseICS(text).filter((e) => {
    const end = new Date(e.end).getTime();
    const start = new Date(e.start).getTime();
    return end >= now && start <= horizon;
  });

  const spaces = (await env.DB.prepare('SELECT id FROM spaces WHERE facility_id = ? AND is_active = 1').bind(facilityId).all<{ id: string }>()).results || [];
  // Replace previously-imported blocks for this facility.
  await env.DB.prepare("DELETE FROM availability_blocks WHERE facility_id = ? AND source = 'ical'").bind(facilityId).run();

  const ts = nowISO();
  const stmts: D1PreparedStatement[] = [];
  for (const e of events) {
    for (const sp of spaces) {
      stmts.push(env.DB.prepare(
        `INSERT INTO availability_blocks (id, space_id, facility_id, start_time, end_time, reason, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ical', ?, ?)`,
      ).bind(genId('blk'), sp.id, facilityId, e.start, e.end, (e.summary || 'Church event').slice(0, 120), ts, ts));
    }
  }
  // D1 batch has a statement limit; chunk to be safe.
  for (let i = 0; i < stmts.length; i += 50) {
    await env.DB.batch(stmts.slice(i, i + 50));
  }
  return events.length;
}

/** POST /api/ical/import { facility_id, url } — save the feed URL and sync now. */
export async function handleIcalImport(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id, url } = await readJson<{ facility_id?: string; url?: string }>(req);
  if (!facility_id) return err('facility_id is required', 422);
  if (!(await operatesFacility(env, auth.id, facility_id))) return err('Not permitted', 403);

  const feed = (url || '').trim();
  if (feed && !/^https?:\/\//i.test(feed) && !/^webcal:\/\//i.test(feed)) {
    return err('Enter a valid calendar URL (https:// or webcal://)', 422);
  }
  const normalized = feed.replace(/^webcal:\/\//i, 'https://');
  await env.DB.prepare('UPDATE facilities SET external_ical_url = ?, updated_at = ? WHERE id = ?')
    .bind(normalized || null, nowISO(), facility_id).run();

  if (!normalized) {
    await env.DB.prepare("DELETE FROM availability_blocks WHERE facility_id = ? AND source = 'ical'").bind(facility_id).run();
    return json({ ok: true, imported: 0, cleared: true });
  }
  const imported = await syncFacilityCalendar(env, facility_id);
  return json({ ok: true, imported });
}
