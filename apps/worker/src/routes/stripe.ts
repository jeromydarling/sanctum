/**
 * Stripe Connect Express. Real when STRIPE_SECRET_KEY is present; otherwise
 * simulated ({demo:true}). Webhooks are signature-verified (HMAC-SHA256 over
 * `${t}.${payload}`, constant-time compare).
 */
import { platformFeeCents } from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, nowISO, genId } from '../http.js';
import { operatesFacility } from '../db.js';
import { constantTimeEqual } from '../auth.js';
import { sendEmail, emailLayout } from '../email/index.js';
import { notify } from './bookings.js';

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeForm(obj: Record<string, string | number>): string {
  return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
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

/** POST /api/stripe/connect/create-account { facility_id } */
export async function handleConnectAccount(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id } = await readJson<{ facility_id?: string }>(req);
  if (!facility_id) return err('facility_id is required', 422);
  if (!(await operatesFacility(env, auth.id, facility_id))) return err('Not permitted', 403);

  if (!env.STRIPE_SECRET_KEY) {
    // Simulate onboarding so the demo flow completes end-to-end.
    const fakeId = `acct_demo_${facility_id.slice(-8)}`;
    await env.DB.prepare('UPDATE facilities SET stripe_account_id = ?, stripe_onboarded = 1, updated_at = ? WHERE id = ?')
      .bind(fakeId, nowISO(), facility_id).run();
    return json({ demo: true, stripe_account_id: fakeId, onboarded: true });
  }

  let acctId: string;
  const existing = await env.DB.prepare('SELECT stripe_account_id FROM facilities WHERE id = ?').bind(facility_id).first<{ stripe_account_id: string | null }>();
  if (existing?.stripe_account_id) {
    acctId = existing.stripe_account_id;
  } else {
    const acct = await stripeCall(env, '/accounts', { type: 'express' });
    acctId = acct.id as string;
    await env.DB.prepare('UPDATE facilities SET stripe_account_id = ?, updated_at = ? WHERE id = ?')
      .bind(acctId, nowISO(), facility_id).run();
  }
  const base = env.APP_URL || '';
  const link = await stripeCall(env, '/account_links', {
    account: acctId,
    refresh_url: `${base}/operator/settings/stripe`,
    return_url: `${base}/operator/settings/stripe?connected=1`,
    type: 'account_onboarding',
  });
  return json({ url: link.url, stripe_account_id: acctId });
}

/** POST /api/stripe/checkout { booking_id } */
export async function handleCheckout(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { booking_id } = await readJson<{ booking_id?: string }>(req);
  if (!booking_id) return err('booking_id is required', 422);
  const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(booking_id).first<Record<string, unknown>>();
  if (!booking) return err('Booking not found', 404);
  if (booking.renter_id !== auth.id) return err('Not your booking', 403);

  const facility = await env.DB.prepare('SELECT * FROM facilities WHERE id = ?').bind(booking.facility_id).first<Record<string, unknown>>();
  const subtotal = Number(booking.total_cents || 0);
  const deposit = Number(booking.deposit_cents || 0); // collected, then returned/withheld later
  // Platform fee applies only to the rental subtotal, never the refundable deposit.
  const fee = platformFeeCents(subtotal, parseFloat(env.PLATFORM_FEE_PERCENT || '1.5'));
  const depositStatus = deposit > 0 ? 'held' : 'none';

  if (!env.STRIPE_SECRET_KEY || !facility?.stripe_account_id) {
    // Simulate a successful payment in demo mode.
    await env.DB.prepare('UPDATE bookings SET status = ?, balance_paid_at = ?, deposit_status = ?, updated_at = ? WHERE id = ?')
      .bind('confirmed', nowISO(), depositStatus, nowISO(), booking_id).run();
    return json({ demo: true, confirmed: true });
  }

  const base = env.APP_URL || '';
  const items: Record<string, string | number> = {
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': String(booking.event_name),
    'line_items[0][price_data][unit_amount]': subtotal,
    'line_items[0][quantity]': 1,
  };
  if (deposit > 0) {
    items['line_items[1][price_data][currency]'] = 'usd';
    items['line_items[1][price_data][product_data][name]'] = 'Refundable security deposit';
    items['line_items[1][price_data][unit_amount]'] = deposit;
    items['line_items[1][quantity]'] = 1;
  }
  const session = await stripeCall(env, '/checkout/sessions', {
    mode: 'payment',
    ...items,
    'payment_intent_data[application_fee_amount]': fee,
    'payment_intent_data[transfer_data][destination]': facility.stripe_account_id as string,
    'payment_intent_data[metadata][booking_id]': booking_id,
    success_url: `${base}/renter/bookings/${booking_id}?paid=1`,
    cancel_url: `${base}/renter/bookings/${booking_id}`,
    client_reference_id: booking_id,
  });
  await env.DB.prepare('UPDATE bookings SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ?')
    .bind(session.id as string, nowISO(), booking_id).run();
  return json({ url: session.url });
}

