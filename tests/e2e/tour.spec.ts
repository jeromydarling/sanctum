import { test, expect, type Page } from '@playwright/test';
import { signUp, purgeUser, uniqueEmail, PASSWORD } from './helpers.js';

/**
 * The on-demand product tour: a signed-in user opens the section tour from the
 * header, steps through coach-marks anchored to real UI, and closes it. Uses a
 * fresh renter account (the /renter discovery page has a tour), self-cleaning.
 */
test.describe.configure({ mode: 'serial' });

test.describe('product tour', () => {
  let page: Page;
  const email = uniqueEmail('tour');
  const runId = Date.now();

  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(async ({ playwright }) => {
    const baseURL = process.env.BASE_URL || 'https://sanctum.garden';
    const ctx = await playwright.request.newContext({ baseURL });
    await purgeUser(ctx, email);
    await ctx.dispose();
    await page.close();
  });

  test('opens, steps through anchored coach-marks, and closes', async () => {
    await signUp(page, { email, password: PASSWORD, name: 'E2E Tourist', org: `E2E Tour ${runId}`, role: 'renter' });
    await expect(page).toHaveURL(/\/renter$/);
    await expect(page.getByRole('heading', { name: /Find a space/ })).toBeVisible({ timeout: 20_000 });

    // Launch the section tour from the header.
    await page.getByRole('button', { name: 'Take a tour' }).click();

    // Step 1 — the intro card (dialog with the tour's first step).
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Find a welcoming space')).toBeVisible();
    await expect(dialog.getByText('1 of 3')).toBeVisible();

    // Step 2 — anchored to the real search card.
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByText('Search by city and type')).toBeVisible();
    await expect(dialog.getByText('2 of 3')).toBeVisible();

    // Step 3 — the results, then finish.
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByText('Request in one step')).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();

    // Reopens and closes via Escape (keyboard accessibility).
    await page.getByRole('button', { name: 'Take a tour' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
