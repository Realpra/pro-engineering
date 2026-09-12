-- ── Platform Premium & Contingency Policy Framework ──────────────────────────
-- Tables: platform_premium_policy, contingency_policy, policy_change_log,
--         premium_approval_requests
-- Seed:   27 rows each for premium and contingency policies

-- ── 1. platform_premium_policy ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_premium_policy (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical         TEXT NOT NULL,
  job_category     TEXT NOT NULL,
  tier             TEXT NOT NULL,
  premium_pct      NUMERIC(5,2) NOT NULL,
  effective_from   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_premium_policy_uniq UNIQUE (vertical, job_category, tier),
  CONSTRAINT platform_premium_policy_vertical_chk
    CHECK (vertical IN ('civil-engineering','interior-design','mep-services')),
  CONSTRAINT platform_premium_policy_category_chk
    CHECK (job_category IN ('turnkey','labour-only','material-supply')),
  CONSTRAINT platform_premium_policy_tier_chk
    CHECK (tier IN ('budget','premium','luxury'))
);

ALTER TABLE platform_premium_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_platform_premium_policy"  ON platform_premium_policy FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_platform_premium_policy" ON platform_premium_policy FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ── 2. contingency_policy ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contingency_policy (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical                 TEXT NOT NULL,
  job_category             TEXT NOT NULL,
  tier                     TEXT NOT NULL,
  max_contingency_pct      NUMERIC(5,2) NOT NULL,
  admin_approval_limit_pct NUMERIC(5,2) NOT NULL,
  effective_from           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contingency_policy_uniq UNIQUE (vertical, job_category, tier),
  CONSTRAINT contingency_policy_vertical_chk
    CHECK (vertical IN ('civil-engineering','interior-design','mep-services')),
  CONSTRAINT contingency_policy_category_chk
    CHECK (job_category IN ('turnkey','labour-only','material-supply')),
  CONSTRAINT contingency_policy_tier_chk
    CHECK (tier IN ('budget','premium','luxury'))
);

ALTER TABLE contingency_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_contingency_policy"  ON contingency_policy FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_contingency_policy" ON contingency_policy FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ── 3. policy_change_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policy_change_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name    TEXT NOT NULL,
  record_id     UUID NOT NULL,
  changed_by    UUID NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  change_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE policy_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_policy_change_log"  ON policy_change_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_policy_change_log" ON policy_change_log FOR INSERT TO authenticated WITH CHECK (true);

-- ── 4. premium_approval_requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS premium_approval_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref   TEXT NOT NULL,
  boq_id        UUID,
  requested_pct NUMERIC(5,2) NOT NULL,
  policy_pct    NUMERIC(5,2) NOT NULL,
  boq_total     NUMERIC(12,2),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved_by_admin','approved_by_super_admin','rejected')),
  requested_by  UUID,
  reviewed_by   UUID,
  reviewed_at   TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE premium_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_premium_approval_requests"  ON premium_approval_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_premium_approval_requests" ON premium_approval_requests FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ── 5. Seed: platform_premium_policy (27 rows) ────────────────────────────
