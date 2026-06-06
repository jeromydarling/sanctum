import { test, expect, type Page } from '@playwright/test';
import { signUp, signOut, sweepPages, purgeUser, uniqueEmail, PASSWORD } from './helpers.js';

/**
 * THE journey: one brand-new operator account, signed up live against the
 * deployed app, clicked through every screen, with each create/edit re-checked
 * after a reload to prove it hit the database (not just React state). The
 * account is purged in afterAll so CI runs never accumulate junk.
 */
test.describe.configure({ mode: 'serial' });

const OPERATOR_PAGES: [string, RegExp][] = [
  ['/operator', /welcome back/i],
  ['/operator/calendar', /^Calendar$/],
  ['/operator/bookings', /^Bookings$/],
  ['/operator/spaces', /Spaces & Resources/],
  ['/operator/tenants', /Tenants & recurring/],
  ['/operator/compliance', /^Compliance$/],
  ['/operator/pricing', /Pricing & discounts/],
  ['/operator/invoices', /^Invoices$/],
  ['/operator/renters', /^Renters$/],
  ['/operator/leads', /^Inquiries$/],
  ['/operator/analytics', /^Analytics$/],
  ['/operator/financials', /^Financials$/],
  ['/operator/reviews', /^Reviews$/],
  ['/operator/assistant', /AI Assistant/],
  ['/operator/network', /^Network$/],
  ['/operator/settings', /^Settings$/],
];

test.describe('operator journey', () => {
  let page: Page;
  const email = uniqueEmail('operator');
  const runId = Date.now();

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async ({ playwright }) => {
    // Clean up against the same deployment the journey ran on.
    const baseURL = process.env.BASE_URL || 'https://sanctum.garden';
    const ctx = await playwright.request.newContext({ baseURL });
    await purgeUser(ctx, email);
    await ctx.dispose();
    await page.close();
  });

  test('signs up a new operator from the marketing site', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /sitting empty/i })).toBeVisible();
    await page.getByRole('button', { name: 'Open your doors' }).first().click();
    await expect(page).toHaveURL(/\/signup$/);

    await signUp(page, { email, password: PASSWORD, name: 'E2E Operator', org: `E2E Center ${runId}`, role: 'operator' });

    // New operators land in guided onboarding — an operator-only route, so
    // reaching it proves we're authenticated as a live operator.
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: /set you up in minutes/i })).toBeVisible({ timeout: 20_000 });
  });

  test('reaches the dashboard and every operator page renders', async () => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/\/operator$/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await sweepPages(page, OPERATOR_PAGES);
  });

  test('creates a space that persists across reload', async () => {
    const spaceName = `E2E Hall ${runId}`;
    await page.goto('/operator/spaces');
    await expect(page.getByRole('heading', { name: /Spaces & Resources/ })).toBeVisible();

    await page.getByRole('button', { name: 'Add space', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Name', { exact: true }).fill(spaceName);
    await dialog.getByRole('button', { name: 'Add space', exact: true }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('heading', { name: spaceName })).toBeVisible();
    // Reload proves it was written to D1, not just held in React state.
    await page.reload();
    await expect(page.getByRole('heading', { name: spaceName })).toBeVisible({ timeout: 15_000 });
  });

  test('saves profile settings that persist across reload', async () => {
    const desc = `A welcoming community space. Run ${runId}.`;
    await page.goto('/operator/settings');
    await expect(page.getByRole('heading', { name: /^Settings$/ })).toBeVisible();

    await page.getByLabel('About your community').fill(desc);
    const approval = page.getByLabel(/Review each request before confirming/);
    const before = await approval.isChecked();
    await approval.setChecked(!before);

    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel('About your community')).toHaveValue(desc, { timeout: 15_000 });
    await expect(page.getByLabel(/Review each request before confirming/)).toBeChecked({ checked: !before });
  });

  test('saves pricing discounts that persist across reload', async () => {
    await page.goto('/operator/pricing');
    await expect(page.getByRole('heading', { name: /Pricing & discounts/ })).toBeVisible();

    await page.getByRole('spinbutton').first().fill('15');
    await page.getByRole('button', { name: /Save discounts/ }).click();
    await expect(page.getByText('Discounts saved')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole('spinbutton').first()).toHaveValue('15', { timeout: 15_000 });
  });

  test('connects payouts (simulated) and it persists', async () => {
    await page.goto('/operator/settings');
    await expect(page.getByRole('heading', { name: /^Settings$/ })).toBeVisible();

    // A brand-new operator isn't connected yet. Click Connect Stripe — for an
    // e2e+ account carrying the guard token, the worker simulates onboarding
    // (no real Stripe call), so this is deterministic even under a live key.
    await page.getByRole('button', { name: /Connect Stripe/ }).click();
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 20_000 });

    // Payout status is a real DB write — confirm it survives a reload.
    await page.reload();
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 20_000 });
  });

  test('AI assistant generates a draft', async () => {
    await page.goto('/operator/assistant');
    await expect(page.getByRole('heading', { name: /AI Assistant/ })).toBeVisible();
    await page.getByRole('button', { name: /^Generate$/ }).click();
    // The Copy button only appears once a draft has rendered. Allow time for the
    // model (callAI falls back to a local draft, so this always resolves).
    await expect(page.getByRole('button', { name: /Copy/ })).toBeVisible({ timeout: 30_000 });
  });

  test('session survives a cold reload, then signs out', async () => {
    // A full document load restores the live session from storage. Let it settle
    // (the authed dashboard shell renders its Notifications control) BEFORE
    // reloading — reloading mid-load would abort the in-flight /auth/me, which the
    // app treats as a sign-out. Settling first makes the reload a true refresh.
    await page.goto('/operator');
    const notifications = page.getByRole('button', { name: 'Notifications' });
    await expect(notifications).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(notifications).toBeVisible({ timeout: 20_000 });
    await signOut(page);
    // After sign-out, the dashboard is gone — protected routes bounce to login.
    await page.goto('/operator');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  });
});
