-- Holds one time slot per assessment booking
CREATE TABLE IF NOT EXISTS assessment_slots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date     DATE        NOT NULL,
  time_slot     TEXT        NOT NULL CHECK (time_slot IN ('morning', 'afternoon')),
  assessor_name TEXT        NOT NULL DEFAULT 'Coordinator',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE assessment_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessment_slots_auth_insert"
  ON assessment_slots FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "assessment_slots_auth_read"
  ON assessment_slots FOR SELECT TO authenticated
  USING (true);

-- Links a worker+module to a slot
CREATE TABLE IF NOT EXISTS assessment_bookings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  slot_id     UUID        NOT NULL REFERENCES assessment_slots(id) ON DELETE CASCADE,
  module_code TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_bookings_worker_id_idx
  ON assessment_bookings (worker_id);

ALTER TABLE assessment_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessment_bookings_auth_insert"
  ON assessment_bookings FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "assessment_bookings_auth_read"
  ON assessment_bookings FOR SELECT TO authenticated
  USING (true);
