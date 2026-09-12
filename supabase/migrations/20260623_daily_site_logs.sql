-- Daily site logs submitted by supervisors (morning and evening).
-- One row per supervisor per calendar day. Morning and evening fields
-- are stored together; evening fields are nullable until submitted.

CREATE TABLE IF NOT EXISTS daily_site_logs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id         UUID        NOT NULL REFERENCES workers(id),
  booking_ref           TEXT        NOT NULL,
  log_date              DATE        NOT NULL DEFAULT CURRENT_DATE,

  -- Morning log
  morning_submitted_at  TIMESTAMPTZ,
  crew_attendance       JSONB       NOT NULL DEFAULT '[]',
  site_photo_url        TEXT,
  planned_scope         TEXT,
  materials_delivered   BOOLEAN     NOT NULL DEFAULT false,
  materials_description TEXT,
  materials_photo_url   TEXT,

  -- Evening log
  evening_submitted_at  TIMESTAMPTZ,
  scope_completed       TEXT,
  deviation_from_plan   BOOLEAN,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_supervisor_log_date UNIQUE (supervisor_id, log_date)
);

CREATE TRIGGER trg_daily_site_logs_updated_at
  BEFORE UPDATE ON daily_site_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_daily_site_logs_supervisor ON daily_site_logs (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_daily_site_logs_date ON daily_site_logs (log_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_site_logs_booking ON daily_site_logs (booking_ref);

ALTER TABLE daily_site_logs ENABLE ROW LEVEL SECURITY;

-- Supervisor can read and write their own daily logs.
-- auth_user_id on workers links the worker record to the Supabase auth user.
CREATE POLICY "daily_logs_supervisor_all"
  ON daily_site_logs FOR ALL
  TO authenticated
  USING (
    supervisor_id IN (
      SELECT id FROM workers WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    supervisor_id IN (
      SELECT id FROM workers WHERE auth_user_id = auth.uid()
    )
  );

-- Coordinators and admins can read every log (same broad authenticated read
-- used elsewhere in the platform for staff visibility).
CREATE POLICY "daily_logs_staff_select"
  ON daily_site_logs FOR SELECT
  TO authenticated
  USING (true);

-- Storage bucket for photos taken on site (first-on-site + materials).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-log-photos',
  'site-log-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "site_log_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-log-photos');

CREATE POLICY "site_log_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'site-log-photos');
