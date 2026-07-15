-- Coarse fixed-window rate limiting for public/auth endpoints (abuse + spam
-- defense that complements Turnstile). bucket = "action:ip:windowIndex".
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
