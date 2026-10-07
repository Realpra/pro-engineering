-- Coordinator Dynamic Scheduling Engine — the full schema for the day-grain, event-sourced
-- deployment engine designed in Coordinator_Complete_Dynamic_Scheme.xlsx (17 tables) and
-- The_DESIGN_DEPLOYMENT_flow_Proengineering document (Phases A-J), both reconciled and
-- finalized 7 Oct 2026.
--
-- DISCIPLINE: reuse every already-frozen table/field where the real-world concept already
-- exists; only create new tables for genuinely new concepts. Mapping used throughout:
--   Job Master            -> guest_enquiries (extended)
--   Plan Template         -> job_milestone_substages (ALREADY LIVE — not duplicated. Each
--                            substage's early_start_date..early_finish_date + headcount is
--                            the source Task Ledger rows are materialized from)
--   Worker Master         -> workers (extended)
--   Job Tier Master       -> new table (boq_generated.tier's raw values stay untouched;
--                            this table is the Regular/Premium/Platinum naming + priority
--                            layer the matching engine reads, mapped in app code)
--   Trade Master          -> trade_config (extended)
--   Zone Master           -> geo_hierarchy (already live)
--   Zone Adjacency, Compliance Policy, Deviance Policy, Task Ledger, Delay/Event Log,
--   Worker Supply Ledger, Match Log, Continuity Block, External Event, Human Decision Log,
--   Saviors -> genuinely new, no existing counterpart. Created below.

-- ============================================================================
-- 1. EXTEND EXISTING TABLES (Addition, not Contradiction — nothing existing is touched)
-- ============================================================================

-- Job Master additions on guest_enquiries
ALTER TABLE guest_enquiries
  ADD COLUMN IF NOT EXISTS has_started_execution BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN guest_enquiries.has_started_execution IS
  'Y once at least one Task Ledger row for this job has gone COMPLETED. The intra-tier '
  'tie-break: amongst jobs of the same tier, an already-ongoing job is resolved before a '
  'new/rescheduling job in any conflict-decision row (Phase F).';

-- Worker Master additions on workers — genuinely new concepts, NOT replacing the existing
-- workers.skill_level TEXT bucket (unskilled/semi_skilled/skilled etc.), which every other
-- role's UI already reads and keeps reading unchanged.
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS skill_grade INTEGER,
  ADD COLUMN IF NOT EXISTS mobility_radius_km NUMERIC(6,2);

ALTER TABLE workers
  DROP CONSTRAINT IF EXISTS workers_skill_grade_check;
ALTER TABLE workers
  ADD CONSTRAINT workers_skill_grade_check CHECK (skill_grade IS NULL OR skill_grade BETWEEN 0 AND 5);

COMMENT ON COLUMN workers.skill_grade IS
  '0-5. 0 = not yet assessed. 1 is the floor — no worker is onboarded below grade 1. '
  '1-2 = Regular, 3 = Premium, 4-5 = Platinum. This is the real number the deviance ladder '
  'is computed from (candidate grade vs. the job''s own tier floor), confirmed by the '
  'project owner 7 Oct 2026. Distinct from the existing skill_level bucket, which every '
  'other role''s UI already depends on and keeps using unchanged.';
COMMENT ON COLUMN workers.mobility_radius_km IS
  'Informational only — the worker''s own stated travel distance. Confirmed by the project '
  'owner that deployment LOGIC runs purely on Zone + Zone Adjacency, never a radius '
  'calculation; this field is for display/reference, never read by the matching engine.';

-- Trade Master additions on trade_config
ALTER TABLE trade_config
  ADD COLUMN IF NOT EXISTS skill_bucket TEXT;
COMMENT ON COLUMN trade_config.skill_bucket IS 'Skilled / Semi-Skilled / Unskilled.';

