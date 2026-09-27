-- Supervisor Visit schema freeze, Duplicate/Conflict #10:
-- job_milestone_substages.supervisor_checklist / evidence_checklist /
-- evidence_submitted are named as if Supervisor owns them, but the ONLY
-- writer anywhere in the repo is Site Incharge (app/site-incharge/substage/
-- [id]/actions.ts) -- Supervisor's own SubstageCard.tsx only ever reads a
-- count. Add correctly-named columns alongside (never rename in place --
-- many out-of-scope readers across coordinator/sub-coordinator/supervisor
-- pages still read the old names, so the writer now dual-writes both until
-- those readers are migrated in a later pass).

ALTER TABLE job_milestone_substages
  ADD COLUMN IF NOT EXISTS site_checklist JSONB,
  ADD COLUMN IF NOT EXISTS site_evidence_checklist JSONB,
  ADD COLUMN IF NOT EXISTS site_evidence_submitted JSONB;

UPDATE job_milestone_substages
SET site_checklist = supervisor_checklist
WHERE site_checklist IS NULL AND supervisor_checklist IS NOT NULL;

UPDATE job_milestone_substages
SET site_evidence_checklist = evidence_checklist
WHERE site_evidence_checklist IS NULL AND evidence_checklist IS NOT NULL;

UPDATE job_milestone_substages
SET site_evidence_submitted = evidence_submitted
WHERE site_evidence_submitted IS NULL AND evidence_submitted IS NOT NULL;
