/**
 * Money utilities for Sanctum.
 *
 * Hard-won rules encoded here:
 *  - All money is integer cents. Never floats for storage or transport.
 *  - Durations are computed in MINUTES, never hours, to avoid client/server
 *    pricing mismatches on fractional bookings.
 *  - The platform fee is a single source of truth (PLATFORM_FEE_PERCENT).
 */

/** Default platform fee. Overridable via the Worker `PLATFORM_FEE_PERCENT` var. */
export const PLATFORM_FEE_PERCENT = 1.5;

/** Format integer cents as a USD string, e.g. 12345 -> "$123.45". */
export function formatCents(cents: number | null | undefined): string {
  const v = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  const negative = v < 0;
  const abs = Math.abs(Math.round(v));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `$${dollars.toLocaleString('en-US')}.${remainder
    .toString()
    .padStart(2, '0')}`;
  return negative ? `-${formatted}` : formatted;
}

/** Parse a user-entered dollar string (e.g. "123.45", "$1,200") to integer cents. */
export function parseDollarsToCents(input: string | number | null | undefined): number {
  if (input == null) return 0;
  if (typeof input === 'number') return Math.round(input * 100);
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
  const dollars = parseFloat(cleaned);
  if (!Number.isFinite(dollars)) return 0;
  return Math.round(dollars * 100);
}

/** Whole minutes between two ISO timestamps (or Date). Always >= 0, rounded. */
export function durationMinutes(
  start: string | Date,
  end: string | Date,
): number {
  const s = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const e = end instanceof Date ? end.getTime() : new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  return Math.max(0, Math.round((e - s) / 60000));
}

export interface BookingPriceInput {
  startTime: string;
  endTime: string;
  hourlyRateCents: number;
  halfDayRateCents?: number | null;
  fullDayRateCents?: number | null;
  weekendHourlyRateCents?: number | null;
  /** Sum of selected resource fees (flat + hourly*hours), precomputed. */
  resourceFeesCents?: number;
  depositCents?: number;
  /** Percentage discount applied to the space subtotal (e.g. 25 for nonprofit). */
  discountPercent?: number;
  /** True if the booking start falls on Sat/Sun (weekend pricing). */
  isWeekend?: boolean;
  /** Platform fee percent override; defaults to PLATFORM_FEE_PERCENT. */
  platformFeePercent?: number;
}

export interface BookingPriceBreakdown {
  minutes: number;
  hours: number;
  spaceSubtotalCents: number;
  resourceFeesCents: number;
  discountCents: number;
  subtotalCents: number;
  depositCents: number;
  platformFeeCents: number;
  totalCents: number;
}

const HALF_DAY_MINUTES = 4 * 60;
const FULL_DAY_MINUTES = 8 * 60;

/**
 * Authoritative booking price computation. The Worker MUST recompute with this
 * and never trust client-sent totals. Picks the cheapest applicable tier
 * (hourly vs half-day vs full-day) so renters are never overcharged.
 */
export function computeBookingPrice(
  input: BookingPriceInput,
): BookingPriceBreakdown {
  const minutes = durationMinutes(input.startTime, input.endTime);
  const hours = minutes / 60;

  const hourlyRate = input.isWeekend && input.weekendHourlyRateCents
    ? input.weekendHourlyRateCents
    : input.hourlyRateCents;

  // Hourly cost, billed per started 15-minute increment is overkill; we bill the
  // exact minute fraction of the hourly rate but compare against day tiers.
  const hourlyCost = Math.round((minutes / 60) * (hourlyRate || 0));

  const candidates: number[] = [hourlyCost];
  if (input.halfDayRateCents && minutes <= HALF_DAY_MINUTES) {
    candidates.push(input.halfDayRateCents);
  }
  if (input.fullDayRateCents && minutes <= FULL_DAY_MINUTES) {
    candidates.push(input.fullDayRateCents);
  }
  // If they book longer than a full day, full-day rate still applies as a floor option.
  if (input.fullDayRateCents && minutes > FULL_DAY_MINUTES) {
    const days = Math.ceil(minutes / FULL_DAY_MINUTES);
    candidates.push(input.fullDayRateCents * days);
  }

  // Bill the cheapest applicable positive tier. Guard against an all-zero set
  // (e.g. a free/unpriced space) — Math.min() of [] is Infinity, which would
  // corrupt the subtotal, total, and platform fee.
  const positiveCandidates = candidates.filter((c) => c > 0);
  const spaceSubtotalCents = positiveCandidates.length ? Math.min(...positiveCandidates) : 0;

  const resourceFeesCents = Math.max(0, Math.round(input.resourceFeesCents || 0));

  const discountPercent = clampPercent(input.discountPercent || 0);
  const discountCents = Math.round((spaceSubtotalCents * discountPercent) / 100);

  const subtotalCents = Math.max(
    0,
    spaceSubtotalCents - discountCents + resourceFeesCents,
  );

  const depositCents = Math.max(0, Math.round(input.depositCents || 0));

  const feePercent = input.platformFeePercent ?? PLATFORM_FEE_PERCENT;
  const platformFeeCents = Math.round((subtotalCents * feePercent) / 100);

  return {
    minutes,
    hours,
    spaceSubtotalCents,
    resourceFeesCents,
    discountCents,
    subtotalCents,
    depositCents,
    platformFeeCents,
    totalCents: subtotalCents,
  };
}

/** The platform's application fee (in cents) for a given subtotal. */
export function platformFeeCents(
  subtotalCents: number,
  feePercent: number = PLATFORM_FEE_PERCENT,
): number {
  return Math.round((Math.max(0, subtotalCents) * feePercent) / 100);
}

function clampPercent(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, p));
}
