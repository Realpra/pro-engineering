-- WorkersTable_Review workbook decisions, 1 Oct 2026 (E3/E5/E7-i/E7-ii/E7-iii):
--
-- E3: Coordinator gets two independent actions -- "Mark Deployable (Adhoc)" (immediate,
-- independent of the existing coordinator_approved "recommend to Admin" flow) and the
-- existing approveWorkerToAdmin. A worker can be adhoc-deployable before, during, or
-- without ever being recommended upward.
--
-- E5: credential type + validity date, captured on the onboarding FORM itself (Screen 12)
-- and flowing upward unchanged to every review role -- NOT a replacement for the existing
-- admin_renewal_flag_reason/admin_renewal_flagged_at (added 20261001_worker_onboarding_
-- approval_chain.sql), which stays as Admin's own ad hoc follow-up flag for anything not
-- caught at onboarding. Both mechanisms coexist.
--
-- E7-i: Admin's 4th action -- "approve provisional subject to remarked compliance",
-- distinct from a plain approve and from the renewal-flag (which is specifically about
-- credential expiry). Return/Reject/Approve already exist (adminReturnWorker/
-- adminRejectWorker/adminApproveWorker, app/admin/workers/actions.ts).
--
-- E7-ii: fully-automatic resubmission linking -- a new registration matching an existing
-- REJECTED worker's phone and/or Aadhaar-last-4 updates that same row (same id/worker_code)
-- instead of inserting a new one. resubmission_count/resubmitted_at record this happened.
--
-- E7-iii: staff completing a returned-for-correction worker's missing fields from a phone/
-- WhatsApp/email intake, with an evidence upload and a "how procured" remark trail.

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS coordinator_deployable_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coordinator_deployable_by      UUID,
  ADD COLUMN IF NOT EXISTS coordinator_deployable_remark  TEXT,
  ADD COLUMN IF NOT EXISTS credential_type                TEXT,
  ADD COLUMN IF NOT EXISTS credential_other_detail        TEXT,
  ADD COLUMN IF NOT EXISTS credential_valid_upto          DATE,
  ADD COLUMN IF NOT EXISTS admin_provisional_remarks      TEXT,
  ADD COLUMN IF NOT EXISTS admin_provisional_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resubmission_count             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resubmitted_at                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correction_evidence_url        TEXT,
  ADD COLUMN IF NOT EXISTS correction_evidence_note       TEXT,
  ADD COLUMN IF NOT EXISTS correction_completed_by        UUID,
  ADD COLUMN IF NOT EXISTS correction_completed_at        TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workers_credential_type_check'
  ) THEN
    ALTER TABLE workers
      ADD CONSTRAINT workers_credential_type_check
      CHECK (credential_type IS NULL OR credential_type IN ('registration', 'permit_license', 'not_applicable', 'other'));
  END IF;
END $$;
