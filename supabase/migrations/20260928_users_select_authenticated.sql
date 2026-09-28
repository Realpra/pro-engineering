-- Allow any authenticated user to read all users (id/platform_role lookups).
-- Mirrors the exact same pattern already used for workers_select_authenticated
-- (20260621_workers_admin_read.sql) and scope_reports_select_authenticated
-- (20260621_scope_reports_coordinator_read.sql) -- both migrations record the
-- same root cause: is_staff() checks users.role IN ('admin','manager'), a
-- legacy column/value set from the abandoned schema design (see
-- supabase/schema.sql, confirmed stale -- Session 59), never updated to match
-- the live platform_role column this whole app actually uses. is_staff() is
-- left as-is here (same as the two precedent fixes did) rather than repaired,
-- since fixing it retroactively would need auditing every other table that
-- depends on it -- out of scope for this fix.
--
-- Confirmed live (28 Sep 2026) this blocks every "look up users by
-- platform_role" query run via the regular (non-service-role) client:
-- Dashboard's raiseSOS, Reports' submitSupervisorReport, Extra Works'
-- threshold-notify, Pre-Delivery's dissatisfaction-notify, Estimates'
-- revise/modify-notify -- confirmed by a real SOS attempt returning
-- "No admin recipient found to raise SOS to." despite admin@proengineering.in
-- existing.
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  TO authenticated
  USING (true);
