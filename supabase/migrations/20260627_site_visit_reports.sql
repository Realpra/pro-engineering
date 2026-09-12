-- site_visit_reports: supervisor-completed 19-screen field assessment forms.
-- Separate from scope_reports (which FK-references jobs and users).
-- Supervisors live in workers table, jobs are tracked via booking_ref on guest_enquiries.

CREATE TABLE site_visit_reports (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id          UUID        NOT NULL REFERENCES workers(id),
  booking_ref            TEXT        NOT NULL,
  title                  TEXT,
  report_type            TEXT        NOT NULL DEFAULT 'site_visit',
  status                 TEXT        NOT NULL DEFAULT 'in_progress',
  screen_progress        INTEGER     NOT NULL DEFAULT 0,

  -- Per-screen JSONB columns (screens 1–4 named; 5–19 generic until specified)
  screen01_job_details   JSONB,
  screen02_demolition    JSONB,
  screen03_plumbing      JSONB,
  screen04_electrical    JSONB,
  screen05_data          JSONB,
  screen06_data          JSONB,
  screen07_data          JSONB,
  screen08_data          JSONB,
  screen09_data          JSONB,
  screen10_data          JSONB,
  screen11_data          JSONB,
  screen12_data          JSONB,
  screen13_data          JSONB,
  screen14_data          JSONB,
  screen15_data          JSONB,
  screen16_data          JSONB,
  screen17_data          JSONB,
  screen18_data          JSONB,
  screen19_data          JSONB,

  submitted_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_site_visit_supervisor_booking UNIQUE (supervisor_id, booking_ref)
);

CREATE TRIGGER trg_site_visit_reports_updated_at
  BEFORE UPDATE ON site_visit_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE site_visit_reports ENABLE ROW LEVEL SECURITY;

-- Supervisors can fully manage their own reports
CREATE POLICY "site_visit_reports_supervisor_all"
  ON site_visit_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workers
      WHERE workers.id = site_visit_reports.supervisor_id
        AND workers.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers
      WHERE workers.id = site_visit_reports.supervisor_id
        AND workers.auth_user_id = auth.uid()
    )
  );

-- Coordinators/staff can read all reports
CREATE POLICY "site_visit_reports_staff_read"
  ON site_visit_reports FOR SELECT
  TO authenticated
  USING (true);
