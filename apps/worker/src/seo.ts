/**
 * Server-side SEO for the SPA. The Worker runs first (run_worker_first), serves
 * the static assets via env.ASSETS, and rewrites per-route <head> metadata with
 * HTMLRewriter — so crawlers and social cards see page-specific titles,
 * descriptions, canonical URLs, and images instead of one generic shell. Also
 * serves /sitemap.xml, /robots.txt, and /llms.txt.
 */
import type { Env } from './types.js';

export interface Meta {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType: string;
  noindex?: boolean;
}

const MAX_TITLE = 60;
const MAX_DESC = 155;

function clip(s: string, max: number): string {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function base(env: Env): string {
  return (env.APP_URL || 'https://sanctum.garden').replace(/\/$/, '');
}

// Static, indexable marketing routes → concise title/description.
const STATIC: Record<string, { title: string; description: string }> = {
  '/': { title: 'Sanctum — Open doors. Stronger communities.', description: 'Turn your community’s empty rooms into shared flourishing. List spaces, take bookings, and open your doors — with a transparent 1.5% fee.' },
  '/find': { title: 'Find a community space near you · Sanctum', description: 'Search welcoming halls, chapels, kitchens, gyms, and classrooms to rent for your next gathering — by city, type, and capacity.' },
  '/features': { title: 'Every feature · Sanctum', description: 'Recurring tenants, calendar sync, e-sign agreements, deposits, discovery, AI onboarding, and more — everything a community space needs.' },
  '/pricing': { title: 'Honest pricing, in plain sight · Sanctum', description: 'Simple monthly plans plus a transparent 1.5% per paid booking. Priced for access, not extraction. Your first 30 days are free.' },
  '/about': { title: 'Our mission · Sanctum', description: 'A building that sits empty is a gift waiting to be given. Sanctum helps community spaces open their doors and strengthen their neighborhoods.' },
  '/privacy': { title: 'Privacy commitment · Sanctum', description: 'How Sanctum protects your data and your community’s trust. Export or delete everything you own, anytime.' },
};

// App/auth routes: real content lives behind auth — keep them out of the index.
const NOINDEX_PREFIXES = ['/operator', '/renter', '/admin', '/book', '/login', '/signup', '/forgot', '/reset', '/verify'];

/** Resolve metadata for a path, hitting D1 for dynamic public pages. */
export async function metaForPath(env: Env, path: string): Promise<Meta> {
  const b = base(env);
  const canonical = `${b}${path === '/' ? '/' : path.replace(/\/$/, '')}`;
  const home = STATIC['/'];

  if (STATIC[path]) {
    return { ...STATIC[path], title: clip(STATIC[path].title, MAX_TITLE), description: clip(STATIC[path].description, MAX_DESC), canonical, ogType: 'website' };
  }

  const seg = path.split('/').filter(Boolean);
  try {
    // Public facility page: /c/:slug
    if (seg[0] === 'c' && seg[1]) {
      const f = await env.DB.prepare('SELECT name, city, state, description, cover_image_url FROM facilities WHERE slug = ? AND is_listed = 1')
        .bind(decodeURIComponent(seg[1])).first<{ name: string; city: string; state: string; description: string | null; cover_image_url: string | null }>();
      if (f) {
        const loc = [f.city, f.state].filter(Boolean).join(', ');
        return {
          title: clip(`${f.name}${loc ? ` — ${loc}` : ''} · Sanctum`, MAX_TITLE),
          description: clip(f.description || `Rent space at ${f.name}${loc ? ` in ${loc}` : ''}. Book welcoming community rooms for your next gathering.`, MAX_DESC),
          canonical, ogImage: f.cover_image_url || undefined, ogType: 'place',
        };
      }
    }
    // Public event page: /e/:slug
    if (seg[0] === 'e' && seg[1]) {
      const s = await env.DB.prepare('SELECT title, content FROM event_microsites WHERE slug = ? AND is_published = 1')
        .bind(decodeURIComponent(seg[1])).first<{ title: string; content: string }>();
      if (s) {
        let body = '', cover = '';
        try { const c = JSON.parse(s.content || '{}'); body = c.body || c.headline || ''; cover = c.cover || ''; } catch { /* ignore */ }
        return { title: clip(`${s.title} · Sanctum`, MAX_TITLE), description: clip(body || `You're invited to ${s.title}.`, MAX_DESC), canonical, ogImage: cover || undefined, ogType: 'event' };
      }
    }
    // White-label network page: /n/:slug
    if (seg[0] === 'n' && seg[1]) {
      const n = await env.DB.prepare('SELECT name, description, logo_url FROM networks WHERE slug = ?')
        .bind(decodeURIComponent(seg[1])).first<{ name: string; description: string | null; logo_url: string | null }>();
      if (n) {
        return { title: clip(`${n.name} · Sanctum`, MAX_TITLE), description: clip(n.description || `Discover welcoming community spaces across the ${n.name}.`, MAX_DESC), canonical, ogImage: n.logo_url || undefined, ogType: 'website' };
      }
    }
  } catch { /* fall through to default */ }

  const noindex = NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  return { title: clip(home.title, MAX_TITLE), description: clip(home.description, MAX_DESC), canonical: noindex ? canonical : `${b}/`, ogType: 'website', noindex };
}

class Attr {
  constructor(private name: string, private value: string) {}
  element(el: Element) { el.setAttribute(this.name, this.value); }
}
class Text {
  constructor(private value: string) {}
  element(el: Element) { el.setInnerContent(this.value); }
}
class HeadAppender {
  constructor(private html: string) {}
  element(el: Element) { if (this.html) el.append(this.html, { html: true }); }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Rewrite an HTML shell response with per-route metadata. */
export function injectMeta(res: Response, meta: Meta, env: Env): Response {
  const extra = [
    meta.ogImage ? `<meta property="og:image" content="${esc(meta.ogImage)}" />` : '',
    meta.ogImage ? `<meta name="twitter:image" content="${esc(meta.ogImage)}" />` : '',
    env.GSC_VERIFICATION ? `<meta name="google-site-verification" content="${esc(env.GSC_VERIFICATION)}" />` : '',
  ].filter(Boolean).join('');

  return new HTMLRewriter()
    .on('title', new Text(meta.title))
    .on('meta[name="description"]', new Attr('content', meta.description))
    .on('link[rel="canonical"]', new Attr('href', meta.canonical))
    .on('meta[name="robots"]', new Attr('content', meta.noindex ? 'noindex,follow' : 'index,follow'))
    .on('meta[property="og:title"]', new Attr('content', meta.title))
    .on('meta[property="og:description"]', new Attr('content', meta.description))
    .on('meta[property="og:url"]', new Attr('content', meta.canonical))
    .on('meta[property="og:type"]', new Attr('content', meta.ogType))
    .on('meta[name="twitter:title"]', new Attr('content', meta.title))
    .on('meta[name="twitter:description"]', new Attr('content', meta.description))
    .on('head', new HeadAppender(extra))
    .transform(res);
}

/** GET /sitemap.xml — marketing routes + listed facilities, events, networks. */
export async function sitemap(env: Env): Promise<Response> {
  const b = base(env);
  const urls: { loc: string; priority: string }[] = Object.keys(STATIC).map((p) => ({ loc: `${b}${p === '/' ? '/' : p}`, priority: p === '/' ? '1.0' : '0.8' }));
  try {
    const facs = (await env.DB.prepare('SELECT slug FROM facilities WHERE is_listed = 1').all<{ slug: string }>()).results || [];
    for (const f of facs) urls.push({ loc: `${b}/c/${encodeURIComponent(f.slug)}`, priority: '0.7' });
    const evs = (await env.DB.prepare('SELECT slug FROM event_microsites WHERE is_published = 1').all<{ slug: string }>()).results || [];
    for (const e of evs) urls.push({ loc: `${b}/e/${encodeURIComponent(e.slug)}`, priority: '0.5' });
    const nets = (await env.DB.prepare('SELECT slug FROM networks').all<{ slug: string }>()).results || [];
    for (const n of nets) urls.push({ loc: `${b}/n/${encodeURIComponent(n.slug)}`, priority: '0.5' });
  } catch { /* still return the static routes */ }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

/** GET /robots.txt */
export function robots(env: Env): Response {
  const b = base(env);
  const body = `User-agent: *\nAllow: /\nDisallow: /operator\nDisallow: /renter\nDisallow: /admin\nDisallow: /book\n\nSitemap: ${b}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}

/** GET /llms.txt — a linked guide for AI assistants. */
export function llms(env: Env): Response {
  const b = base(env);
  const body = `# Sanctum

> Open doors. Stronger communities. Sanctum is an all-in-one platform that helps community spaces — churches, community centers, and civic buildings — rent and share their rooms with the neighborhood. Transparent pricing: a small monthly plan plus 1.5% per paid booking.

## Pages
- [Home](${b}/): what Sanctum is and who it's for
- [Find a space](${b}/find): discover community spaces to rent near you
- [Features](${b}/features): recurring tenants, calendar sync, e-sign agreements, deposits, discovery, and AI onboarding
- [Pricing](${b}/pricing): plans and the transparent 1.5% booking fee
- [Our mission](${b}/about): why Sanctum exists — a building that sits empty is a gift waiting to be given
- [Privacy](${b}/privacy): how we protect your data

## For operators
Community spaces list their rooms, set rates (or offer them free / by donation), take bookings and payment, manage recurring tenants, and sign use agreements — all in one place.

## For renters
Groups find welcoming, affordable spaces, book online, sign the agreement, and pay securely.
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
