-- =============================================================================
-- Client Remarks Processing: extend boq_generated + estimate_client_responses
-- =============================================================================

-- ---------------------------------------------------------------------------
-- boq_generated: add deferred-items tracking + estimate versioning columns
-- ---------------------------------------------------------------------------
ALTER TABLE boq_generated
  ADD COLUMN IF NOT EXISTS estimate_kind           TEXT          NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS parent_estimate_id      UUID,
  ADD COLUMN IF NOT EXISTS sub_estimate_id         UUID,
  ADD COLUMN IF NOT EXISTS deferred_items          JSONB         NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS deferred_value          NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deferred_pct            NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimate_version        NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS estimate_version_label  TEXT;

-- ---------------------------------------------------------------------------
-- estimate_client_responses: create if not exists (all columns including new ones)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimate_client_responses (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref               TEXT        NOT NULL,
  boq_id                    UUID,
  estimate_version          NUMERIC,
  response_type             TEXT,
  overall_remarks           TEXT,
  line_item_responses       JSONB       NOT NULL DEFAULT '[]',
  responded_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  coordinator_processed     BOOLEAN     NOT NULL DEFAULT false,
  coordinator_processed_at  TIMESTAMPTZ,
  item_decisions            JSONB       NOT NULL DEFAULT '[]',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If the table already existed, add only the new coordinator columns
ALTER TABLE estimate_client_responses
  ADD COLUMN IF NOT EXISTS coordinator_processed     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinator_processed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS item_decisions            JSONB       NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_ecr_booking_ref  ON estimate_client_responses (booking_ref);
CREATE INDEX IF NOT EXISTS idx_ecr_boq_id       ON estimate_client_responses (boq_id);
CREATE INDEX IF NOT EXISTS idx_ecr_unprocessed  ON estimate_client_responses (booking_ref, coordinator_processed)
  WHERE coordinator_processed = false;

ALTER TABLE estimate_client_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'estimate_client_responses'
      AND policyname  = 'ecr_authenticated_all'
  ) THEN
    CREATE POLICY "ecr_authenticated_all"
      ON estimate_client_responses FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;
