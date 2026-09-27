-- Supervisor Visit schema freeze, Duplicate/Conflict #2:
-- coordinator_approved_at was written for two unrelated real-world events --
-- Supervisor's coordinatorApproveMilestone ("coordinator approved milestone
-- evidence") and Client's verifyPayment ("coordinator verified the client's
-- M0 token payment"). Split into two correctly-named columns; the old column
-- is kept and dual-written by both call sites for any out-of-scope reader
-- (admin/dashboard, PaymentCard.tsx, MilestoneTabs.tsx) not yet migrated.
ALTER TABLE milestone_payment_schedule
  ADD COLUMN IF NOT EXISTS milestone_evidence_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_payment_verified_at TIMESTAMPTZ;

-- Best-effort backfill: M0 rows (token payment) vs all other milestone codes
-- (evidence approval) is exactly how the two call sites already partition by
-- milestone_code, so the same partition backfills correctly.
UPDATE milestone_payment_schedule
SET token_payment_verified_at = coordinator_approved_at
WHERE token_payment_verified_at IS NULL
  AND coordinator_approved_at IS NOT NULL
  AND milestone_code = 'M0';

UPDATE milestone_payment_schedule
SET milestone_evidence_approved_at = coordinator_approved_at
WHERE milestone_evidence_approved_at IS NULL
  AND coordinator_approved_at IS NOT NULL
  AND milestone_code <> 'M0';

-- Duplicate/Conflict #5/#6/#7: payment_pct, trigger_event, and released_at
-- were declared in the original 20260629 migration but confirmed dead by
-- repeated exhaustive grep -- every real write/read in the live app uses
-- payment_percent, trigger_condition, and payment_released_at instead (an
-- undocumented rename that was never reflected back into a migration, the
-- same drift pattern already fixed for contingency_policy in Session 63).
ALTER TABLE milestone_payment_schedule
  DROP COLUMN IF EXISTS payment_pct,
  DROP COLUMN IF EXISTS trigger_event,
  DROP COLUMN IF EXISTS released_at;

-- Bug #6 (HIGHEST PRIORITY -- needs live verification, applied here
-- defensively): the original inline CHECK (status IN ('pending','released',
-- 'paid')) was never widened by any later migration, yet the live app writes
-- evidence_submitted / coordinator_approved / payment_released /
-- admin_approved / admin_hold / admin_rejected / decision_5_confirmed /
-- verification_pending / paid. If that narrow CHECK is still enforced in the
-- live database, most of the real payment-flow writes this whole audit
-- describes would already be silently failing. Widen it to the full set of
-- values every writer in the codebase actually uses (grep-confirmed), keeping
-- 'released' for any historical row from before the payment_released rename.
ALTER TABLE milestone_payment_schedule
  DROP CONSTRAINT IF EXISTS milestone_payment_schedule_status_check;

ALTER TABLE milestone_payment_schedule
  ADD CONSTRAINT milestone_payment_schedule_status_check
  CHECK (status IN (
    'pending', 'released', 'paid',
    'evidence_submitted', 'coordinator_approved', 'payment_released',
    'admin_approved', 'admin_hold', 'admin_rejected', 'decision_5_confirmed',
    'verification_pending'
  ));
