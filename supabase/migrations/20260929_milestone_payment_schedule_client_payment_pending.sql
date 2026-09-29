-- Client field inventory finding: submitMilestonePaymentRequest
-- (app/client/dashboard/[bookingRef]/actions.ts) was confirmed orphaned dead
-- code (zero callers anywhere), and the one status value it writes,
-- 'client_payment_pending', is NOT in the live CHECK constraint widened by
-- 20260927_milestone_payment_schedule_freeze_fixes.sql -- confirmed by
-- reading that migration's own full value list. Writing it today would fail
-- exactly like the site_instructions instruction_type CHECK-constraint
-- mismatch found earlier this session.
--
-- Per the project owner's decision (29 Sep 2026): build this for real. It is
-- the client-initiated trigger to pay a staff-approved, non-M0 milestone
-- (M1-M4) -- the M0 token payment already has its own working flow
-- (app/client/payment), but nothing let a client pay any LATER milestone.
-- This is a genuine Addition per Amendment 3 (a new need, met by adding a
-- new value alongside -- every existing reader/writer of the frozen status
-- column behaves exactly as before).
ALTER TABLE milestone_payment_schedule
  DROP CONSTRAINT IF EXISTS milestone_payment_schedule_status_check;

ALTER TABLE milestone_payment_schedule
  ADD CONSTRAINT milestone_payment_schedule_status_check
  CHECK (status IN (
    'pending', 'released', 'paid',
    'evidence_submitted', 'coordinator_approved', 'payment_released',
    'admin_approved', 'admin_hold', 'admin_rejected', 'decision_5_confirmed',
    'verification_pending', 'client_payment_pending'
  ));