INSERT INTO platform_premium_policy (vertical, job_category, tier, premium_pct) VALUES
  -- civil-engineering
  ('civil-engineering', 'turnkey',         'budget',  12.00),
  ('civil-engineering', 'turnkey',         'premium', 14.00),
  ('civil-engineering', 'turnkey',         'luxury',  16.00),
  ('civil-engineering', 'labour-only',     'budget',  10.00),
  ('civil-engineering', 'labour-only',     'premium', 12.00),
  ('civil-engineering', 'labour-only',     'luxury',  14.00),
  ('civil-engineering', 'material-supply', 'budget',   8.00),
  ('civil-engineering', 'material-supply', 'premium', 10.00),
  ('civil-engineering', 'material-supply', 'luxury',  12.00),
  -- interior-design
  ('interior-design',   'turnkey',         'budget',  14.00),
  ('interior-design',   'turnkey',         'premium', 16.00),
  ('interior-design',   'turnkey',         'luxury',  18.00),
  ('interior-design',   'labour-only',     'budget',  12.00),
  ('interior-design',   'labour-only',     'premium', 14.00),
  ('interior-design',   'labour-only',     'luxury',  16.00),
  ('interior-design',   'material-supply', 'budget',  10.00),
  ('interior-design',   'material-supply', 'premium', 12.00),
  ('interior-design',   'material-supply', 'luxury',  14.00),
  -- mep-services
  ('mep-services',      'turnkey',         'budget',  13.00),
  ('mep-services',      'turnkey',         'premium', 15.00),
  ('mep-services',      'turnkey',         'luxury',  17.00),
  ('mep-services',      'labour-only',     'budget',  11.00),
  ('mep-services',      'labour-only',     'premium', 13.00),
  ('mep-services',      'labour-only',     'luxury',  15.00),
  ('mep-services',      'material-supply', 'budget',   9.00),
  ('mep-services',      'material-supply', 'premium', 11.00),
  ('mep-services',      'material-supply', 'luxury',  13.00)
ON CONFLICT (vertical, job_category, tier) DO NOTHING;

-- ── 6. Seed: contingency_policy (27 rows) ─────────────────────────────────
-- max_contingency_pct      = max allowed without any approval
-- admin_approval_limit_pct = above this, super admin required regardless of job total
INSERT INTO contingency_policy (vertical, job_category, tier, max_contingency_pct, admin_approval_limit_pct) VALUES
  -- civil-engineering
  ('civil-engineering', 'turnkey',         'budget',   5.00, 10.00),
  ('civil-engineering', 'turnkey',         'premium',  6.00, 12.00),
  ('civil-engineering', 'turnkey',         'luxury',   8.00, 15.00),
  ('civil-engineering', 'labour-only',     'budget',   5.00, 10.00),
  ('civil-engineering', 'labour-only',     'premium',  6.00, 12.00),
  ('civil-engineering', 'labour-only',     'luxury',   7.00, 14.00),
  ('civil-engineering', 'material-supply', 'budget',   3.00,  8.00),
  ('civil-engineering', 'material-supply', 'premium',  4.00, 10.00),
  ('civil-engineering', 'material-supply', 'luxury',   5.00, 12.00),
  -- interior-design
  ('interior-design',   'turnkey',         'budget',   7.00, 12.00),
  ('interior-design',   'turnkey',         'premium',  8.00, 15.00),
  ('interior-design',   'turnkey',         'luxury',  10.00, 18.00),
  ('interior-design',   'labour-only',     'budget',   6.00, 12.00),
  ('interior-design',   'labour-only',     'premium',  7.00, 14.00),
  ('interior-design',   'labour-only',     'luxury',   9.00, 16.00),
  ('interior-design',   'material-supply', 'budget',   4.00, 10.00),
  ('interior-design',   'material-supply', 'premium',  5.00, 12.00),
  ('interior-design',   'material-supply', 'luxury',   6.00, 14.00),
  -- mep-services
  ('mep-services',      'turnkey',         'budget',   6.00, 12.00),
  ('mep-services',      'turnkey',         'premium',  7.00, 14.00),
  ('mep-services',      'turnkey',         'luxury',   9.00, 16.00),
  ('mep-services',      'labour-only',     'budget',   5.00, 10.00),
  ('mep-services',      'labour-only',     'premium',  6.00, 12.00),
  ('mep-services',      'labour-only',     'luxury',   8.00, 15.00),
  ('mep-services',      'material-supply', 'budget',   3.00,  8.00),
  ('mep-services',      'material-supply', 'premium',  4.00, 10.00),
  ('mep-services',      'material-supply', 'luxury',   5.00, 12.00)
ON CONFLICT (vertical, job_category, tier) DO NOTHING;
