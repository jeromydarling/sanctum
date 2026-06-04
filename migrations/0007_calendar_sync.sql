-- Two-way calendar sync.
-- Per-facility token for the outbound iCal subscribe feed.
ALTER TABLE facilities ADD COLUMN ical_token TEXT;
-- The church's own external calendar (Google/Outlook/iCal) to import & block against.
ALTER TABLE facilities ADD COLUMN external_ical_url TEXT;
-- Distinguish operator-made blocks from imported ones (so re-sync can replace cleanly).
ALTER TABLE availability_blocks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
