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

## SEO — Google Search Console
1. In GSC, add `sanctum.garden`, choose the **HTML tag** method, copy the
   `content="…"` value.
2. Paste it into `wrangler.jsonc` `vars.GSC_VERIFICATION` (it's a public token) and
   push — the Worker injects `<meta name="google-site-verification">` on every page.
3. Back in GSC, verify, then submit `https://sanctum.garden/sitemap.xml`.

## QuickBooks (optional)
`QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` secrets enable the accounting sync.
