/**
 * Recurring-lease occurrence math. Pure, UTC-based, and shared by client + server
 * so the calendar, conflict checks, and billing all agree.
 */
import type { Lease } from './types.js';

export interface Occurrence {
  start: string; // ISO
  end: string; // ISO
}

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function atTime(day: Date, hhmm: string): string {
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h || 0, min || 0)).toISOString();
}

/** Weeks between two UTC dates (floored). */
function weeksBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (7 * 86400000));
}

/**
 * Occurrences of a lease that intersect [windowStart, windowEnd).
 * - weekly: every selected weekday, every week.
 * - biweekly: selected weekdays on alternating weeks (anchored to start_date's week).
 * - monthly: the start_date's day-of-month each month (weekdays ignored).
 */
export function leaseOccurrences(
  lease: Lease,
  windowStart: Date,
  windowEnd: Date,
): Occurrence[] {
  if (lease.status === 'ended') return [];
  const out: Occurrence[] = [];
  const start = parseYMD(lease.start_date);
  const end = lease.end_date ? parseYMD(lease.end_date) : null;

  const from = dateOnly(new Date(Math.max(windowStart.getTime(), start.getTime())));
  const toMs = Math.min(windowEnd.getTime(), end ? end.getTime() + 86400000 : windowEnd.getTime());
  if (from.getTime() >= toMs) return [];

  if (lease.cadence === 'monthly') {
    const dom = start.getUTCDate();
    const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (cur.getTime() < toMs) {
      const day = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), dom));
      if (day.getTime() >= start.getTime() && day.getTime() >= windowStart.getTime() && day.getTime() < toMs && (!end || day.getTime() <= end.getTime())) {
        out.push({ start: atTime(day, lease.start_time_local), end: atTime(day, lease.end_time_local) });
      }
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return out;
  }

  const weekdays = Array.isArray(lease.weekdays) ? lease.weekdays : [];
  const everyN = lease.cadence === 'biweekly' ? 2 : 1;
  for (let t = from.getTime(); t < toMs; t += 86400000) {
    const day = new Date(t);
    if (!weekdays.includes(day.getUTCDay())) continue;
    if (everyN === 2 && weeksBetween(start, day) % 2 !== 0) continue;
    if (day.getTime() < start.getTime()) continue;
    if (end && day.getTime() > end.getTime()) continue;
    out.push({ start: atTime(day, lease.start_time_local), end: atTime(day, lease.end_time_local) });
  }
  return out;
}

/** Does a [start,end) interval overlap any occurrence of an active lease? */
export function leaseConflicts(lease: Lease, start: string, end: string): boolean {
  if (lease.status !== 'active') return false;
  const s = new Date(start);
  const e = new Date(end);
  // Look a day on either side so a time range spanning midnight is caught.
  const occ = leaseOccurrences(lease, new Date(s.getTime() - 86400000), new Date(e.getTime() + 86400000));
  return occ.some((o) => new Date(o.start).getTime() < e.getTime() && new Date(o.end).getTime() > s.getTime());
}

/** Count billable sessions in a month (UTC year/month). */
export function leaseSessionsInMonth(lease: Lease, year: number, month: number): number {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return leaseOccurrences(lease, start, end).length;
}

/** Amount to invoice for a given month, in cents. */
export function leaseMonthlyAmountCents(lease: Lease, year: number, month: number): number {
  if (lease.rate_period === 'month') return lease.rate_cents;
  return lease.rate_cents * leaseSessionsInMonth(lease, year, month);
}
