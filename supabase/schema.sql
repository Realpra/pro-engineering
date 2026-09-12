-- =============================================================================
-- Pro Engineering Platform - Supabase Schema
-- Construction & Renovation Services Marketplace, India
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =============================================================================
-- UTILITY: updated_at trigger function (shared by all tables)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLE: users
-- Extends auth.users - one row per authenticated account.
-- Roles: client (project owner), manager (pro-eng staff), site_engineer, admin.
-- =============================================================================

CREATE TABLE users (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  phone         TEXT,
  role          TEXT        NOT NULL DEFAULT 'client'
                              CHECK (role IN ('client', 'manager', 'site_engineer', 'admin')),
  organization  TEXT,
  gstin         TEXT,
  pan           TEXT,
  address       JSONB,
  state         TEXT,
  profile_photo TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_users_role       ON users (role);
CREATE INDEX idx_users_state      ON users (state);
CREATE INDEX idx_users_is_active  ON users (is_active);
CREATE INDEX idx_users_full_name  ON users USING gin (full_name gin_trgm_ops);

-- =============================================================================
-- TABLE: workers
-- Individual labourers / subcontractors available for deployment.
-- May or may not have a platform account (user_id is optional).
-- =============================================================================

CREATE TABLE workers (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        REFERENCES users(id) ON DELETE SET NULL,
  full_name                TEXT        NOT NULL,
  phone                    TEXT        NOT NULL,
  aadhaar_last4            TEXT,
  pan                      TEXT,
  trade                    TEXT        NOT NULL,
  skill_level              TEXT        NOT NULL DEFAULT 'skilled'
                                         CHECK (skill_level IN ('unskilled', 'semi_skilled', 'skilled', 'highly_skilled')),
  daily_wage_inr           NUMERIC(10,2),
  state                    TEXT        NOT NULL,
  district                 TEXT,
  is_bocw_registered       BOOLEAN     NOT NULL DEFAULT false,
  bocw_registration_number TEXT,
  pf_uan                   TEXT,
  esic_ip_number           TEXT,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  profile_photo            TEXT,
  average_rating           NUMERIC(3,2),
  total_deployments        INTEGER     NOT NULL DEFAULT 0,
  is_active                BOOLEAN     NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_workers_updated_at
  BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_workers_trade        ON workers (trade);
CREATE INDEX idx_workers_skill_level  ON workers (skill_level);
CREATE INDEX idx_workers_state        ON workers (state);
CREATE INDEX idx_workers_is_active    ON workers (is_active);
CREATE INDEX idx_workers_user_id      ON workers (user_id);
CREATE INDEX idx_workers_full_name    ON workers USING gin (full_name gin_trgm_ops);

-- =============================================================================
-- TABLE: jobs
-- A project awarded by a client. Single source of truth for a construction or
-- renovation engagement.
-- Status flow: draft -> scoping -> estimated -> approved -> in_progress -> completed
-- =============================================================================

CREATE TABLE jobs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID        NOT NULL REFERENCES users(id),
  manager_id            UUID        REFERENCES users(id),
  site_engineer_id      UUID        REFERENCES users(id),

  title                 TEXT        NOT NULL,
  description           TEXT,
  job_type              TEXT        NOT NULL
                          CHECK (job_type IN (
                            'construction', 'renovation', 'interior', 'civil',
                            'electrical', 'plumbing', 'flooring', 'painting',
                            'waterproofing', 'landscaping', 'other'
                          )),
  status                TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft', 'scoping', 'estimated', 'approved',
                            'in_progress', 'on_hold', 'completed', 'cancelled'
                          )),

  site_address          JSONB       NOT NULL,
  state                 TEXT        NOT NULL,
  zone                  TEXT        CHECK (zone IN ('north', 'south', 'east', 'west', 'central', 'northeast')),
  latitude              NUMERIC(10,7),
  longitude             NUMERIC(10,7),

  area_sqft             NUMERIC(10,2),
  floors                INTEGER,
  site_photos           TEXT[],

  planned_start_date    DATE,
  planned_end_date      DATE,
  actual_start_date     DATE,
  actual_end_date       DATE,

  total_estimate_inr    NUMERIC(14,2),
  total_actual_cost_inr NUMERIC(14,2),
  gst_applicable        BOOLEAN     NOT NULL DEFAULT true,
  gst_rate_pct          NUMERIC(5,2)         DEFAULT 18.00,
  bocw_cess_applicable  BOOLEAN     NOT NULL DEFAULT true,

  contract_number       TEXT        UNIQUE,
  po_number             TEXT,

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_jobs_client_id   ON jobs (client_id);
CREATE INDEX idx_jobs_manager_id  ON jobs (manager_id);
CREATE INDEX idx_jobs_status      ON jobs (status);
CREATE INDEX idx_jobs_job_type    ON jobs (job_type);
CREATE INDEX idx_jobs_state       ON jobs (state);
CREATE INDEX idx_jobs_zone        ON jobs (zone);
CREATE INDEX idx_jobs_created_at  ON jobs (created_at DESC);
CREATE INDEX idx_jobs_title       ON jobs USING gin (title gin_trgm_ops);

