/**
 * Registry of tables reachable through the generic write-through upsert,
 * their writable columns, and which columns are JSON (stored as TEXT).
 *
 * Money/conflict-sensitive tables (bookings, invoices) are intentionally
 * ABSENT here — they go through dedicated, validated endpoints.
 */
import type { GenericTable } from '@sanctum/shared';

export interface TableDef {
  columns: string[];
  jsonColumns: string[];
}

export const TABLES: Record<GenericTable, TableDef> = {
  profiles: {
    columns: [
      'id', 'email', 'full_name', 'role', 'phone',
      'organization_name', 'organization_type', 'avatar_url',
      'created_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  facilities: {
    columns: [
      'id', 'operator_id', 'name', 'slug', 'denomination', 'description',
      'address', 'city', 'state', 'zip', 'phone', 'email', 'website',
      'logo_url', 'cover_image_url', 'stripe_account_id', 'stripe_onboarded',
      'plan', 'subscription_status', 'is_listed', 'requires_approval',
      'approval_lead_days', 'cancellation_policy', 'facility_use_agreement_url',
      'require_coi', 'min_coi_amount_cents', 'tax_exempt_id', 'use_agreement_text',
      'network_id', 'created_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  networks: {
    columns: ['id', 'owner_id', 'name', 'slug', 'description', 'brand_primary', 'logo_url', 'created_at', 'updated_at'],
    jsonColumns: [],
  },
  spaces: {
    columns: [
      'id', 'facility_id', 'name', 'space_type', 'description',
      'capacity_persons', 'square_footage', 'hourly_rate_cents',
      'half_day_rate_cents', 'full_day_rate_cents', 'weekend_hourly_rate_cents',
      'deposit_amount_cents', 'available_days', 'available_start_time',
      'available_end_time', 'min_booking_hours', 'max_booking_hours',
      'buffer_minutes', 'amenities', 'images', 'allowed_uses',
      'restricted_uses', 'pricing_mode', 'is_active', 'created_at', 'updated_at',
    ],
    jsonColumns: ['available_days', 'amenities', 'images', 'allowed_uses', 'restricted_uses'],
  },
  resources: {
    columns: [
      'id', 'facility_id', 'name', 'resource_type', 'quantity',
      'hourly_rate_cents', 'flat_rate_cents', 'is_active',
      'created_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  compliance_docs: {
    columns: [
      'id', 'booking_id', 'renter_id', 'facility_id', 'doc_type', 'file_url',
      'status', 'expiration_date', 'insurer_name', 'policy_number',
      'coverage_amount_cents', 'notes', 'reviewed_by', 'uploaded_at',
      'reviewed_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  reviews: {
    columns: [
      'id', 'booking_id', 'facility_id', 'space_id', 'renter_id', 'rating',
      'headline', 'body', 'is_published', 'operator_response',
      'created_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  leads: {
    columns: [
      'id', 'facility_id', 'name', 'email', 'phone', 'organization',
      'message', 'space_id', 'stage', 'created_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  notifications: {
    columns: [
      'id', 'user_id', 'title', 'body', 'type', 'is_read', 'action_url',
      'created_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  event_microsites: {
    columns: [
      'id', 'facility_id', 'renter_id', 'booking_id', 'slug', 'title',
      'content', 'is_published', 'rsvp_enabled', 'created_at', 'updated_at',
    ],
    jsonColumns: ['content'],
  },
  availability_blocks: {
    columns: [
      'id', 'space_id', 'facility_id', 'start_time', 'end_time', 'reason',
      'created_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  pricing_rules: {
    columns: [
      'id', 'facility_id', 'org_type', 'discount_percent', 'created_at', 'updated_at',
    ],
    jsonColumns: [],
  },
  leases: {
    columns: [
      'id', 'facility_id', 'space_id', 'renter_id', 'title', 'tenant_name',
      'tenant_email', 'cadence', 'weekdays', 'start_time_local', 'end_time_local',
      'start_date', 'end_date', 'rate_cents', 'rate_period', 'status', 'notes',
      'created_at', 'updated_at',
    ],
    jsonColumns: ['weekdays'],
  },
};

export function isGenericTable(t: string): t is GenericTable {
  return Object.prototype.hasOwnProperty.call(TABLES, t);
}
