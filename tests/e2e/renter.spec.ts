import { test, expect, type Page } from '@playwright/test';
import { signUp, signOut, sweepPages, purgeUser, uniqueEmail, PASSWORD } from './helpers.js';

/**
 * The renter side of "a real user does everything": a brand-new renter account,
 * signed up live, walked through every renter screen, creating an event page and
 * editing settings — each re-checked after a reload to prove DB persistence.
 * Self-cleaning via afterAll purge.
 */
test.describe.configure({ mode: 'serial' });

const RENTER_PAGES: [string, RegExp][] = [
  ['/renter', /Find a space/],
  ['/renter/bookings', /My bookings/],
  ['/renter/documents', /My documents/],
  ['/renter/sites', /Event pages/],
  ['/renter/learn', /Learning hub/],
  ['/renter/settings', /^Settings$/],
];

test.describe('renter journey', () => {
  let page: Page;
  const email = uniqueEmail('renter');
  const runId = Date.now();

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async ({ playwright }) => {
    const baseURL = process.env.BASE_URL || 'https://sanctum.garden';
    const ctx = await playwright.request.newContext({ baseURL });
    await purgeUser(ctx, email);
    await ctx.dispose();
    await page.close();
  });

  test('signs up a new renter and lands on discovery', async () => {
    await signUp(page, { email, password: PASSWORD, name: 'E2E Renter', org: `E2E Troupe ${runId}`, role: 'renter' });
    await expect(page).toHaveURL(/\/renter$/);
    await expect(page.getByRole('heading', { name: /Find a space/ })).toBeVisible({ timeout: 20_000 });
  });

  test('every renter page renders', async () => {
    await sweepPages(page, RENTER_PAGES);
  });

  test('creates an event page that persists across reload', async () => {
    const title = `E2E Event ${runId}`;
    await page.goto('/renter/sites');
    await expect(page.getByRole('heading', { name: /Event pages/ })).toBeVisible();

    await page.getByRole('button', { name: /New event page/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Event title').fill(title);
    await dialog.getByRole('button', { name: /Create & edit/ }).click();

    // Creation hard-navigates (window.location) to the builder — itself a full
    // page load that re-fetches the new page from D1. The Headline field
    // re-populating from the server proves it persisted. (We let this load settle
    // rather than reloading again, which would abort the in-flight /auth/me.)
    await expect(page).toHaveURL(/\/renter\/sites\/.+/, { timeout: 20_000 });
    await expect(page.getByLabel('Headline')).toHaveValue(title, { timeout: 20_000 });

    // It also shows up in the list of event pages.
    await page.goto('/renter/sites');
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20_000 });
  });

  test('saves profile settings that persist across reload', async () => {
    const newName = `E2E Renter ${runId}`;
    await page.goto('/renter/settings');
    await expect(page.getByRole('heading', { name: /^Settings$/ })).toBeVisible();

    await page.getByLabel('Full name').fill(newName);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Profile saved')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel('Full name')).toHaveValue(newName, { timeout: 15_000 });
  });

  test('session survives a cold reload, then signs out', async () => {
    await page.goto('/renter');
    await page.reload();
    await expect(page.getByRole('heading', { name: /Find a space/ })).toBeVisible({ timeout: 15_000 });
    await signOut(page);
    await page.goto('/renter');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  });
});