-- =============================================================================
-- TABLE: job_modules
-- A job is broken into modules / phases (e.g. Foundation -> Brickwork ->
-- Plastering -> Flooring). Each module has its own cost and schedule.
-- =============================================================================

CREATE TABLE job_modules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  name            TEXT        NOT NULL,
  category        TEXT        NOT NULL
                    CHECK (category IN (
                      'civil', 'structural', 'electrical', 'plumbing',
                      'finishing', 'interior', 'exterior', 'hvac', 'fire_safety', 'other'
                    )),
  description     TEXT,
  sequence_order  INTEGER     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled')),

  planned_start   DATE,
  planned_end     DATE,
  actual_start    DATE,
  actual_end      DATE,
  estimated_days  INTEGER,
  actual_days     INTEGER,

  estimated_cost  NUMERIC(14,2),
  actual_cost     NUMERIC(14,2),

  completion_pct  INTEGER      NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_job_modules_updated_at
  BEFORE UPDATE ON job_modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_job_modules_job_id   ON job_modules (job_id);
CREATE INDEX idx_job_modules_status   ON job_modules (status);
CREATE INDEX idx_job_modules_category ON job_modules (category);
CREATE INDEX idx_job_modules_order    ON job_modules (job_id, sequence_order);

-- =============================================================================
-- TABLE: scope_reports
-- Field engineer's assessment of site conditions and work scope before
-- estimation. Multiple revisions allowed; only one can be 'approved'.
-- =============================================================================

CREATE TABLE scope_reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_by       UUID        NOT NULL REFERENCES users(id),

  title            TEXT        NOT NULL,
  report_type      TEXT        NOT NULL DEFAULT 'initial'
                     CHECK (report_type IN ('initial', 'revised', 'final')),
  version          INTEGER     NOT NULL DEFAULT 1,
  status           TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),

  site_conditions  JSONB,
  scope_items      JSONB       NOT NULL DEFAULT '[]',
  exclusions       TEXT[],
  assumptions      TEXT[],
  risk_notes       TEXT,

  site_visit_date  DATE,
  site_photos      TEXT[],

  submitted_at     TIMESTAMPTZ,
  approved_at      TIMESTAMPTZ,
  approved_by      UUID        REFERENCES users(id),
  rejection_reason TEXT,

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_scope_reports_updated_at
  BEFORE UPDATE ON scope_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_scope_reports_job_id ON scope_reports (job_id);
CREATE INDEX idx_scope_reports_status ON scope_reports (status);
CREATE UNIQUE INDEX idx_scope_reports_approved
  ON scope_reports (job_id) WHERE (status = 'approved');

-- =============================================================================
-- TABLE: estimates
-- Itemised cost estimate for a job (or a specific module). Versioned;
-- superseded estimates are retained for audit.
-- =============================================================================

