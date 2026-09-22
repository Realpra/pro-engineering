-- Fixes a TYPE_MISMATCH found by supabase/audits/field_naming_audit_v2.sql:
-- guest_enquiries.scheduled_date is TEXT while supervisor_daily_routes.scheduled_date
-- (the same concept, a booked visit date) is DATE. The TEXT column isn't in any prior
-- migration file, so it was added directly against the live DB outside this repo's
-- migration history.
--
-- Verified before writing this: the only code that reads guest_enquiries.scheduled_date
-- is app/supervisor/scope-verification/page.tsx, which selects it but never renders,
-- filters, or orders by it (no .eq/.order/.in calls against it anywhere in the repo,
-- unlike supervisor_daily_routes.scheduled_date which is actively date-compared).
-- So converting it to DATE requires no code changes.
--
-- BEFORE RUNNING THIS: run the check below in the Supabase SQL editor. If it returns
-- any rows, do NOT run the ALTER below as-is — those rows will fail the cast and you'll
-- need to decide how to handle them (NULL out, or fix manually) first.
--
--   SELECT id, booking_ref, scheduled_date
--   FROM guest_enquiries
--   WHERE scheduled_date IS NOT NULL
--     AND scheduled_date !~ '^\d{4}-\d{2}-\d{2}$';
--
-- If that check returns zero rows, run the statement below.

ALTER TABLE guest_enquiries
  ALTER COLUMN scheduled_date TYPE DATE
  USING NULLIF(scheduled_date, '')::date;
