-- Worker onboarding approval chain (project owner's confirmed design,
-- 30 Sep-1 Oct 2026): Sub-Coordinator recommends -> Coordinator gives an ad
-- hoc approval (immediately deployable, reaches Admin's queue in parallel,
-- not sequentially) -> Admin gives the one final Approve/Reject, with an
-- optional renewal-flag overlay for an otherwise-approvable worker pending a
-- safety-license/government-certificate renewal.
--
-- sub_coordinator_recommendation mirrors the existing (confirmed dead --
-- grep shows it's read in WorkerCard.tsx, written nowhere) coordinator_
-- recommendation column's naming -- both get wired to real write paths by
-- this session's build, closing that "specified but never wired" gap.
--
-- The renewal-flag overlay is a deliberate NEW, separate concept from the
-- pre-existing literal 'approved' value on 3 rows (Session 66's confirmed
-- data-sanity canary, left untouched per the project owner's explicit
-- decision) -- it must never reuse that value.
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS sub_coordinator_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS admin_renewal_flag_reason      TEXT,
  ADD COLUMN IF NOT EXISTS admin_renewal_flagged_at       TIMESTAMPTZ;
