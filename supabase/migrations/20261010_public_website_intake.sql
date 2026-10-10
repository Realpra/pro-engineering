-- Public website intake (Session 71, 10 Oct 2026) — the schema behind the public site's two
-- doors: the client's three request types (one day or smaller / turn-key lump sum / Labour
-- Bazaar bulk) and the supply side's three partner registrations (Team Head / Associate /
-- Contractor). Individual workers keep using the existing, frozen /onboarding flow untouched.
--
-- DISCIPLINE (same as 20261007_coordinator_dynamic_scheduling_engine.sql): reuse every
-- already-frozen table/field where the real-world concept already exists; only create new
-- tables for genuinely new concepts.
--   A client's request  -> guest_enquiries (Job Master) — EXTENDED. A request raised from the
--                          website is the same real-world thing as a /book enquiry: one job, one
--                          booking_ref, entering the same Coordinator/Admin pipeline. Every
--                          existing reader/writer of guest_enquiries behaves exactly as before
--                          (Addition, not Contradiction — all new columns are nullable).
--   Team Head/Associate/Contractor -> supply_partners — NEW. Search-before-create-fresh:
--                          `workers` was checked first and does not serve this concept (a
--                          worker row is one deployable individual with a trade, wage and
--                          approval chain; a partner is a firm/person who BRINGS workers or takes
--                          a whole job, and has no trade/wage/skill_grade of its own). `users`
--                          was checked too — a partner has no login at registration time.
--
-- Two columns below are already READ by live code but have no migration file of their own
-- (same undocumented-live-column pattern as geo_hierarchy.level): guest_enquiries.
-- scope_description (coordinator/jobs, coordinator/scope-reports, supervisor/estimate) and
-- guest_enquiries.address_line (supervisor/scope-verification). They are the canonical homes
-- for the request's brief scope and site address, so they are reused rather than duplicated —
-- ADD COLUMN IF NOT EXISTS documents them here and is a no-op where they already exist.

-- ============================================================================
-- 1. EXTEND guest_enquiries (Job Master)
-- ============================================================================
ALTER TABLE guest_enquiries
  ADD COLUMN IF NOT EXISTS scope_description TEXT,
  ADD COLUMN IF NOT EXISTS address_line      TEXT,
  ADD COLUMN IF NOT EXISTS site_state        TEXT,
  ADD COLUMN IF NOT EXISTS firm_name         TEXT,
  ADD COLUMN IF NOT EXISTS request_type      TEXT,
  ADD COLUMN IF NOT EXISTS request_trade     TEXT,
  ADD COLUMN IF NOT EXISTS request_skill     TEXT,
  ADD COLUMN IF NOT EXISTS request_job_type  TEXT,
  ADD COLUMN IF NOT EXISTS lump_sum_package  TEXT,
  ADD COLUMN IF NOT EXISTS with_material     BOOLEAN,
  ADD COLUMN IF NOT EXISTS work_unit         TEXT,
  ADD COLUMN IF NOT EXISTS time_from         TEXT,
  ADD COLUMN IF NOT EXISTS time_to           TEXT,
  ADD COLUMN IF NOT EXISTS day_slot          TEXT,
  ADD COLUMN IF NOT EXISTS duration_days     INTEGER,
  ADD COLUMN IF NOT EXISTS skills_required   JSONB;

ALTER TABLE guest_enquiries DROP CONSTRAINT IF EXISTS guest_enquiries_request_type_check;
ALTER TABLE guest_enquiries ADD CONSTRAINT guest_enquiries_request_type_check
  CHECK (request_type IS NULL OR request_type IN ('one_day', 'turn_key', 'labour_bazaar'));

ALTER TABLE guest_enquiries DROP CONSTRAINT IF EXISTS guest_enquiries_work_unit_check;
ALTER TABLE guest_enquiries ADD CONSTRAINT guest_enquiries_work_unit_check
  CHECK (work_unit IS NULL OR work_unit IN ('full_day', 'hours'));

ALTER TABLE guest_enquiries DROP CONSTRAINT IF EXISTS guest_enquiries_day_slot_check;
ALTER TABLE guest_enquiries ADD CONSTRAINT guest_enquiries_day_slot_check
  CHECK (day_slot IS NULL OR day_slot IN ('forenoon', 'afternoon'));

COMMENT ON COLUMN guest_enquiries.request_type IS
  'NULL = a full project enquiry from /book (the nine project types). one_day / turn_key / '
  'labour_bazaar = raised from the public website''s request forms (/request/*).';
COMMENT ON COLUMN guest_enquiries.request_trade IS
  'The discipline the client picked (Civil, Electrical, IT, ...) — content/job-catalogue.json. '
  'Distinct from workers.trade, which is a worker skill (Mason, Plumber, ...).';
