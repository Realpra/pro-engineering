-- Allow any authenticated user to read all workers.
-- Matches the same pattern as guest_enquiries_select_staff.
-- The existing workers_all_staff policy only grants access when is_staff()
-- returns true (requires a row in the users table with role admin/manager),
-- which blocks coordinator accounts that authenticate via auth.users only.

CREATE POLICY "workers_select_authenticated"
  ON workers FOR SELECT
  TO authenticated
  USING (true);
