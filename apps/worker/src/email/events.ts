/**
 * Domain email senders — one place for every transactional notification so the
 * voice stays consistent and call sites stay one-liners. All reuse sendEmail
 * (which logs to email_log and no-ops until the Email binding is configured).
 */
import type { Env } from '../types.js';
import { sendEmail, emailLayout } from './index.js';

export function money(cents: number): string {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}
function firstName(name?: string | null): string {
  return name ? `, ${name.trim().split(' ')[0]}` : '';
}
function app(env: Env, path = ''): string {
  return `${env.APP_URL || ''}${path}`;
}

/** A user's email + name from their profile. */
export async function profileContact(env: Env, userId: string): Promise<{ email: string; name: string | null } | null> {
  if (!userId) return null;
  const r = await env.DB.prepare('SELECT email, full_name FROM profiles WHERE id = ?')
    .bind(userId)
    .first<{ email: string | null; full_name: string | null }>();
  return r?.email ? { email: r.email, name: r.full_name } : null;
}

/** Who an invoice should be emailed to: the named renter, else the linked
 *  booking's renter. Returns null when there's no account to reach (e.g. an
 *  account-less tenant on a manual invoice — the cron emails those directly). */
export async function invoiceRecipient(env: Env, inv: Record<string, unknown>): Promise<{ email: string; name: string | null } | null> {
  const byRenter = await profileContact(env, String(inv.renter_id || ''));
  if (byRenter) return byRenter;
  if (inv.booking_id) {
    const bk = await env.DB.prepare('SELECT renter_id FROM bookings WHERE id = ?')
      .bind(inv.booking_id)
      .first<{ renter_id: string }>();
    if (bk?.renter_id) return profileContact(env, bk.renter_id);
  }
  return null;
}

// ---------- Invoices ----------
export async function emailInvoiceIssued(env: Env, to: string, name: string | null, inv: Record<string, unknown>): Promise<void> {
  const due = inv.due_date ? ` It's due by <strong>${String(inv.due_date).slice(0, 10)}</strong>.` : '';
  await sendEmail(env, {
    to,
    subject: `Invoice ${inv.invoice_number} — ${money(Number(inv.total_cents))} due`,
    html: emailLayout(
      'You have a new invoice',
      `<p>Hello${firstName(name)},</p>
       <p>Invoice <strong>${inv.invoice_number}</strong> for <strong>${money(Number(inv.total_cents))}</strong> is ready.${due}</p>
       <p>You can view it and pay securely from your Sanctum account.</p>`,
      { label: 'View & pay invoice', url: app(env, '/renter/documents') },
    ),
  });
}

export async function emailInvoiceReminder(env: Env, to: string, name: string | null, inv: Record<string, unknown>): Promise<void> {
  await sendEmail(env, {
    to,
    subject: `Reminder: invoice ${inv.invoice_number} is still open`,
    html: emailLayout(
      'A gentle reminder',
      `<p>Hello${firstName(name)},</p>
       <p>Invoice <strong>${inv.invoice_number}</strong> for <strong>${money(Number(inv.total_cents))}</strong> is still open${inv.due_date ? ` (due ${String(inv.due_date).slice(0, 10)})` : ''}. If you've already paid, thank you — please disregard this note.</p>`,
      { label: 'View & pay invoice', url: app(env, '/renter/documents') },
    ),
  });
}

// ---------- Booking payments ----------
export async function emailPaymentFailed(env: Env, to: string, name: string | null, eventName: string, bookingId: string): Promise<void> {
  await sendEmail(env, {
    to,
    subject: `Payment didn't go through: ${eventName}`,
    html: emailLayout(
      'Your payment didn\'t go through',
      `<p>Hello${firstName(name)},</p>
       <p>We couldn't process the payment for <strong>${eventName}</strong>. Your date isn't confirmed yet — please try again to secure it.</p>`,
      { label: 'Complete payment', url: app(env, `/renter/bookings/${bookingId}`) },
    ),
  });
}

export async function emailBookingRefunded(env: Env, to: string, name: string | null, eventName: string, full: boolean): Promise<void> {
  await sendEmail(env, {
    to,
    subject: `Refund issued: ${eventName}`,
    html: emailLayout(
      full ? 'Your refund is on the way' : 'A partial refund is on the way',
      `<p>Hello${firstName(name)},</p>
       <p>${full ? 'A full refund' : 'A partial refund'} for <strong>${eventName}</strong> has been issued. Depending on your bank, it may take a few business days to appear.</p>`,
    ),
  });
}

export async function emailOperatorBookingPaid(env: Env, to: string, name: string | null, eventName: string, bookingId: string): Promise<void> {
  await sendEmail(env, {
    to,
    subject: `Booked & paid: ${eventName}`,
    html: emailLayout(
      'A booking is confirmed and paid',
      `<p>Good news${firstName(name)} — <strong>${eventName}</strong> is paid in full and confirmed. The date is held on your calendar.</p>`,
      { label: 'View the booking', url: app(env, `/operator/bookings/${bookingId}`) },
    ),
  });
}

