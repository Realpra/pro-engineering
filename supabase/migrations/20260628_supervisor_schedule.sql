-- supervisor_schedule: obligations (site visits, meetings, etc.) assigned to a supervisor on a given date.
-- supervisor_daily_routes: already exists — adding route_confirmed + route_locked_at.

CREATE TABLE supervisor_schedule (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id           UUID        NOT NULL REFERENCES workers(id),
  schedule_date           DATE        NOT NULL,
  obligation_type         TEXT        NOT NULL,   -- 'site_visit' | 'meeting' | 'training' | 'office' | 'other'
  obligation_description  TEXT,
  time_slot               TEXT,                  -- e.g. 'morning' | 'afternoon' | '09:00'
  confirmed               BOOLEAN     NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supervisor_schedule_supervisor_date
  ON supervisor_schedule (supervisor_id, schedule_date);

CREATE TRIGGER trg_supervisor_schedule_updated_at
  BEFORE UPDATE ON supervisor_schedule
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE supervisor_schedule ENABLE ROW LEVEL SECURITY;

-- Supervisors manage their own schedule rows
CREATE POLICY "supervisor_schedule_supervisor_all"
  ON supervisor_schedule FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workers
      WHERE workers.id = supervisor_schedule.supervisor_id
        AND workers.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers
      WHERE workers.id = supervisor_schedule.supervisor_id
        AND workers.auth_user_id = auth.uid()
    )
  );

-- Coordinators / staff can read all schedules
CREATE POLICY "supervisor_schedule_staff_read"
  ON supervisor_schedule FOR SELECT
  TO authenticated
  USING (true);

-- Patch supervisor_daily_routes (table exists, columns may not)
ALTER TABLE supervisor_daily_routes
  ADD COLUMN IF NOT EXISTS route_confirmed   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS route_locked_at   TIMESTAMPTZ;
