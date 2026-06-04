-- White-label networks (diocese / association / conference) owning many facilities.
CREATE TABLE IF NOT EXISTS networks (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  brand_primary TEXT NOT NULL DEFAULT '#4338ca',
  logo_url      TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

ALTER TABLE facilities ADD COLUMN network_id TEXT;

-- Demo network owning the demo facility.
INSERT INTO networks (id, owner_id, name, slug, description, brand_primary, created_at, updated_at)
VALUES ('net-tcfn', 'usr-demo-operator', 'Twin Cities Faith Network', 'twin-cities-faith-network',
  'A network of welcoming community spaces across the Twin Cities — open doors, shared flourishing.',
  '#3b5bdb', '2026-06-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z')
ON CONFLICT(id) DO NOTHING;
UPDATE facilities SET network_id = 'net-tcfn' WHERE id = 'fac-usr-demo-operator';
