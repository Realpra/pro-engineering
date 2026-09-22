-- Fixes a CANDIDATE_ROOT_MATCH found by supabase/audits/field_naming_audit_v2.sql:
-- premium_approval_requests.actioned_at looked related to estimate_client_responses'
-- coordinator_actioned_at, but they turned out to be unrelated tables/concepts.
--
-- Investigated before touching it:
--   - Not defined in any migration file for this table -- added directly against
--     the live DB.
--   - The actual timestamp used everywhere admin/super_admin act on a premium
--     approval request is reviewed_at, not actioned_at:
--       app/admin/dashboard/premium-approval-actions.ts (approve + reject)
--       app/superadmin/dashboard/actions.ts (approve + reject)
--     actioned_at has zero references anywhere in the repo.
--   - Live check: `SELECT actioned_at, COUNT(*) FROM premium_approval_requests
--     GROUP BY actioned_at` returned zero rows -- the table is currently empty,
--     so there is no data at risk.

ALTER TABLE premium_approval_requests DROP COLUMN IF EXISTS actioned_at;
