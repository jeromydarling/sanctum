-- Platform-level CRM notes for the super-admin customer area. Mirrors
-- crm_interactions but scoped to the whole platform (a customer = an operator /
-- their facility), not to a single facility's tenants. Admin-only.
CREATE TABLE IF NOT EXISTS admin_notes (
  id           TEXT PRIMARY KEY,
  subject_kind TEXT NOT NULL,            -- 'operator' | 'facility'
  subject_id   TEXT NOT NULL,
  kind         TEXT NOT NULL,            -- 'note' | 'call' | 'email' | 'task'
  body         TEXT,
  due_at       TEXT,
  done         INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_notes_subject ON admin_notes(subject_kind, subject_id);
