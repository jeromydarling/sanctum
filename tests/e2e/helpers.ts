import { type Page, type APIRequestContext, expect } from '@playwright/test';

/**
 * Guard token for the test-account purge endpoint. Matches the worker's
 * DEFAULT_PURGE_TOKEN fallback; override with the E2E_ADMIN_TOKEN env/secret.
 * Purge is hard-restricted server-side to e2e+* emails, so this is a low-value
 * guard, not a credential.
 */
export const PURGE_TOKEN = process.env.E2E_ADMIN_TOKEN || 'sanctum-e2e-purge';

/** A new throwaway account per run. The e2e+ prefix is REQUIRED — the purge
 *  endpoint refuses to touch anything else, so real accounts are never at risk. */
export function uniqueEmail(tag: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e+${tag}-${Date.now()}-${rand}@example.com`;
}

export const PASSWORD = 'E2e-Sanctum-Pass-123';

/** Best-effort teardown — never fail the suite on cleanup. */
export async function purgeUser(request: APIRequestContext, email: string): Promise<void> {
  try {
    const res = await request.post(
      `/api/admin/purge-user?token=${encodeURIComponent(PURGE_TOKEN)}&email=${encodeURIComponent(email)}`,
    );
    // eslint-disable-next-line no-console
    console.log(`[purge] ${email} -> ${res.status()} ${await res.text()}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`[purge] ${email} failed (ignored): ${String(e)}`);
  }
}

/** Fill and submit the live signup form. Lands on /onboarding (operator) or /renter. */
export async function signUp(
  page: Page,
  opts: { email: string; password: string; name: string; org: string; role: 'operator' | 'renter' },
): Promise<void> {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Open your doors' })).toBeVisible();
  await page
    .getByRole('button', { name: opts.role === 'operator' ? /I manage a space/ : /looking to rent/ })
    .click();
  await page.getByLabel('Your name').fill(opts.name);
  await page
    .getByLabel(opts.role === 'operator' ? 'Community / organization name' : 'Organization (optional)')
    .fill(opts.org);
  await page.getByLabel('Email').fill(opts.email);
  await page.getByLabel('Password').fill(opts.password);
  await page.getByRole('button', { name: /Create my account/ }).click();
}

/** Sign out from inside any dashboard — opens the mobile drawer first if needed. */
export async function signOut(page: Page): Promise<void> {
  const openMenu = page.getByRole('button', { name: 'Open menu' });
  if (await openMenu.isVisible().catch(() => false)) await openMenu.click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: /sitting empty/i })).toBeVisible({ timeout: 15_000 });
}

/** Visit each [path, headingRegex] and assert the page's <h1> renders for an authed user. */
export async function sweepPages(page: Page, pages: [string, RegExp][]): Promise<void> {
  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
  }
}