CREATE TABLE estimates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_module_id    UUID        REFERENCES job_modules(id) ON DELETE SET NULL,
  scope_report_id  UUID        REFERENCES scope_reports(id) ON DELETE SET NULL,
  created_by       UUID        NOT NULL REFERENCES users(id),

  estimate_type    TEXT        NOT NULL DEFAULT 'detailed'
                     CHECK (estimate_type IN ('preliminary', 'detailed', 'revised', 'final')),
  version          INTEGER     NOT NULL DEFAULT 1,
  status           TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'superseded')),

  line_items       JSONB       NOT NULL DEFAULT '[]',

  material_cost    NUMERIC(14,2) NOT NULL DEFAULT 0,
  labour_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
  equipment_cost   NUMERIC(14,2) NOT NULL DEFAULT 0,
  overhead_pct     NUMERIC(5,2)  NOT NULL DEFAULT 10.00,
  overhead_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  profit_pct       NUMERIC(5,2)  NOT NULL DEFAULT 10.00,
  profit_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,

  gst_rate_pct     NUMERIC(5,2)  NOT NULL DEFAULT 18.00,
  gst_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  bocw_cess_rate   NUMERIC(5,2)  NOT NULL DEFAULT 1.00,
  bocw_cess_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tds_rate_pct     NUMERIC(5,2)           DEFAULT 2.00,
  tds_amount       NUMERIC(14,2)          DEFAULT 0,

  total_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  valid_until      DATE,

  submitted_at     TIMESTAMPTZ,
  approved_at      TIMESTAMPTZ,
  approved_by      UUID        REFERENCES users(id),
  rejection_reason TEXT,

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_estimates_job_id        ON estimates (job_id);
CREATE INDEX idx_estimates_module_id     ON estimates (job_module_id);
CREATE INDEX idx_estimates_status        ON estimates (status);
CREATE INDEX idx_estimates_estimate_type ON estimates (estimate_type);
CREATE UNIQUE INDEX idx_estimates_approved
  ON estimates (job_id) WHERE (status = 'approved');

-- =============================================================================
-- TABLE: zone_cost_database
-- Reference rates for materials, labour and equipment by Indian state/zone.
-- Sourced from DSR (Delhi Schedule of Rates), state CSRs, and market data.
-- =============================================================================

CREATE TABLE zone_cost_database (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  state           TEXT        NOT NULL,
  zone            TEXT        NOT NULL
                    CHECK (zone IN ('north', 'south', 'east', 'west', 'central', 'northeast')),
  city            TEXT,

  item_code       TEXT        NOT NULL,
  item_name       TEXT        NOT NULL,
  category        TEXT        NOT NULL
                    CHECK (category IN ('material', 'labour', 'equipment', 'subcontract')),
  subcategory     TEXT,
  specification   TEXT,
  unit            TEXT        NOT NULL,

  base_rate       NUMERIC(12,2) NOT NULL,
  min_rate        NUMERIC(12,2),
  max_rate        NUMERIC(12,2),

  effective_from  DATE        NOT NULL,
  effective_until DATE,
  source          TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_rate_range CHECK (
    min_rate IS NULL OR max_rate IS NULL OR min_rate <= max_rate
  )
);

CREATE TRIGGER trg_zone_cost_database_updated_at
  BEFORE UPDATE ON zone_cost_database
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_zcd_state     ON zone_cost_database (state);
CREATE INDEX idx_zcd_zone      ON zone_cost_database (zone);
CREATE INDEX idx_zcd_category  ON zone_cost_database (category);
CREATE INDEX idx_zcd_item_code ON zone_cost_database (item_code);
CREATE INDEX idx_zcd_is_active ON zone_cost_database (is_active);
CREATE INDEX idx_zcd_effective ON zone_cost_database (effective_from, effective_until);
CREATE INDEX idx_zcd_item_name ON zone_cost_database USING gin (item_name gin_trgm_ops);
CREATE UNIQUE INDEX idx_zcd_unique_rate
  ON zone_cost_database (state, zone, item_code, effective_from);

-- =============================================================================
-- TABLE: milestones
-- Contractual checkpoints tied to a job or module. Can be linked to payments.
-- =============================================================================

