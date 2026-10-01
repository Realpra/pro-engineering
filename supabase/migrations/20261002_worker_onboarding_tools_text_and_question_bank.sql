-- Project owner's decision, 2 Oct 2026, on the two remaining Worker Onboarding All-Trades
-- workbook items:
--
-- (1) Rows 114-115 (ownsMeasuringTape5m/ownsSpiritLevel600mm) become worker-self-filled text
-- fields, not Mason-specific booleans -- "We can frame a question with fill box where he can
-- fill text. for both question subject row 114, row 115." Two new generic text columns added
-- alongside the old booleans (never drop/alter in place per this project's standing rule --
-- Mason workers may already have real data under the old columns).
--
-- (2) The Section C Skill Questions bank becomes admin-editable -- "the question bank shall be
-- editable by admin. it will create the slot and full testing." trade_skill_questions already
-- exists (20260926_worker_onboarding_full_spec.sql) with an authenticated READ policy only; adds
-- the missing authenticated WRITE policies so an Admin CRUD screen can actually insert/update/
-- delete rows (service-role-only writes until now).

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS essential_tool_1 TEXT,
  ADD COLUMN IF NOT EXISTS essential_tool_2 TEXT;

COMMENT ON COLUMN workers.owns_measuring_tape_5m IS
  'Superseded by essential_tool_1 (free text, 2 Oct 2026) -- kept, not dropped, per this project''s never-remove-without-explicit-go-ahead rule. May still hold real data from before the change.';
COMMENT ON COLUMN workers.owns_spirit_level_600mm IS
  'Superseded by essential_tool_2 (free text, 2 Oct 2026) -- kept, not dropped, per this project''s never-remove-without-explicit-go-ahead rule. May still hold real data from before the change.';

DROP POLICY IF EXISTS "trade_skill_questions_authenticated_write" ON trade_skill_questions;
CREATE POLICY "trade_skill_questions_authenticated_write"
  ON trade_skill_questions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
