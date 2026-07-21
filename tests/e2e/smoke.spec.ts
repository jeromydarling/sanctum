import { test, expect } from '@playwright/test';

/**
 * Public, unauthenticated surfaces + API health. Creates no accounts.
 * Runs on both desktop and mobile projects.
 */
test.describe('public smoke', () => {
  test('home loads with title and hero', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sanctum/i);
    await expect(page.getByRole('heading', { name: /sitting empty/i })).toBeVisible();
  });

  test('primary CTA routes to signup', async ({ page }) => {
    await page.goto('/');
    // The hero CTA is a real <button> (nav uses <a> links), so this targets the
    // hero specifically — and it's visible on mobile where the nav buttons hide.
    await page.getByRole('button', { name: 'Open your doors' }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: 'Open your doors' })).toBeVisible();
  });

  test('find page renders discovery UI', async ({ page }) => {
    await page.goto('/find');
    await expect(page.getByRole('heading', { name: /find a space near you/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search', exact: true }).first()).toBeVisible();
  });

  test('features and pricing pages render', async ({ page }) => {
    await page.goto('/features');
    await expect(page.getByRole('heading', { name: /touch every corner/i })).toBeVisible();
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /honest pricing/i })).toBeVisible();
  });

  test('API: health, config, and discover return expected shape', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    expect((await health.json()).ok).toBe(true);

    const config = await request.get('/api/config');
    expect(config.ok()).toBeTruthy();
    expect(await config.json()).toHaveProperty('turnstile_site_key');

    const discover = await request.get('/api/public/discover');
    expect(discover.ok()).toBeTruthy();
    const body = await discover.json();
    expect(Array.isArray(body.facilities)).toBe(true);
  });

  test('SEO: sitemap, robots, llms, and per-route meta', async ({ request }) => {
    const sm = await request.get('/sitemap.xml');
    expect(sm.ok()).toBeTruthy();
    const smx = await sm.text();
    expect(smx).toContain('<urlset');
    expect(smx).toContain('/c/'); // dynamic facility routes are listed

    const rb = await request.get('/robots.txt');
    expect(rb.ok()).toBeTruthy();
    expect(await rb.text()).toMatch(/Sitemap:\s*https?:\/\//);

    const llm = await request.get('/llms.txt');
    expect(llm.ok()).toBeTruthy();
    expect(await llm.text()).toContain('](http'); // has links for AI assistants

    // Per-route <head> injection on a static marketing route (needs no seed data).
    // Dynamic per-facility meta is covered in marketplace.spec against a listing
    // the test creates itself.
    const pricing = await request.get('/pricing');
    expect(pricing.ok()).toBeTruthy();
    const html = await pricing.text();
    expect(html).toMatch(/<title>[^<]*[Pp]ricing/);
    expect(html).toContain('property="og:title"');
    // A social share image (default branded card) and structured data.
    expect(html).toMatch(/property="og:image"[^>]*og\.png/);
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"WebSite"');

    // The branded OG image is actually served.
    const og = await request.get('/og.png');
    expect(og.ok()).toBeTruthy();
    expect(og.headers()['content-type']).toContain('image/png');
  });
});
