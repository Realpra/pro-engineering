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

-- Supervisor Visit schema freeze, Bug #5 -- CONFIRMED LIVE by a real test
-- insert (not hypothetical): the original UNIQUE(supervisor_id, booking_ref)
-- constraint is still blocking a second row per booking right now. The first
-- pass of this migration guessed its name as `uq_site_visit_supervisor_booking`
-- and dropped that -- but the constraint live in production has Postgres's
-- own auto-generated name instead (confirmed by the actual error message a
-- live test insert produced: "violates unique constraint
-- site_visit_reports_supervisor_id_booking_ref_key"), so the first pass's
-- DROP CONSTRAINT was a silent no-op against a constraint that was never
-- there under that name. Dropping the REAL name now, plus keeping the
-- original guess for safety. Replace it with a constraint that actually
-- matches the slot-scoped design: one row per (supervisor, booking, slot).
-- Flow (i) survey rows (slot_id IS NULL) are de-duplicated by initReport()'s
-- own select-before-insert check, since Postgres treats NULLs as distinct
-- under a UNIQUE constraint.
ALTER TABLE site_visit_reports
  DROP CONSTRAINT IF EXISTS uq_site_visit_supervisor_booking,
  DROP CONSTRAINT IF EXISTS site_visit_reports_supervisor_id_booking_ref_key;

DROP INDEX IF EXISTS uq_site_visit_supervisor_booking_slot;
CREATE UNIQUE INDEX IF NOT EXISTS uq_site_visit_supervisor_booking_slot
  ON site_visit_reports (supervisor_id, booking_ref, slot_id)
  WHERE slot_id IS NOT NULL;