-- ============================================================================
-- 2. JOB TIER MASTER (new) — the real Regular/Premium/Platinum naming + priority layer.
--    Deliberately does NOT rewrite boq_generated.tier's existing raw values (confirmed
--    live: 'budget'/'premium'/'luxury') — the mapping from those to Regular/Premium/
--    Platinum lives in application code (lib/allocationPriority.ts), same place Session 70
--    Part 1 already put it. This table is what the matching engine and Deviance Policy key
--    off of directly.
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_tier_master (
  tier_id       TEXT PRIMARY KEY,
  tier_name     TEXT NOT NULL UNIQUE,
  priority_rank INTEGER NOT NULL,
  skill_floor   INTEGER NOT NULL CHECK (skill_floor BETWEEN 0 AND 5)
);

INSERT INTO job_tier_master (tier_id, tier_name, priority_rank, skill_floor) VALUES
  ('T-1', 'Regular',  3, 1),
  ('T-2', 'Premium',  2, 3),
  ('T-3', 'Platinum', 1, 4)
ON CONFLICT (tier_id) DO UPDATE SET
  tier_name = EXCLUDED.tier_name,
  priority_rank = EXCLUDED.priority_rank,
  skill_floor = EXCLUDED.skill_floor;

ALTER TABLE job_tier_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_tier_master_authenticated_read" ON job_tier_master;
CREATE POLICY "job_tier_master_authenticated_read"
  ON job_tier_master FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 3. ZONE ADJACENCY (new) — which zones may pull from which, travel time, donor-capacity
--    check. Zone Master itself is already live as geo_hierarchy — not duplicated.
-- ============================================================================
CREATE TABLE IF NOT EXISTS zone_adjacency (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_zone_id                 UUID NOT NULL REFERENCES geo_hierarchy(id) ON DELETE CASCADE,
  to_zone_id                   UUID NOT NULL REFERENCES geo_hierarchy(id) ON DELETE CASCADE,
  travel_time_minutes          INTEGER,
  distance_km                  NUMERIC(6,2),
  eligible_for_pull            BOOLEAN NOT NULL DEFAULT true,
  donor_capacity_check_required BOOLEAN NOT NULL DEFAULT true,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_zone_id, to_zone_id)
);

ALTER TABLE zone_adjacency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zone_adjacency_authenticated_all" ON zone_adjacency;
CREATE POLICY "zone_adjacency_authenticated_all"
  ON zone_adjacency FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. COMPLIANCE POLICY (new) — max daily/rolling hours, minimum rest between shifts.
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_policy (
  policy_id                 TEXT PRIMARY KEY,
  applies_to_trade          TEXT NOT NULL DEFAULT 'ALL',
  max_hours_per_day         NUMERIC(4,1) NOT NULL,
  max_rolling_7day_hours    NUMERIC(5,1) NOT NULL,
  min_rest_hours_between_shifts NUMERIC(4,1) NOT NULL
);

INSERT INTO compliance_policy (policy_id, applies_to_trade, max_hours_per_day, max_rolling_7day_hours, min_rest_hours_between_shifts)
VALUES
  ('POL-C-01', 'ALL', 9, 48, 11),
  ('POL-C-02', 'SUPERVISOR', 10, 54, 11)
ON CONFLICT (policy_id) DO NOTHING;

ALTER TABLE compliance_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compliance_policy_authenticated_read" ON compliance_policy;
CREATE POLICY "compliance_policy_authenticated_read"
  ON compliance_policy FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 5. DEVIANCE POLICY (new) — the real, symmetric -3..+3 ladder, confirmed 7 Oct 2026.
--    Walk order lives in application code (the matching engine), not the schema: negative
--    side fully exhausted first (0 -> -1 -> -2 -> -3, cost-economy), THEN positive side as
--    last resort (+1 -> +2 -> +3) before NO SUPPLY.
-- ============================================================================
CREATE TABLE IF NOT EXISTS deviance_policy (
  policy_id        TEXT PRIMARY KEY,
  applies_to_trade TEXT NOT NULL DEFAULT 'ALL',
  applies_to_tier  TEXT NOT NULL DEFAULT 'ALL',
  deviance_level   INTEGER NOT NULL CHECK (deviance_level BETWEEN -3 AND 3),
  action           TEXT NOT NULL CHECK (action IN ('AUTO_BOOK', 'ASK_COORDINATOR', 'NOT_ALLOWED'))
);

