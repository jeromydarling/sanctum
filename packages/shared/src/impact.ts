/**
 * "Community impact" — the good an operator is doing, computed from their
 * realized (confirmed/completed) bookings. Pure and deterministic so it can run
 * both in the operator dashboard and in the monthly recap email. This is a
 * retention surface: reminding a community of the doors they've opened is the
 * most honest reason to stay.
 */
import type { Booking } from './types.js';

export interface Impact {
  eventsHosted: number;
  neighborsWelcomed: number;
  hoursOpen: number;
  earnedCents: number;
  givenHours: number; // hours hosted at no charge (free / $0 donation)
  groups: number; // distinct renters welcomed
}

const REALIZED = new Set(['confirmed', 'completed']);

/** Aggregate impact over the given bookings, optionally since an ISO date. */
export function computeImpact(bookings: Booking[], sinceISO?: string): Impact {
  const since = sinceISO ? new Date(sinceISO).getTime() : -Infinity;
  const groups = new Set<string>();
  const acc: Impact = { eventsHosted: 0, neighborsWelcomed: 0, hoursOpen: 0, earnedCents: 0, givenHours: 0, groups: 0 };

  for (const b of bookings) {
    if (!REALIZED.has(b.status)) continue;
    if (new Date(b.start_time).getTime() < since) continue;
    const hours = Math.max(0, (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3_600_000);
    acc.eventsHosted += 1;
    acc.neighborsWelcomed += Number(b.expected_attendance || 0);
    acc.hoursOpen += hours;
    acc.earnedCents += Number(b.subtotal_cents || 0);
    if (Number(b.subtotal_cents || 0) === 0) acc.givenHours += hours;
    if (b.renter_id) groups.add(b.renter_id);
  }
  acc.hoursOpen = Math.round(acc.hoursOpen);
  acc.givenHours = Math.round(acc.givenHours);
  acc.groups = groups.size;
  return acc;
}

/** ISO timestamp for the first day of the current month (UTC). */
export function startOfMonthISO(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
