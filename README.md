# Sanctum

**Open doors. Stronger communities.**

Sanctum is an all-in-one platform that helps community spaces — halls, sanctuaries,
classrooms, gyms, commercial kitchens, parking lots — open their doors to the groups
around them, and manage those renters end to end. A near-free monthly plan plus a
transparent **1.5%** on paid bookings. Priced for access, not extraction.

Built 100% on Cloudflare: a single Worker serves the React SPA **and** every `/api/*`
route, backed by D1, R2, Workers AI (Flux), and Cloudflare Images.

---

## Monorepo layout

```
sanctum/
├── apps/
│   ├── web/        React 18 + Vite + Tailwind v3 SPA (hand-rolled shadcn-style UI)
│   └── worker/     Single Cloudflare Worker — serves the SPA assets + all /api/* routes
├── packages/
│   └── shared/     Domain types, constants, money utils (single source of truth) + tests
├── migrations/     D1 SQL migrations (0001 schema, 0002 seed)
├── scripts/        gen-seed.mjs (computes demo PBKDF2 hashes offline)
└── wrangler.jsonc  Unified Worker config (assets + D1 + AI + cron)
```

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind v3, React Router v6 (lazy + Suspense),
  Recharts, lucide-react, Sonner. Playfair Display / Inter / JetBrains Mono.
- **Backend** — one Cloudflare Worker (wrangler v4). `assets` serves `apps/web/dist` with
  SPA fallback; `run_worker_first: ["/api/*"]` routes the API through the Worker.
- **Data** — D1 (SQLite). Booleans as int, JSON as text, ISO timestamp strings, money in cents.
- **Auth** — Worker-issued JWT (HS256, Web Crypto) + PBKDF2 passwords (100k, SHA-256).
  `AUTH_SECRET` resolves from a Worker secret **or** auto-generates into a D1 `app_secrets`
  table — auth is never blocked on a manually-set secret.

## Demo + Live

Auth method decides the mode:

- **Demo** — one-click role login → in-memory sandbox seeded from `lib/mockData.ts`.
  Resets on reload, nothing persisted. Prospects can test everything with no signup.
- **Live** — signup / email login → D1-backed, write-through (`wt`) to `/api/data/upsert`,
  hydrate-on-login scoped to the caller. The public facility directory comes from a
  dedicated public endpoint, never from the user-scoped hydrate.

Demo accounts are seeded into D1 too (hashes computed offline), so one-click demo also
works against the live deployment:

| Role     | Email                        | Password       |
|----------|------------------------------|----------------|
| Operator | `operator@demo.sanctum.app`  | `sanctum-demo` |
| Renter   | `renter@demo.sanctum.app`    | `sanctum-demo` |
| Admin    | `admin@demo.sanctum.app`     | `sanctum-demo` |

## Develop

```bash
npm install
npm run dev:web          # Vite on :5173 (proxies /api → :8787)
npx wrangler dev         # Worker on :8787 (serves API; uses local/remote D1)
```

## Validate (run before every push)

```bash
npm run typecheck && npm test && npm run build:web
npx wrangler deploy --dry-run
```

## Deploy

The GitHub repo is connected to **Cloudflare Workers Builds**, which auto-deploys on
every push to `main` (build command `npm run build`). D1 is provisioned and migrated;
its `database_id` is wired into `wrangler.jsonc`.

R2, Cloudflare Images, and the third-party secrets are enabled from the dashboard — see
[`docs/DASHBOARD_SETUP.md`](docs/DASHBOARD_SETUP.md). Until R2/Images are enabled they
stay commented out in `wrangler.jsonc` and the Worker degrades gracefully.

## Architecture notes (hard-won)

- **Money is recomputed server-side.** Client never sets totals. Durations are in
  **minutes** to avoid client/server mismatch. See `packages/shared/src/money.ts`.
- **Money/conflict tables bypass the generic upsert.** Bookings and invoices have
  dedicated, validated endpoints with double-booking + optimistic-concurrency checks.
- **Per-row authorization** (`canWrite`) on every generic write/delete.
- **AI is metered** in D1 (`ai_usage`): ~100/day per user, ~15/day per IP. `callAI`
  falls back when the Worker returns `{demo:true}` **or** empty text.
- **Resilience** — ErrorBoundary, global handlers, telemetry sink to `error_logs`, the
  whole Worker `fetch` wrapped in try/catch returning a friendly error + incident id.
- **Privacy** — `/privacy`, Settings → export-my-data and delete-my-account.
