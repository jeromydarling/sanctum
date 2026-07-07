import { describe, it, expect } from 'vitest';
import { computeImpact, startOfMonthISO } from './impact.js';
import type { Booking } from './types.js';

function bk(p: Partial<Booking>): Booking {
  return {
    id: 'b', facility_id: 'f', space_id: 's', renter_id: 'r', event_name: 'e', event_type: null,
    event_description: null, expected_attendance: null, start_time: '2026-03-02T10:00:00.000Z',
    end_time: '2026-03-02T14:00:00.000Z', setup_start_time: null, subtotal_cents: 10000,
    deposit_cents: 0, resource_fees_cents: 0, discount_cents: 0, total_cents: 10000,
    platform_fee_cents: 150, status: 'confirmed', denial_reason: null, cancellation_reason: null,
    coi_uploaded: 0, agreement_signed: 0, agreement_signed_at: null, agreement_signer: null,
    agreement_ip: null, stripe_payment_intent_id: null, stripe_checkout_session_id: null,
    deposit_paid_at: null, balance_paid_at: null, resource_ids: [], renter_notes: null,
    operator_notes: null, created_at: '', updated_at: '', ...p,
  } as Booking;
}

describe('computeImpact', () => {
  it('aggregates only realized bookings and sums hours/earnings', () => {
    const out = computeImpact([
      bk({ id: '1', renter_id: 'a', expected_attendance: 50 }),
      bk({ id: '2', renter_id: 'b', status: 'completed', expected_attendance: 30 }),
      bk({ id: '3', renter_id: 'c', status: 'pending' }), // ignored
      bk({ id: '4', renter_id: 'a', subtotal_cents: 0, expected_attendance: 20 }), // given free
    ]);
    expect(out.eventsHosted).toBe(3);
    expect(out.groups).toBe(2); // a, b (c ignored)
    expect(out.neighborsWelcomed).toBe(100);
    expect(out.hoursOpen).toBe(12); // 3 realized × 4h
    expect(out.earnedCents).toBe(20000);
    expect(out.givenHours).toBe(4);
  });

  it('honors the since filter', () => {
    const out = computeImpact([
      bk({ id: '1', start_time: '2026-01-01T10:00:00.000Z', end_time: '2026-01-01T12:00:00.000Z' }),
      bk({ id: '2', start_time: '2026-03-10T10:00:00.000Z', end_time: '2026-03-10T12:00:00.000Z' }),
    ], '2026-03-01T00:00:00.000Z');
    expect(out.eventsHosted).toBe(1);
  });

  it('startOfMonthISO returns the UTC first-of-month', () => {
    expect(startOfMonthISO(new Date('2026-03-17T09:30:00.000Z'))).toBe('2026-03-01T00:00:00.000Z');
  });
});
