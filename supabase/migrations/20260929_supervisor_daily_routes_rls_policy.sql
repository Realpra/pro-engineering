-- ROOT CAUSE CONFIRMED LIVE (29 Sep 2026): supervisor_daily_routes has Row
-- Level Security ENABLED but ZERO policies defined at all (confirmed via
-- `SELECT ... FROM pg_policy WHERE polrelid = 'supervisor_daily_routes'::
-- regclass` returning no rows) -- Postgres's default with RLS on and no
-- matching policy is deny-all, for every command, to every non-owner role.
-- A real live test caught this: addSlotManually (built and previously
-- believed "live-simulated" in an earlier session -- that check must have
-- run via the SQL Editor's own service-role session, which bypasses RLS
-- entirely, not through the real app) failed with "new row violates row-
-- level security policy" the first time an actual Supervisor session tried
-- it. This is the mirror-image of the Session 66 `workers` bug (RLS
-- disabled despite policies existing -- an open door); here the door is
-- locked with no key cut for anyone.
--
-- Fix: grant `authenticated` full access, matching the precedent already
-- established on guest_enquiries (Session 59 finding: `USING (true)` for
-- any authenticated user, since this project's real per-role scoping
-- happens in application code via explicit .eq() filters, e.g.
-- .eq('supervisor_id', workerRecord.id), not at the RLS layer) -- this
-- table has never had per-role RLS scoping and nothing in this pass
-- introduces the need for it. `anon` gets no access: every reader/writer
-- of this table requires an authenticated session (confirmed by grep).
ALTER TABLE supervisor_daily_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_supervisor_daily_routes" ON supervisor_daily_routes;
CREATE POLICY "authenticated_all_supervisor_daily_routes"
  ON supervisor_daily_routes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
