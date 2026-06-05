/**
 * Public, unauthenticated endpoints. The facility directory and public
 * facility/microsite pages come from HERE, never from the user-scoped hydrate
 * (which would clobber the global directory).
 */
import type { Env } from '../types.js';
import { json, err, readJson, genId, nowISO, clientIP } from '../http.js';
import { decodeRow } from '../db.js';
import { TABLES } from '../schema.js';
import { verifyTurnstile } from '../turnstile.js';

/** GET /api/public/discover?city=&state=&type=&capacity= */
export async function handleDiscover(env: Env, url: URL): Promise<Response> {
  const city = url.searchParams.get('city')?.trim().toLowerCase();
  const state = url.searchParams.get('state')?.trim().toLowerCase();
  const type = url.searchParams.get('type')?.trim();
  const capacity = parseInt(url.searchParams.get('capacity') || '0', 10);

  const facilities = ((
    await env.DB.prepare('SELECT * FROM facilities WHERE is_listed = 1').all<Record<string, unknown>>()
  ).results || []).map((f) => decodeRow(TABLES.facilities, f));

  const facIds = facilities.map((f) => f.id as string);
  let spaces: Record<string, unknown>[] = [];
  let rules: Record<string, unknown>[] = [];
  if (facIds.length) {
    const ph = facIds.map(() => '?').join(',');
    const res = await env.DB.prepare(
      `SELECT * FROM spaces WHERE is_active = 1 AND facility_id IN (${ph})`,
    ).bind(...facIds).all<Record<string, unknown>>();
    spaces = (res.results || []).map((s) => decodeRow(TABLES.spaces, s));
    const rres = await env.DB.prepare(`SELECT * FROM pricing_rules WHERE facility_id IN (${ph})`).bind(...facIds).all<Record<string, unknown>>();
    rules = rres.results || [];
  }

  const out = facilities
    .map((f) => publicFacility(f, spaces.filter((s) => s.facility_id === f.id), rules.filter((r) => r.facility_id === f.id)))
    .filter((f) => {
      if (city && !String(f.city).toLowerCase().includes(city)) return false;
      if (state && !String(f.state).toLowerCase().includes(state)) return false;
      if (type && !f.spaces.some((s) => s.space_type === type)) return false;
      if (capacity && !f.spaces.some((s) => Number(s.capacity_persons || 0) >= capacity)) return false;
      return f.spaces.length > 0;
    });

  return json({ facilities: out });
}

/** GET /api/public/facility/:slug */
export async function handleFacilityBySlug(env: Env, slug: string): Promise<Response> {
  const facility = await env.DB.prepare('SELECT * FROM facilities WHERE slug = ? AND is_listed = 1')
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!facility) return err('Facility not found', 404);
  const facilityRow = decodeRow(TABLES.facilities, facility);

  const spacesRes = await env.DB.prepare(
    'SELECT * FROM spaces WHERE facility_id = ? AND is_active = 1',
  ).bind(facility.id).all<Record<string, unknown>>();
  const spaces = (spacesRes.results || []).map((s) => decodeRow(TABLES.spaces, s));

  const rulesRes = await env.DB.prepare('SELECT * FROM pricing_rules WHERE facility_id = ?').bind(facility.id).all<Record<string, unknown>>();

  const reviewsRes = await env.DB.prepare(
    'SELECT id, rating, headline, body, operator_response, created_at FROM reviews WHERE facility_id = ? AND is_published = 1 ORDER BY created_at DESC LIMIT 20',
  ).bind(facility.id).all<Record<string, unknown>>();

  return json({
    facility: publicFacility(facilityRow, spaces, rulesRes.results || []),
    reviews: reviewsRes.results || [],
  });
}

