-- Password reset tokens (store only the hash of the token).
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- Idempotency ledger for cron reminders (one row per booking+kind).
CREATE TABLE IF NOT EXISTS reminder_log (
  id         TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  kind       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(booking_id, kind)
);

-- Stripe customer id for subscription billing management (customer portal).
ALTER TABLE facilities ADD COLUMN stripe_customer_id TEXT;
