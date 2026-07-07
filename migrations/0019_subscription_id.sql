-- Stripe subscription id for the operator's SaaS plan, so we can pause / resume
-- / cancel it via the API (the retention "pause instead of cancel" save-offer).
ALTER TABLE facilities ADD COLUMN stripe_subscription_id TEXT;
