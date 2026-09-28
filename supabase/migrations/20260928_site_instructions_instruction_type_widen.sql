-- site_instructions has no baseline migration anywhere in this repo (live-only
-- schema, PENDING #20) -- this is the first migration to ever touch it.
--
-- Live query (project owner, SQL Editor, 28 Sep 2026) confirmed
-- instruction_type's real CHECK constraint only allowed 6 values
-- (pre_instruction/revised/hold/expedite/resource/alert). Every one of the
-- values below is already written by real, live code today -- some from this
-- session's 12-tab Supervisor pass, some from Admin's pre-existing
-- adminIssueDirective (app/admin/reports/actions.ts, predates this session),
-- some from Sub-Coordinator's chase/notification actions. Per the project
-- owner's explicit decision: these are real, distinct operational values and
-- must keep working as instruction_type, not be collapsed into a generic
-- 'alert'. instruction_category (already a real, live, previously-unused
-- column) is used instead as a broader grouping layer above instruction_type
-- -- see the corresponding code changes in the same commit.
ALTER TABLE site_instructions DROP CONSTRAINT IF EXISTS site_instructions_instruction_type_check;

ALTER TABLE site_instructions ADD CONSTRAINT site_instructions_instruction_type_check
  CHECK (instruction_type = ANY (ARRAY[
    -- original 6, already valid
    'pre_instruction', 'revised', 'hold', 'expedite', 'resource', 'alert',
    -- this session's new event-driven alerts (category 'system_alert')
    'sos', 'daily_log_deadline_missed', 'scope_change_threshold_breach',
    'client_handover_dissatisfaction',
    -- Supervisor's upward reports / estimate review (category 'report')
    'supervisor_estimate_review', 'method_improvement', 'payment_policy',
    'execution', 'methodology', 'special_site', 'safety_critical',
    -- Sub-Coordinator's own site-level instructions (category 'site_instruction')
    'chase', 'notification',
    -- Admin's pre-existing directive types (category 'directive')
    'admin', 'quality', 'general_policy', 'business_policy', 'general'
  ]::text[]));