-- Proposed default action set — NOT yet owner-confirmed row by row (flagged in the
-- companion workbook/doc): 0 and the first step each direction auto-book; deeper steps
-- each direction ask the Coordinator, since both a bigger standards-drop and a bigger
-- cost jump deserve a conscious decision.
INSERT INTO deviance_policy (policy_id, applies_to_trade, applies_to_tier, deviance_level, action) VALUES
  ('POL-D-00', 'ALL', 'ALL',  0, 'AUTO_BOOK'),
  ('POL-D-N1', 'ALL', 'ALL', -1, 'AUTO_BOOK'),
  ('POL-D-N2', 'ALL', 'ALL', -2, 'ASK_COORDINATOR'),
  ('POL-D-N3', 'ALL', 'ALL', -3, 'ASK_COORDINATOR'),
  ('POL-D-P1', 'ALL', 'ALL',  1, 'AUTO_BOOK'),
  ('POL-D-P2', 'ALL', 'ALL',  2, 'ASK_COORDINATOR'),
  ('POL-D-P3', 'ALL', 'ALL',  3, 'ASK_COORDINATOR'),
  ('POL-D-06', 'SUPERVISOR', 'Platinum', -2, 'NOT_ALLOWED')
ON CONFLICT (policy_id) DO NOTHING;

ALTER TABLE deviance_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deviance_policy_authenticated_all" ON deviance_policy;
CREATE POLICY "deviance_policy_authenticated_all"
  ON deviance_policy FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. TASK LEDGER (new) — the real, event-driven day-grain demand log. Materialized FROM
