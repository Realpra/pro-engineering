-- Worker Onboarding freeze, full-spec build (Session 65 continued).
-- Project owner decision: build the complete original 11-section professional
-- profiling spec (Sections A-K, found in the original design log), not the
-- Tier-1 MVP that was deliberately built first back in June. Every field below
-- traces to a specific spec question found in the original design conversation
-- (docs/SCHEMA_FREEZE_METHODOLOGY.md's "search before create fresh" discipline).
-- Decisions applied per the project owner's explicit instructions:
--   - year_experience stays as the existing bucketed enum (kept, not replaced).
--   - height_restriction/dust_restriction stay as the existing 2 booleans; an
--     "Other" option is added (other_restriction + free-text detail) rather
--     than building the spec's full 14-condition health-flag system.
--   - declared/agreed become real persisted data (previously validation-only,
--     never written to the DB despite gating the submit button).
--   - gender/whatsapp_same/whatsapp_phone/team_name/team_number (found to have
--     no original-spec grounding) are explicitly kept, not dropped.
--   - is_available/daily_wage/years_experience/height_restriction/dust_restriction
--     are kept AS-IS; the richer spec fields are added ALONGSIDE them, per the
--     "never unfreeze, add alongside" rule -- nothing already live is removed.

-- ============================================================================
-- PART 0 -- geo_hierarchy: document undocumented live columns, add real
-- parent-child hierarchy (State > District > Region > Zone > Sector).
-- CONFIRMED GAP: geo_hierarchy's own migration (20260628_estimate_console.sql)
-- only declares id/name/type/created_at, but live code (coordinator/zone-
-- registry/actions.ts addZone, admin/zones/page.tsx) already reads/writes
-- level/short_code/is_active -- undocumented live-only columns, same pattern
-- as PENDING #20. Adding IF NOT EXISTS is safe whether or not they already
-- exist live.
-- ============================================================================
ALTER TABLE geo_hierarchy
  ADD COLUMN IF NOT EXISTS level      TEXT,
  ADD COLUMN IF NOT EXISTS short_code TEXT,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_id  UUID REFERENCES geo_hierarchy(id);

CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_parent ON geo_hierarchy (parent_id);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_level  ON geo_hierarchy (level);

-- Seed the real hierarchy: State -> District -> Region -> Zone -> Sector.
-- Zones group multiple Sectors (Zone 1/2/3... containing several sectors each),
-- matching the project owner's explicit description. Existing flat rows
-- (Noida, Delhi, etc. from the original seed) are left untouched -- this adds
-- the proper tree alongside them, it does not replace or renumber anything.
DO $$
DECLARE
  v_state_id    UUID;
  v_district_id UUID;
  v_region_id   UUID;
  v_zone1_id    UUID;
BEGIN
  -- geo_hierarchy.name has no unique constraint in the live schema, so this
  -- upserts by explicit lookup instead of ON CONFLICT (which requires one).
  SELECT id INTO v_state_id FROM geo_hierarchy WHERE name = 'Uttar Pradesh' LIMIT 1;
  IF v_state_id IS NULL THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active)
      VALUES ('Uttar Pradesh', 'state', 'UP', true)
      RETURNING id INTO v_state_id;
  ELSE
    UPDATE geo_hierarchy SET level = 'state', short_code = 'UP', is_active = true
      WHERE id = v_state_id;
  END IF;

  SELECT id INTO v_district_id FROM geo_hierarchy WHERE name = 'Gautam Buddha Nagar' LIMIT 1;
  IF v_district_id IS NULL THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Gautam Buddha Nagar', 'district', 'GBN', true, v_state_id)
      RETURNING id INTO v_district_id;
  ELSE
    UPDATE geo_hierarchy SET level = 'district', short_code = 'GBN', is_active = true, parent_id = v_state_id
      WHERE id = v_district_id;
  END IF;

  SELECT id INTO v_region_id FROM geo_hierarchy WHERE name = 'Noida Region' LIMIT 1;
  IF v_region_id IS NULL THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Noida Region', 'region', 'NR', true, v_district_id)
      RETURNING id INTO v_region_id;
  ELSE
    UPDATE geo_hierarchy SET level = 'region', short_code = 'NR', is_active = true, parent_id = v_district_id
      WHERE id = v_region_id;
  END IF;

  SELECT id INTO v_zone1_id FROM geo_hierarchy WHERE name = 'Zone 1' LIMIT 1;
  IF v_zone1_id IS NULL THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Zone 1', 'zone', 'Z1', true, v_region_id)
      RETURNING id INTO v_zone1_id;
  ELSE
    UPDATE geo_hierarchy SET level = 'zone', short_code = 'Z1', is_active = true, parent_id = v_region_id
      WHERE id = v_zone1_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM geo_hierarchy WHERE name = 'Noida Sector 62') THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Noida Sector 62', 'sector', 'S62', true, v_zone1_id);
  ELSE
    UPDATE geo_hierarchy SET level = 'sector', short_code = 'S62', is_active = true, parent_id = v_zone1_id
      WHERE name = 'Noida Sector 62';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM geo_hierarchy WHERE name = 'Noida Sector 63') THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Noida Sector 63', 'sector', 'S63', true, v_zone1_id);
  ELSE
    UPDATE geo_hierarchy SET level = 'sector', short_code = 'S63', is_active = true, parent_id = v_zone1_id
      WHERE name = 'Noida Sector 63';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM geo_hierarchy WHERE name = 'Noida Sector 64') THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Noida Sector 64', 'sector', 'S64', true, v_zone1_id);
  ELSE
    UPDATE geo_hierarchy SET level = 'sector', short_code = 'S64', is_active = true, parent_id = v_zone1_id
      WHERE name = 'Noida Sector 64';
  END IF;
