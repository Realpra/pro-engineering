-- Dead column found while manually tracing boq_generated (same table job_id was
-- already dropped from in this session). client_notes has zero references
-- anywhere in the codebase -- coordinator_notes on the same table is actively
-- used by the admin estimate console, but no "client can leave notes" feature
-- was ever built to write or read client_notes. Live check confirmed both rows
-- are NULL.

ALTER TABLE boq_generated DROP COLUMN IF EXISTS client_notes;
