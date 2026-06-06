# Sanctum E2E tests (Playwright)

A "real user does everything" rig: it signs up brand-new accounts on the
**deployed** site and clicks through every screen, proving each create/edit
survives a page reload (i.e. it actually hit the database). Throwaway accounts
are purged automatically.

## What's here

| Spec | What it does |
| --- | --- |
| `e2e/smoke.spec.ts` | Public surfaces (home, find, features, pricing) + API health/config/discover shape. No auth, no accounts. |
| `e2e/journey.spec.ts` | The operator journey — signup → onboarding → every operator page → create a space, edit settings, set pricing, **connect payouts (simulated)**, run the AI assistant → reload-verified persistence → sign out. Self-cleaning. |
| `e2e/renter.spec.ts` | The renter journey — signup → **welcome-email assertion** → every renter page → create an event page → **book a space + pay → confirmed (simulated payment)** → edit settings → reload-verified persistence → sign out. Self-cleaning. |
| `e2e/app.spec.ts` | Negative paths (bad login, protected-route redirects). Creates no accounts. |
| `e2e/helpers.ts` | Shared signup / sign-out / page-sweep / purge helpers. |

Each journey is `test.describe.configure({ mode: 'serial' })` over a single
shared account, with a unique `e2e+...@example.com` email per run.

## Running

Tests run against a **deployed** site (production by default) — there is no
local web server. They run on two projects: `desktop` (Desktop Chrome) and
`mobile` (Pixel 7).

```bash
npm ci
npx playwright install --with-deps chromium   # first time only

npm run test:e2e                 # all specs, both projects, against production
npm run test:e2e:ui              # interactive UI mode

# Just parse/enumerate specs without a browser (works anywhere):
npx playwright test --list
```

> This sandbox/CI image can run a browser; a locked-down dev sandbox may not
> (`playwright install chromium` needs network egress). In that case only
> `--list` works locally — the full run happens in GitHub Actions.

## Environment knobs

| Var | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `https://sanctum.garden` | Site under test. Point at a preview to test it. |
| `E2E_ADMIN_TOKEN` | `sanctum-e2e-purge` | Token for the test-account purge endpoint. Set a repo secret to override. |
| `CI` | – | When set: 2 retries, 1 worker, GitHub + HTML reporters. |

```bash
BASE_URL=https://staging.example.com npm run test:e2e
```

## Email verification is DISABLED for the journey

The journey must sign up and use the app immediately, with no email link in the
loop. Verification is gated by a single server variable:

- **`EMAIL_VERIFICATION`** (Worker env var) — **default OFF**. When it is not
  exactly `"on"`, every new signup is created already-verified and is logged in
  immediately (a welcome email is still sent, best-effort).
- **To re-enable verification, set `EMAIL_VERIFICATION=on`** (one variable).
  Signups then return `{ verification_required: true }` instead of a session,
  a confirmation email is sent (`/api/auth/verify` consumes the token), and
  `login` is blocked until the address is confirmed. *(Re-enabling also needs a
  front-end "check your inbox / confirm" screen; the server gate is the
  security control.)*

## Faking payments & email (no real Stripe, no real delivery)

The rig exercises the **money path** (book → pay → confirmed) and the **email
pipeline** without touching real Stripe or sending real mail — safely, even
against a live `STRIPE_SECRET_KEY`:

- **Payments.** The app already has a "real-or-simulated" Stripe layer. The
  Playwright context attaches `x-e2e-token: <guard token>` to every request;
  the worker simulates payouts/checkout **only when** that token is present
  **and** the signed-in account is an `e2e+*` test user. Real users never send
  the header and don't know the token, so they always hit real Stripe. The
  renter booking flow targets the seeded demo facility (no Stripe account), so
  its checkout simulates a successful charge with zero Stripe calls and the
  booking transitions to `confirmed` — the genuine internal state change.
- **Email.** Every outbound message is recorded (recipient + subject only) in an
  `email_log` table. `GET /api/admin/test/emails?token=…&to=…` (token-guarded,
  restricted to `e2e+*` recipients) lets the rig assert the welcome email fired —
  no delivery required.

To lock the payment simulation down further, set a real `E2E_ADMIN_TOKEN` Worker
secret (and the matching repo secret) — then the public default token won't
enable it.

## Test-account cleanup

`POST /api/admin/purge-user?token=<E2E_ADMIN_TOKEN>&email=<email>` deletes the
user and **all** child rows. It is doubly safe: it requires the token **and**
refuses any email that doesn't start with `e2e+`, so it can never erase a real
account — even if the token is known. Each journey calls it in `afterAll`.

## CI

`.github/workflows/e2e.yml` runs on every push to `main` and via manual
`workflow_dispatch` (with an optional `base_url` input). Because a push to
`main` deploys (Cloudflare Workers Builds) and starts the test job at the same
time, the workflow first **waits for the new deployment to go live** — it polls
the purge route, which only exists in the new code (404 → old, 403 → live) —
then runs both projects and always uploads the `playwright-report/` artifact
(video, screenshots, traces on failure).

## Porting this rig to another Cloudflare + SPA app

1. Copy `playwright.config.ts`, `tests/`, and `.github/workflows/e2e.yml`.
2. Set `BASE_URL` and the hero/heading/selector strings in the specs.
3. Add an `EMAIL_VERIFICATION`-style flag (default off) so signup works without
   an email round-trip, and a token-guarded, prefix-restricted purge endpoint.
4. Ensure the app CSS honors `@media (prefers-reduced-motion: reduce)`.
5. Keep `tests/` out of the app/worker tsconfig `include` so the app build is
   unaffected.
