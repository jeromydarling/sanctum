import { describe, it, expect } from 'vitest';
import {
  formatCents,
  parseDollarsToCents,
  durationMinutes,
  computeBookingPrice,
  platformFeeCents,
  PLATFORM_FEE_PERCENT,
} from './money.js';

describe('formatCents', () => {
  it('formats whole dollars', () => {
    expect(formatCents(12345)).toBe('$123.45');
    expect(formatCents(100)).toBe('$1.00');
    expect(formatCents(0)).toBe('$0.00');
  });
  it('handles thousands separators', () => {
    expect(formatCents(123456789)).toBe('$1,234,567.89');
  });
  it('handles negatives and nullish', () => {
    expect(formatCents(-500)).toBe('-$5.00');
    expect(formatCents(null)).toBe('$0.00');
    expect(formatCents(undefined)).toBe('$0.00');
  });
});

describe('parseDollarsToCents', () => {
  it('parses dollar strings to cents', () => {
    expect(parseDollarsToCents('123.45')).toBe(12345);
    expect(parseDollarsToCents('$1,200')).toBe(120000);
    expect(parseDollarsToCents('5')).toBe(500);
  });
  it('handles numbers and junk', () => {
    expect(parseDollarsToCents(10)).toBe(1000);
    expect(parseDollarsToCents('')).toBe(0);
    expect(parseDollarsToCents('abc')).toBe(0);
    expect(parseDollarsToCents(null)).toBe(0);
  });
});

describe('durationMinutes', () => {
  it('computes whole minutes (not hours) to avoid mismatch', () => {
    expect(
      durationMinutes('2026-01-01T10:00:00Z', '2026-01-01T11:30:00Z'),
    ).toBe(90);
  });
  it('never goes negative', () => {
    expect(
      durationMinutes('2026-01-01T11:00:00Z', '2026-01-01T10:00:00Z'),
    ).toBe(0);
  });
  it('handles invalid input', () => {
    expect(durationMinutes('nope', 'also-nope')).toBe(0);
  });
});

describe('computeBookingPrice', () => {
  it('bills hourly for short bookings', () => {
    const b = computeBookingPrice({
      startTime: '2026-01-01T10:00:00Z',
      endTime: '2026-01-01T12:00:00Z',
      hourlyRateCents: 5000,
    });
    expect(b.minutes).toBe(120);
    expect(b.spaceSubtotalCents).toBe(10000);
    expect(b.subtotalCents).toBe(10000);
    expect(b.platformFeeCents).toBe(150); // 1.5% of $100
  });

  it('bills fractional hours by the minute', () => {
    const b = computeBookingPrice({
      startTime: '2026-01-01T10:00:00Z',
      endTime: '2026-01-01T11:30:00Z',
      hourlyRateCents: 6000,
    });
    // 90 minutes * ($60/hr) = $90
    expect(b.spaceSubtotalCents).toBe(9000);
  });

  it('picks the cheaper full-day rate when it beats hourly', () => {
    const b = computeBookingPrice({
      startTime: '2026-01-01T09:00:00Z',
      endTime: '2026-01-01T17:00:00Z', // 8 hours
      hourlyRateCents: 10000, // $80/hr would be $800
      fullDayRateCents: 50000, // $500 flat is cheaper
    });
    expect(b.spaceSubtotalCents).toBe(50000);
  });

  it('applies discount before fees and computes fee on discounted subtotal', () => {
    const b = computeBookingPrice({
      startTime: '2026-01-01T10:00:00Z',
      endTime: '2026-01-01T14:00:00Z', // 4 hours
      hourlyRateCents: 5000, // $200
      resourceFeesCents: 5000, // $50
      discountPercent: 25,
    });
    // space $200, discount $50, + resources $50 => subtotal $200
    expect(b.discountCents).toBe(5000);
    expect(b.subtotalCents).toBe(20000);
    expect(b.platformFeeCents).toBe(300); // 1.5% of $200
  });

  it('uses weekend rate when flagged', () => {
    const b = computeBookingPrice({
      startTime: '2026-01-03T10:00:00Z',
      endTime: '2026-01-03T12:00:00Z',
      hourlyRateCents: 5000,
      weekendHourlyRateCents: 8000,
      isWeekend: true,
    });
    expect(b.spaceSubtotalCents).toBe(16000);
  });

  it('returns 0 (never Infinity) for an unpriced space', () => {
    const b = computeBookingPrice({
      startTime: '2026-01-01T10:00:00Z',
      endTime: '2026-01-01T12:00:00Z',
      hourlyRateCents: 0, // no rates set at all
    });
    expect(Number.isFinite(b.spaceSubtotalCents)).toBe(true);
    expect(b.spaceSubtotalCents).toBe(0);
    expect(b.subtotalCents).toBe(0);
    expect(b.totalCents).toBe(0);
    expect(b.platformFeeCents).toBe(0);
  });

  it('still bills resources when the space itself is unpriced', () => {
    const b = computeBookingPrice({
      startTime: '2026-01-01T10:00:00Z',
      endTime: '2026-01-01T12:00:00Z',
      hourlyRateCents: 0,
      resourceFeesCents: 5000,
    });
    expect(b.subtotalCents).toBe(5000);
    expect(b.platformFeeCents).toBe(75);
  });

  it('charges per day beyond a full day', () => {
    const b = computeBookingPrice({
      startTime: '2026-01-01T08:00:00Z',
      endTime: '2026-01-02T20:00:00Z', // 36 hours -> ceil(36/8)=5 days? no, 36h=2160min /480=4.5 ->5
      hourlyRateCents: 100000,
      fullDayRateCents: 40000,
    });
    expect(b.spaceSubtotalCents).toBe(200000); // 5 * $400
  });
});

describe('platformFeeCents', () => {
  it('uses the default fee percent', () => {
    expect(platformFeeCents(100000)).toBe(Math.round(100000 * PLATFORM_FEE_PERCENT / 100));
    expect(platformFeeCents(100000)).toBe(1500);
  });
  it('respects an override', () => {
    expect(platformFeeCents(100000, 5)).toBe(5000);
  });
  it('never negative', () => {
    expect(platformFeeCents(-100)).toBe(0);
  });
});
