-- Human-focused tenant CRM: a relationship timeline (notes, calls, visits, tasks).
CREATE TABLE IF NOT EXISTS tenant_interactions (
  id          TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  lease_id    TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'note', -- note | call | email | visit | task
  body        TEXT NOT NULL DEFAULT '',
  due_at      TEXT,                          -- for follow-up tasks
  done        INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_interactions_lease ON tenant_interactions(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_interactions_facility ON tenant_interactions(facility_id);

-- Seed a little relationship history for the demo daycare tenant.
INSERT INTO tenant_interactions (id, facility_id, lease_id, kind, body, created_by, created_at, updated_at) VALUES
  ('ti-1', 'fac-usr-demo-operator', 'lease-daycare', 'note', 'Signed a 12-month agreement. Lovely team — they keep Classroom 1 spotless.', 'usr-demo-operator', '2026-01-05T15:00:00.000Z', '2026-01-05T15:00:00.000Z'),
  ('ti-2', 'fac-usr-demo-operator', 'lease-daycare', 'call', 'Maria called about adding Fridays in the fall. Asked her to send dates.', 'usr-demo-operator', '2026-05-12T16:30:00.000Z', '2026-05-12T16:30:00.000Z')
ON CONFLICT(id) DO NOTHING;
INSERT INTO tenant_interactions (id, facility_id, lease_id, kind, body, due_at, done, created_by, created_at, updated_at) VALUES
  ('ti-3', 'fac-usr-demo-operator', 'lease-daycare', 'task', 'Follow up on the fall Friday expansion + renewal.', '2026-06-20T12:00:00.000Z', 0, 'usr-demo-operator', '2026-05-12T16:31:00.000Z', '2026-05-12T16:31:00.000Z')
ON CONFLICT(id) DO NOTHING;