END $$;

-- ============================================================================
-- PART 1 -- workers: Section A (Identity & Location) remainder
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS accommodation_type          TEXT,
  ADD COLUMN IF NOT EXISTS transport_mode              TEXT,
  ADD COLUMN IF NOT EXISTS max_travel_minutes          INTEGER,
  ADD COLUMN IF NOT EXISTS same_day_notice_zones       TEXT[],
  ADD COLUMN IF NOT EXISTS willing_out_of_zone_overnight BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS unavailable_weekdays        TEXT[],
  ADD COLUMN IF NOT EXISTS seasonal_unavailable_months TEXT[];

-- ============================================================================
-- PART 2 -- workers: Section B (Primary Trade Declaration) remainder
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS years_residential           INTEGER,
  ADD COLUMN IF NOT EXISTS years_commercial            INTEGER,
  ADD COLUMN IF NOT EXISTS years_institutional         INTEGER,
  ADD COLUMN IF NOT EXISTS largest_project_description TEXT,
  ADD COLUMN IF NOT EXISTS largest_project_role        TEXT,
  ADD COLUMN IF NOT EXISTS max_workers_supervised      INTEGER,
  ADD COLUMN IF NOT EXISTS most_demanding_job_description TEXT,
  ADD COLUMN IF NOT EXISTS last_employer_name          TEXT,
  ADD COLUMN IF NOT EXISTS last_employer_phone         TEXT,
  ADD COLUMN IF NOT EXISTS last_employer_work_type     TEXT,
  ADD COLUMN IF NOT EXISTS reason_left_last_employer   TEXT,
  ADD COLUMN IF NOT EXISTS prior_employer_name         TEXT,
  ADD COLUMN IF NOT EXISTS prior_employer_work_type    TEXT,
  ADD COLUMN IF NOT EXISTS longest_tenure_months       INTEGER,
  ADD COLUMN IF NOT EXISTS prior_platform_experience   TEXT;

-- ============================================================================
-- PART 3 -- Section C (Skill Depth, trade-specific) -- normalized, not flat
-- columns, since each of 9+ trades has its own ~12-15 question set (would be
-- 100+ mostly-null columns per worker as flat columns on `workers`).
-- ============================================================================
CREATE TABLE IF NOT EXISTS trade_skill_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade          TEXT NOT NULL,
  question_code  TEXT NOT NULL,
  question_text  TEXT NOT NULL,
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade, question_code)
);
ALTER TABLE trade_skill_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trade_skill_questions_authenticated_read" ON trade_skill_questions;
CREATE POLICY "trade_skill_questions_authenticated_read"
  ON trade_skill_questions FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS worker_skill_answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id      UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  question_code  TEXT NOT NULL,
  trade          TEXT NOT NULL,
  answer         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, question_code)
);
ALTER TABLE worker_skill_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worker_skill_answers_authenticated_read" ON worker_skill_answers;
CREATE POLICY "worker_skill_answers_authenticated_read"
  ON worker_skill_answers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "worker_skill_answers_insert_anon" ON worker_skill_answers;
