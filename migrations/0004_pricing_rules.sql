-- Pricing rules: per-facility discounts by renter organization type.
CREATE TABLE IF NOT EXISTS pricing_rules (
  id               TEXT PRIMARY KEY,
  facility_id      TEXT NOT NULL,
  org_type         TEXT NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(facility_id, org_type)
);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_facility ON pricing_rules(facility_id);

-- Seed the demo facility with a 25% nonprofit discount and 10% school discount.
INSERT INTO pricing_rules (id, facility_id, org_type, discount_percent, created_at, updated_at)
VALUES
  ('pr-nonprofit', 'fac-usr-demo-operator', 'nonprofit', 25, '2026-06-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z'),
  ('pr-school', 'fac-usr-demo-operator', 'school', 10, '2026-06-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z')
ON CONFLICT(facility_id, org_type) DO NOTHING;