/** GET /api/public/network/:slug — white-label network page with its facilities. */
export async function handleNetworkBySlug(env: Env, slug: string): Promise<Response> {
  const network = await env.DB.prepare('SELECT id, name, slug, description, brand_primary, logo_url FROM networks WHERE slug = ?')
    .bind(slug).first<Record<string, unknown>>();
  if (!network) return err('Network not found', 404);

  const facsRes = await env.DB.prepare('SELECT * FROM facilities WHERE network_id = ? AND is_listed = 1').bind(network.id).all<Record<string, unknown>>();
  const facilities = (facsRes.results || []).map((f) => decodeRow(TABLES.facilities, f));
  const facIds = facilities.map((f) => f.id as string);
  let spaces: Record<string, unknown>[] = [];
  if (facIds.length) {
    const ph = facIds.map(() => '?').join(',');
    const res = await env.DB.prepare(`SELECT * FROM spaces WHERE is_active = 1 AND facility_id IN (${ph})`).bind(...facIds).all<Record<string, unknown>>();
    spaces = (res.results || []).map((s) => decodeRow(TABLES.spaces, s));
  }
  return json({
    network,
    facilities: facilities.map((f) => publicFacility(f, spaces.filter((s) => s.facility_id === f.id))),
  });
}

/** GET /api/public/event/:slug — published event microsite. */
export async function handleEventBySlug(env: Env, slug: string): Promise<Response> {
  const site = await env.DB.prepare(
    'SELECT * FROM event_microsites WHERE slug = ? AND is_published = 1',
  ).bind(slug).first<Record<string, unknown>>();
  if (!site) return err('Event page not found', 404);
  return json({ site: decodeRow(TABLES.event_microsites, site) });
}

/** POST /api/public/inquiry — public lead capture (creates a lead + notifies operator). */
export async function handleInquiry(env: Env, req: Request): Promise<Response> {
  const b = await readJson<{ facility_id?: string; name?: string; email?: string; organization?: string; message?: string; space_id?: string; turnstile_token?: string }>(req);
  if (!(await verifyTurnstile(env, b.turnstile_token, clientIP(req)))) {
    return err('Please complete the verification challenge', 403);
  }
  if (!b.facility_id || !b.name?.trim() || !b.message?.trim()) {
    return err('Please include your name and a message', 422);
  }
  const facility = await env.DB.prepare('SELECT id, operator_id, name FROM facilities WHERE id = ? AND is_listed = 1')
    .bind(b.facility_id)
    .first<{ id: string; operator_id: string; name: string }>();
  if (!facility) return err('Facility not found', 404);

  const ts = nowISO();
  await env.DB.prepare(
    `INSERT INTO leads (id, facility_id, name, email, organization, message, space_id, stage, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'inquiry', ?, ?)`,
  ).bind(genId('lead'), b.facility_id, b.name.trim(), b.email || null, b.organization || null, b.message.trim(), b.space_id || null, ts, ts).run();

  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, is_read, action_url, created_at, updated_at)
     VALUES (?, ?, 'New inquiry', ?, 'lead', 0, '/operator/leads', ?, ?)`,
  ).bind(genId('ntf'), facility.operator_id, `${b.name} asked about your spaces.`, ts, ts).run();

  return json({ ok: true });
}

function publicFacility(
  f: Record<string, unknown>,
  spaces: Record<string, unknown>[],
  pricingRules: Record<string, unknown>[] = [],
): Record<string, unknown> & { spaces: Record<string, unknown>[] } {
  return {
    id: f.id,
    name: f.name,
    slug: f.slug,
    denomination: f.denomination,
    description: f.description,
    city: f.city,
    state: f.state,
    zip: f.zip,
    address: f.address,
    phone: f.phone,
    email: f.email,
    website: f.website,
    logo_url: f.logo_url,
    cover_image_url: f.cover_image_url,
    requires_approval: f.requires_approval,
    use_agreement_text: f.use_agreement_text,
    translations: f.translations,
    spaces,
    pricing_rules: pricingRules.map((r) => ({ org_type: r.org_type, discount_percent: r.discount_percent })),
  };
}
