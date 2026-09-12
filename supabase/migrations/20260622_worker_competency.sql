-- Stores module declarations and MCQ results from the onboarding Screen 4

CREATE TABLE IF NOT EXISTS worker_competency (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  module_code TEXT        NOT NULL,
  declared    BOOLEAN     NOT NULL DEFAULT false,
  mcq_passed  BOOLEAN,
  score       INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_competency_worker_id_idx
  ON worker_competency (worker_id);

ALTER TABLE worker_competency ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts during onboarding (matches workers table pattern)
CREATE POLICY "worker_competency_anon_insert"
  ON worker_competency FOR INSERT TO anon
  WITH CHECK (true);

-- Allow authenticated staff to read all competency records
CREATE POLICY "worker_competency_auth_read"
  ON worker_competency FOR SELECT TO authenticated
  USING (true);
