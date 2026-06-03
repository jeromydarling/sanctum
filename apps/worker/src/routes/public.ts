/**
 * Public, unauthenticated endpoints. The facility directory and public
 * facility/microsite pages come from HERE, never from the user-scoped hydrate
 * (which would clobber the global directory).
 */
import type { Env } from '../types.js';
import { json, err } from '../http.js';
import { decodeRow } from '../db.js';
import { TABLES } from '../schema.js';

/** GET /api/public/discover?city=&state=&type=&capacity= */
export async function handleDiscover(env: Env, url: URL): Promise<Response> {
  const city = url.searchParams.get('city')?.trim().toLowerCase();
  const state = url.searchParams.get('state')?.trim().toLowerCase();
  const type = url.searchParams.get('type')?.trim();
  const capacity = parseInt(url.searchParams.get('capacity') || '0', 10);

  const facilities = (
    await env.DB.prepare('SELECT * FROM facilities WHERE is_listed = 1').all<Record<string, unknown>>()
  ).results || [];

  const facIds = facilities.map((f) => f.id as string);
  let spaces: Record<string, unknown>[] = [];
  if (facIds.length) {
    const ph = facIds.map(() => '?').join(',');
    const res = await env.DB.prepare(
      `SELECT * FROM spaces WHERE is_active = 1 AND facility_id IN (${ph})`,
    ).bind(...facIds).all<Record<string, unknown>>();
    spaces = (res.results || []).map((s) => decodeRow(TABLES.spaces, s));
  }

  const out = facilities
    .map((f) => publicFacility(f, spaces.filter((s) => s.facility_id === f.id)))
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

  const spacesRes = await env.DB.prepare(
    'SELECT * FROM spaces WHERE facility_id = ? AND is_active = 1',
  ).bind(facility.id).all<Record<string, unknown>>();
  const spaces = (spacesRes.results || []).map((s) => decodeRow(TABLES.spaces, s));

  const reviewsRes = await env.DB.prepare(
    'SELECT id, rating, headline, body, operator_response, created_at FROM reviews WHERE facility_id = ? AND is_published = 1 ORDER BY created_at DESC LIMIT 20',
  ).bind(facility.id).all<Record<string, unknown>>();

  return json({
    facility: publicFacility(facility, spaces),
    reviews: reviewsRes.results || [],
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

function publicFacility(
  f: Record<string, unknown>,
  spaces: Record<string, unknown>[],
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
    spaces,
  };
}
