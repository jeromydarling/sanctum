# Go-live checklist

Everything below is **wired in code** and degrades gracefully until configured.
Set these in the Cloudflare dashboard (Workers → sanctum → Settings). Secrets are
**never** committed — the repo is public.

## Payments (Stripe Connect)
Until these are set, the whole payment flow runs in **simulated** mode.

| Key | Type | Where it's used |
|---|---|---|
| `STRIPE_SECRET_KEY` | secret | Connect onboarding, checkout, refunds, subscriptions |
| `STRIPE_WEBHOOK_SECRET` | secret | Verifies `/api/stripe/webhooks` (platform events) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | secret | Verifies Connect (connected-account) webhook events |

Then in the Stripe dashboard add a webhook to `https://sanctum.garden/api/stripe/webhooks`
subscribing to: `account.updated`, `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`payment_intent.payment_failed`, `charge.dispute.created`, `charge.dispute.closed`.

## Email (Cloudflare Email Service)
The `EMAIL` binding is already declared. Verify the sending domain / route for
`hello@sanctum.garden` in the dashboard; until then, sends are logged (and
recorded in `email_log`) but not delivered. No code change needed.

## Turnstile (bot protection on public forms)
- `TURNSTILE_SITE_KEY` — public, paste into `wrangler.jsonc` `vars`.
- `TURNSTILE_SECRET_KEY` — secret.

## E2E guard token (recommended once Turnstile is on)
`E2E_ADMIN_TOKEN` gates the disposable-account test paths (purge, payment
simulation, and the Turnstile bypass — all restricted to `e2e+` addresses).
Both sides fall back to a public default, so for airtight production set a
strong random value as a **Worker secret** `E2E_ADMIN_TOKEN` *and* store the
same value as the repo's `E2E_ADMIN_TOKEN` GitHub Actions secret so E2E keeps
passing. Low-risk until then (bypass is limited to throwaway `e2e+` emails and
rate-limited), but this closes it entirely.

## SEO — Google Search Console
1. In GSC, add `sanctum.garden`, choose the **HTML tag** method, copy the
   `content="…"` value.
2. Paste it into `wrangler.jsonc` `vars.GSC_VERIFICATION` (it's a public token) and
   push — the Worker injects `<meta name="google-site-verification">` on every page.
3. Back in GSC, verify, then submit `https://sanctum.garden/sitemap.xml`.

## Analytics (Cloudflare Web Analytics — cookieless)
`CF_ANALYTICS_TOKEN` — public beacon token from **Cloudflare dashboard → Analytics
& Logs → Web Analytics**. Paste into `wrangler.jsonc` `vars` and push; the Worker
injects the beacon on every page. No cookies, no consent banner required.

## Error monitoring (optional)
`SENTRY_DSN` secret enables server-side error reporting.

## QuickBooks (optional)
Two paths, both live:
- **Zapier (no setup on our side):** operators paste a Zapier Catch Hook URL in
  Financials and Sanctum posts every paid booking/invoice to it. Works today on
  any deployment — nothing to configure here. Customer guide:
  `docs/QUICKBOOKS_ZAPIER.md`.
- **Native one-click connect:** set `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` secrets
  (requires an approved Intuit production app). Dormant until those are set.

## Production data
The public demo listing (**St. Brigid Community Center**, its 5 spaces, and the
*Youth Spring Recital* event page) has been **unlisted** from production D1 so it no
longer appears in discovery, the sitemap, or public facility pages. The rows are
retained (flags flipped: `facilities.is_listed=0`, `spaces.is_active=0`,
`event_microsites.is_published=0`) rather than deleted, so it can be re-listed for a
screenshot/demo later. E2E tests self-provision their own accounts and listings, so
they do not depend on this data.

## Launch status — code vs dashboard
**Done in code + deployed:** Turnstile wiring, transactional email + `email_log`,
Stripe live-mode readiness (dual webhook secrets, refunds, subscriptions), Terms of
Service + refund policy + signup acceptance, correct support email
(`help@sanctum.garden`), rate limiting on public auth/inquiry, cookieless analytics
hook, per-route SEO (meta/sitemap/robots/llms), GSC verification hook, demo-data
teardown.

**Remaining — dashboard-only, no code needed** (set the keys above, then verify):
- Turnstile: create widget, set `TURNSTILE_SITE_KEY` (var) + `TURNSTILE_SECRET_KEY` (secret).
- Email: verify `sanctum.garden` sending domain + SPF/DKIM/DMARC so mail delivers.
- Stripe: complete platform profile, set the three secrets, register the webhook.
- GSC: set `GSC_VERIFICATION`, verify, submit the sitemap.
- Analytics: set `CF_ANALYTICS_TOKEN`.
- (Optional) Sentry: set `SENTRY_DSN`. QuickBooks: set `QBO_*`.
