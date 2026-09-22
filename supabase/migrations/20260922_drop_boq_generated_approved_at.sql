-- Dead column found while manually tracing boq_generated. Zero code references
-- anywhere in the repo -- the actual approval mechanism on this table is
-- status: 'accepted' + client_accepted_at (set in
-- app/client/dashboard/[bookingRef]/actions.ts:121), which is fully wired.
-- Live check confirmed both rows are NULL.

ALTER TABLE boq_generated DROP COLUMN IF EXISTS approved_at;
