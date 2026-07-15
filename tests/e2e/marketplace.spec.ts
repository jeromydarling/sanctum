import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { signUp, purgeUser, uniqueEmail, PASSWORD, PURGE_TOKEN } from './helpers.js';

/**
 * The real marketplace money path, fully self-provisioning (no seed data):
 * an operator signs up, lists a space in a unique city, then a *different*
 * account discovers it, books, and pays — the booking really transitions to
 * confirmed (simulated charge), and the operator sees it. Two browser contexts,
 * both self-cleaning.
 */
test.describe.configure({ mode: 'serial' });

test.describe('marketplace: list → discover → book → pay → confirmed', () => {
  let opCtx: BrowserContext, rtCtx: BrowserContext;
  let opPage: Page, rtPage: Page;
  const opEmail = uniqueEmail('mktop');
  const rtEmail = uniqueEmail('mktrent');
  const runId = Date.now();
  const city = `E2Eville${runId}`;
  const orgName = `E2E Center ${runId}`;
  const spaceName = `E2E Hall ${runId}`;
  const eventName = `E2E Mkt Booking ${runId}`;
  let facilityId = '';
  let spaceId = '';
  let facilitySlug = '';

  test.beforeAll(async ({ browser }) => {
    // Both contexts carry the guard token so payouts/payment simulate for e2e+ accounts.
    opCtx = await browser.newContext({ extraHTTPHeaders: { 'x-e2e-token': PURGE_TOKEN } });
    rtCtx = await browser.newContext({ extraHTTPHeaders: { 'x-e2e-token': PURGE_TOKEN } });
    opPage = await opCtx.newPage();
    rtPage = await rtCtx.newPage();
  });

  test.afterAll(async ({ playwright }) => {
    const baseURL = process.env.BASE_URL || 'https://sanctum.garden';
    const ctx = await playwright.request.newContext({ baseURL });
    await purgeUser(ctx, opEmail);
    await purgeUser(ctx, rtEmail);
    await ctx.dispose();
    await opCtx.close();
    await rtCtx.close();
  });

  test('operator lists a space in a unique city', async () => {
    await signUp(opPage, { email: opEmail, password: PASSWORD, name: 'E2E MktOp', org: orgName, role: 'operator' });
    await opPage.getByRole('button', { name: 'Skip for now' }).click();
    await expect(opPage).toHaveURL(/\/operator$/);

    await opPage.goto('/operator/settings');
    await expect(opPage.getByRole('heading', { name: /^Settings$/ })).toBeVisible();
    await opPage.getByLabel('City').fill(city);
    const listToggle = opPage.getByLabel(/List us in public discovery/);
    if (!(await listToggle.isChecked())) await listToggle.check();
    // Capture the write result (surfaces the HTTP status on failure) instead of
    // depending on a transient toast.
    const [resp] = await Promise.all([
      opPage.waitForResponse((r) => r.url().includes('/api/data/upsert') && r.request().method() === 'POST'),
      opPage.getByRole('button', { name: 'Save changes', exact: true }).click(),
    ]);
    expect(resp.ok(), `facility upsert returned HTTP ${resp.status()}`).toBeTruthy();

    await opPage.goto('/operator/spaces');
    await opPage.getByRole('button', { name: 'Add space', exact: true }).click();
    const dialog = opPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Name', { exact: true }).fill(spaceName);
    await dialog.getByRole('button', { name: 'Add space', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(opPage.getByRole('heading', { name: spaceName })).toBeVisible();
  });

  test('the listing is publicly discoverable with per-route SEO meta', async () => {
    // Poll discovery until the new listing (unique city, with a space) appears.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fac: any;
    await expect(async () => {
      const res = await opPage.request.get(`/api/public/discover?city=${encodeURIComponent(city)}`);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fac = (body.facilities || []).find((f: any) => f.city === city && (f.spaces || []).length > 0);
      expect(fac, `a facility in ${city} with a space should be discoverable`).toBeTruthy();
    }).toPass({ timeout: 20_000 });

    facilityId = fac.id;
    facilitySlug = fac.slug;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sp = (fac.spaces || []).find((s: any) => s.name === spaceName) || fac.spaces[0];
    expect(sp).toBeTruthy();
    spaceId = sp.id;

    // The Worker injects the facility's name into the page <head> from D1.
    const html = await (await opPage.request.get(`/c/${facilitySlug}`)).text();
    expect(html).toContain('property="og:title"');
    expect(html).toContain(orgName);
  });

  test('a renter discovers, books, and pays — booking is confirmed', async () => {
    await signUp(rtPage, { email: rtEmail, password: PASSWORD, name: 'E2E MktRenter', org: '', role: 'renter' });
    await expect(rtPage).toHaveURL(/\/renter$/);

    const slot = new Date(Date.now() + (300 + (runId % 1200)) * 86_400_000).toISOString().slice(0, 10);
    await rtPage.goto(`/book/${facilityId}/${spaceId}`);
    await expect(rtPage.getByRole('heading', { name: /When would you like the space/i })).toBeVisible({ timeout: 20_000 });
    await rtPage.getByLabel('Date').fill(slot);
    await rtPage.getByRole('button', { name: 'Continue' }).click();

    await expect(rtPage.getByRole('heading', { name: /Tell us about your event/i })).toBeVisible();
    await rtPage.getByLabel('Event name').fill(eventName);
    await rtPage.getByRole('button', { name: 'Continue' }).click();

    await expect(rtPage.getByRole('heading', { name: /Review your booking/i })).toBeVisible();
    await rtPage.getByLabel('Type your full name to sign').fill('E2E MktRenter');
    await rtPage.getByRole('button', { name: /Confirm & continue/ }).click();

    await expect(rtPage).toHaveURL(/\/renter\/bookings\/.+/, { timeout: 20_000 });
    const pay = rtPage.getByRole('button', { name: /Pay & confirm/ });
    await expect(pay).toBeVisible({ timeout: 20_000 });
    await pay.click();
    await expect(rtPage.getByText('Confirmed').first()).toBeVisible({ timeout: 20_000 });
    await rtPage.reload();
    await expect(rtPage.getByText('Confirmed').first()).toBeVisible({ timeout: 20_000 });
  });

  test('the operator sees the confirmed booking', async () => {
    await opPage.goto('/operator/bookings');
    await expect(opPage.getByRole('heading', { name: /^Bookings$/ })).toBeVisible();
    // A confirmed future booking lives under the Upcoming tab.
    const upcoming = opPage.getByRole('button', { name: /Upcoming/ });
    if (await upcoming.isVisible().catch(() => false)) await upcoming.click();
    await expect(opPage.getByText(eventName).first()).toBeVisible({ timeout: 20_000 });
  });
});
