import { describe, it, expect } from 'vitest';
import { leaseOccurrences, leaseConflicts, leaseSessionsInMonth, leaseMonthlyAmountCents } from './lease.js';
import type { Lease } from './types.js';

function lease(partial: Partial<Lease>): Lease {
  return {
    id: 'l1', facility_id: 'f1', space_id: 's1', renter_id: null, title: 'Test',
    tenant_name: null, tenant_email: null, cadence: 'weekly', weekdays: [1],
    start_time_local: '09:00', end_time_local: '11:00', start_date: '2026-01-01',
    end_date: null, rate_cents: 10000, rate_period: 'month', status: 'active',
    notes: null, created_at: '', updated_at: '', ...partial,
  };
}

describe('leaseOccurrences', () => {
  it('emits weekly occurrences on the chosen weekday', () => {
    const l = lease({ weekdays: [1], start_date: '2026-06-01' }); // Mondays
    const occ = leaseOccurrences(l, new Date('2026-06-01T00:00:00Z'), new Date('2026-07-01T00:00:00Z'));
    // June 2026 Mondays: 1, 8, 15, 22, 29 => 5
    expect(occ.length).toBe(5);
    expect(occ[0].start).toBe('2026-06-01T09:00:00.000Z');
    expect(occ[0].end).toBe('2026-06-01T11:00:00.000Z');
  });

  it('handles multi-day weekly (Mon–Fri daycare)', () => {
    const l = lease({ weekdays: [1, 2, 3, 4, 5], start_date: '2026-06-01' });
    const occ = leaseOccurrences(l, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-08T00:00:00Z'));
    expect(occ.length).toBe(5); // Mon-Fri of the first week
  });

  it('respects biweekly cadence', () => {
    const l = lease({ cadence: 'biweekly', weekdays: [1], start_date: '2026-06-01' });
    const occ = leaseOccurrences(l, new Date('2026-06-01T00:00:00Z'), new Date('2026-07-01T00:00:00Z'));
    // Every other Monday from Jun 1: 1, 15, 29 => 3
    expect(occ.length).toBe(3);
  });

  it('respects an end date', () => {
    const l = lease({ weekdays: [1], start_date: '2026-06-01', end_date: '2026-06-15' });
    const occ = leaseOccurrences(l, new Date('2026-06-01T00:00:00Z'), new Date('2026-07-01T00:00:00Z'));
    expect(occ.length).toBe(3); // 1, 8, 15
  });

  it('emits nothing for an ended lease', () => {
    const l = lease({ status: 'ended' });
    expect(leaseOccurrences(l, new Date('2026-06-01Z'), new Date('2026-07-01Z')).length).toBe(0);
  });

  it('monthly cadence repeats the start day-of-month', () => {
    const l = lease({ cadence: 'monthly', start_date: '2026-01-10', weekdays: [] });
    const occ = leaseOccurrences(l, new Date('2026-06-01T00:00:00Z'), new Date('2026-09-01T00:00:00Z'));
    expect(occ.map((o) => o.start.slice(0, 10))).toEqual(['2026-06-10', '2026-07-10', '2026-08-10']);
  });
});

describe('leaseConflicts', () => {
  const l = lease({ weekdays: [1], start_time_local: '18:00', end_time_local: '20:00', start_date: '2026-06-01' });
  it('flags an overlapping booking on the lease day', () => {
    expect(leaseConflicts(l, '2026-06-08T19:00:00.000Z', '2026-06-08T21:00:00.000Z')).toBe(true);
  });
  it('allows a non-overlapping time on the same day', () => {
    expect(leaseConflicts(l, '2026-06-08T08:00:00.000Z', '2026-06-08T10:00:00.000Z')).toBe(false);
  });
  it('allows a different weekday', () => {
    expect(leaseConflicts(l, '2026-06-09T19:00:00.000Z', '2026-06-09T20:00:00.000Z')).toBe(false);
  });
  it('ignores paused leases', () => {
    expect(leaseConflicts(lease({ ...l, status: 'paused' }), '2026-06-08T19:00:00.000Z', '2026-06-08T20:00:00.000Z')).toBe(false);
  });
});

describe('lease billing', () => {
  it('per-session bills by number of sessions in the month', () => {
    const l = lease({ rate_period: 'session', rate_cents: 4000, weekdays: [2], start_date: '2026-01-01' });
    // June 2026 Tuesdays: 2, 9, 16, 23, 30 => 5 * $40 = $200
    expect(leaseSessionsInMonth(l, 2026, 5)).toBe(5);
    expect(leaseMonthlyAmountCents(l, 2026, 5)).toBe(20000);
  });
  it('flat-per-month bills the flat rate', () => {
    const l = lease({ rate_period: 'month', rate_cents: 120000 });
    expect(leaseMonthlyAmountCents(l, 2026, 5)).toBe(120000);
  });
});
