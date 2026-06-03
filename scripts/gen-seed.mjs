/**
 * Generates migrations/0002_seed.sql with demo accounts (PBKDF2 hashes computed
 * here, offline) + a rich demo facility so one-click demo works on the live DB.
 *
 * Run: node scripts/gen-seed.mjs
 */
import { writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const enc = new TextEncoder();
const ITER = 100_000;

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, km, 256);
  return { hash: toHex(bits), salt: b64url(salt) };
}

const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const NOW = '2026-06-01T12:00:00.000Z';

// Deterministic ids so the seed is idempotent.
const OP = 'usr-demo-operator';
const RENTER = 'usr-demo-renter';
const RENTER2 = 'usr-demo-renter2';
const ADMIN = 'usr-demo-admin';
const FAC = 'fac-usr-demo-operator';

const USERS = [
  { id: OP, email: 'operator@demo.sanctum.app', pw: 'sanctum-demo', name: 'Grace Okafor', role: 'operator', org: 'St. Brigid Community Center' },
  { id: RENTER, email: 'renter@demo.sanctum.app', pw: 'sanctum-demo', name: 'Marcus Bell', role: 'renter', org: 'Northside Youth Theater' },
  { id: RENTER2, email: 'renter2@demo.sanctum.app', pw: 'sanctum-demo', name: 'Lena Park', role: 'renter', org: 'Riverside Quilters Guild' },
  { id: ADMIN, email: 'admin@demo.sanctum.app', pw: 'sanctum-demo', name: 'Sanctum Admin', role: 'admin', org: null },
];

const SPACES = [
  { id: 'spc-hall', name: 'Fellowship Hall', type: 'fellowship_hall', cap: 200, sqft: 3200, hr: 12000, half: 40000, full: 70000, wkd: 15000, dep: 25000,
    desc: 'A bright, welcoming hall with hardwood floors, a stage, and a warming kitchen adjacent. Perfect for receptions, fundraisers, and community dinners.',
    amen: ['stage', 'kitchen_access', 'sound_system', 'wifi', 'parking', 'wheelchair_accessible', 'tables_chairs', 'restrooms'],
    uses: ['wedding', 'meeting', 'concert', 'community', 'class'] },
  { id: 'spc-chapel', name: 'The Chapel', type: 'chapel', cap: 80, sqft: 1100, hr: 9000, half: 30000, full: 50000, wkd: 12000, dep: 20000,
    desc: 'An intimate chapel with warm light and excellent acoustics. A serene setting for small ceremonies, recitals, and gatherings.',
    amen: ['piano', 'sound_system', 'wheelchair_accessible', 'parking', 'restrooms'],
    uses: ['wedding', 'concert', 'community'] },
  { id: 'spc-class', name: 'Classroom 1', type: 'classroom', cap: 30, sqft: 600, hr: 4000, half: 14000, full: 24000, wkd: 5000, dep: 5000,
    desc: 'A flexible classroom with movable tables, a projector, and fast Wi-Fi. Ideal for workshops, tutoring, and small meetings.',
    amen: ['projector', 'wifi', 'tables_chairs', 'air_conditioning', 'wheelchair_accessible'],
    uses: ['class', 'meeting', 'community'] },
  { id: 'spc-kitchen', name: 'Commercial Kitchen', type: 'kitchen', cap: 12, sqft: 800, hr: 8000, half: 28000, full: 48000, wkd: 10000, dep: 30000,
    desc: 'A fully-equipped commercial kitchen with two ovens, a six-burner range, prep tables, and ample cold storage. Health-department ready.',
    amen: ['kitchen_access', 'wifi', 'parking', 'restrooms'],
    uses: ['class', 'community'] },
  { id: 'spc-gym', name: 'Community Gym', type: 'gym', cap: 150, sqft: 5000, hr: 10000, half: 35000, full: 60000, wkd: 13000, dep: 20000,
    desc: 'A full-size gymnasium with a basketball court, bleachers, and an open floor plan. Great for sports, expos, and large gatherings.',
    amen: ['parking', 'restrooms', 'wheelchair_accessible', 'sound_system'],
    uses: ['community', 'meeting', 'concert'] },
];

const RESOURCES = [
  { id: 'res-tables', name: 'Round Tables (20)', type: 'furniture', qty: 20, flat: 5000 },
  { id: 'res-chairs', name: 'Folding Chairs (200)', type: 'furniture', qty: 200, flat: 4000 },
  { id: 'res-projector', name: 'Projector + Screen', type: 'av_equipment', qty: 1, flat: 3000 },
  { id: 'res-pa', name: 'PA System', type: 'av_equipment', qty: 1, flat: 4500 },
  { id: 'res-podium', name: 'Podium', type: 'furniture', qty: 1, flat: 1000 },
  { id: 'res-urn', name: 'Coffee Urn (100 cup)', type: 'kitchen', qty: 2, flat: 1500 },
];

