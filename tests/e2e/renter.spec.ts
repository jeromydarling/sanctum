import { test, expect, type Page } from '@playwright/test';
import { signUp, signOut, sweepPages, purgeUser, uniqueEmail, PASSWORD, PURGE_TOKEN } from './helpers.js';

// The seeded demo facility — public, listed, auto-approve, no Stripe account —
// so its checkout simulates a successful payment with zero Stripe involvement.
const DEMO_FACILITY = 'fac-usr-demo-operator';
// Fellowship Hall: standard pricing, and (unlike spc-class/spc-chapel) NO
// recurring lease — so a far-future weekday slot never hits a tenant conflict.
const DEMO_SPACE = 'spc-hall';

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

  test('signup fired a welcome email (pipeline captured)', async () => {
    const res = await page.request.get(
      `/api/admin/test/emails?token=${encodeURIComponent(PURGE_TOKEN)}&to=${encodeURIComponent(email)}`,
    );
    expect(res.ok(), `email-log read returned HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.emails)).toBeTruthy();
    expect(
      body.emails.some((e: { subject: string }) => /welcome/i.test(e.subject)),
      `expected a welcome email; got ${JSON.stringify(body.emails)}`,
    ).toBeTruthy();
  });

  test('every renter page renders', async () => {
    await sweepPages(page, RENTER_PAGES);
  });

  test('books a space and pays — booking is confirmed (simulated payment)', async () => {
    // Unique far-future slot so parallel/repeat runs never collide on the space.
    const slot = new Date(Date.now() + (300 + (runId % 1200)) * 86_400_000);
    const dateStr = slot.toISOString().slice(0, 10);
    const eventName = `E2E Booking ${runId}`;

    await page.goto(`/book/${DEMO_FACILITY}/${DEMO_SPACE}`);
    await expect(page.getByRole('heading', { name: /When would you like the space/i })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Date').fill(dateStr);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: /Tell us about your event/i })).toBeVisible();
    await page.getByLabel('Event name').fill(eventName);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: /Review your booking/i })).toBeVisible();
    await page.getByLabel('Type your full name to sign').fill('E2E Renter');
    await page.getByRole('button', { name: /Confirm & continue/ }).click();

    // Lands on the booking detail — auto-approved, ready to pay.
    await expect(page).toHaveURL(/\/renter\/bookings\/.+/, { timeout: 20_000 });
    const pay = page.getByRole('button', { name: /Pay & confirm/ });
    await expect(pay).toBeVisible({ timeout: 20_000 });
    await pay.click();

    // Simulated payment confirms the booking; verify it sticks across a reload.
    await expect(page.getByText('Confirmed').first()).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText('Confirmed').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Pay & confirm/ })).toHaveCount(0);
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
    // Wait for the write to reach the server before reloading (a reload mid-write
    // would abort it). Capture the status so a real failure is legible, then prove
    // it persisted by reloading — the real point, not the transient toast.
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/data/upsert') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(resp.ok(), `profile upsert returned HTTP ${resp.status()}`).toBeTruthy();

    await page.reload();
    await expect(page.getByLabel('Full name')).toHaveValue(newName, { timeout: 20_000 });
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