CREATE POLICY "worker_skill_answers_insert_anon"
  ON worker_skill_answers FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "worker_skill_answers_insert_authenticated" ON worker_skill_answers;
CREATE POLICY "worker_skill_answers_insert_authenticated"
  ON worker_skill_answers FOR INSERT TO authenticated WITH CHECK (true);

-- Seed the Mason question set found in the original spec (the only trade
-- whose Section C content was captured in this pass). Other trades' question
-- sets are not yet transcribed from the design log -- flagged, not guessed.
INSERT INTO trade_skill_questions (trade, question_code, question_text, display_order) VALUES
  ('Mason', 'reads_floor_plan', 'Can you read and understand a building floor plan?', 1),
  ('Mason', 'mortar_mixes', 'What mortar mixes can you prepare correctly from memory (1:2, 1:3, 1:4, 1:6)?', 2),
  ('Mason', 'tiling_experience', 'Have you laid tiles in addition to bricks and plasterwork? What types?', 3),
  ('Mason', 'rcc_shuttering', 'Have you done RCC shuttering and deshuttering work?', 4),
  ('Mason', 'plaster_finish', 'Have you applied plaster to a smooth finish, or only rough base coat?', 5),
  ('Mason', 'pointing_work', 'Have you done pointing work on exposed brick or stone surfaces?', 6),
  ('Mason', 'plumb_level_check', 'Can you check plumb and level using a spirit level and plumb bob independently?', 7),
  ('Mason', 'crack_identification', 'Have you ever identified a crack during demolition and stopped work to get it assessed?', 8),
  ('Mason', 'joint_tolerance', 'What is the thinnest joint tolerance you can maintain consistently in brick laying?', 9),
  ('Mason', 'lightweight_block', 'Have you worked with lightweight block (AAC/Siporex) in addition to red brick?', 10)
ON CONFLICT (trade, question_code) DO NOTHING;

-- ============================================================================
-- PART 4 -- Section D (Multi-Skilling) -- per-skill rating needs a child table
-- ============================================================================
CREATE TABLE IF NOT EXISTS worker_secondary_skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  skill_name      TEXT NOT NULL,
  rating_level    TEXT CHECK (rating_level IN ('beginner','competent','expert')),
  jobs_last_2yr   INTEGER,
  complex_example TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, skill_name)
);
ALTER TABLE worker_secondary_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worker_secondary_skills_authenticated_read" ON worker_secondary_skills;
CREATE POLICY "worker_secondary_skills_authenticated_read"
  ON worker_secondary_skills FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "worker_secondary_skills_insert_anon" ON worker_secondary_skills;
CREATE POLICY "worker_secondary_skills_insert_anon"
  ON worker_secondary_skills FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "worker_secondary_skills_insert_authenticated" ON worker_secondary_skills;
CREATE POLICY "worker_secondary_skills_insert_authenticated"
  ON worker_secondary_skills FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS next_training_interest TEXT;

