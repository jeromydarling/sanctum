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
});
