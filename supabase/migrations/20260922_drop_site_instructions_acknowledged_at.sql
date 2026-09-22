-- Fixes a CANDIDATE_ROOT_MATCH found by supabase/audits/field_naming_audit_v2.sql:
-- site_instructions has both acknowledged_at and admin_acknowledged_at.
--
-- Investigated before touching it:
--   - Not defined in any migration file (site_instructions has no CREATE TABLE in
--     this repo at all) — added directly against the live DB.
--   - admin_acknowledged_at is actively used: written in
--     app/admin/reports/actions.ts:17, read in app/admin/reports/page.tsx,
--     ReportTabs.tsx, and app/admin/dashboard/page.tsx.
--   - Plain acknowledged_at is never referenced anywhere in the repo for this
--     table. Every other role's acknowledgment flow uses a status = 'acknowledged'
--     text field instead (see app/supervisor/directives/page.tsx:32), not a
--     timestamp column. The only other "acknowledged_at" in the codebase is an
--     unrelated JSON key inside boq_generated.risk_flag_items — a different
--     table and feature entirely.
--   - Live check: `SELECT acknowledged_at, COUNT(*) FROM site_instructions
--     GROUP BY acknowledged_at` returned zero rows — the table is currently
--     empty, so there is no data to lose.

ALTER TABLE site_instructions DROP COLUMN IF EXISTS acknowledged_at;
