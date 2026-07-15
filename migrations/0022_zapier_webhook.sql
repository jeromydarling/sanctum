-- Per-facility Zapier "Catch Hook" URL. When set, Sanctum POSTs a JSON payload
-- to it on every paid booking and paid tenant invoice, so an operator's Zap can
-- push the transaction into QuickBooks (or anything else) with no code on our
-- side. Null/empty = disabled. Restricted server-side to hooks.zapier.com.
ALTER TABLE facilities ADD COLUMN zapier_webhook_url TEXT;
