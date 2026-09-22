-- Fixes a TYPE_MISMATCH found by supabase/audits/field_naming_audit_v2.sql:
-- boq_generated.job_id was TEXT while every other job_id column (daily_site_logs,
-- estimates, scope_change_requests) is UUID.
--
-- Investigated before touching it:
--   - Not defined in its migration (supabase/migrations/20260629_boq_generation.sql:191)
--     — boq_generated only has booking_ref, no job_id. It was added directly against
--     the live DB outside this repo's migration history.
--   - Zero code in the repo reads or writes boq_generated.job_id (grepped every file
--     under app/ that touches the boq_generated table).
--   - Live data check (run by the user): `SELECT job_id, COUNT(*) FROM boq_generated
--     GROUP BY job_id` returned a single row: NULL, count 2 — i.e. every row in the
--     table has this column NULL. Nothing was ever written to it.
--
-- Retyping a column that holds no data and that no code reads serves no purpose.
-- The correct fix is to remove the orphaned column rather than convert its type.

ALTER TABLE boq_generated DROP COLUMN IF EXISTS job_id;
