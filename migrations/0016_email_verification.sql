-- Email-verification scaffolding. The gate is OFF by default (EMAIL_VERIFICATION
-- env var != "on"); when off, every account is created already-verified and the
-- column has no effect. Existing accounts default to verified so nothing breaks.
ALTER TABLE profiles ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;

-- One-time email-verification tokens (hashed), mirroring password_resets.
CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