CREATE TABLE milestones (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_module_id    UUID        REFERENCES job_modules(id) ON DELETE SET NULL,

  title            TEXT        NOT NULL,
  description      TEXT,
  milestone_type   TEXT        NOT NULL DEFAULT 'completion'
                     CHECK (milestone_type IN (
                       'start', 'completion', 'payment', 'inspection',
                       'material_delivery', 'handover', 'custom'
                     )),
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),

  planned_date     DATE        NOT NULL,
  actual_date      DATE,
  delay_days       INTEGER     GENERATED ALWAYS AS (
                     CASE WHEN actual_date > planned_date
                       THEN actual_date - planned_date
                       ELSE 0
                     END
                   ) STORED,

  completion_pct   INTEGER     NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  evidence_photos  TEXT[],
  verified_by      UUID        REFERENCES users(id),
  verified_at      TIMESTAMPTZ,

  payment_linked   BOOLEAN     NOT NULL DEFAULT false,
  payment_pct      NUMERIC(5,2),
  payment_amount   NUMERIC(14,2),

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_milestones_job_id       ON milestones (job_id);
CREATE INDEX idx_milestones_module_id    ON milestones (job_module_id);
CREATE INDEX idx_milestones_status       ON milestones (status);
CREATE INDEX idx_milestones_planned_date ON milestones (planned_date);
CREATE INDEX idx_milestones_payment      ON milestones (job_id) WHERE payment_linked = true;

-- =============================================================================
-- TABLE: deployment_ratings
-- Client/manager rating of a worker after a deployment (one per worker per job).
-- overall_rating is the mean of the four sub-dimensions, stored computed.
-- =============================================================================

CREATE TABLE deployment_ratings (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             UUID        NOT NULL REFERENCES jobs(id),
  worker_id          UUID        NOT NULL REFERENCES workers(id),
  rated_by           UUID        NOT NULL REFERENCES users(id),

  deployment_start   DATE        NOT NULL,
  deployment_end     DATE,

  quality_rating     SMALLINT    NOT NULL CHECK (quality_rating BETWEEN 1 AND 5),
  punctuality_rating SMALLINT    NOT NULL CHECK (punctuality_rating BETWEEN 1 AND 5),
  behaviour_rating   SMALLINT    NOT NULL CHECK (behaviour_rating BETWEEN 1 AND 5),
  skill_rating       SMALLINT    NOT NULL CHECK (skill_rating BETWEEN 1 AND 5),

  overall_rating     NUMERIC(3,2) GENERATED ALWAYS AS (
                       ROUND(CAST(quality_rating + punctuality_rating + behaviour_rating + skill_rating AS NUMERIC) / 4, 2)
                     ) STORED,

  would_rehire       BOOLEAN,
  review_text        TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_rating_job_worker UNIQUE (job_id, worker_id)
);

CREATE TRIGGER trg_deployment_ratings_updated_at
  BEFORE UPDATE ON deployment_ratings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_ratings_worker_id ON deployment_ratings (worker_id);
CREATE INDEX idx_ratings_job_id    ON deployment_ratings (job_id);
CREATE INDEX idx_ratings_overall   ON deployment_ratings (overall_rating DESC);

-- =============================================================================
-- TABLE: bocw_cess_records
-- Tracks Building & Other Construction Workers cess obligations per job
-- (1% of construction cost under the BOCW Welfare Cess Act, 1996).
-- Each Indian state collects and administers this independently.
-- =============================================================================

CREATE TABLE bocw_cess_records (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                  UUID        NOT NULL REFERENCES jobs(id),
  filed_by                UUID        REFERENCES users(id),

  state                   TEXT        NOT NULL,
  cess_type               TEXT        NOT NULL DEFAULT 'construction'
                            CHECK (cess_type IN ('construction', 'renovation', 'repair', 'maintenance')),

  cess_rate_pct           NUMERIC(5,2)  NOT NULL DEFAULT 1.00,
  construction_cost       NUMERIC(14,2) NOT NULL,
  cess_amount             NUMERIC(14,2) NOT NULL,

  assessment_period_start DATE        NOT NULL,
  assessment_period_end   DATE        NOT NULL,

  payment_status          TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN ('pending', 'paid', 'overdue', 'waived', 'disputed')),
  due_date                DATE,
  paid_at                 DATE,
  paid_amount             NUMERIC(14,2),
  challan_number          TEXT,
  authority_reference     TEXT,
  receipt_url             TEXT,

  penalty_amount          NUMERIC(14,2),
  penalty_reason          TEXT,

  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_bocw_period CHECK (assessment_period_end >= assessment_period_start)
);

