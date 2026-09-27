-- Supervisor Visit schema freeze, Duplicate/Conflict #2:
-- coordinator_approved_at was written for two unrelated real-world events --
-- Supervisor's coordinatorApproveMilestone ("coordinator approved milestone
-- evidence") and Client's verifyPayment ("coordinator verified the client's
-- M0 token payment"). Amendment 1 tie-break: coordinator_approved_at is
-- itself the correct, canonical, heavily-depended-on name for the FIRST
-- event (confirmed by PaymentCard.tsx's own "Days Waiting"/"Coordinator
-- Approved" logic, distinct from its separate admin_approved_at cell) --
-- left completely unchanged, no reader needs to move. Only the SECOND event
-- (an unrelated M0 token-payment fact wrongly overloading the same column)
-- gets its own new column, resolved canonically -- verifyPayment no longer
-- writes coordinator_approved_at at all.
ALTER TABLE milestone_payment_schedule
  ADD COLUMN IF NOT EXISTS token_payment_verified_at TIMESTAMPTZ;

-- Best-effort backfill: only M0 rows can hold a historical token-payment
-- timestamp under the old, conflated write.
UPDATE milestone_payment_schedule
SET token_payment_verified_at = coordinator_approved_at
WHERE token_payment_verified_at IS NULL
  AND coordinator_approved_at IS NOT NULL
  AND milestone_code = 'M0';

-- Duplicate/Conflict #5/#6/#7: payment_pct, trigger_event, and released_at
-- were declared in the original 20260629 migration; every real write/read in
-- the live app uses payment_percent, trigger_condition, and
-- payment_released_at instead (an undocumented rename that was never
-- reflected back into a migration, the same drift pattern already fixed for
-- contingency_policy in Session 63). A prior pass of this migration DROPPED
-- these 3 columns outright -- the project owner explicitly rejected that: per
-- Amendment 1 step 5 ("the losing candidate is NOT deleted"), they are kept
-- in the table, not dropped. Cross-checked against june.md's own contemporary
-- audit note (line 167287): no separate designed flow exists behind these 3
-- specific names beyond what payment_percent/trigger_condition/
-- payment_released_at already implement live -- they are the first
-- migration's draft names, superseded before real code was built on them,
-- not an unfinished feature. Recorded here, not silently dropped.

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
