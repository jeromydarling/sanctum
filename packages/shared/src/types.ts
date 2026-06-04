/**
 * Domain row types for Sanctum.
 *
 * These mirror the D1 schema exactly (snake_case columns). Persisted booleans
 * are integers (0|1), JSON columns are typed arrays/objects that are stored as
 * text, and all timestamps are ISO-8601 strings.
 */
import type {
  Role,
  SpaceType,
  BookingStatus,
  OrgType,
  DocType,
  DocStatus,
  InvoiceStatus,
  Plan,
} from './constants.js';

export type Bool = 0 | 1;
export type ISODate = string;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  phone: string | null;
  organization_name: string | null;
  organization_type: OrgType | null;
  avatar_url: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Facility {
  id: string;
  operator_id: string;
  name: string;
  slug: string;
  denomination: string | null;
  description: string | null;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  stripe_account_id: string | null;
  stripe_onboarded: Bool;
  stripe_customer_id?: string | null;
  plan: Plan;
  subscription_status: string;
  is_listed: Bool;
  requires_approval: Bool;
  approval_lead_days: number;
  cancellation_policy: string | null;
  facility_use_agreement_url: string | null;
  require_coi: Bool;
  min_coi_amount_cents: number;
  tax_exempt_id: string | null;
  use_agreement_text?: string | null;
  ical_token?: string | null;
  external_ical_url?: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export type PricingMode = 'standard' | 'donation' | 'free';

export interface Space {
  id: string;
  facility_id: string;
  name: string;
  space_type: SpaceType;
  description: string | null;
  capacity_persons: number | null;
  square_footage: number | null;
  hourly_rate_cents: number | null;
  half_day_rate_cents: number | null;
  full_day_rate_cents: number | null;
  weekend_hourly_rate_cents: number | null;
  deposit_amount_cents: number;
  available_days: string[]; // JSON
  available_start_time: string; // "07:00"
  available_end_time: string; // "22:00"
  min_booking_hours: number;
  max_booking_hours: number | null;
  buffer_minutes: number;
  amenities: string[]; // JSON
  images: string[]; // JSON of file keys/urls
  allowed_uses: string[]; // JSON
  restricted_uses: string[]; // JSON
  pricing_mode?: PricingMode;
  is_active: Bool;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Resource {
  id: string;
  facility_id: string;
  name: string;
  resource_type: string;
  quantity: number;
  hourly_rate_cents: number;
  flat_rate_cents: number;
  is_active: Bool;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Booking {
  id: string;
  facility_id: string;
  space_id: string;
  renter_id: string;
  event_name: string;
  event_type: string | null;
  event_description: string | null;
  expected_attendance: number | null;
  start_time: ISODate;
  end_time: ISODate;
  setup_start_time: ISODate | null;
  subtotal_cents: number;
  deposit_cents: number;
  resource_fees_cents: number;
  discount_cents: number;
  total_cents: number;
  platform_fee_cents: number;
  status: BookingStatus;
  denial_reason: string | null;
  cancellation_reason: string | null;
  coi_uploaded: Bool;
  agreement_signed: Bool;
  agreement_signed_at: ISODate | null;
  agreement_signer?: string | null;
  agreement_ip?: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  deposit_paid_at: ISODate | null;
  balance_paid_at: ISODate | null;
  resource_ids: string[]; // JSON
  renter_notes: string | null;
  operator_notes: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface ComplianceDoc {
  id: string;
  booking_id: string | null;
  renter_id: string;
  facility_id: string;
  doc_type: DocType;
  file_url: string | null;
  status: DocStatus;
  expiration_date: string | null;
  insurer_name: string | null;
  policy_number: string | null;
  coverage_amount_cents: number | null;
  notes: string | null;
  reviewed_by: string | null;
  uploaded_at: ISODate;
  reviewed_at: ISODate | null;
  updated_at: ISODate;
}

export interface Invoice {
  id: string;
  facility_id: string;
  booking_id: string | null;
  renter_id: string;
  invoice_number: string;
  line_items: InvoiceLineItem[]; // JSON
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  platform_fee_cents: number;
  status: InvoiceStatus;
  due_date: string | null;
  paid_at: ISODate | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface InvoiceLineItem {
  label: string;
  quantity: number;
  unit_cents: number;
  amount_cents: number;
}

export interface Review {
  id: string;
  booking_id: string | null;
  facility_id: string;
  space_id: string | null;
  renter_id: string;
  rating: number;
  headline: string | null;
  body: string | null;
  is_published: Bool;
  operator_response: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Lead {
  id: string;
  facility_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  message: string | null;
  space_id: string | null;
  /** inquiry -> tour -> booked -> lost */
  stage: 'inquiry' | 'tour' | 'booked' | 'lost';
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: Bool;
  action_url: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface EventMicrosite {
  id: string;
  facility_id: string;
  renter_id: string;
  booking_id: string | null;
  slug: string;
  title: string;
  /** JSON site definition (sections, theme, content). */
  content: Record<string, unknown>;
  is_published: Bool;
  rsvp_enabled: Bool;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface AvailabilityBlock {
  id: string;
  space_id: string;
  facility_id: string;
  start_time: ISODate;
  end_time: ISODate;
  reason: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface PricingRule {
  id: string;
  facility_id: string;
  org_type: OrgType;
  discount_percent: number;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Lease {
  id: string;
  facility_id: string;
  space_id: string;
  renter_id: string | null;
  title: string;
  tenant_name: string | null;
  tenant_email: string | null;
  cadence: 'weekly' | 'biweekly' | 'monthly';
  weekdays: number[]; // JSON, 0=Sun..6=Sat
  start_time_local: string; // "08:00"
  end_time_local: string; // "15:00"
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  rate_cents: number;
  rate_period: 'month' | 'session';
  status: 'active' | 'paused' | 'ended';
  notes: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

/** Tables routed through the generic write-through upsert. */
export type GenericTable =
  | 'profiles'
  | 'facilities'
  | 'spaces'
  | 'resources'
  | 'compliance_docs'
  | 'reviews'
  | 'leads'
  | 'notifications'
  | 'event_microsites'
  | 'availability_blocks'
  | 'pricing_rules'
  | 'leases';

/** Tables that bypass the generic upsert (money/conflict-sensitive). */
export type ProtectedTable = 'bookings' | 'invoices';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  full_name: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
