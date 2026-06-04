-- Generalize the relationship log so it covers BOTH recurring tenants (leases) and
-- one-off renters. Additive + copy (the old tenant_interactions table is left in
-- place so the currently-deployed Worker keeps working during the rollout).
CREATE TABLE IF NOT EXISTS crm_interactions (
  id           TEXT PRIMARY KEY,
  facility_id  TEXT NOT NULL,
  subject_kind TEXT NOT NULL DEFAULT 'renter',  -- 'lease' | 'renter'
  subject_id   TEXT NOT NULL,                    -- lease id or renter id
  kind         TEXT NOT NULL DEFAULT 'note',     -- note | call | email | visit | reminder
  body         TEXT NOT NULL DEFAULT '',
  due_at       TEXT,
  done         INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_crm_subject ON crm_interactions(subject_kind, subject_id);
CREATE INDEX IF NOT EXISTS idx_crm_facility ON crm_interactions(facility_id);

INSERT INTO crm_interactions (id, facility_id, subject_kind, subject_id, kind, body, due_at, done, created_by, created_at, updated_at)
  SELECT id, facility_id, 'lease', lease_id, kind, body, due_at, done, created_by, created_at, updated_at
  FROM tenant_interactions
  WHERE NOT EXISTS (SELECT 1 FROM crm_interactions c WHERE c.id = tenant_interactions.id);
