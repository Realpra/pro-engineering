-- Real fix for is_staff(), not a workaround. Confirmed live (28 Sep 2026) that
-- is_staff() checked users.role IN ('admin','manager') -- a legacy column/
-- value set from the abandoned schema design (supabase/schema.sql, confirmed
-- stale -- Session 59), never updated to match the live platform_role column
-- this whole app actually uses. This silently blocked every non-service-role
-- query looking up recipients by platform_role (SOS, report submissions,
-- threshold notifications, handover dissatisfaction routing, estimate review
-- notifications) and any is_staff()-gated RLS read/write.
--
-- Full live blast radius confirmed via pg_policies before this fix (not
-- guessed): most of is_staff()'s dependents (bocw_cess_records,
-- deployment_ratings, estimates, job_modules, jobs, milestones, risk_flags)
-- are built around the abandoned legacy `jobs` table (client_id/manager_id/
-- site_engineer_id) the live app never uses -- confirmed dead-code-adjacent,
-- not live-critical. `users`, `workers`, and `scope_reports` are the ones
-- that matter for the real, live app.
--
-- Project owner's revised, explicit decision (narrower than the first pass
-- above): staff = super_admin, admin, coordinator, sub_coordinator only.
-- Supervisor, Site Incharge, Mktg Agent, and Client are all non-staff.
-- Consequence, deliberately accepted: Supervisor's own session can no longer
-- read the users table beyond its own row -- the recipient-lookup queries
-- that need to find admins/coordinators (raiseSOS, submitSupervisorReport,
-- submitExtraWork's coordinator-notify, submitClientHandover's
-- sub-coordinator-notify, submitSupervisorEstimateReview's coordinator-notify)
-- are switched to a service-role client instead (same commit), matching the
-- exact precedent already used for checkPhoneExists in Session 65 -- narrow
-- the specific lookup, not the RLS boundary.
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND platform_role IN ('super_admin', 'admin', 'coordinator', 'sub_coordinator')
      AND is_active = true
  );
$function$;
