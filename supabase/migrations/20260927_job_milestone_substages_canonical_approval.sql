-- Supervisor Visit schema freeze, Duplicate/Conflict #2, resolved canonically
-- (no dual-write, per the project owner's explicit instruction):
-- substage_approved_at (Admin's own correctly-named approval column,
-- app/admin/milestones/actions.ts) is now the ONLY column every reader
-- across coordinator/sub-coordinator/supervisor/site-incharge uses.
-- coordinator_approved_at is no longer written by any code path as of this
-- migration -- backfill any historical row where only the legacy column was
-- ever populated, so no already-approved substage looks unapproved to the
-- new canonical reads.
UPDATE job_milestone_substages
SET substage_approved_at = coordinator_approved_at,
    substage_approval_status = COALESCE(substage_approval_status, 'approved')
WHERE substage_approved_at IS NULL
  AND coordinator_approved_at IS NOT NULL;

-- Amendment 2 verification query (run after the UPDATE above, expect 0 rows):
-- SELECT count(*) FROM job_milestone_substages
-- WHERE substage_approved_at IS NULL AND coordinator_approved_at IS NOT NULL;