CREATE TRIGGER trg_bocw_cess_records_updated_at
  BEFORE UPDATE ON bocw_cess_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_bocw_job_id         ON bocw_cess_records (job_id);
CREATE INDEX idx_bocw_state          ON bocw_cess_records (state);
CREATE INDEX idx_bocw_payment_status ON bocw_cess_records (payment_status);
CREATE INDEX idx_bocw_due_date       ON bocw_cess_records (due_date) WHERE payment_status = 'pending';

-- =============================================================================
-- TABLE: worker_day_tracker
-- Daily attendance and task log per worker per job. One row = one worker-day.
-- Used for wage computation, BOCW headcount, and progress monitoring.
-- =============================================================================

CREATE TABLE worker_day_tracker (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID        NOT NULL REFERENCES jobs(id),
  worker_id         UUID        NOT NULL REFERENCES workers(id),
  job_module_id     UUID        REFERENCES job_modules(id) ON DELETE SET NULL,

  work_date         DATE        NOT NULL,
  attendance_type   TEXT        NOT NULL DEFAULT 'full_day'
                      CHECK (attendance_type IN ('full_day', 'half_day', 'absent', 'holiday', 'paid_leave')),

  check_in_time     TIME,
  check_out_time    TIME,
  hours_worked      NUMERIC(4,2),

  daily_wage        NUMERIC(10,2) NOT NULL,
  attendance_factor NUMERIC(3,2)  NOT NULL DEFAULT 1.00,
  wage_amount       NUMERIC(10,2) NOT NULL,
  overtime_hours    NUMERIC(4,2)  NOT NULL DEFAULT 0,
  overtime_rate     NUMERIC(10,2)           DEFAULT 0,
  overtime_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_payable     NUMERIC(10,2) NOT NULL DEFAULT 0,

  task_description  TEXT,
  work_done_pct     INTEGER      CHECK (work_done_pct BETWEEN 0 AND 100),
  materials_used    JSONB        NOT NULL DEFAULT '[]',

  marked_by         UUID         REFERENCES users(id),
  verified          BOOLEAN      NOT NULL DEFAULT false,
  verified_by       UUID         REFERENCES users(id),
  verified_at       TIMESTAMPTZ,

  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT uq_worker_day UNIQUE (job_id, worker_id, work_date)
);

CREATE TRIGGER trg_worker_day_tracker_updated_at
  BEFORE UPDATE ON worker_day_tracker
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_wdt_job_id    ON worker_day_tracker (job_id);
CREATE INDEX idx_wdt_worker_id ON worker_day_tracker (worker_id);
CREATE INDEX idx_wdt_work_date ON worker_day_tracker (work_date DESC);
CREATE INDEX idx_wdt_module_id ON worker_day_tracker (job_module_id);
CREATE INDEX idx_wdt_verified  ON worker_day_tracker (job_id, verified) WHERE verified = false;
CREATE INDEX idx_wdt_month     ON worker_day_tracker (worker_id, date_trunc('month', work_date::timestamp));

-- =============================================================================
-- TABLE: risk_flags
-- Issues or risks raised on a job. risk_score = likelihood x impact (max 25).
-- =============================================================================

CREATE TABLE risk_flags (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL REFERENCES jobs(id),
  job_module_id    UUID        REFERENCES job_modules(id) ON DELETE SET NULL,
  raised_by        UUID        NOT NULL REFERENCES users(id),
  assigned_to      UUID        REFERENCES users(id),

  risk_type        TEXT        NOT NULL
                     CHECK (risk_type IN (
                       'safety', 'quality', 'delay', 'cost_overrun',
                       'material', 'labour', 'regulatory', 'weather',
                       'client', 'design', 'other'
                     )),
  severity         TEXT        NOT NULL DEFAULT 'medium'
                     CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status           TEXT        NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'acknowledged', 'mitigating', 'resolved', 'closed', 'escalated')),

  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL,

  likelihood       SMALLINT    NOT NULL DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact           SMALLINT    NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  risk_score       INTEGER     GENERATED ALWAYS AS (likelihood::integer * impact::integer) STORED,

  mitigation_plan  TEXT,
  due_date         DATE,
  evidence_photos  TEXT[],

  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID        REFERENCES users(id),
  resolution_notes TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_risk_flags_updated_at
  BEFORE UPDATE ON risk_flags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_risk_job_id    ON risk_flags (job_id);
