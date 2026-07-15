# Sync Sanctum to QuickBooks with Zapier

Sanctum can push every **paid booking** and **paid tenant invoice** into
QuickBooks Online automatically, using [Zapier](https://zapier.com) as the
bridge. Nothing to install — you connect QuickBooks to Zapier once, and it runs
itself.

There are two ways to do it. Pick one:

| | Option A — Webhook (recommended) | Option B — Email parser (free) |
|---|---|---|
| **Reliability** | High — structured data, exact amounts | Good, but breaks if email wording changes |
| **Zapier plan** | Paid (Webhooks by Zapier is a premium trigger) | Free plan works |
| **Setup time** | ~2 minutes | ~10 minutes |

---

## Option A — Webhook (recommended)

### 1. Start a Zap with a Catch Hook
1. In Zapier, click **Create → Zap**.
2. **Trigger:** search for **Webhooks by Zapier**, choose the event
   **Catch Hook**, continue.
3. Zapier shows a **Custom Webhook URL** like
   `https://hooks.zapier.com/hooks/catch/1234567/abcde/`. Copy it.

### 2. Paste it into Sanctum
1. In Sanctum, go to **Operator → Financials → Automatic sync via Zapier**.
2. Paste the URL, click **Save**, then click **Send test**. This sends Zapier a
   sample event so it can learn the fields.
3. Back in Zapier, click **Test trigger** — you should see the sample record.

### 3. Create the QuickBooks action
1. **Action:** search **QuickBooks Online**, choose
   **Create Sales Receipt** (or **Create Invoice** if you prefer).
2. Connect your QuickBooks account when prompted.
3. Map the fields from the webhook to QuickBooks:

   | QuickBooks field | Map from Sanctum field |
   |---|---|
   | Customer | `customer` |
   | Transaction date | `date` |
   | Product/Service | a service item, e.g. "Facility Rental" |
   | Description / Memo | `description` |
   | Amount | `amount` |

4. **Turn the Zap on.** Done — every future paid booking/invoice flows in.

### What Sanctum sends
Each event is a flat JSON payload, so every field maps cleanly in Zapier:

| Field | Example | Notes |
|---|---|---|
| `event` | `booking.paid` | also `invoice.paid`, `test` |
| `facility_name` | `St. Anne Parish Hall` | your facility |
| `date` | `2026-07-15T18:30:00.000Z` | when it was paid |
| `type` | `Booking` | or `Tenant invoice` |
| `customer` | `Maria Alvarez` | renter / tenant name |
| `description` | `Quinceañera` | event name or invoice number |
| `reference` | `bkg-abc123` | booking id or invoice number |
| `amount` | `700.00` | gross, in dollars |
| `platform_fee` | `10.50` | Sanctum's fee, in dollars |
| `net` | `689.50` | what you keep, in dollars |
| `gross_cents` / `platform_fee_cents` / `net_cents` | `70000` | same values in cents |
| `currency` | `USD` | |

> **Tip:** map `amount` (gross) to the sales receipt so QuickBooks shows the full
> rental revenue, and record the Sanctum platform fee separately as an expense if
> you want your books to net out exactly. Or map `net` if you only track deposits
> actually received.

---

## Option B — Email parser (free plan)

If you're on Zapier's free plan, use **Email Parser by Zapier** instead of a
webhook. It reads Sanctum's confirmation emails.

1. Go to [parser.zapier.com](https://parser.zapier.com) and create a mailbox —
   you'll get an address like `abcde@robot.zapier.com`.
2. In your email, set up a rule that **forwards** Sanctum booking-confirmation
   and paid-invoice emails to that address. (Forward one manually first so the
   parser has a sample.)
3. In the parser, highlight the amount, customer name, and event name in the
   sample so Zapier learns where they are.
4. Create a Zap: **Trigger** = Email Parser (New Email), **Action** = QuickBooks
   Online → Create Sales Receipt, mapping the parsed fields.
5. Turn it on.

This route is free but more fragile — if we change how a confirmation email
reads, you may need to re-teach the parser. For anything high-volume, Option A is
worth the paid plan.

---

## Troubleshooting
- **"Send test" says it couldn't reach Zapier** — make sure the Zap is switched
  **on** and the URL is the exact Catch Hook URL (starts with
  `https://hooks.zapier.com/`).
- **Nothing arrives after a real booking** — confirm the booking actually reached
  **paid/confirmed** status; only paid transactions fire. Check your Zap's
  **History** tab in Zapier.
- **Duplicate entries** — a booking that's paid fires once; a *tenant* invoice
  (not tied to a booking) fires once. Booking-linked invoices don't double-fire.

Prefer a native, one-click integration with no Zapier at all? We also support
direct QuickBooks connect — ask us to enable it for your account.