/** POST /api/stripe/subscribe { facility_id, plan } — Sanctum bills the operator. */
export async function handleSubscribe(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id, plan } = await readJson<{ facility_id?: string; plan?: string }>(req);
  if (!facility_id || !plan) return err('facility_id and plan are required', 422);
  if (!(await operatesFacility(env, auth.id, facility_id)) && auth.role !== 'admin') {
    return err('Only the facility operator can change the plan', 403);
  }
  const prices: Record<string, number> = { starter: 900, growth: 1900, pro: 2900 };
  const amount = prices[plan];
  if (!amount) return err('Unknown plan', 422);

  if (!env.STRIPE_SECRET_KEY) {
    // Simulate the subscription so the demo/non-configured flow completes.
    await env.DB.prepare('UPDATE facilities SET plan = ?, subscription_status = ?, updated_at = ? WHERE id = ?')
      .bind(plan, 'active', nowISO(), facility_id).run();
    return json({ demo: true, plan, status: 'active' });
  }

  const base = env.APP_URL || '';
  const session = await stripeCall(env, '/checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': `Sanctum ${plan} plan`,
    'line_items[0][price_data][unit_amount]': amount,
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][quantity]': 1,
    'subscription_data[trial_period_days]': 30,
    client_reference_id: facility_id,
    'metadata[kind]': 'subscription',
    'metadata[plan]': plan,
    success_url: `${base}/operator/settings?subscribed=1`,
    cancel_url: `${base}/operator/settings`,
  });
  return json({ url: session.url });
}

/** POST /api/stripe/portal { facility_id } — open the Stripe billing portal. */
export async function handleBillingPortal(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id } = await readJson<{ facility_id?: string }>(req);
  if (!facility_id) return err('facility_id is required', 422);
  if (!(await operatesFacility(env, auth.id, facility_id)) && auth.role !== 'admin') {
    return err('Not permitted', 403);
  }
  const facility = await env.DB.prepare('SELECT stripe_customer_id FROM facilities WHERE id = ?')
    .bind(facility_id).first<{ stripe_customer_id: string | null }>();

  if (!env.STRIPE_SECRET_KEY || !facility?.stripe_customer_id) {
    return json({ demo: true, error: 'Billing management opens once you have an active paid subscription.' });
  }
  const session = await stripeCall(env, '/billing_portal/sessions', {
    customer: facility.stripe_customer_id,
    return_url: `${env.APP_URL || ''}/operator/settings`,
  });
  return json({ url: session.url });
}

/** POST /api/bookings/:id/deposit { action:'return'|'withhold', keep_cents?, note? } */
export async function handleDepositResolve(env: Env, req: Request, auth: AuthContext, bookingId: string): Promise<Response> {
  const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(bookingId).first<Record<string, unknown>>();
  if (!booking) return err('Booking not found', 404);
  if (!(await operatesFacility(env, auth.id, booking.facility_id as string)) && auth.role !== 'admin') {
    return err('Only the facility operator can resolve a deposit', 403);
  }
  const deposit = Number(booking.deposit_cents || 0);
  if (deposit <= 0) return err('This booking has no deposit', 400);

  const b = await readJson<{ action?: string; keep_cents?: number; note?: string }>(req);

  // Mark a cash/check deposit as collected (no Stripe involved).
  if (b.action === 'collect') {
    if (booking.deposit_status === 'held') return json({ ok: true });
    await env.DB.prepare('UPDATE bookings SET deposit_status = ?, updated_at = ? WHERE id = ?')
      .bind('held', nowISO(), bookingId).run();
    const saved0 = await getBookingRow(env, bookingId);
    return json({ ok: true, booking: saved0 });
  }

  if (booking.deposit_status !== 'held') {
    return err('There is no held deposit to resolve for this booking', 400);
  }

  const keep = Math.max(0, Math.min(deposit, Math.round(Number(b.keep_cents) || 0)));
  const isWithhold = b.action === 'withhold';
  const refundCents = isWithhold ? deposit - keep : deposit;
  const newStatus = isWithhold && keep > 0 ? 'withheld' : 'returned';

  // Issue the refund in live mode.
  if (env.STRIPE_SECRET_KEY && booking.stripe_payment_intent_id && refundCents > 0) {
    try {
      await stripeCall(env, '/refunds', {
        payment_intent: booking.stripe_payment_intent_id as string,
        amount: refundCents,
      });
    } catch (e) {
      return err(`Refund failed: ${(e as Error).message}`, 502);
    }
  }

  await env.DB.prepare(
    'UPDATE bookings SET deposit_status = ?, deposit_returned_cents = ?, deposit_resolution_note = ?, updated_at = ? WHERE id = ?',
  ).bind(newStatus, refundCents, b.note || null, nowISO(), bookingId).run();

  // Notify the renter.
  const renter = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?').bind(booking.renter_id).first<{ email: string }>();
  if (renter?.email) {
    await sendEmail(env, {
      to: renter.email,
      subject: `Your deposit for ${booking.event_name}`,
      html: emailLayout('Deposit update', newStatus === 'returned'
        ? `<p>Your full security deposit has been returned. Thank you for caring for the space!</p>`
        : `<p>Part of your security deposit was kept for damages.${b.note ? ` Note: ${b.note}` : ''} The remainder has been refunded.</p>`),
    });
  }

  return json({ ok: true, booking: await getBookingRow(env, bookingId) });
}

