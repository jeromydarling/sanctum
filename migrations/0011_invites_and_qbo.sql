-- Self-serve network invitations (cross-operator).
CREATE TABLE IF NOT EXISTS network_invites (
  token       TEXT PRIMARY KEY,
  network_id  TEXT NOT NULL,
  email       TEXT NOT NULL,
  accepted_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_network_invites_network ON network_invites(network_id);

-- QuickBooks Online connection (per facility). Tokens live in D1, never in the repo.
ALTER TABLE facilities ADD COLUMN qbo_realm_id TEXT;
ALTER TABLE facilities ADD COLUMN qbo_access_token TEXT;
ALTER TABLE facilities ADD COLUMN qbo_refresh_token TEXT;
ALTER TABLE facilities ADD COLUMN qbo_token_expires_at TEXT;
