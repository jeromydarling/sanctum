-- Demo event microsite so the public /e/:slug route works on a fresh deploy.
INSERT INTO event_microsites (id, facility_id, renter_id, booking_id, slug, title, content, is_published, rsvp_enabled, created_at, updated_at)
VALUES (
  'site-1', 'fac-usr-demo-operator', 'usr-demo-renter', 'bkg-3', 'youth-spring-recital', 'Youth Spring Recital',
  '{"headline":"Youth Spring Recital","date":"June 21, 2026 · 6:00 PM","location":"The Chapel, St. Brigid Community Center","body":"Join us for an evening of music as our young performers share the songs they''ve worked on all season. Doors open at 5:30. Light refreshments to follow.","cta":"RSVP","theme":"indigo"}',
  1, 1, '2026-06-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z'
) ON CONFLICT(id) DO NOTHING;
