-- Supervisor Visit schema freeze, Duplicate/Conflict #18:
-- workers.current_job_id is written with two incompatible entity types
-- depending on which role's action ran: Supervisor's assignWorkerToSubstage
-- (app/supervisor/milestone-tracker/actions.ts) writes a
-- job_milestone_substages row id; Sub-Coordinator's assignWorkerToJob writes
-- a guest_enquiries row id. Per Amendment 3, this is an ADDITION to the
-- already-frozen workers table (Worker Onboarding), not a re-opening of that
-- freeze: the concept "which job is this worker currently on" isn't wrong,
-- its single untyped column just can't serve two distinct consumers safely.
-- current_job_id itself is left as-is (still written by both paths,
-- unchanged) so no out-of-scope reader relying on its current truthiness
-- breaks; current_substage_id is the new, correctly-typed column Supervisor's
-- own write path now also populates.

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS current_substage_id UUID REFERENCES job_milestone_substages(id);

-- Best-effort backfill: only safe to infer for rows whose current_job_id
-- happens to already match a real job_milestone_substages id (the shape
-- Supervisor's own write path has always used).
UPDATE workers w
SET current_substage_id = w.current_job_id
WHERE w.current_substage_id IS NULL
  AND w.current_job_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM job_milestone_substages jms WHERE jms.id = w.current_job_id);
