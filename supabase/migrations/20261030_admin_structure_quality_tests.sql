-- 30 Oct 2026 (Session 72) — Admin add/edit/delete structure for quality tests.
--
-- Owner's decision D13 (CLAUDE.md Owner Decisions Register): quality tests are job-specific;
-- Admin sets the test questions per sector and per job, editable, and can add or delete tests.
--
-- REUSES the live QIP tables (qip_templates / qip_template_checks / qip_check_results), which
-- were built earlier and never used by any code (0 rows each, confirmed read-only on 30 Oct 2026).
-- Nothing is dropped or renamed. Only missing columns are added.
--
-- Live finding fixed here: all three QIP tables have Row Level Security ENABLED with ZERO
-- policies, so the app could neither read nor write them (same class of bug as
-- supervisor_daily_routes, fixed 29 Sep 2026). Policy below follows that precedent:
-- authenticated full access; who may edit is enforced in the Admin server actions.
--
-- Safe to run more than once.

-- 1. Test templates: which job / sector / stage a test belongs to, and its hold time.
ALTER TABLE qip_templates
  ADD COLUMN IF NOT EXISTS vertical       TEXT,
  ADD COLUMN IF NOT EXISTS sector         TEXT,
  ADD COLUMN IF NOT EXISTS milestone_code TEXT,
  ADD COLUMN IF NOT EXISTS substage_code  TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS hold_hours     NUMERIC,
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Test questions (steps): how each step is answered.
ALTER TABLE qip_template_checks
  ADD COLUMN IF NOT EXISTS answer_type    TEXT NOT NULL DEFAULT 'pass_fail',
  ADD COLUMN IF NOT EXISTS options        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unit           TEXT,
  ADD COLUMN IF NOT EXISTS sequence_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE qip_template_checks DROP CONSTRAINT IF EXISTS qip_template_checks_answer_type_check;
ALTER TABLE qip_template_checks
  ADD CONSTRAINT qip_template_checks_answer_type_check
  CHECK (answer_type IN (
    'pass_fail',    -- Pass / Fail / Not applicable
    'yes_no',       -- Yes / No
    'options',      -- one choice from `options`
    'number',       -- a number, with `unit`
    'photo',        -- a photograph
    'timer_start',  -- starts the hold timer (with photo)
    'timer_end',    -- ends the hold timer (with photo)
    'text'          -- free text
  ));

-- 3. Access rules (RLS was on with no policy = nothing could read or write).
DROP POLICY IF EXISTS "authenticated_all_qip_templates" ON qip_templates;
CREATE POLICY "authenticated_all_qip_templates"
  ON qip_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_qip_template_checks" ON qip_template_checks;
CREATE POLICY "authenticated_all_qip_template_checks"
  ON qip_template_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_qip_check_results" ON qip_check_results;
CREATE POLICY "authenticated_all_qip_check_results"
  ON qip_check_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
