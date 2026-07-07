/**
 * Minimal standalone Stripe REST client (no SDK) used by the booking lifecycle
 * to issue refunds. Kept separate from routes/stripe.ts so bookings.ts can
 * refund without a circular import (stripe.ts already imports from bookings.ts).
 */
import type { Env } from './types.js';

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeForm(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function stripeCall(env: Env, path: string, body: Record<string, string | number>): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stripeForm(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as { message?: string })?.message || 'stripe error');
  return data;
}

/**
 * Refund (part of) a booking's payment.
 *  - reverseTransfer pulls the refunded amount back FROM the connected account
 *    (correct for destination charges — e.g. a full cancellation refund).
 *  - refundApplicationFee also returns Sanctum's platform fee (used on a full
 *    cancellation, so the renter is made whole).
 * No-op (returns simulated) when Stripe isn't configured or there's no charge.
 */
export async function refundBooking(
  env: Env,
  booking: Record<string, unknown>,
  opts: { amountCents: number; reverseTransfer?: boolean; refundApplicationFee?: boolean },
): Promise<{ refunded: boolean; simulated?: boolean; error?: string }> {
  const pi = booking.stripe_payment_intent_id as string | null;
  if (!env.STRIPE_SECRET_KEY || !pi || opts.amountCents <= 0) {
    return { refunded: false, simulated: true };
  }
  try {
    await stripeCall(env, '/refunds', {
      payment_intent: pi,
      amount: Math.round(opts.amountCents),
      ...(opts.reverseTransfer ? { reverse_transfer: 'true' } : {}),
      ...(opts.refundApplicationFee ? { refund_application_fee: 'true' } : {}),
    });
    return { refunded: true };
  } catch (e) {
    return { refunded: false, error: (e as Error).message };
  }
}
