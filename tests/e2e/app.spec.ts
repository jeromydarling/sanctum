import { test, expect } from '@playwright/test';

/**
 * Negative paths. These create NO accounts and sign nobody in.
 */
test.describe('negative paths', () => {
  test('bad login is rejected and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    await page.getByLabel('Email').fill('e2e+nope-doesnotexist@example.com');
    await page.getByLabel('Password').fill('definitely-the-wrong-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    // A 401 surfaces a friendly error toast; we must NOT navigate to a dashboard.
    await expect(page.getByText(/please sign in to continue/i)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test('protected routes redirect to login when signed out', async ({ page }) => {
    await page.goto('/operator');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

    await page.goto('/renter/settings');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  });
});
