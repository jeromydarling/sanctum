-- Lightweight outbound-email log: lets the E2E rig assert that the email
-- pipeline fired (welcome, booking, etc.) without anything actually being
-- delivered. Metadata only (recipient + subject), never message bodies.
CREATE TABLE IF NOT EXISTS email_log (
  id         TEXT PRIMARY KEY,
  to_addr    TEXT NOT NULL,
  subject    TEXT NOT NULL,
  sent       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_email_log_to ON email_log(to_addr, created_at);
