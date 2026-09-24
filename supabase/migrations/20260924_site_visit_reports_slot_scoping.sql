-- Fixes the Flow (ii) initReport() bug documented in CLAUDE.md PENDING #8 and
-- docs/SITE_VISIT_REBUILD_SPEC.md: initReport() (app/supervisor/site-visit/actions.ts)
-- only matched existing reports by supervisor_id + booking_ref, so every daily
-- execution visit to the same booking (different supervisor_daily_routes slots on
-- different days) collapsed into the SAME row, silently overwriting the previous
-- visit's data.
--
-- slot_id is nullable and does NOT affect Flow (i) SITE SURVEY
-- (app/site-survey/[bookingRef], SiteSurveyManager.tsx) -- that flow never passes a
-- slot id, so its reports keep matching on supervisor_id + booking_ref with
-- slot_id IS NULL, exactly as before this migration.

ALTER TABLE site_visit_reports
  ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES supervisor_daily_routes(id);

CREATE INDEX IF NOT EXISTS idx_site_visit_reports_slot ON site_visit_reports (slot_id);
