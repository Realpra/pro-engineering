-- Adds evidence_complete flag to job_milestone_substages, set true once every
-- item in evidence_checklist is confirmed (see uploadEvidence in
-- app/site-incharge/substage/[id]/actions.ts).
-- NOTE: not yet applied to the live DB — no service-role/DATABASE_URL key is
-- available in this environment to run migrations. Apply manually via the
-- Supabase SQL editor.
ALTER TABLE job_milestone_substages
  ADD COLUMN IF NOT EXISTS evidence_complete BOOLEAN DEFAULT false;
