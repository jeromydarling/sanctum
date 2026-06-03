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

## 3. Set Worker secrets (Settings → Variables and Secrets → Encrypt)

On the **sanctum** Worker, add these as **encrypted** secrets:

| Secret                  | Where it's used                         | Required? |
|-------------------------|-----------------------------------------|-----------|
| `STRIPE_SECRET_KEY`     | Stripe Connect payments (use **test** key first) | for real payments |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures      | for real payments |
| `ANTHROPIC_API_KEY`     | AI text tools (else Workers AI/demo)    | optional  |
| `RESEND_API_KEY`        | Transactional email (else no-op)        | optional  |

`AUTH_SECRET` is **not** needed — it auto-generates into the D1 `app_secrets` table.

After Stripe is live, add the webhook endpoint `https://<your-domain>/api/stripe/webhooks`
subscribed to `account.updated`, `checkout.session.completed`, and
`payment_intent.payment_failed`.

---

## Claude-for-Chrome prompt (paste into Claude for Chrome with the dashboard open)

```
You are helping me configure the Cloudflare dashboard for my Worker named "sanctum".
Work in TEST mode first. As you go, read back only the LAST 4 CHARACTERS of any secret
value — never the full value — and never type a secret into any chat.

Do these in order, pausing for me to confirm before each "Save":

1. R2: Go to R2. Create a bucket named exactly "sanctum-files". Confirm it exists.

2. Images: Go to Images and enable the product if it isn't already.

3. Worker secrets: Go to Workers & Pages → "sanctum" → Settings → Variables and Secrets.
   Add these as ENCRYPTED secrets (I will paste each value myself):
     - STRIPE_SECRET_KEY        (my Stripe TEST secret key, starts with sk_test_)
     - STRIPE_WEBHOOK_SECRET    (from the webhook I create in step 4, starts with whsec_)
     - ANTHROPIC_API_KEY        (optional)
     - RESEND_API_KEY           (optional)
   Do NOT add AUTH_SECRET — the app generates it itself.

4. Stripe webhook: In the Stripe dashboard (test mode) → Developers → Webhooks → add an
   endpoint at https://<MY_WORKER_DOMAIN>/api/stripe/webhooks, subscribed to:
   account.updated, checkout.session.completed, payment_intent.payment_failed.
   Copy the signing secret (whsec_…) and use it for STRIPE_WEBHOOK_SECRET above.

5. Verify the Resend "from" domain (hello@sanctum.app) under Resend → Domains if I plan
   to send real email.

After each step, tell me what changed and the last 4 characters of any secret I entered.
```

---

## Known-open (carry forward)

- Public facility-profile by-slug endpoint — **done** (`/api/public/facility/:slug`).
- `payment_intent.payment_failed` → notify operator — **done**.
- Verify the Resend "from" domain — dashboard step above.
- Custom-domain setup prompt — add the domain under Workers → Custom Domains, then set
  the Worker `APP_URL` var to the production URL.
