-- Corrective migration: 20260926_worker_onboarding_full_spec.sql's inline CHECK
-- constraints were written independently from the actual UI dropdown values in
-- app/onboarding/[trade]/page.tsx, and drifted apart on 5 of the 6 constrained
-- fields (confirmed live: the first real registration attempt failed on
-- workers_available_days_per_month_check). The UI's values are the ones kept
-- here (already-built, human-labelled options) -- the constraints are corrected
-- to match, not the other way around. prefers_team_or_solo already matched and
-- is left untouched.
--
-- Not editing the original migration file in place, per this project's
-- Expand-Contract discipline (see 20260926_geo_zone_sector_many_to_many.sql's
-- own note) -- it already ran successfully live, so a fresh install would run
-- both files in order and land in the same corrected state either way.

ALTER TABLE workers DROP CONSTRAINT IF EXISTS workers_can_carry_25kg_50m_check;
ALTER TABLE workers ADD CONSTRAINT workers_can_carry_25kg_50m_check
  CHECK (can_carry_25kg_50m IN ('yes','no','with_difficulty'));

ALTER TABLE workers DROP CONSTRAINT IF EXISTS workers_can_work_heights_2m_check;
ALTER TABLE workers ADD CONSTRAINT workers_can_work_heights_2m_check
  CHECK (can_work_heights_2m IN ('yes','no','with_difficulty'));

ALTER TABLE workers DROP CONSTRAINT IF EXISTS workers_available_days_per_month_check;
ALTER TABLE workers ADD CONSTRAINT workers_available_days_per_month_check
  CHECK (available_days_per_month IN ('lt10','10_15','15_20','20_25','25_plus'));

ALTER TABLE workers DROP CONSTRAINT IF EXISTS workers_notice_period_needed_check;
ALTER TABLE workers ADD CONSTRAINT workers_notice_period_needed_check
  CHECK (notice_period_needed IN ('immediate','1_week','2_weeks','1_month'));

ALTER TABLE workers DROP CONSTRAINT IF EXISTS workers_owns_smartphone_check;
ALTER TABLE workers ADD CONSTRAINT workers_owns_smartphone_check
  CHECK (owns_smartphone IN ('yes','basic_phone','no'));
