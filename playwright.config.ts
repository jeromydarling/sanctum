import { defineConfig, devices } from '@playwright/test';

/**
 * Sanctum E2E configuration.
 *
 * Tests run against the DEPLOYED site (production by default), NOT a local dev
 * server — set BASE_URL to point elsewhere (e.g. a preview deployment).
 *
 * reducedMotion: "reduce" collapses framer-motion / CSS animations to instant
 * so elements settle immediately and never read as "unstable" mid-animation —
 * the app's CSS honors @media (prefers-reduced-motion: reduce) to match.
 */
const BASE_URL = process.env.BASE_URL || 'https://sanctum.garden';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Each journey is serial WITHIN its file (test.describe.configure serial);
  // across files we parallelize so the deployed-site suite finishes in minutes,
  // not half an hour. Distinct per-run accounts mean parallel files don't clash.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    // Injected on every request. The worker simulates payouts/payments ONLY for
    // requests that carry this token AND are signed in as an e2e+* account, so
    // real users (who never send it) always hit real Stripe — even under a live key.
    extraHTTPHeaders: { 'x-e2e-token': process.env.E2E_ADMIN_TOKEN || 'sanctum-e2e-purge' },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
