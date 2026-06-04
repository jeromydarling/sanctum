/**
 * Money/conflict actions that go through dedicated endpoints when live, and
 * mutate the in-memory store when demo. These bypass the generic upsert.
 */
import type { Booking, Invoice, InvoiceLineItem } from '@sanctum/shared';
import { computeBookingPrice, durationMinutes, leaseConflicts } from '@sanctum/shared';
import { api } from './api.js';
import { isLive } from './config.js';
import { getData, table, rehydrate, touch } from './store.js';
import { genId } from './ids.js';

type BookingAction = 'approve' | 'deny' | 'cancel' | 'confirm' | 'complete';

const STATUS_MAP: Record<BookingAction, Booking['status']> = {
  approve: 'approved', deny: 'denied', cancel: 'cancelled', confirm: 'confirmed', complete: 'completed',
};

export async function bookingAction(id: string, action: BookingAction, reason?: string): Promise<void> {
  const arr = table('bookings');
  const booking = arr.find((b) => b.id === id);
  if (!booking) return;

  if (isLive()) {
    const res = await api<{ booking: Booking }>(`/bookings/${id}/${action}`, {
      body: { base_updated_at: booking.updated_at, reason },
    });
    Object.assign(booking, res.booking);
    await rehydrate();
    return;
  }
  // Demo: mutate locally.
  booking.status = STATUS_MAP[action];
  booking.updated_at = new Date().toISOString();
  if (action === 'deny') booking.denial_reason = reason || 'Not available';
  if (action === 'cancel') booking.cancellation_reason = reason || null;
  bump();
}

export interface NewBookingInput {
  facility_id: string;
  space_id: string;
  event_name: string;
  event_type?: string;
  event_description?: string;
  expected_attendance?: number;
  start_time: string;
  end_time: string;
  resource_ids?: string[];
  renter_notes?: string;
  donation_cents?: number;
  signer_name?: string;
  manual?: boolean;
  walkin_name?: string;
}

export async function createBooking(input: NewBookingInput, renterId: string): Promise<Booking> {
  if (isLive()) {
    const res = await api<{ booking: Booking }>('/bookings', { body: input });
    await rehydrate();
    return res.booking;
  }
  // Demo: recompute locally with the same money logic and conflict check.
  const d = getData();
  const space = d.spaces.find((s) => s.id === input.space_id);
  if (!space) throw new Error('Space not found');

  // Conflict check.
  const minutes = durationMinutes(input.start_time, input.end_time);
  if (minutes <= 0) throw new Error('End time must be after start time');
  const buffer = space.buffer_minutes || 0;
  const bufStart = new Date(new Date(input.start_time).getTime() - buffer * 60000).getTime();
  const bufEnd = new Date(new Date(input.end_time).getTime() + buffer * 60000).getTime();
  const conflict = d.bookings.some((b) =>
    b.space_id === input.space_id &&
    ['pending', 'approved', 'confirmed'].includes(b.status) &&
    new Date(b.start_time).getTime() < bufEnd &&
    new Date(b.end_time).getTime() > bufStart,
  );
  if (conflict) throw new Error('That time overlaps an existing booking for this space.');

  // Reject times reserved by an active recurring tenant of this space.
  const leaseHit = d.leases.some((l) => l.space_id === input.space_id && leaseConflicts(l, input.start_time, input.end_time));
  if (leaseHit) throw new Error('That time is reserved by a recurring tenant of this space.');

  const resourceFees = (input.resource_ids || []).reduce((sum, rid) => {
    const r = d.resources.find((x) => x.id === rid);
    return sum + (r ? r.flat_rate_cents + Math.round(r.hourly_rate_cents * (minutes / 60)) : 0);
  }, 0);
  // Automatic discount from the facility's pricing rules + renter org type.
  const renterProfile = d.profiles.find((p) => p.id === renterId);
  const rule = renterProfile?.organization_type
    ? d.pricing_rules.find((r) => r.facility_id === input.facility_id && r.org_type === renterProfile.organization_type)
    : undefined;
  const discountPercent = rule?.discount_percent || 0;

  const isWeekend = [0, 6].includes(new Date(input.start_time).getUTCDay());
  let price = computeBookingPrice({
    startTime: input.start_time, endTime: input.end_time,
    hourlyRateCents: space.hourly_rate_cents || 0,
    halfDayRateCents: space.half_day_rate_cents, fullDayRateCents: space.full_day_rate_cents,
    weekendHourlyRateCents: space.weekend_hourly_rate_cents, resourceFeesCents: resourceFees,
    depositCents: space.deposit_amount_cents, discountPercent, isWeekend,
  });
  // Rent-or-donate pricing.
  const mode = space.pricing_mode || 'standard';
  if (mode === 'free') {
    price = { ...price, spaceSubtotalCents: 0, discountCents: 0, subtotalCents: resourceFees, totalCents: resourceFees, platformFeeCents: Math.round(resourceFees * 0.015) };
  } else if (mode === 'donation') {
    const donation = Math.max(0, Math.round(input.donation_cents || 0));
    const subtotal = donation + resourceFees;
    price = { ...price, spaceSubtotalCents: donation, discountCents: 0, subtotalCents: subtotal, totalCents: subtotal, platformFeeCents: Math.round(subtotal * 0.015) };
  }
  const facility = d.facilities.find((f) => f.id === input.facility_id);
  const requiresApproval = facility ? facility.requires_approval === 1 : true;
  const now = new Date().toISOString();
  const signer = (input.signer_name || '').trim() || null;
  const booking: Booking = {
    id: genId('bkg'), facility_id: input.facility_id, space_id: input.space_id, renter_id: renterId,
    event_name: input.event_name, event_type: input.event_type || null, event_description: input.event_description || null,
    expected_attendance: input.expected_attendance || null, start_time: input.start_time, end_time: input.end_time,
    setup_start_time: null, subtotal_cents: price.subtotalCents, deposit_cents: price.depositCents,
    resource_fees_cents: price.resourceFeesCents, discount_cents: price.discountCents, total_cents: price.totalCents,
    platform_fee_cents: price.platformFeeCents, status: input.manual ? 'confirmed' : requiresApproval ? 'pending' : 'approved',
    denial_reason: null, cancellation_reason: null, coi_uploaded: 0,
    agreement_signed: signer && !input.manual ? 1 : 0, agreement_signed_at: signer && !input.manual ? now : null,
    agreement_signer: signer && !input.manual ? signer : null, agreement_ip: null,
    stripe_payment_intent_id: null, stripe_checkout_session_id: null, deposit_paid_at: null, balance_paid_at: null,
    resource_ids: input.resource_ids || [], renter_notes: input.renter_notes || null,
    operator_notes: input.manual && input.walkin_name ? `Walk-in: ${input.walkin_name}` : null,
    created_at: now, updated_at: now,
  };
  d.bookings.push(booking);
  // Notify operator locally (skip self-created walk-ins).
  if (facility && !input.manual) {
    d.notifications.push({
      id: genId('ntf'), user_id: facility.operator_id, title: 'New booking request',
      body: `${input.event_name} needs your review.`, type: 'booking', is_read: 0,
      action_url: `/operator/bookings/${booking.id}`, created_at: now, updated_at: now,
    });
  }
  bump();
  return booking;
}

