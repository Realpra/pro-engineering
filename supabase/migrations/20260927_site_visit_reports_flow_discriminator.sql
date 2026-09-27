-- Supervisor Visit schema freeze, item 1 (Duplicate/Conflict #1):
-- Flow (i) Site Survey and Flow (ii) Daily Execution Visit share the physical
-- site_visit_reports table and collide on column names (screen02_scope_intent,
-- screen17_risk_decisions, screen19_materials) with incompatible content.
-- generateBOQ / the estimate page / the site-survey page's existing-report
-- check all queried by booking_ref (+ status) alone, with no way to tell the
-- two flows apart -- a Flow (ii) row submitted after a Flow (i) survey could
-- silently be picked up as if it were the survey.
--
-- Fix: add an explicit, NOT NULL discriminator column, backfilled from the
-- existing slot_id convention (initReport() already treats slot_id IS NULL as
-- "this is a Flow (i) survey row"), so every consumer can filter on it
-- explicitly instead of relying on that convention implicitly.

ALTER TABLE site_visit_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'daily_execution'
    CHECK (report_type IN ('site_survey', 'daily_execution'));

UPDATE site_visit_reports
SET report_type = CASE WHEN slot_id IS NULL THEN 'site_survey' ELSE 'daily_execution' END
WHERE report_type IS DISTINCT FROM (CASE WHEN slot_id IS NULL THEN 'site_survey' ELSE 'daily_execution' END);

-- Supervisor Visit schema freeze, Bug #5:
-- The original UNIQUE(supervisor_id, booking_ref) constraint (20260627) is
-- never dropped by the 20260924 slot-scoping migration. If still live, it
-- would block a supervisor from ever having more than one site_visit_reports
-- row per booking at all, regardless of slot_id -- meaning the "one slot = one
-- row" fix could be non-functional at the database level. Replace it with a
-- constraint that actually matches the slot-scoped design: one row per
-- (supervisor, booking, slot). Flow (i) survey rows (slot_id IS NULL) are
-- de-duplicated by initReport()'s own select-before-insert check, since
-- Postgres treats NULLs as distinct under a UNIQUE constraint.
ALTER TABLE site_visit_reports
  DROP CONSTRAINT IF EXISTS uq_site_visit_supervisor_booking;

DROP INDEX IF EXISTS uq_site_visit_supervisor_booking_slot;
CREATE UNIQUE INDEX IF NOT EXISTS uq_site_visit_supervisor_booking_slot
  ON site_visit_reports (supervisor_id, booking_ref, slot_id)
  WHERE slot_id IS NOT NULL;
