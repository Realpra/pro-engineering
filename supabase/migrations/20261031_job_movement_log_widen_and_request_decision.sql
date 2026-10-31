-- Owner's decisions of 31 Oct 2026 (second round) -- Addition, no existing data changes.
--
-- 1. job_movement_log covers more of the job's life: site visits, staff assignment, milestone
--    payments, handover, plan changes, worker deployment ("the most essential task") and daily
--    incidents. The stage/action CHECK lists are widened; existing rows stay valid.
-- 2. Admin decides what happens to a job request that is not moving (client dropped out etc.):
--    keep it live to pursue, or reject it. A rejected request leaves the active job list but is
--    kept on record as "request received but rejected".

ALTER TABLE job_movement_log DROP CONSTRAINT IF EXISTS job_movement_log_stage_check;
ALTER TABLE job_movement_log ADD CONSTRAINT job_movement_log_stage_check CHECK (stage IN (
  'request', 'routing', 'survey', 'estimate', 'premium', 'client', 'execution', 'milestone',
  'scope_change',
  'site_visit', 'staff', 'payment', 'handover', 'plan', 'deployment', 'incident'));

ALTER TABLE job_movement_log DROP CONSTRAINT IF EXISTS job_movement_log_action_check;
ALTER TABLE job_movement_log ADD CONSTRAINT job_movement_log_action_check CHECK (action IN (
  'created', 'forwarded', 'approved', 'returned', 'rejected', 'decided',
  'client_accepted', 'client_rejected', 'client_review',
  'raised', 'scheduled', 'rescheduled', 'declined', 'reassigned', 'cancelled', 'assigned',
  'removed', 'held', 'released', 'completed', 'recast'));

-- Admin's decision on a job request (one concept: what Admin decided about the request).
ALTER TABLE guest_enquiries
  ADD COLUMN IF NOT EXISTS request_decision        TEXT,
  ADD COLUMN IF NOT EXISTS request_decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS request_decided_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_decided_by      UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE guest_enquiries DROP CONSTRAINT IF EXISTS guest_enquiries_request_decision_check;
ALTER TABLE guest_enquiries ADD CONSTRAINT guest_enquiries_request_decision_check
  CHECK (request_decision IS NULL OR request_decision IN ('pursue', 'rejected'));

COMMENT ON COLUMN guest_enquiries.request_decision IS
  'Admin''s decision on a stalled job request: pursue (keep live) or rejected (removed from the active list, kept on record). Owner, 31 Oct 2026.';