function iso(daysFromSeed, hour) {
  const d = new Date('2026-06-01T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + daysFromSeed);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const BOOKINGS = [
  { id: 'bkg-1', space: 'spc-hall', renter: RENTER, name: 'Spring Benefit Dinner', type: 'community', att: 160, day: 12, sh: 17, eh: 22, sub: 70000, status: 'pending' },
  { id: 'bkg-2', space: 'spc-class', renter: RENTER2, name: 'Beginner Quilting Workshop', type: 'class', att: 18, day: 8, sh: 10, eh: 14, sub: 16000, status: 'approved' },
  { id: 'bkg-3', space: 'spc-chapel', renter: RENTER, name: 'Youth Spring Recital', type: 'concert', att: 70, day: 20, sh: 18, eh: 21, sub: 30000, status: 'confirmed' },
  { id: 'bkg-4', space: 'spc-gym', renter: RENTER2, name: 'Community Wellness Fair', type: 'community', att: 140, day: -10, sh: 9, eh: 15, sub: 60000, status: 'completed' },
  { id: 'bkg-5', space: 'spc-kitchen', renter: RENTER, name: 'Holiday Meal Prep', type: 'community', att: 10, day: -25, sh: 8, eh: 16, sub: 48000, status: 'completed' },
];

const REVIEWS = [
  { id: 'rev-1', booking: 'bkg-4', space: 'spc-gym', renter: RENTER2, rating: 5, headline: 'Spacious and welcoming', body: 'The gym was spotless and the staff helped us set up. Our wellness fair was a huge success.' },
  { id: 'rev-2', booking: 'bkg-5', space: 'spc-kitchen', renter: RENTER, rating: 5, headline: 'A dream kitchen', body: 'Everything we needed to cook for 300 neighbors. Booking and payment were effortless.' },
  { id: 'rev-3', booking: null, space: 'spc-hall', renter: RENTER2, rating: 4, headline: 'Beautiful hall', body: 'Gorgeous light and plenty of room. Would book again for our annual gala.' },
  { id: 'rev-4', booking: null, space: 'spc-chapel', renter: RENTER, rating: 5, headline: 'Perfect acoustics', body: 'Our recital sounded incredible in the chapel. The piano was well-tuned.' },
];

const COIS = [
  { id: 'coi-1', booking: 'bkg-2', renter: RENTER2, status: 'approved', insurer: 'Community Mutual', policy: 'CM-884213', cov: 100000000, exp: '2026-12-31' },
  { id: 'coi-2', booking: 'bkg-3', renter: RENTER, status: 'pending', insurer: 'Northside Insurance Co', policy: 'NS-771209', cov: 200000000, exp: '2026-09-15' },
  { id: 'coi-3', booking: 'bkg-1', renter: RENTER, status: 'pending', insurer: null, policy: null, cov: null, exp: null },
];

const LEADS = [
  { id: 'lead-1', name: 'Aisha Rahman', email: 'aisha@cityballet.org', org: 'City Youth Ballet', msg: 'Interested in the Fellowship Hall for a weekend recital in the fall.', space: 'spc-hall', stage: 'tour' },
  { id: 'lead-2', name: 'Tom Reilly', email: 'tom@reillyfamily.com', org: null, msg: 'Looking to rent the chapel for a 50th anniversary celebration.', space: 'spc-chapel', stage: 'inquiry' },
  { id: 'lead-3', name: 'Sofia Mendez', email: 'sofia@feedingneighbors.org', org: 'Feeding Neighbors', msg: 'We run a weekly meal program and need kitchen access.', space: 'spc-kitchen', stage: 'booked' },
];

async function main() {
  const lines = [];
  lines.push('-- Seed: demo accounts + demo facility. Generated by scripts/gen-seed.mjs.');
  lines.push('-- Idempotent via deterministic ids + ON CONFLICT DO NOTHING.\n');

  for (const u of USERS) {
    const { hash, salt } = await hashPassword(u.pw);
    lines.push(
      `INSERT INTO auth_credentials (user_id, email, password_hash, password_salt, created_at) VALUES (${q(u.id)}, ${q(u.email)}, ${q(hash)}, ${q(salt)}, ${q(NOW)}) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash, password_salt=excluded.password_salt;`,
    );
    lines.push(
      `INSERT INTO profiles (id, email, full_name, role, organization_name, created_at, updated_at) VALUES (${q(u.id)}, ${q(u.email)}, ${q(u.name)}, ${q(u.role)}, ${q(u.org)}, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
    );
  }

  lines.push(
    `\nINSERT INTO facilities (id, operator_id, name, slug, denomination, description, address, city, state, zip, phone, email, website, plan, subscription_status, is_listed, requires_approval, require_coi, stripe_onboarded, created_at, updated_at) VALUES (${q(FAC)}, ${q(OP)}, ${q('St. Brigid Community Center')}, ${q('st-brigid-community-center')}, ${q('Nondenominational')}, ${q('A neighborhood community center with spaces for every gathering — from wedding receptions in the Fellowship Hall to workshops, recitals, and shared meals. We believe a building that sits empty is a gift waiting to be given.')}, ${q('1420 Linden Avenue')}, ${q('Minneapolis')}, ${q('MN')}, ${q('55404')}, ${q('(612) 555-0142')}, ${q('hello@stbrigidcenter.org')}, ${q('https://stbrigidcenter.org')}, ${q('growth')}, ${q('active')}, 1, 1, 1, 1, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
  );

  for (const s of SPACES) {
    lines.push(
      `INSERT INTO spaces (id, facility_id, name, space_type, description, capacity_persons, square_footage, hourly_rate_cents, half_day_rate_cents, full_day_rate_cents, weekend_hourly_rate_cents, deposit_amount_cents, amenities, allowed_uses, is_active, created_at, updated_at) VALUES (${q(s.id)}, ${q(FAC)}, ${q(s.name)}, ${q(s.type)}, ${q(s.desc)}, ${s.cap}, ${s.sqft}, ${s.hr}, ${s.half}, ${s.full}, ${s.wkd}, ${s.dep}, ${q(JSON.stringify(s.amen))}, ${q(JSON.stringify(s.uses))}, 1, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
    );
  }

  for (const r of RESOURCES) {
    lines.push(
      `INSERT INTO resources (id, facility_id, name, resource_type, quantity, flat_rate_cents, is_active, created_at, updated_at) VALUES (${q(r.id)}, ${q(FAC)}, ${q(r.name)}, ${q(r.type)}, ${r.qty}, ${r.flat}, 1, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
    );
  }

  for (const b of BOOKINGS) {
    const fee = Math.round(b.sub * 0.015);
    lines.push(
      `INSERT INTO bookings (id, facility_id, space_id, renter_id, event_name, event_type, expected_attendance, start_time, end_time, subtotal_cents, total_cents, platform_fee_cents, status, created_at, updated_at) VALUES (${q(b.id)}, ${q(FAC)}, ${q(b.space)}, ${q(b.renter)}, ${q(b.name)}, ${q(b.type)}, ${b.att}, ${q(iso(b.day, b.sh))}, ${q(iso(b.day, b.eh))}, ${b.sub}, ${b.sub}, ${fee}, ${q(b.status)}, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
    );
  }

  for (const r of REVIEWS) {
    lines.push(
      `INSERT INTO reviews (id, booking_id, facility_id, space_id, renter_id, rating, headline, body, is_published, created_at, updated_at) VALUES (${q(r.id)}, ${q(r.booking)}, ${q(FAC)}, ${q(r.space)}, ${q(r.renter)}, ${r.rating}, ${q(r.headline)}, ${q(r.body)}, 1, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
    );
  }

  for (const c of COIS) {
    lines.push(
      `INSERT INTO compliance_docs (id, booking_id, renter_id, facility_id, doc_type, status, insurer_name, policy_number, coverage_amount_cents, expiration_date, uploaded_at, updated_at) VALUES (${q(c.id)}, ${q(c.booking)}, ${q(c.renter)}, ${q(FAC)}, 'certificate_of_insurance', ${q(c.status)}, ${q(c.insurer)}, ${q(c.policy)}, ${c.cov === null ? 'NULL' : c.cov}, ${q(c.exp)}, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
    );
  }

  for (const l of LEADS) {
    lines.push(
      `INSERT INTO leads (id, facility_id, name, email, organization, message, space_id, stage, created_at, updated_at) VALUES (${q(l.id)}, ${q(FAC)}, ${q(l.name)}, ${q(l.email)}, ${q(l.org)}, ${q(l.msg)}, ${q(l.space)}, ${q(l.stage)}, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
    );
  }

  // Two invoices: one paid, one sent.
  lines.push(
    `INSERT INTO invoices (id, facility_id, booking_id, renter_id, invoice_number, line_items, subtotal_cents, total_cents, platform_fee_cents, status, paid_at, created_at, updated_at) VALUES ('inv-1', ${q(FAC)}, 'bkg-4', ${q(RENTER2)}, 'INV-20260522-A1B2C', ${q(JSON.stringify([{ label: 'Community Wellness Fair', quantity: 1, unit_cents: 60000, amount_cents: 60000 }]))}, 60000, 60000, 900, 'paid', ${q(NOW)}, ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
  );
  lines.push(
    `INSERT INTO invoices (id, facility_id, booking_id, renter_id, invoice_number, line_items, subtotal_cents, total_cents, platform_fee_cents, status, created_at, updated_at) VALUES ('inv-2', ${q(FAC)}, 'bkg-5', ${q(RENTER)}, 'INV-20260507-D3E4F', ${q(JSON.stringify([{ label: 'Holiday Meal Prep', quantity: 1, unit_cents: 48000, amount_cents: 48000 }]))}, 48000, 48000, 720, 'sent', ${q(NOW)}, ${q(NOW)}) ON CONFLICT(id) DO NOTHING;`,
  );

  writeFileSync(new URL('../migrations/0002_seed.sql', import.meta.url), lines.join('\n') + '\n');
  console.log(`Wrote migrations/0002_seed.sql (${lines.length} statements)`);
}

main();
