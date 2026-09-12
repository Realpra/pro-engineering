-- ── Patch: premium_approval_requests missing columns ──────────────────────
-- request_type distinguishes platform-premium overrides from contingency
-- overrides; approval_level records which console (admin vs super admin)
-- is the authority for a given request. Both were omitted from the original
-- CREATE TABLE in 20260701_policy_framework.sql.

ALTER TABLE premium_approval_requests ADD COLUMN IF NOT EXISTS request_type TEXT CHECK (request_type IN ('platform_premium','contingency'));
ALTER TABLE premium_approval_requests ADD COLUMN IF NOT EXISTS approval_level TEXT CHECK (approval_level IN ('admin','super_admin'));

-- ── Patch: platform_premium_policy missing deviation band columns ─────────
-- grep across supabase/migrations for min_deviation_pct / max_deviation_pct
-- returned zero matches — no migration ever created these columns, so the
-- "policy_rate + min_deviation_pct .. policy_rate + max_deviation_pct" band
-- check requested for the estimate console has nothing to read from without
-- this patch. Defaults match the original policy spec (-5 / +10).

ALTER TABLE platform_premium_policy ADD COLUMN IF NOT EXISTS min_deviation_pct NUMERIC NOT NULL DEFAULT -5;
ALTER TABLE platform_premium_policy ADD COLUMN IF NOT EXISTS max_deviation_pct NUMERIC NOT NULL DEFAULT 10;
