-- Durable job queue for announcement fan-out. Sending an announcement enqueues
-- one row per recipient (fast, no external calls in the request); a 1-minute
-- cron drains them in the background — so a facility with hundreds of tenants
-- never blocks the request or hits per-invocation limits.
CREATE TABLE IF NOT EXISTS announcement_deliveries (
  id              TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  user_id         TEXT,                              -- in-app notification target (if they have an account)
  email           TEXT,                              -- email target (if on file)
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending | sent | failed
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ann_deliveries_pending ON announcement_deliveries(status, created_at);
