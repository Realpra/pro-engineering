-- Client field inventory finding (Screen 5, Site Visit): confirmed no column
-- anywhere captured a client-requested visit date/slot -- /book/site-visit and
-- /book/civil-site-visit told the client "confirmed... WhatsApp confirmation"
-- for an appointment nothing in the system recorded or notified anyone about.
--
-- Project owner's real-world description of this concept (28-29 Sep 2026):
-- the pre-estimate survey visit (scope_survey/client_visit/estimate_visit) can
-- be requested two ways -- directly by the client via /book, or logged by
-- Coordinator/Admin on the client's behalf when the request comes in by phone/
-- WhatsApp/email -- and can recur multiple times during survey-stage to-fro
-- negotiation. This is the REQUEST/INTAKE side of that visit, genuinely
-- distinct from supervisor_daily_routes (the already-frozen, staff-ASSIGNED
-- side -- a specific supervisor, confirmed date/slot/slot_type) since an
-- incoming request has no supervisor assigned yet and supervisor_daily_routes
-- requires one. Search-before-create-fresh: supervisor_daily_routes was
-- checked first and does not serve this concept.
--
-- Execution-phase visits (programmed from substage/milestone schedule, client
-- complaints, pending overhangs) and admin/coordinator/superadmin "other"/
-- training/briefing slots are NOT built here -- deliberately scoped out, not
-- silently skipped (see CLAUDE.md). Programmed visits already have a home on
-- supervisor_daily_routes once scheduled; auto-generating them from
-- schedule/complaint/overhang triggers is a separate, larger scheduling-
-- automation project. "Other"/training visits should use the already-valid
-- slot_type='hq' via the existing addSlotManually() on Route Plan for now --
-- a genuinely distinct new slot_type value was not added because
-- supervisor_daily_routes has no migration file at all (fully live-only
-- schema) and its real CHECK constraint definition cannot be verified from
-- this sandbox; adding one blind risks the exact kind of live CHECK-
-- constraint mismatch this project has already hit twice this session.
CREATE TABLE IF NOT EXISTS site_visit_requests (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref        TEXT        NOT NULL,
  visit_category     TEXT        NOT NULL CHECK (visit_category IN ('scope_survey', 'client_visit', 'estimate_visit')),
  requested_date     DATE,
  requested_slot     TEXT        CHECK (requested_slot IN ('morning', 'afternoon', 'evening')),
  requested_by_role  TEXT        NOT NULL CHECK (requested_by_role IN ('client', 'coordinator', 'admin', 'super_admin')),
  requested_by       UUID        REFERENCES users(id),
  source             TEXT        NOT NULL DEFAULT 'book_form' CHECK (source IN ('book_form', 'phone', 'whatsapp', 'email', 'other')),
  notes              TEXT,
  status             TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),
  scheduled_route_id UUID        REFERENCES supervisor_daily_routes(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visit_requests_booking_ref ON site_visit_requests (booking_ref);
CREATE INDEX IF NOT EXISTS idx_site_visit_requests_status      ON site_visit_requests (status);

ALTER TABLE site_visit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_site_visit_requests" ON site_visit_requests;
CREATE POLICY "anon_insert_site_visit_requests"
  ON site_visit_requests FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_site_visit_requests" ON site_visit_requests;
CREATE POLICY "authenticated_all_site_visit_requests"
  ON site_visit_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
