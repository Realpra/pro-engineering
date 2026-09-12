-- Allow any authenticated coordinator to read all scope reports.
-- Mirrors the pattern used in workers_admin_read for consistent access control.
-- The existing scope_reports_select policy requires is_staff() or creator/team
-- membership, which blocks coordinator accounts authenticated via auth.users only.

CREATE POLICY "scope_reports_select_authenticated"
  ON scope_reports FOR SELECT
  TO authenticated
  USING (true);
