-- Builds out the real SA-12 Snag List feature (june.md lines 10515-10522,
-- 11104-11105, 11219-11224) that scope_snag_items was only ever half-built
-- for: an insert existed with no resolution tracking, no read/resolve UI,
-- and no enforcement of the original rule ("Critical snags cannot be
-- 'Client accepted' -- must be Resolved. Milestone locked until all snags
-- are Resolved or Client accepted.").

ALTER TABLE scope_snag_items
  ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'resolved', 'client_accepted')),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES workers(id),
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
