-- Screen 18 of Flow (ii) (SiteVisitManager.tsx) collects a two-part Decision 5
-- reason: "Why Rejected" (stored in the existing decision_5_reason column) and
-- "What to Do" (redo complete / redo part / create a substage job / other),
-- which has no existing column to land in. See docs/SITE_VISIT_REBUILD_SPEC.md
-- "Screen 18 -- Payment Proposal" and CLAUDE.md PENDING #9.

ALTER TABLE milestone_payment_schedule
  ADD COLUMN IF NOT EXISTS decision_5_remedy TEXT;