async function getBookingRow(env: Env, id: string): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (row) { try { row.resource_ids = JSON.parse((row.resource_ids as string) || '[]'); } catch { row.resource_ids = []; } }
  return row;
}

/** POST /api/stripe/webhooks — signature-verified. */
export async function handleWebhook(env: Env, req: Request): Promise<Response> {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') || '';

  if (env.STRIPE_WEBHOOK_SECRET) {
    const ok = await verifyStripeSig(payload, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!ok) return err('Invalid signature', 400);
  } else if (env.STRIPE_SECRET_KEY) {
    // Live Stripe is configured but no webhook secret — refuse to trust unsigned
    // events (they can confirm bookings / mark them paid). Only the fully-simulated
    // mode (no Stripe keys at all) processes unsigned payloads.
    return err('Webhook signature verification is not configured', 400);
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try { event = JSON.parse(payload); } catch { return err('Invalid payload', 400); }

  const obj = event.data?.object || {};
  switch (event.type) {
    case 'account.updated': {
      const acctId = obj.id as string;
      const onboarded = obj.charges_enabled ? 1 : 0;
      await env.DB.prepare('UPDATE facilities SET stripe_onboarded = ?, updated_at = ? WHERE stripe_account_id = ?')
        .bind(onboarded, nowISO(), acctId).run();
      break;
    }
    case 'checkout.session.completed': {
      // Subscription checkout (Sanctum billing the operator).
      if ((obj.metadata as Record<string, string>)?.kind === 'subscription') {
        const facilityId = (obj.client_reference_id as string) || '';
        const plan = (obj.metadata as Record<string, string>)?.plan;
        const customer = (obj.customer as string) || null;
        if (facilityId && plan) {
          await env.DB.prepare('UPDATE facilities SET plan = ?, subscription_status = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), updated_at = ? WHERE id = ?')
            .bind(plan, 'active', customer, nowISO(), facilityId).run();
        }
        break;
      }
      const bookingId = (obj.client_reference_id as string) || '';
      if (bookingId) {
        const pi = (obj.payment_intent as string) || null;
        await env.DB.prepare(
          "UPDATE bookings SET status = ?, balance_paid_at = ?, stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), deposit_status = CASE WHEN deposit_cents > 0 THEN 'held' ELSE deposit_status END, updated_at = ? WHERE id = ?",
        ).bind('confirmed', nowISO(), pi, nowISO(), bookingId).run();
        const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(bookingId).first<Record<string, unknown>>();
        if (booking) {
          const facility = await env.DB.prepare('SELECT operator_id, name FROM facilities WHERE id = ?').bind(booking.facility_id).first<{ operator_id: string; name: string }>();
          if (facility) {
            await notify(env, facility.operator_id, {
              title: 'Booking confirmed & paid',
              body: `${booking.event_name} is paid and confirmed.`,
              action_url: `/operator/bookings/${bookingId}`,
            });
          }
          const renter = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?').bind(booking.renter_id).first<{ email: string }>();
          if (renter?.email) {
            await sendEmail(env, {
              to: renter.email,
              subject: `You're confirmed: ${booking.event_name}`,
              html: emailLayout('Your booking is confirmed', `<p>Payment received. Your event <strong>${booking.event_name}</strong> is confirmed. We can't wait to host you.</p>`),
            });
          }
        }
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customer = (obj.customer as string) || '';
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : (obj.status as string) || 'active';
      if (customer) {
        await env.DB.prepare('UPDATE facilities SET subscription_status = ?, updated_at = ? WHERE stripe_customer_id = ?')
          .bind(status, nowISO(), customer).run();
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const bookingId = (obj.metadata as Record<string, string>)?.booking_id || '';
      if (bookingId) {
        const booking = await env.DB.prepare('SELECT facility_id, event_name FROM bookings WHERE id = ?').bind(bookingId).first<{ facility_id: string; event_name: string }>();
        if (booking) {
          const facility = await env.DB.prepare('SELECT operator_id FROM facilities WHERE id = ?').bind(booking.facility_id).first<{ operator_id: string }>();
          if (facility) {
            await notify(env, facility.operator_id, {
              title: 'Payment failed',
              body: `A payment failed for ${booking.event_name}.`,
              action_url: `/operator/bookings/${bookingId}`,
            });
          }
        }
      }
      break;
    }
  }
  return json({ received: true });
}

async function verifyStripeSig(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(hex, v1);
}

export { genId };
