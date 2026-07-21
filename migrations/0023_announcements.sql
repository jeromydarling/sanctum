-- Operator announcements: a one-to-many alert an operator sends to their active
-- tenants and/or renters with upcoming bookings (in-app notification + email).
-- This table is the sent-history; delivery fans out to notifications/email at send time.
CREATE TABLE IF NOT EXISTS announcements (
  id              TEXT PRIMARY KEY,
  facility_id     TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT,
  audience        TEXT NOT NULL,          -- 'tenants' | 'renters' | 'all'
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_facility ON announcements(facility_id, created_at);