COMMENT ON COLUMN guest_enquiries.request_skill IS 'one_day only: the skill under the trade (Masonry, Plumbing, ...).';
COMMENT ON COLUMN guest_enquiries.request_job_type IS 'one_day only: the job under the skill (Leak repair, ...).';
COMMENT ON COLUMN guest_enquiries.lump_sum_package IS 'turn_key only: the lump sum job (Kitchen renovation, ...).';
COMMENT ON COLUMN guest_enquiries.with_material IS 'turn_key only: true = with material, false = without material.';
COMMENT ON COLUMN guest_enquiries.work_unit IS 'one_day only: full_day, or hours (then time_from/time_to hold the HH:MM range).';
COMMENT ON COLUMN guest_enquiries.day_slot IS 'one_day only: forenoon / afternoon.';
COMMENT ON COLUMN guest_enquiries.duration_days IS
  'labour_bazaar: how many days the workers are needed. Day-grain, so NOT folded into the '
  'existing duration_weeks (which /book writes and keeps writing unchanged).';
COMMENT ON COLUMN guest_enquiries.skills_required IS
  'The client''s own proposed demand: [{"skill": "Mason", "count": 4}, ...], skill drawn from '
  'the onboardable worker trades. A PROPOSAL to be finalised with the client — not an '
  'allocation; task_ledger remains the only record of real day-grain demand.';
COMMENT ON COLUMN guest_enquiries.site_state IS
  'State name from geo_hierarchy (level=state). district and zone (sector name) keep their '
  'existing meaning and are written exactly as /book/schedule writes them.';
COMMENT ON COLUMN guest_enquiries.firm_name IS 'labour_bazaar: the requesting firm or site name.';

CREATE INDEX IF NOT EXISTS idx_guest_enquiries_request_type ON guest_enquiries (request_type);

-- ============================================================================
-- 2. NEW TABLE: supply_partners (Team Head / Associate / Contractor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS supply_partners (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_type      TEXT        NOT NULL CHECK (partner_type IN ('team_head', 'associate', 'contractor')),

  full_name         TEXT        NOT NULL,
  phone             TEXT        NOT NULL,
  whatsapp_phone    TEXT,
  email             TEXT,

  company_name      TEXT,
  firm_type         TEXT,
  gst_number        TEXT,
  pan_number        TEXT,
  year_established  INTEGER,
  office_address    TEXT,
  website_links     TEXT,
  social_links      TEXT,

  years_experience  INTEGER,
  work_kinds        TEXT,
  largest_job       TEXT,
  client_references TEXT,

  team_basis        TEXT        CHECK (team_basis IS NULL OR team_basis IN ('by_skill', 'by_package')),
  team_package      TEXT,
  team_composition  JSONB,
  total_workers     INTEGER,

  site_state        TEXT,
  districts         TEXT[]      NOT NULL DEFAULT '{}',
  sectors           TEXT[]      NOT NULL DEFAULT '{}',

  engagement_types  TEXT[]      NOT NULL DEFAULT '{}',
  commercial_terms  TEXT,
  remarks           TEXT,
  declared          BOOLEAN     NOT NULL DEFAULT false,

  status            TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'approved', 'rejected')),
  staff_note        TEXT,
  reviewed_by       UUID        REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE supply_partners IS
  'Supply-side registrations from the public website. team_head = leads a team (the owner''s '
  '"gang mate"/"project worker team"), workers onboarded onto Pro Engineering, head earns a '
  'commission. associate = strong in labour supply, same commission model. contractor = may be '
  'given an entire job request, Pro Engineering takes a percentage of revenue.';
COMMENT ON COLUMN supply_partners.team_composition IS
  '[{"skill": "Plumber", "count": 6}, ...] — approximate numbers the partner brings, skill '
  'drawn from the onboardable worker trades. Declared supply only; each worker still goes '
  'through the real /onboarding flow before becoming a deployable workers row.';
COMMENT ON COLUMN supply_partners.engagement_types IS 'Any of: lead_basis, sub_contractor, labour_provider.';
COMMENT ON COLUMN supply_partners.sectors IS 'geo_hierarchy sector names, same naming workers.zones uses.';

CREATE INDEX IF NOT EXISTS idx_supply_partners_status ON supply_partners (status);
CREATE INDEX IF NOT EXISTS idx_supply_partners_type   ON supply_partners (partner_type);

ALTER TABLE supply_partners ENABLE ROW LEVEL SECURITY;

-- Public registration form (anonymous). The server action uses the service-role client, same
-- precedent as app/book/actions.ts; this policy keeps the insert working if that key is unset.
DROP POLICY IF EXISTS "anon_insert_supply_partners" ON supply_partners;
CREATE POLICY "anon_insert_supply_partners"
  ON supply_partners FOR INSERT
  TO anon
  WITH CHECK (true);

-- Staff (super_admin, admin, coordinator, sub_coordinator — is_staff()) read and act on them.
DROP POLICY IF EXISTS "staff_all_supply_partners" ON supply_partners;
CREATE POLICY "staff_all_supply_partners"
  ON supply_partners FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
