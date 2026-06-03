-- Sanctum initial schema.
-- Conventions: booleans are INTEGER (0/1), JSON is stored as TEXT,
-- all timestamps are ISO-8601 TEXT strings. Money is INTEGER cents.

-- Platform secrets (AUTH_SECRET auto-generates into this table on first use).
CREATE TABLE IF NOT EXISTS app_secrets (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Auth credentials, kept separate from profiles so hydrate never leaks hashes.
CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id       TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  full_name         TEXT,
  role              TEXT NOT NULL DEFAULT 'renter',
  phone             TEXT,
  organization_name TEXT,
  organization_type TEXT,
  avatar_url        TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS facilities (
  id                          TEXT PRIMARY KEY,
  operator_id                 TEXT NOT NULL,
  name                        TEXT NOT NULL,
  slug                        TEXT NOT NULL UNIQUE,
  denomination                TEXT,
  description                 TEXT,
  address                     TEXT NOT NULL DEFAULT '',
  city                        TEXT NOT NULL DEFAULT '',
  state                       TEXT NOT NULL DEFAULT '',
  zip                         TEXT,
  phone                       TEXT,
  email                       TEXT,
  website                     TEXT,
  logo_url                    TEXT,
  cover_image_url             TEXT,
  stripe_account_id           TEXT,
  stripe_onboarded            INTEGER NOT NULL DEFAULT 0,
  plan                        TEXT NOT NULL DEFAULT 'starter',
  subscription_status         TEXT NOT NULL DEFAULT 'trialing',
  is_listed                   INTEGER NOT NULL DEFAULT 1,
  requires_approval           INTEGER NOT NULL DEFAULT 1,
  approval_lead_days          INTEGER NOT NULL DEFAULT 3,
  cancellation_policy         TEXT,
  facility_use_agreement_url  TEXT,
  require_coi                 INTEGER NOT NULL DEFAULT 1,
  min_coi_amount_cents        INTEGER NOT NULL DEFAULT 100000000,
  tax_exempt_id               TEXT,
  created_at                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_facilities_operator ON facilities(operator_id);
CREATE INDEX IF NOT EXISTS idx_facilities_listed ON facilities(is_listed);

CREATE TABLE IF NOT EXISTS spaces (
  id                       TEXT PRIMARY KEY,
  facility_id              TEXT NOT NULL,
  name                     TEXT NOT NULL,
  space_type               TEXT NOT NULL DEFAULT 'other',
  description              TEXT,
  capacity_persons         INTEGER,
  square_footage           INTEGER,
  hourly_rate_cents        INTEGER,
  half_day_rate_cents      INTEGER,
  full_day_rate_cents      INTEGER,
  weekend_hourly_rate_cents INTEGER,
  deposit_amount_cents     INTEGER NOT NULL DEFAULT 0,
  available_days           TEXT NOT NULL DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]',
  available_start_time     TEXT NOT NULL DEFAULT '07:00',
  available_end_time       TEXT NOT NULL DEFAULT '22:00',
  min_booking_hours        REAL NOT NULL DEFAULT 1,
  max_booking_hours        REAL,
  buffer_minutes           INTEGER NOT NULL DEFAULT 30,
  amenities                TEXT NOT NULL DEFAULT '[]',
  images                   TEXT NOT NULL DEFAULT '[]',
  allowed_uses             TEXT NOT NULL DEFAULT '[]',
  restricted_uses          TEXT NOT NULL DEFAULT '[]',
  is_active                INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_spaces_facility ON spaces(facility_id);

CREATE TABLE IF NOT EXISTS resources (
  id                TEXT PRIMARY KEY,
  facility_id       TEXT NOT NULL,
  name              TEXT NOT NULL,
  resource_type     TEXT NOT NULL DEFAULT 'other',
  quantity          INTEGER NOT NULL DEFAULT 1,
  hourly_rate_cents INTEGER NOT NULL DEFAULT 0,
  flat_rate_cents   INTEGER NOT NULL DEFAULT 0,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_resources_facility ON resources(facility_id);

CREATE TABLE IF NOT EXISTS bookings (
  id                        TEXT PRIMARY KEY,
  facility_id               TEXT NOT NULL,
  space_id                  TEXT NOT NULL,
  renter_id                 TEXT NOT NULL,
  event_name                TEXT NOT NULL,
  event_type                TEXT,
  event_description         TEXT,
  expected_attendance       INTEGER,
  start_time                TEXT NOT NULL,
  end_time                  TEXT NOT NULL,
  setup_start_time          TEXT,
  subtotal_cents            INTEGER NOT NULL DEFAULT 0,
  deposit_cents             INTEGER NOT NULL DEFAULT 0,
  resource_fees_cents       INTEGER NOT NULL DEFAULT 0,
  discount_cents            INTEGER NOT NULL DEFAULT 0,
  total_cents               INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents        INTEGER NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'pending',
  denial_reason             TEXT,
  cancellation_reason       TEXT,
  coi_uploaded              INTEGER NOT NULL DEFAULT 0,
  agreement_signed          INTEGER NOT NULL DEFAULT 0,
  agreement_signed_at       TEXT,
  stripe_payment_intent_id  TEXT,
  stripe_checkout_session_id TEXT,
  deposit_paid_at           TEXT,
  balance_paid_at           TEXT,
  resource_ids              TEXT NOT NULL DEFAULT '[]',
  renter_notes              TEXT,
  operator_notes            TEXT,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_facility ON bookings(facility_id);
CREATE INDEX IF NOT EXISTS idx_bookings_renter ON bookings(renter_id);
CREATE INDEX IF NOT EXISTS idx_bookings_space_time ON bookings(space_id, start_time);

CREATE TABLE IF NOT EXISTS compliance_docs (
  id                    TEXT PRIMARY KEY,
  booking_id            TEXT,
  renter_id             TEXT NOT NULL,
  facility_id           TEXT NOT NULL,
  doc_type              TEXT NOT NULL,
  file_url              TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  expiration_date       TEXT,
  insurer_name          TEXT,
  policy_number         TEXT,
  coverage_amount_cents INTEGER,
  notes                 TEXT,
  reviewed_by           TEXT,
  uploaded_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at           TEXT,
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_compliance_facility ON compliance_docs(facility_id);
CREATE INDEX IF NOT EXISTS idx_compliance_renter ON compliance_docs(renter_id);

CREATE TABLE IF NOT EXISTS invoices (
  id                 TEXT PRIMARY KEY,
  facility_id        TEXT NOT NULL,
  booking_id         TEXT,
  renter_id          TEXT NOT NULL,
  invoice_number     TEXT NOT NULL UNIQUE,
  line_items         TEXT NOT NULL DEFAULT '[]',
  subtotal_cents     INTEGER NOT NULL DEFAULT 0,
  tax_cents          INTEGER NOT NULL DEFAULT 0,
  total_cents        INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'draft',
  due_date           TEXT,
  paid_at            TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_facility ON invoices(facility_id);
CREATE INDEX IF NOT EXISTS idx_invoices_renter ON invoices(renter_id);

CREATE TABLE IF NOT EXISTS reviews (
  id                TEXT PRIMARY KEY,
  booking_id        TEXT,
  facility_id       TEXT NOT NULL,
  space_id          TEXT,
  renter_id         TEXT NOT NULL,
  rating            INTEGER NOT NULL DEFAULT 5,
  headline          TEXT,
  body              TEXT,
  is_published      INTEGER NOT NULL DEFAULT 0,
  operator_response TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_facility ON reviews(facility_id);

CREATE TABLE IF NOT EXISTS leads (
  id           TEXT PRIMARY KEY,
  facility_id  TEXT NOT NULL,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  organization TEXT,
  message      TEXT,
  space_id     TEXT,
  stage        TEXT NOT NULL DEFAULT 'inquiry',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_facility ON leads(facility_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  type       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  action_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS event_microsites (
  id           TEXT PRIMARY KEY,
  facility_id  TEXT NOT NULL,
  renter_id    TEXT NOT NULL,
  booking_id   TEXT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '{}',
  is_published INTEGER NOT NULL DEFAULT 0,
  rsvp_enabled INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS availability_blocks (
  id           TEXT PRIMARY KEY,
  space_id     TEXT NOT NULL,
  facility_id  TEXT NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  reason       TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_blocks_space ON availability_blocks(space_id);

-- AI usage metering (one row per call; counts aggregated by day).
CREATE TABLE IF NOT EXISTS ai_usage (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  ip         TEXT,
  endpoint   TEXT,
  day        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON ai_usage(user_id, day);
CREATE INDEX IF NOT EXISTS idx_ai_usage_ip_day ON ai_usage(ip, day);

-- Error telemetry sink.
CREATE TABLE IF NOT EXISTS error_logs (
  id          TEXT PRIMARY KEY,
  incident_id TEXT,
  user_id     TEXT,
  source      TEXT,
  message     TEXT,
  stack       TEXT,
  url         TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Idempotency ledger for cron auto-invoicing (don't double-bill).
CREATE TABLE IF NOT EXISTS billing_runs (
  id         TEXT PRIMARY KEY,
  period     TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(period, facility_id)
);
