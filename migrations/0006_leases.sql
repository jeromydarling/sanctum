-- Recurring arrangements: weekly tenants, classes, long-term leases.
CREATE TABLE IF NOT EXISTS leases (
  id                 TEXT PRIMARY KEY,
  facility_id        TEXT NOT NULL,
  space_id           TEXT NOT NULL,
  renter_id          TEXT,                 -- optional linked account
  title              TEXT NOT NULL,        -- "Little Lambs Daycare"
  tenant_name        TEXT,
  tenant_email       TEXT,
  cadence            TEXT NOT NULL DEFAULT 'weekly', -- weekly | biweekly | monthly
  weekdays           TEXT NOT NULL DEFAULT '[]',     -- JSON [0..6], 0=Sun
  start_time_local   TEXT NOT NULL DEFAULT '09:00',
  end_time_local     TEXT NOT NULL DEFAULT '17:00',
  start_date         TEXT NOT NULL,
  end_date           TEXT,                 -- null = ongoing
  rate_cents         INTEGER NOT NULL DEFAULT 0,
  rate_period        TEXT NOT NULL DEFAULT 'month',  -- month | session
  status             TEXT NOT NULL DEFAULT 'active', -- active | paused | ended
  notes              TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_leases_facility ON leases(facility_id);
CREATE INDEX IF NOT EXISTS idx_leases_space ON leases(space_id);

-- A demo tenant on the Classroom: a weekday daycare paying monthly.
INSERT INTO leases (id, facility_id, space_id, title, tenant_name, tenant_email, cadence, weekdays, start_time_local, end_time_local, start_date, rate_cents, rate_period, status, created_at, updated_at)
VALUES ('lease-daycare', 'fac-usr-demo-operator', 'spc-class', 'Little Lambs Daycare', 'Maria Gomez', 'maria@littlelambs.org', 'weekly', '[1,2,3,4,5]', '08:00', '15:00', '2026-01-05', 120000, 'month', 'active', '2026-06-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z')
ON CONFLICT(id) DO NOTHING;
