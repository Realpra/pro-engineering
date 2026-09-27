-- Builds out the real SA-12 Snag List feature (june.md lines 10515-10522,
-- 11104-11105, 11219-11224) that scope_snag_items was only ever half-built
-- for: an insert existed with no working resolution tracking, no read/
-- resolve UI, and no enforcement of the original rule ("Critical snags
-- cannot be 'Client accepted' -- must be Resolved. Milestone locked until
-- all snags are Resolved or Client accepted.").
--
-- CORRECTION (this pass): a first version of this migration assumed
-- resolution_status/resolved_at/resolved_by/resolution_notes did not exist
-- yet and added them via ADD COLUMN IF NOT EXISTS. A live schema dump
-- (information_schema.columns) proved they already existed on the live
-- table, along with several other columns no app code has ever referenced
-- (pre_delivery_assessment_id, raised_by_role, raised_by, snag_trade,
-- resolution_required) -- invisible to every grep-based field inventory
-- this session ran, since none of them are read/written anywhere in code.
-- Because ADD COLUMN IF NOT EXISTS silently skips an already-existing
-- column, the CHECK clause attached to resolution_status in that first
-- version never actually applied. Adding it properly now, as its own
-- statement, against the real live column.
ALTER TABLE scope_snag_items
  DROP CONSTRAINT IF EXISTS scope_snag_items_resolution_status_check;

ALTER TABLE scope_snag_items
  ADD CONSTRAINT scope_snag_items_resolution_status_check
  CHECK (resolution_status IS NULL OR resolution_status IN ('open', 'resolved', 'client_accepted'));
