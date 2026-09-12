-- Add sector and employment_classification columns to workers table

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS sector                    TEXT,
  ADD COLUMN IF NOT EXISTS employment_classification TEXT
    CHECK (employment_classification IN ('permanent', 'contractual', 'daily_wage', 'piece_rate', 'subcontractor'));

CREATE INDEX IF NOT EXISTS idx_workers_sector ON workers (sector);
CREATE INDEX IF NOT EXISTS idx_workers_employment ON workers (employment_classification);
