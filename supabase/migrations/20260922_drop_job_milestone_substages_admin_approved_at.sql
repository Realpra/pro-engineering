-- Dead column found while tracing job_milestone_substages' approval flow
-- (see the same commit that added coordinator_approved_at to
-- adminApproveSubstage/adminRejectSubstage in app/admin/milestones/actions.ts).
--
-- admin_approved_at looks like it should mirror the admin/coordinator two-stage
-- approval pattern that genuinely exists on milestone_payment_schedule, but on
-- this table it's never read or written anywhere in the repo -- the actual admin
-- approval action writes substage_approved_at instead. Live check confirmed all
-- 27 rows are NULL.

ALTER TABLE job_milestone_substages DROP COLUMN IF EXISTS admin_approved_at;
