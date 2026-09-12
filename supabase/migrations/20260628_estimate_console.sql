-- =============================================================================
-- Estimate Console: supporting tables + schema patches
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Patch site_visit_reports: add named screen columns (live DB already has these
-- from prior direct migrations; IF NOT EXISTS is a no-op on those instances)
-- ---------------------------------------------------------------------------
ALTER TABLE site_visit_reports
  ADD COLUMN IF NOT EXISTS screen02_scope_intent   JSONB,
  ADD COLUMN IF NOT EXISTS screen07_electrical     JSONB,
  ADD COLUMN IF NOT EXISTS screen14_measurements   JSONB,
  ADD COLUMN IF NOT EXISTS screen15_labour         JSONB,
  ADD COLUMN IF NOT EXISTS screen16_timeline       JSONB,
  ADD COLUMN IF NOT EXISTS screen17_risk_decisions JSONB,
  ADD COLUMN IF NOT EXISTS screen18_client_scope   JSONB,
  ADD COLUMN IF NOT EXISTS review_status           TEXT,
  ADD COLUMN IF NOT EXISTS coordinator_notes       TEXT,
  ADD COLUMN IF NOT EXISTS risk_flag_count         INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Patch labour_rate_config: add display name + unit columns
-- ---------------------------------------------------------------------------
ALTER TABLE labour_rate_config
  ADD COLUMN IF NOT EXISTS activity_name TEXT,
  ADD COLUMN IF NOT EXISTS unit          TEXT;

UPDATE labour_rate_config
SET activity_name = n.name, unit = n.unit
FROM (VALUES
  ('demolition-floor',  'Demolition – Floor Tiles',       'sq ft'),
  ('demolition-wall',   'Demolition – Wall Tiles',        'sq ft'),
  ('waterproofing',     'Waterproofing Treatment',        'sq ft'),
  ('floor-screed',      'Floor Screed',                   'sq ft'),
  ('floor-tiling',      'Floor Tiling',                   'sq ft'),
  ('wall-tiling',       'Wall Tiling',                    'sq ft'),
  ('plastering-wall',   'Wall Plastering',                'sq ft'),
  ('grouting',          'Tile Grouting',                  'sq ft'),
  ('plumbing-reroute',  'Plumbing Reroute',               'job'),
  ('electrical-points', 'Electrical New Points',          'point'),
  ('fixture-fitting',   'Fixture & Sanitary Fitting',     'job'),
  ('supervision',       'Site Supervision',               'day')
) AS n(code, name, unit)
WHERE labour_rate_config.activity = n.code
  AND labour_rate_config.activity_name IS NULL;

-- ---------------------------------------------------------------------------
-- geo_hierarchy: zone / city lookup for rate cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS geo_hierarchy (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  type       TEXT        NOT NULL DEFAULT 'zone',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE geo_hierarchy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_hierarchy_authenticated_read"
  ON geo_hierarchy FOR SELECT
  TO authenticated
  USING (true);

-- Seed zones used by guest_enquiries + a default fallback
INSERT INTO geo_hierarchy (name, type) VALUES
  ('default',           'zone'),
  ('Noida',             'city'),
  ('Noida Sector 137',  'zone'),
  ('Noida Sector 143',  'zone'),
  ('Noida Sector 168',  'zone'),
  ('Greater Noida',     'city'),
  ('Delhi',             'city'),
  ('Gurgaon',           'city'),
  ('Gurugram',          'city')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- rate_card: per-zone labour/activity rates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_card (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_hierarchy_id UUID          NOT NULL REFERENCES geo_hierarchy(id),
  activity_code    TEXT          NOT NULL,
  rate             NUMERIC(12,2) NOT NULL,
  effective_from   DATE          NOT NULL DEFAULT CURRENT_DATE,
  effective_until  DATE,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (geo_hierarchy_id, activity_code, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_rate_card_geo  ON rate_card (geo_hierarchy_id);
CREATE INDEX IF NOT EXISTS idx_rate_card_code ON rate_card (activity_code);
CREATE INDEX IF NOT EXISTS idx_rate_card_active ON rate_card (is_active, effective_from);

ALTER TABLE rate_card ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_card_authenticated_read"
  ON rate_card FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rate_card_admin_all"
  ON rate_card FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.platform_role IN ('admin', 'coordinator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.platform_role IN ('admin', 'coordinator')
    )
  );

-- Seed: default zone (fallback when specific zone has no data)
INSERT INTO rate_card (geo_hierarchy_id, activity_code, rate)
SELECT g.id, v.code, v.rate
FROM geo_hierarchy g
CROSS JOIN (VALUES
  ('demolition-floor',    18.00),
  ('demolition-wall',     22.00),
  ('waterproofing',       35.00),
  ('floor-screed',        20.00),
  ('floor-tiling',        65.00),
  ('wall-tiling',         75.00),
  ('plastering-wall',     40.00),
  ('grouting',            15.00),
  ('plumbing-reroute', 12000.00),
  ('electrical-points',  1800.00),
  ('fixture-fitting',   8000.00),
  ('supervision',         800.00)
) AS v(code, rate)
WHERE g.name = 'default'
ON CONFLICT (geo_hierarchy_id, activity_code, effective_from) DO NOTHING;

-- Seed: Noida zones (slightly higher market rate)
INSERT INTO rate_card (geo_hierarchy_id, activity_code, rate)
SELECT g.id, v.code, v.rate
FROM geo_hierarchy g
CROSS JOIN (VALUES
  ('demolition-floor',    20.00),
  ('demolition-wall',     24.00),
  ('waterproofing',       38.00),
  ('floor-screed',        22.00),
  ('floor-tiling',        70.00),
  ('wall-tiling',         80.00),
  ('plastering-wall',     45.00),
  ('grouting',            16.00),
  ('plumbing-reroute', 14000.00),
  ('electrical-points',  2000.00),
  ('fixture-fitting',   9000.00),
  ('supervision',         900.00)
) AS v(code, rate)
WHERE g.name IN ('Noida', 'Noida Sector 137', 'Noida Sector 143', 'Noida Sector 168')
ON CONFLICT (geo_hierarchy_id, activity_code, effective_from) DO NOTHING;

-- ---------------------------------------------------------------------------
-- client_estimates: generated estimates from scope reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_estimates (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref        TEXT          NOT NULL,
  report_id          UUID,
  version            INTEGER       NOT NULL DEFAULT 1,
  status             TEXT          NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'pending_approval', 'sent_to_client')),

  line_items         JSONB         NOT NULL DEFAULT '[]',

  subtotal_labour    NUMERIC(14,2) NOT NULL DEFAULT 0,
  platform_fee       NUMERIC(14,2) NOT NULL DEFAULT 0,
  bocw_cess          NUMERIC(14,2) NOT NULL DEFAULT 0,
  gst_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
  contingency_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  contingency_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  discount_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,

  coordinator_notes  TEXT,
  created_by         UUID          REFERENCES users(id),
  sent_to_client_at  TIMESTAMPTZ,

  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_estimates_booking_ref
  ON client_estimates (booking_ref);

CREATE TRIGGER trg_client_estimates_updated_at
  BEFORE UPDATE ON client_estimates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE client_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_estimates_authenticated_all"
  ON client_estimates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
