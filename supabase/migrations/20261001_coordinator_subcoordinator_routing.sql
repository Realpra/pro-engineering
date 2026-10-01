-- Coordinator / Sub-Coordinator zone-based job routing (confirmed across
-- several rounds with the project owner, 30 Sep-1 Oct 2026). Project owner's
-- explicit decisions baked into this migration:
--  - Coordinator/Sub-Coordinator get MULTIPLE states + MULTIPLE zones of
--    coverage, kept as two independent arrays (not strictly nested under
--    each other) because NCR-type zones can cross state lines.
--  - Coordinator (and Admin/Superadmin above) keep their existing universal,
--    unscoped view of every job permanently -- these columns do not change
--    any existing Coordinator-facing query. Only Sub-Coordinator's new,
--    separately-built screens filter by driving_user_id.
--  - Every new job gets `driving_role`/`driving_user_id` stamped at Admin's
--    assign step, whether routed to Coordinator or Sub-Coordinator.
--  - A Sub-Coordinator-driven job hands fully to a Coordinator at one single
--    gate ("Confirm Job for Execution", built separately), which is also
--    where a real Coordinator gets picked for jobs that only ever had a
--    Sub-Coordinator -- not before.
-- No existing column is renamed or dropped; `users` and `guest_enquiries`
-- both have no CREATE TABLE in this repo (confirmed live-only, same standing
-- note as workers/job_milestone_substages/supervisor_daily_routes), so this
-- follows the same defensive ADD COLUMN IF NOT EXISTS pattern already used
-- throughout this project for those tables.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS coverage_states TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS coverage_zones  TEXT[] DEFAULT '{}';

ALTER TABLE public.guest_enquiries
  ADD COLUMN IF NOT EXISTS driving_role                TEXT CHECK (driving_role IN ('coordinator', 'sub_coordinator')),
  ADD COLUMN IF NOT EXISTS driving_user_id              UUID,
  ADD COLUMN IF NOT EXISTS driving_assigned_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driving_assigned_by          UUID,
  ADD COLUMN IF NOT EXISTS sub_coordinator_handoff_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_for_execution_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_for_execution_by   UUID;

-- Worker-allocation non-availability escalation (project owner's confirmed
-- simplification, replacing an earlier zone-adjacency-table proposal):
-- Coordinator's zone-scoped match failing outright escalates to Admin, who
-- picks manually from every worker of that trade platform-wide. This is a
-- real decision record, not a free-text afterthought, so it gets its own
-- small table rather than overloading job_milestone_substages further.
CREATE TABLE IF NOT EXISTS worker_allocation_escalations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref       TEXT NOT NULL,
  substage_id       UUID REFERENCES job_milestone_substages(id) ON DELETE CASCADE,
  trade             TEXT NOT NULL,
  skill_level_needed TEXT,
  raised_by         UUID,
  raised_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_worker_id UUID,
  resolved_by       UUID,
  resolved_at       TIMESTAMPTZ,
  remark            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled'))
);
ALTER TABLE worker_allocation_escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worker_allocation_escalations_authenticated_all" ON worker_allocation_escalations;
CREATE POLICY "worker_allocation_escalations_authenticated_all"
  ON worker_allocation_escalations FOR ALL TO authenticated USING (true) WITH CHECK (true);