// ---------- Leads ----------
export async function emailInquiryToOperator(
  env: Env,
  to: string,
  name: string | null,
  lead: { name: string; email?: string | null; organization?: string | null; message: string },
  facilityName: string,
): Promise<void> {
  await sendEmail(env, {
    to,
    subject: `New inquiry about ${facilityName}`,
    html: emailLayout(
      'Someone\'s interested in your space',
      `<p>Hello${firstName(name)},</p>
       <p><strong>${lead.name}</strong>${lead.organization ? ` (${lead.organization})` : ''} just asked about <strong>${facilityName}</strong>:</p>
       <blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #4338ca;color:#444">${lead.message}</blockquote>
       ${lead.email ? `<p>Reply to them at <a href="mailto:${lead.email}">${lead.email}</a>, or manage it in your dashboard.</p>` : ''}`,
      { label: 'Open your leads', url: app(env, '/operator/leads') },
    ),
  });
}

// ---------- Operator operations ----------
export async function emailDispute(env: Env, to: string, name: string | null, eventName: string, closed: boolean, outcome: string): Promise<void> {
  await sendEmail(env, {
    to,
    subject: closed ? `Dispute closed (${outcome}): ${eventName}` : `Payment disputed — action needed: ${eventName}`,
    html: emailLayout(
      closed ? 'A payment dispute has closed' : 'A payment was disputed',
      closed
        ? `<p>The dispute on <strong>${eventName}</strong> has closed (${outcome}). No further action is needed here.</p>`
        : `<p>Hello${firstName(name)},</p>
           <p>A cardholder has disputed the payment for <strong>${eventName}</strong>. As the connected account, you're liable for disputes — please respond promptly in your Stripe dashboard to make your case.</p>`,
      { label: 'Review the booking', url: app(env, '/operator/bookings') },
    ),
  });
}

export async function emailPayoutFailed(env: Env, to: string, name: string | null, facilityName: string): Promise<void> {
  await sendEmail(env, {
    to,
    subject: 'A payout to your bank failed',
    html: emailLayout(
      'A payout didn\'t reach your bank',
      `<p>Hello${firstName(name)},</p>
       <p>A Stripe payout to <strong>${facilityName}</strong> failed — usually a bank detail that needs updating. Please check your payout settings so your money can reach you.</p>`,
      { label: 'Check payout settings', url: app(env, '/operator/settings/stripe') },
    ),
  });
}

// ---------- Auth / account ----------
export async function emailPasswordChanged(env: Env, to: string): Promise<void> {
  await sendEmail(env, {
    to,
    subject: 'Your Sanctum password was changed',
    html: emailLayout(
      'Your password was changed',
      `<p>This is a confirmation that your Sanctum password was just changed. If this was you, no action is needed.</p>
       <p>If you didn't do this, please reset your password right away and contact us.</p>`,
      { label: 'Reset your password', url: app(env, '/forgot') },
    ),
  });
}

export async function emailAccountDeleted(env: Env, to: string): Promise<void> {
  await sendEmail(env, {
    to,
    subject: 'Your Sanctum account was deleted',
    html: emailLayout(
      'Your account has been deleted',
      `<p>Your Sanctum account and its data have been removed, as you requested. We're sorry to see you go — the door is always open if you'd like to come back.</p>`,
    ),
  });
}

// ---------- Subscription (operator's own plan) ----------
export async function emailTrialEnding(env: Env, to: string, name: string | null): Promise<void> {
  await sendEmail(env, {
    to,
    subject: 'Your Sanctum trial is ending soon',
    html: emailLayout(
      'Your free trial is wrapping up',
      `<p>Hello${firstName(name)},</p>
       <p>Your Sanctum free trial ends in a few days. To keep taking bookings without interruption, add a payment method or confirm your plan.</p>`,
      { label: 'Manage your plan', url: app(env, '/operator/settings') },
    ),
  });
}

export async function emailSubscriptionPaymentFailed(env: Env, to: string, name: string | null): Promise<void> {
  await sendEmail(env, {
    to,
    subject: 'We couldn\'t process your Sanctum payment',
    html: emailLayout(
      'Your plan payment didn\'t go through',
      `<p>Hello${firstName(name)},</p>
       <p>We weren't able to charge your payment method for your Sanctum plan. Please update it so your community keeps running without a hitch — we'll try again automatically.</p>`,
      { label: 'Update payment method', url: app(env, '/operator/settings') },
    ),
  });
}

export async function emailOnboardingComplete(env: Env, to: string, name: string | null, facilityName: string): Promise<void> {
  await sendEmail(env, {
    to,
    subject: 'You\'re ready to accept payments',
    html: emailLayout(
      'Payments are switched on',
      `<p>Good news${firstName(name)} — ${facilityName} is fully set up with Stripe. You can now take bookings and get paid directly to your bank, with Sanctum's transparent 1.5% fee and nothing hidden.</p>`,
      { label: 'Go to your dashboard', url: app(env, '/operator') },
    ),
  });
}
