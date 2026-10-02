-- Worker Allocation, tier-priority + Admin -> Superadmin escalation
-- (2 Oct 2026). Project owner's confirmed rule: a Coordinator exhausts his
-- own coverage_zones, then escalates to Admin (already built, Session 68).
-- If Admin ALSO can't resolve it, Admin escalates to Superadmin -- that
-- last hop never existed. worker_allocation_escalations.status only ever
-- allowed 'pending' | 'resolved' | 'cancelled'; this widens it and adds the
-- columns an Admin's escalation-to-Superadmin actually needs to record.
--
-- No new "job tier" field is added here -- boq_generated.tier
-- ('budget'|'premium'|'luxury', set once per job at estimate finalization
-- via generateBOQ/EstimateConsole) is the EXACT "general / premium / higher"
-- job category the project owner described, already real and already live.
-- Reused as-is, per this project's own "search before create fresh" rule.

ALTER TABLE worker_allocation_escalations
  DROP CONSTRAINT IF EXISTS worker_allocation_escalations_status_check;

ALTER TABLE worker_allocation_escalations
  ADD CONSTRAINT worker_allocation_escalations_status_check
  CHECK (status IN ('pending', 'resolved', 'cancelled', 'escalated_to_superadmin'));

ALTER TABLE worker_allocation_escalations
  ADD COLUMN IF NOT EXISTS escalated_to_superadmin_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_to_superadmin_by UUID,
  ADD COLUMN IF NOT EXISTS escalated_to_superadmin_remark TEXT;
