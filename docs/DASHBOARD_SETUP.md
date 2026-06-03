# Sanctum — Cloudflare Dashboard Setup

Everything that can't be done from CI is listed here. The app already deploys and runs
(demo mode works with zero secrets); these steps unlock storage, image transforms, real
payments, real AI, and email.

> **Never paste full secret values into chat.** When confirming a value is set, report
> only the **last 4 characters**.

---

## 1. Enable the R2 bucket (file storage)

1. Cloudflare dashboard → **R2** → **Create bucket** → name it exactly `sanctum-files`.
2. In `wrangler.jsonc`, uncomment the `r2_buckets` block:
   ```jsonc
   "r2_buckets": [{ "binding": "STORAGE", "bucket_name": "sanctum-files" }],
   ```
3. Commit + push to `main`. Workers Builds redeploys with the binding.

Until enabled, uploads fall back to keeping the local data URL — nothing breaks.

## 2. Enable Cloudflare Images

1. Dashboard → **Images** → enable the product.
2. In `wrangler.jsonc`, uncomment:
   ```jsonc
   "images": { "binding": "IMAGES" }
   ```
3. Commit + push. `/api/files/:key?w=N` will then serve resized WebP; without it, the
   original object is served as-is.

## 3. Enable Cloudflare Email Service (native domain email — no third party)

Sanctum sends transactional email via Cloudflare's own Email Service (`env.EMAIL.send`),
**not Resend**. To turn it on:

1. Dashboard → **sanctum.garden** zone → **Email** → enable **Email Routing**, then
   **Email Sending** (Cloudflare Email Service). Verify the domain's email DNS records
   (Cloudflare adds the SPF/DKIM/MX records for you on a Cloudflare-managed zone).
2. In `wrangler.jsonc`, uncomment the `send_email` binding:
   ```jsonc
   "send_email": [{ "name": "EMAIL" }]
   ```
3. Commit + push. Emails then send from `hello@sanctum.garden`. Until enabled, email
   calls no-op (logged only) so nothing breaks.

## 4. Set Worker secrets (Settings → Variables and Secrets → Encrypt)

Only Stripe needs a key now — AI is Workers AI and email is Cloudflare Email Service.

| Secret                  | Where it's used                         | Required? |
|-------------------------|-----------------------------------------|-----------|
| `STRIPE_SECRET_KEY`     | Payments + subscriptions (use **test** key first) | for real payments |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures      | for real payments |

`AUTH_SECRET` is **not** needed — it auto-generates into the D1 `app_secrets` table.
There is **no** Anthropic or Resend key — those third parties were removed.

After Stripe is live, add the webhook endpoint `https://sanctum.garden/api/stripe/webhooks`
subscribed to `account.updated`, `checkout.session.completed`, and
`payment_intent.payment_failed`.

---

## Claude-for-Chrome prompt (paste into Claude for Chrome with the dashboard open)

```
You are helping me configure the Cloudflare dashboard for my Worker "sanctum" on the
domain sanctum.garden. Everything here is Cloudflare-native — no Resend, no Anthropic.
Work in TEST mode for Stripe. Read back only the LAST 4 CHARACTERS of any secret value —
never the full value — and never type a secret into any chat.

Do these in order, pausing for me to confirm before each "Save":

1. R2: Go to R2. Create a bucket named exactly "sanctum-files". Confirm it exists.

2. Images: Go to Images and enable the product if it isn't already.

3. Email: Go to the sanctum.garden zone → Email. Enable Email Routing, then enable
   Email Sending (Cloudflare Email Service). Add/verify the email DNS records it suggests.

4. Worker secrets: Go to Workers & Pages → "sanctum" → Settings → Variables and Secrets.
   Add these as ENCRYPTED secrets (I will paste each value myself):
     - STRIPE_SECRET_KEY        (my Stripe TEST secret key, starts with sk_test_)
     - STRIPE_WEBHOOK_SECRET    (from the webhook I create in step 5, starts with whsec_)
   Do NOT add AUTH_SECRET — the app generates it itself.

5. Stripe webhook: In the Stripe dashboard (test mode) → Developers → Webhooks → add an
   endpoint at https://sanctum.garden/api/stripe/webhooks, subscribed to:
   account.updated, checkout.session.completed, payment_intent.payment_failed.
   Copy the signing secret (whsec_…) and use it for STRIPE_WEBHOOK_SECRET above.

After each step, tell me what changed and the last 4 characters of any secret I entered.
Remind me to uncomment the r2_buckets, images, and send_email bindings in wrangler.jsonc
and push, so the bindings attach on the next deploy.
```

---

## Known-open (carry forward)

- Public facility-profile by-slug endpoint — **done** (`/api/public/facility/:slug`).
- `payment_intent.payment_failed` → notify operator — **done**.
- Email now uses Cloudflare Email Service — enable it per step 3 above.
- Custom domain — **done** (sanctum.garden; `APP_URL` set).