--    job_milestone_substages (the real, live Plan Template), never re-typed. One row per
--    trade per calendar day per substage; a Cancelled_Delayed row is never edited, a
--    recast is always a new appended row.
-- ============================================================================
-- NOT YET LIVE-VERIFIED: job_milestone_substages has no migration file at all (live-only,
-- per this project's own standing record), so its id column's exact type could not be
-- confirmed from this sandbox (no Supabase network access). Assumed UUID, matching every
-- other id column in this codebase's own convention (gen_random_uuid() throughout) and the
-- UUID typing already used for current_substage_id elsewhere. If it's actually TEXT, this
-- one FK will fail on first run — check `\d job_milestone_substages` before running, and
-- change substage_id's type here to TEXT if so (everything else in this migration is
-- unaffected either way).
CREATE TABLE IF NOT EXISTS task_ledger (
  slot_id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref               TEXT NOT NULL,
  substage_id               UUID REFERENCES job_milestone_substages(id),
  client_name               TEXT,
  project_start_date        DATE,
  day_index                 TEXT,
  active_slot               TEXT,
  target_date               DATE NOT NULL,
  shift_window              TEXT NOT NULL DEFAULT 'FULL_DAY' CHECK (shift_window IN ('AM', 'PM', 'FULL_DAY')),
  shift_start_time          TIME,
  shift_end_time            TIME,
  hours_weight              NUMERIC(4,1),
  required_skill_code       TEXT NOT NULL,
  min_proficiency_req       INTEGER NOT NULL DEFAULT 1 CHECK (min_proficiency_req BETWEEN 1 AND 5),
  headcount_needed          INTEGER NOT NULL DEFAULT 1,
  slot_status               TEXT NOT NULL DEFAULT 'Pending' CHECK (slot_status IN ('Pending', 'Completed', 'Cancelled_Delayed')),
  assigned_worker_id        UUID REFERENCES workers(id),
  filled_via_saviors_id     UUID,
  match_score               TEXT,
  deviance_level_applied    INTEGER CHECK (deviance_level_applied BETWEEN -3 AND 3),
  compliance_check_status   TEXT,
  operational_action_trigger TEXT,
  origin                    TEXT NOT NULL DEFAULT 'Planned' CHECK (origin IN ('Planned', 'Recast')),
  recast_from_slot_id       UUID REFERENCES task_ledger(slot_id),
  continuity_block_id       UUID,
  notice_given_at           TIMESTAMPTZ,
  within_notice_protocol    BOOLEAN,
  recast_reason             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_ledger_one_filler_only CHECK (
    assigned_worker_id IS NULL OR filled_via_saviors_id IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_task_ledger_booking_ref ON task_ledger (booking_ref);
CREATE INDEX IF NOT EXISTS idx_task_ledger_target_date ON task_ledger (target_date);
CREATE INDEX IF NOT EXISTS idx_task_ledger_assigned_worker ON task_ledger (assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_task_ledger_status ON task_ledger (slot_status);

ALTER TABLE task_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_ledger_authenticated_all" ON task_ledger;
CREATE POLICY "task_ledger_authenticated_all"
  ON task_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. SAVIORS (new) — off-system, non-onboarded emergency-worker log. No Worker Master
--    row, no Worker Supply Ledger row — a record, not a managed resource. Created before
--    task_ledger's FK to it below.
-- ============================================================================
CREATE TABLE IF NOT EXISTS saviors (
  savior_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      TEXT NOT NULL,
  mobile         TEXT,
  email          TEXT,
  trade_code     TEXT,
  rate_agreed    NUMERIC(10,2),
  booking_ref    TEXT NOT NULL,
  filled_slot_id UUID REFERENCES task_ledger(slot_id),
  days_assigned  INTEGER,
  logged_by      UUID REFERENCES users(id),
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  remarks        TEXT
);

ALTER TABLE task_ledger
  DROP CONSTRAINT IF EXISTS task_ledger_filled_via_saviors_fk;
ALTER TABLE task_ledger
  ADD CONSTRAINT task_ledger_filled_via_saviors_fk
  FOREIGN KEY (filled_via_saviors_id) REFERENCES saviors(savior_id);

ALTER TABLE saviors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saviors_authenticated_all" ON saviors;
CREATE POLICY "saviors_authenticated_all"
  ON saviors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. CONTINUITY BLOCK (new) — glued vs independent days.
-- ============================================================================
CREATE TABLE IF NOT EXISTS continuity_block (
  block_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref          TEXT NOT NULL,
  day_indices_included TEXT,
  glue_status          TEXT NOT NULL DEFAULT 'Active' CHECK (glue_status IN ('Active', 'Removed')),
  execution_status     TEXT NOT NULL DEFAULT 'Not Started' CHECK (execution_status IN ('Not Started', 'Partially Done', 'Done')),
  ungled_by            UUID REFERENCES users(id),
  ungled_at            TIMESTAMPTZ,
  ungling_reason       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_ledger
  DROP CONSTRAINT IF EXISTS task_ledger_continuity_block_fk;
ALTER TABLE task_ledger
  ADD CONSTRAINT task_ledger_continuity_block_fk
  FOREIGN KEY (continuity_block_id) REFERENCES continuity_block(block_id);

ALTER TABLE continuity_block ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "continuity_block_authenticated_all" ON continuity_block;
CREATE POLICY "continuity_block_authenticated_all"
  ON continuity_block FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. EXTERNAL EVENT (new) — one row per real-world disruption, reporting tag only.
-- ============================================================================
CREATE TABLE IF NOT EXISTS external_event (
  external_event_id TEXT PRIMARY KEY,
  event_type        TEXT NOT NULL,
  event_date        DATE NOT NULL,
  affected_zones    TEXT[],
  description       TEXT,
  logged_by         UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE external_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "external_event_authenticated_all" ON external_event;
CREATE POLICY "external_event_authenticated_all"
  ON external_event FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. DELAY / EVENT LOG (new) — one row per disruption against a specific job, with the
--     reason-category + admin-communication gate confirmed in the Word-document pass.
-- ============================================================================
CREATE TABLE IF NOT EXISTS delay_event_log (
  event_id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref                      TEXT NOT NULL,
  affected_slot_id                 UUID REFERENCES task_ledger(slot_id),
  event_type                       TEXT NOT NULL,
  event_date                       DATE NOT NULL DEFAULT CURRENT_DATE,
  days_lost                        INTEGER,
  skill_changed                    BOOLEAN NOT NULL DEFAULT false,
  new_required_skill_code          TEXT,
  resulting_recast_slot_id         UUID REFERENCES task_ledger(slot_id),
  worker_released_id               UUID REFERENCES workers(id),
  external_event_id                TEXT REFERENCES external_event(external_event_id),
  logged_by                        UUID REFERENCES users(id),
  reason_category                  TEXT NOT NULL CHECK (reason_category IN ('Client', 'Project Reasons', 'Beyond Control')),
  reason_remarks                   TEXT,
  admin_communication_approved_at  TIMESTAMPTZ,
  admin_communication_approved_by  UUID REFERENCES users(id),
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delay_event_log_booking_ref ON delay_event_log (booking_ref);

ALTER TABLE delay_event_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delay_event_log_authenticated_all" ON delay_event_log;
CREATE POLICY "delay_event_log_authenticated_all"
  ON delay_event_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 11. WORKER SUPPLY LEDGER (new) — day-grain, one row per worker x date, always derived
--     fresh from real Task Ledger commitments, never hand-set.
-- ============================================================================
CREATE TABLE IF NOT EXISTS worker_supply_ledger (
  ledger_row_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id                UUID NOT NULL REFERENCES workers(id),
  target_date              DATE NOT NULL,
  availability_token       TEXT NOT NULL DEFAULT 'AVAILABLE_FULL_DAY',
  compliance_flag          TEXT NOT NULL DEFAULT 'OK',
  dispatch_pool_eligibility TEXT,
  rolling_7day_hours       NUMERIC(5,1),
  last_shift_end_timestamp TIMESTAMPTZ,
  released_by_event_id     UUID REFERENCES delay_event_log(event_id),
  reassignment_count_7day  INTEGER NOT NULL DEFAULT 0,
  soft_hold_booking_ref    TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, target_date)
);

COMMENT ON COLUMN worker_supply_ledger.soft_hold_booking_ref IS
  'Non-blocking default suggestion: the job this worker is softly earmarked to return to. '
  'NEVER gates availability_token — a Deployer can override by booking him elsewhere, at '
  'which point this is simply cleared on that date''s row.';

CREATE INDEX IF NOT EXISTS idx_worker_supply_ledger_date ON worker_supply_ledger (target_date);
CREATE INDEX IF NOT EXISTS idx_worker_supply_ledger_worker ON worker_supply_ledger (worker_id);

ALTER TABLE worker_supply_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worker_supply_ledger_authenticated_all" ON worker_supply_ledger;
CREATE POLICY "worker_supply_ledger_authenticated_all"
  ON worker_supply_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 12. MATCH LOG (new) — every candidate considered for a slot, audit trail.
-- ============================================================================
CREATE TABLE IF NOT EXISTS match_log (
  match_attempt_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id                UUID NOT NULL REFERENCES task_ledger(slot_id),
  candidate_worker_id    UUID REFERENCES workers(id),
  target_date            DATE NOT NULL,
  skill_match_pct        TEXT,
  deviance_level_applied INTEGER CHECK (deviance_level_applied BETWEEN -3 AND 3),
  proficiency_ok         BOOLEAN,
  compliance_ok          BOOLEAN,
  selected               BOOLEAN NOT NULL DEFAULT false,
  decision_reason        TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_log_slot ON match_log (slot_id);

ALTER TABLE match_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_log_authenticated_all" ON match_log;
CREATE POLICY "match_log_authenticated_all"
  ON match_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 13. HUMAN DECISION LOG (new) — every person-made override, separate from Match Log.
-- ============================================================================
CREATE TABLE IF NOT EXISTS human_decision_log (
  decision_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type            TEXT NOT NULL CHECK (decision_type IN (
    'Deviance Acceptance', 'Cross-Zone Pull', 'Ungluing', 'Gap Accepted',
    'Priority Override', 'Savior Appointed'
  )),
  related_slot_id          UUID REFERENCES task_ledger(slot_id),
  related_block_id         UUID REFERENCES continuity_block(block_id),
  related_match_attempt_id UUID REFERENCES match_log(match_attempt_id),
  decided_by               UUID REFERENCES users(id),
  decided_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision_value_notes     TEXT
);

ALTER TABLE human_decision_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "human_decision_log_authenticated_all" ON human_decision_log;
CREATE POLICY "human_decision_log_authenticated_all"
  ON human_decision_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