CREATE INDEX idx_risk_module_id ON risk_flags (job_module_id);
CREATE INDEX idx_risk_status    ON risk_flags (status);
CREATE INDEX idx_risk_severity  ON risk_flags (severity);
CREATE INDEX idx_risk_score     ON risk_flags (risk_score DESC);
CREATE INDEX idx_risk_open      ON risk_flags (job_id) WHERE status NOT IN ('resolved', 'closed');

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_modules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_cost_database  ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_ratings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bocw_cess_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_day_tracker  ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags          ENABLE ROW LEVEL SECURITY;

-- Helper: true when the caller is an admin or manager
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE POLICY "users_select"
  ON users FOR SELECT
  USING (id = auth.uid() OR is_staff());

CREATE POLICY "users_insert"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update"
  ON users FOR UPDATE
  USING (id = auth.uid() OR is_staff())
  WITH CHECK (id = auth.uid() OR is_staff());

-- ---------------------------------------------------------------------------
-- workers
-- ---------------------------------------------------------------------------

CREATE POLICY "workers_all_staff"
  ON workers FOR ALL
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "workers_select_own"
  ON workers FOR SELECT
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------

CREATE POLICY "jobs_select"
  ON jobs FOR SELECT
  USING (
    client_id = auth.uid()
    OR manager_id = auth.uid()
    OR site_engineer_id = auth.uid()
    OR is_staff()
  );

CREATE POLICY "jobs_insert"
  ON jobs FOR INSERT
  WITH CHECK (client_id = auth.uid() OR is_staff());

CREATE POLICY "jobs_update"
  ON jobs FOR UPDATE
  USING (
    (client_id = auth.uid() AND status IN ('draft', 'scoping'))
    OR is_staff()
  )
  WITH CHECK (
    (client_id = auth.uid() AND status IN ('draft', 'scoping'))
    OR is_staff()
  );

-- ---------------------------------------------------------------------------
-- job_modules
-- ---------------------------------------------------------------------------

CREATE POLICY "job_modules_select"
  ON job_modules FOR SELECT
  USING (
    is_staff()
    OR EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_modules.job_id
        AND (jobs.client_id = auth.uid()
             OR jobs.manager_id = auth.uid()
             OR jobs.site_engineer_id = auth.uid())
    )
  );

CREATE POLICY "job_modules_all_staff"
  ON job_modules FOR ALL
  USING (is_staff())
  WITH CHECK (is_staff());

-- ---------------------------------------------------------------------------
-- scope_reports
-- ---------------------------------------------------------------------------

CREATE POLICY "scope_reports_select"
  ON scope_reports FOR SELECT
  USING (
    is_staff()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = scope_reports.job_id
        AND (jobs.client_id = auth.uid()
             OR jobs.manager_id = auth.uid()
             OR jobs.site_engineer_id = auth.uid())
    )
  );

CREATE POLICY "scope_reports_insert"
  ON scope_reports FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('site_engineer', 'manager', 'admin')
    )
  );

CREATE POLICY "scope_reports_update"
  ON scope_reports FOR UPDATE
  USING (created_by = auth.uid() OR is_staff())
  WITH CHECK (created_by = auth.uid() OR is_staff());

-- ---------------------------------------------------------------------------
-- estimates
-- ---------------------------------------------------------------------------

CREATE POLICY "estimates_select"
  ON estimates FOR SELECT
  USING (
    is_staff()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = estimates.job_id
        AND (jobs.client_id = auth.uid()
             OR jobs.manager_id = auth.uid()
             OR jobs.site_engineer_id = auth.uid())
    )
  );

CREATE POLICY "estimates_all_staff"
  ON estimates FOR ALL
  USING (is_staff())
  WITH CHECK (is_staff());

