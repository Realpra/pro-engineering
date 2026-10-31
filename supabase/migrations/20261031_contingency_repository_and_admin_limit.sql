-- Owner decision, 31 Oct 2026 (Session 73):
--  * Contingency is an Admin-decided value, kept in Admin's repository, different for every
--    type, job and region, and evolving over time. The estimate takes it from the repository
--    (nothing typed by hand), e.g. item-quantity-rate value 100 + 5% contingency = 105.
--  * Admin Approval Limit for contingency: up to 5% Admin approves; beyond 5% Super Admin.
--
-- What the live table already has (checked read-only 31 Oct 2026): contingency_policy with
-- vertical, job_category, job_type, tier, contingency_pct, min/max_deviation_pct,
-- effective_from/until, set_by, remarks, is_active. Missing: a region, and the approval limit.
-- boq_generated already has contingency_percent/amount/status/proposed_by/approved_by/at.
--
-- Additions only. Nothing existing is renamed or dropped.

-- 1. Region scope on a contingency row. NULL = applies to all locations. When a job is
--    estimated, the most specific row wins: sector, then zone, region, district, state, then
--    the all-locations row.
ALTER TABLE contingency_policy
  ADD COLUMN IF NOT EXISTS geo_id uuid REFERENCES geo_hierarchy(id) ON DELETE SET NULL;

-- 2. Admin approval limit for contingency (owner: 5%). Kept on each row so Super Admin can
--    set it per type/job/region on the screen already built for it.
ALTER TABLE contingency_policy
  ADD COLUMN IF NOT EXISTS admin_approval_limit_pct numeric NOT NULL DEFAULT 5;

ALTER TABLE contingency_policy DROP CONSTRAINT IF EXISTS contingency_policy_admin_limit_check;
ALTER TABLE contingency_policy
  ADD CONSTRAINT contingency_policy_admin_limit_check CHECK (admin_approval_limit_pct >= 0);

CREATE INDEX IF NOT EXISTS idx_contingency_policy_lookup
  ON contingency_policy (job_type, job_category, tier, is_active);

-- 3. The estimate records which repository row and which repository job type it used, so
--    the value can be traced and the approval limit applied.
ALTER TABLE boq_generated
  ADD COLUMN IF NOT EXISTS policy_job_type text;

ALTER TABLE boq_generated
  ADD COLUMN IF NOT EXISTS contingency_policy_id uuid REFERENCES contingency_policy(id) ON DELETE SET NULL;
