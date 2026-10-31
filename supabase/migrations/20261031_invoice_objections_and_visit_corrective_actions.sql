-- Owner's decisions of 31 Oct 2026 (batch 2) -- Addition, no existing table or column changes.
--
-- 1. client_invoice_objections (D30): the client objects to a milestone invoice (item not done,
--    inferior work, wrong quantity, ...). The objection moves Site Head > Supervisor > Coordinator
--    > Admin > Super Admin, each adding factual remarks, and is decided ONE LEVEL ABOVE the role
--    that routinely handles that job value: below Rs 1L (Coordinator) -> Admin; Rs 1L-5L (Admin)
--    -> Super Admin; above Rs 5L (Super Admin) -> Super Admin. The deciding role admits (invoice
--    revised) or clarifies (no change, explanation) and replies to the client. Each step's remark
--    is recorded in job_movement_log (item_type 'client_invoice_objection').
--    This is separate from the routine payment flow; the existing /client/payment screen is
--    left in place.
-- 2. visit_corrective_actions (D27): a daily execution visit never sends the job back to survey;
--    each problem it found becomes a corrective action chosen by the Supervisor (or Site Visit
--    Manager): redo/attend (direction to Site Head), more resources (request to Coordinator),
--    delay (recast by the Supervisor himself, or the Site Head directed to recast and send it to
--    him), or other.

CREATE TABLE IF NOT EXISTS client_invoice_objections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id            UUID        NOT NULL REFERENCES guest_enquiries(id) ON DELETE CASCADE,
  booking_ref           TEXT        NOT NULL,
  milestone_payment_id  UUID        REFERENCES milestone_payment_schedule(id) ON DELETE SET NULL,
  milestone_code        TEXT,
  invoice_amount        NUMERIC,
  objection_type        TEXT        NOT NULL CHECK (objection_type IN (
                          'item_not_done', 'inferior_work', 'quantity_wrong', 'rate_wrong', 'other')),
  description           TEXT        NOT NULL,
  raised_by_user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  raised_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_value             NUMERIC,
  deciding_role         TEXT        NOT NULL CHECK (deciding_role IN ('admin', 'super_admin')),
  holder_role           TEXT        NOT NULL CHECK (holder_role IN (
                          'site_incharge', 'supervisor', 'coordinator', 'admin', 'super_admin')),
  status                TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution            TEXT        CHECK (resolution IS NULL OR resolution IN ('admitted', 'clarified')),
  revised_amount        NUMERIC,
  reply_to_client       TEXT,
  resolved_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_invoice_objections_role_idx ON client_invoice_objections (holder_role, status);
CREATE INDEX IF NOT EXISTS client_invoice_objections_booking_idx ON client_invoice_objections (booking_ref);

ALTER TABLE client_invoice_objections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all_client_invoice_objections ON client_invoice_objections;
CREATE POLICY authenticated_all_client_invoice_objections ON client_invoice_objections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS visit_corrective_actions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_visit_report_id  UUID        NOT NULL REFERENCES site_visit_reports(id) ON DELETE CASCADE,
  enquiry_id            UUID        NOT NULL REFERENCES guest_enquiries(id) ON DELETE CASCADE,
  booking_ref           TEXT        NOT NULL,
  finding_source        TEXT        NOT NULL CHECK (finding_source IN ('checklist_no', 'risk_flag', 'other')),
  finding_text          TEXT        NOT NULL,
  action_type           TEXT        NOT NULL CHECK (action_type IN ('redo_attend', 'more_resources', 'delay', 'other')),
  direction             TEXT,
  delay_days            INTEGER     CHECK (delay_days IS NULL OR delay_days > 0),
  delay_reason_category TEXT        CHECK (delay_reason_category IS NULL OR delay_reason_category IN (
                          'Client', 'Project Reasons', 'Beyond Control')),
  recast_by             TEXT        CHECK (recast_by IS NULL OR recast_by IN ('supervisor', 'site_head')),
  status                TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_by            UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at               TIMESTAMPTZ,
  done_by               UUID        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS visit_corrective_actions_report_idx ON visit_corrective_actions (site_visit_report_id);
CREATE INDEX IF NOT EXISTS visit_corrective_actions_booking_idx ON visit_corrective_actions (booking_ref, status);

ALTER TABLE visit_corrective_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all_visit_corrective_actions ON visit_corrective_actions;
CREATE POLICY authenticated_all_visit_corrective_actions ON visit_corrective_actions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