-- ---------------------------------------------------------------------------
-- zone_cost_database (read-only for all authenticated users, write only admin)
-- ---------------------------------------------------------------------------

CREATE POLICY "zcd_select"
  ON zone_cost_database FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "zcd_all_admin"
  ON zone_cost_database FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ---------------------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------------------

CREATE POLICY "milestones_select"
  ON milestones FOR SELECT
  USING (
    is_staff()
    OR EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = milestones.job_id
        AND (jobs.client_id = auth.uid()
             OR jobs.manager_id = auth.uid()
             OR jobs.site_engineer_id = auth.uid())
    )
  );

CREATE POLICY "milestones_all_staff"
  ON milestones FOR ALL
  USING (is_staff())
  WITH CHECK (is_staff());

-- ---------------------------------------------------------------------------
-- deployment_ratings
-- ---------------------------------------------------------------------------

CREATE POLICY "deployment_ratings_select_staff"
  ON deployment_ratings FOR SELECT
  USING (is_staff());

CREATE POLICY "deployment_ratings_select_own"
  ON deployment_ratings FOR SELECT
  USING (rated_by = auth.uid());

CREATE POLICY "deployment_ratings_insert"
  ON deployment_ratings FOR INSERT
  WITH CHECK (
    rated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = deployment_ratings.job_id
        AND (jobs.client_id = auth.uid() OR jobs.manager_id = auth.uid())
    )
  );

CREATE POLICY "deployment_ratings_update"
  ON deployment_ratings FOR UPDATE
  USING (rated_by = auth.uid() OR is_staff())
  WITH CHECK (rated_by = auth.uid() OR is_staff());

-- ---------------------------------------------------------------------------
-- bocw_cess_records
-- ---------------------------------------------------------------------------

CREATE POLICY "bocw_all_staff"
  ON bocw_cess_records FOR ALL
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "bocw_select_client"
  ON bocw_cess_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = bocw_cess_records.job_id
        AND jobs.client_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- worker_day_tracker
-- ---------------------------------------------------------------------------

CREATE POLICY "wdt_all_staff"
  ON worker_day_tracker FOR ALL
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE POLICY "wdt_all_site_engineer"
  ON worker_day_tracker FOR ALL
  USING (
    marked_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = worker_day_tracker.job_id
        AND jobs.site_engineer_id = auth.uid()
    )
  )
  WITH CHECK (
    marked_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = worker_day_tracker.job_id
        AND jobs.site_engineer_id = auth.uid()
    )
  );

CREATE POLICY "wdt_select_worker"
  ON worker_day_tracker FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workers
      WHERE workers.id = worker_day_tracker.worker_id
        AND workers.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- risk_flags
-- ---------------------------------------------------------------------------

CREATE POLICY "risk_flags_select"
  ON risk_flags FOR SELECT
  USING (
    is_staff()
    OR raised_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = risk_flags.job_id
        AND (jobs.client_id = auth.uid()
             OR jobs.manager_id = auth.uid()
             OR jobs.site_engineer_id = auth.uid())
    )
  );

CREATE POLICY "risk_flags_insert"
  ON risk_flags FOR INSERT
  WITH CHECK (
    raised_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = risk_flags.job_id
        AND (jobs.client_id = auth.uid()
             OR jobs.manager_id = auth.uid()
             OR jobs.site_engineer_id = auth.uid())
    )
  );

CREATE POLICY "risk_flags_update"
  ON risk_flags FOR UPDATE
  USING (raised_by = auth.uid() OR is_staff())
  WITH CHECK (raised_by = auth.uid() OR is_staff());

-- =============================================================================
-- TRIGGER: auto-update workers.average_rating after each deployment rating
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_worker_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE workers
  SET
    average_rating    = (
      SELECT ROUND(AVG(overall_rating), 2)
      FROM deployment_ratings
      WHERE worker_id = NEW.worker_id
    ),
    total_deployments = (
      SELECT COUNT(*)
      FROM deployment_ratings
      WHERE worker_id = NEW.worker_id
    )
  WHERE id = NEW.worker_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refresh_worker_rating
  AFTER INSERT OR UPDATE ON deployment_ratings
  FOR EACH ROW EXECUTE FUNCTION refresh_worker_rating();