-- ============================================================================
-- PART 5 -- Section E (Quality of Work & Track Record)
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS rejected_work_history       TEXT,
  ADD COLUMN IF NOT EXISTS standout_job_description    TEXT,
  ADD COLUMN IF NOT EXISTS has_appreciation_certificate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_rated_quality_score     INTEGER CHECK (self_rated_quality_score BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS self_rated_quality_reason    TEXT,
  ADD COLUMN IF NOT EXISTS quality_check_method         TEXT,
  ADD COLUMN IF NOT EXISTS payment_dispute_history      TEXT,
  ADD COLUMN IF NOT EXISTS asked_to_leave_site_history  TEXT,
  ADD COLUMN IF NOT EXISTS differentiator_description   TEXT;

CREATE TABLE IF NOT EXISTS worker_work_samples (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  caption     TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE worker_work_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worker_work_samples_authenticated_read" ON worker_work_samples;
CREATE POLICY "worker_work_samples_authenticated_read"
  ON worker_work_samples FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "worker_work_samples_insert_anon" ON worker_work_samples;
CREATE POLICY "worker_work_samples_insert_anon"
  ON worker_work_samples FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "worker_work_samples_insert_authenticated" ON worker_work_samples;
CREATE POLICY "worker_work_samples_insert_authenticated"
  ON worker_work_samples FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- PART 6 -- Section F (Health, Fitness, Physical Capability)
-- height_restriction/dust_restriction KEPT AS-IS per project owner decision.
-- Adding "Other" option alongside, not a full 14-condition system.
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS other_restriction           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS other_restriction_detail    TEXT,
  ADD COLUMN IF NOT EXISTS on_medication_affecting_alertness BOOLEAN,
  ADD COLUMN IF NOT EXISTS doctor_restricted_work_type TEXT,
  ADD COLUMN IF NOT EXISTS can_carry_25kg_50m          TEXT CHECK (can_carry_25kg_50m IN ('yes','with_effort','no')),
  ADD COLUMN IF NOT EXISTS can_kneel_crouch_2hr         BOOLEAN,
  ADD COLUMN IF NOT EXISTS can_work_heights_2m          TEXT CHECK (can_work_heights_2m IN ('yes','no','manageable_anxiety')),
  ADD COLUMN IF NOT EXISTS can_work_confined_spaces     BOOLEAN,
  ADD COLUMN IF NOT EXISTS can_work_high_heat_8hr       BOOLEAN,
  ADD COLUMN IF NOT EXISTS wears_corrective_lenses      BOOLEAN;

-- ============================================================================
-- PART 7 -- Section G (Accident History) -- repeatable, needs a child table
-- ============================================================================
CREATE TABLE IF NOT EXISTS worker_accident_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id        UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  incident_year    INTEGER,
  injury_description TEXT,
  cause            TEXT,
  was_hospitalized BOOLEAN,
  full_recovery    BOOLEAN,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE worker_accident_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worker_accident_history_authenticated_read" ON worker_accident_history;
CREATE POLICY "worker_accident_history_authenticated_read"
  ON worker_accident_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "worker_accident_history_insert_anon" ON worker_accident_history;
CREATE POLICY "worker_accident_history_insert_anon"
  ON worker_accident_history FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "worker_accident_history_insert_authenticated" ON worker_accident_history;
CREATE POLICY "worker_accident_history_insert_authenticated"
  ON worker_accident_history FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS had_fall_from_height         BOOLEAN,
  ADD COLUMN IF NOT EXISTS fall_from_height_detail       TEXT,
  ADD COLUMN IF NOT EXISTS had_electric_shock            BOOLEAN,
  ADD COLUMN IF NOT EXISTS electric_shock_detail         TEXT,
  ADD COLUMN IF NOT EXISTS witnessed_structural_collapse BOOLEAN,
  ADD COLUMN IF NOT EXISTS structural_collapse_detail    TEXT,
  ADD COLUMN IF NOT EXISTS chemical_inhalation_treatment TEXT,
  ADD COLUMN IF NOT EXISTS eye_injury_history            TEXT,
  ADD COLUMN IF NOT EXISTS changed_practice_after_incident TEXT,
  ADD COLUMN IF NOT EXISTS witnessed_others_accident     TEXT,
  ADD COLUMN IF NOT EXISTS reported_near_miss            BOOLEAN,
  ADD COLUMN IF NOT EXISTS near_miss_acted_on            BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_permanent_injury_restriction BOOLEAN,
  ADD COLUMN IF NOT EXISTS permanent_injury_detail       TEXT;

-- ============================================================================
-- PART 8 -- Section H (Availability & Work Preferences)
-- is_available/daily_wage KEPT AS-IS, richer fields added alongside.
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS currently_employed_elsewhere BOOLEAN,
  ADD COLUMN IF NOT EXISTS will_inform_current_employer BOOLEAN,
  ADD COLUMN IF NOT EXISTS available_days_per_month     TEXT CHECK (available_days_per_month IN ('0_10','10_20','20_plus')),
  ADD COLUMN IF NOT EXISTS willing_output_based_pay     BOOLEAN,
  ADD COLUMN IF NOT EXISTS prefers_team_or_solo         TEXT CHECK (prefers_team_or_solo IN ('team','solo','either')),
  ADD COLUMN IF NOT EXISTS has_regular_partner          BOOLEAN,
  ADD COLUMN IF NOT EXISTS partner_name                 TEXT,
  ADD COLUMN IF NOT EXISTS partner_trade                TEXT,
  ADD COLUMN IF NOT EXISTS partner_phone                TEXT,
  ADD COLUMN IF NOT EXISTS partner_skill_assessment     TEXT,
  ADD COLUMN IF NOT EXISTS notice_period_needed         TEXT CHECK (notice_period_needed IN ('same_day','24hr','48hr','more')),
  ADD COLUMN IF NOT EXISTS available_emergency_4hr      BOOLEAN,
  ADD COLUMN IF NOT EXISTS emergency_premium_pct        NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS willing_sundays_holidays     BOOLEAN,
  ADD COLUMN IF NOT EXISTS holiday_premium_pct          NUMERIC(5,2);

-- ============================================================================
-- PART 9 -- Section I (Tools & Equipment)
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS owns_basic_tools             BOOLEAN,
  ADD COLUMN IF NOT EXISTS tools_list                   TEXT,
  ADD COLUMN IF NOT EXISTS tools_calibrated             BOOLEAN,
  ADD COLUMN IF NOT EXISTS owns_power_tools             BOOLEAN,
  ADD COLUMN IF NOT EXISTS power_tools_list             TEXT,
  ADD COLUMN IF NOT EXISTS owns_ppe                     TEXT[],
  ADD COLUMN IF NOT EXISTS owns_smartphone              TEXT CHECK (owns_smartphone IN ('android','ios','none')),
  ADD COLUMN IF NOT EXISTS owns_measuring_tape_5m       BOOLEAN,
  ADD COLUMN IF NOT EXISTS owns_spirit_level_600mm      BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_reliable_transport_1hr   BOOLEAN;

-- ============================================================================
-- PART 10 -- Section J (Self-Assessment Ratings) -- discrete columns since
-- the spec says the platform calibrates each dimension individually against
-- real test/deployment results later (queryable, not just a JSONB blob).
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS rating_technical_accuracy      INTEGER CHECK (rating_technical_accuracy BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_speed                   INTEGER CHECK (rating_speed BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_drawing_comprehension   INTEGER CHECK (rating_drawing_comprehension BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_unsupervised_delivery   INTEGER CHECK (rating_unsupervised_delivery BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_problem_identification  INTEGER CHECK (rating_problem_identification BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_asks_for_guidance       INTEGER CHECK (rating_asks_for_guidance BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_physical_fitness        INTEGER CHECK (rating_physical_fitness BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_reliability             INTEGER CHECK (rating_reliability BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_honesty                 INTEGER CHECK (rating_honesty BETWEEN 1 AND 5);

-- ============================================================================
-- PART 11 -- Section K (References & Verification Consent)
-- declared/agreed made real: previously gated the submit button but were
-- never persisted at all (confirmed Session 65 finding). Now captured for
-- real, with a timestamp, so the consent has an actual record.
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS reference_1_name             TEXT,
  ADD COLUMN IF NOT EXISTS reference_1_phone            TEXT,
  ADD COLUMN IF NOT EXISTS reference_2_name             TEXT,
  ADD COLUMN IF NOT EXISTS reference_2_phone            TEXT,
  ADD COLUMN IF NOT EXISTS consent_reference_check      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_profile_sharing      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS declared                     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreed                       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS declaration_confirmed_at     TIMESTAMPTZ;

-- ============================================================================
-- PART 12 -- Bank account verification tracking (spec calls for penny-drop
-- verification; the verification mechanism itself is a separate feature/
-- payment-integration build, not a schema-only change -- these columns record
-- the outcome once that's built).
-- ============================================================================
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS bank_account_verified        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_account_verified_at     TIMESTAMPTZ;