export async function resolveDeposit(
  bookingId: string,
  action: 'return' | 'withhold',
  keepCents: number,
  note: string,
): Promise<void> {
  const booking = table('bookings').find((b) => b.id === bookingId);
  if (!booking) return;
  const deposit = booking.deposit_cents || 0;
  const refund = action === 'withhold' ? Math.max(0, deposit - keepCents) : deposit;
  if (isLive()) {
    const res = await api<{ booking: Booking }>(`/bookings/${bookingId}/deposit`, { body: { action, keep_cents: keepCents, note } });
    Object.assign(booking, res.booking);
    touch();
    return;
  }
  booking.deposit_status = action === 'withhold' && keepCents > 0 ? 'withheld' : 'returned';
  booking.deposit_returned_cents = refund;
  booking.deposit_resolution_note = note || null;
  booking.updated_at = new Date().toISOString();
  touch();
}

export async function invoiceAction(id: string, action: 'send' | 'paid' | 'void'): Promise<void> {
  const inv = table('invoices').find((i) => i.id === id);
  if (!inv) return;
  if (isLive()) {
    const res = await api<{ invoice: Invoice }>(`/invoices/${id}/${action}`, { body: { base_updated_at: inv.updated_at } });
    Object.assign(inv, res.invoice);
    touch();
    return;
  }
  inv.status = action === 'send' ? 'sent' : action === 'paid' ? 'paid' : 'void';
  if (action === 'paid') inv.paid_at = new Date().toISOString();
  inv.updated_at = new Date().toISOString();
  touch();
}

/** Simulate or run a Stripe checkout for a booking. */
export async function payBooking(bookingId: string): Promise<void> {
  const booking = table('bookings').find((b) => b.id === bookingId);
  if (!booking) return;
  if (isLive()) {
    const res = await api<{ url?: string; demo?: boolean }>('/stripe/checkout', { body: { booking_id: bookingId } });
    if (res.url) { window.location.href = res.url; return; }
    await rehydrate();
    return;
  }
  booking.status = 'confirmed';
  booking.balance_paid_at = new Date().toISOString();
  if ((booking.deposit_cents || 0) > 0) booking.deposit_status = 'held';
  booking.updated_at = booking.balance_paid_at;
  bump();
}

export async function createInvoiceFromBooking(bookingId: string): Promise<Invoice | null> {
  const d = getData();
  const booking = d.bookings.find((b) => b.id === bookingId);
  if (!booking) return null;
  const items: InvoiceLineItem[] = [{ label: booking.event_name, quantity: 1, unit_cents: booking.subtotal_cents, amount_cents: booking.subtotal_cents }];
  if (isLive()) {
    const res = await api<{ invoice: Invoice }>('/invoices', {
      body: { facility_id: booking.facility_id, booking_id: bookingId, renter_id: booking.renter_id, line_items: items },
    });
    await rehydrate();
    return res.invoice;
  }
  const now = new Date().toISOString();
  const inv: Invoice = {
    id: genId('inv'), facility_id: booking.facility_id, booking_id: bookingId, renter_id: booking.renter_id,
    invoice_number: `INV-${now.slice(0, 10).replace(/-/g, '')}-${genId('x').slice(-5).toUpperCase()}`,
    line_items: items, subtotal_cents: booking.subtotal_cents, tax_cents: 0, total_cents: booking.subtotal_cents,
    platform_fee_cents: Math.round(booking.subtotal_cents * 0.015), status: 'sent', due_date: null, paid_at: null,
    created_at: now, updated_at: now,
  };
  d.invoices.push(inv);
  bump();
  return inv;
}

// Nudge the store after direct mutations (demo mode).
function bump() {
  touch();
}
