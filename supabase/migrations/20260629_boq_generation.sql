-- =============================================================================
-- BOQ Auto-Generation: SKU catalogue, calculation rules, generated BOQs,
-- milestone payment templates + schedules
-- =============================================================================

-- ---------------------------------------------------------------------------
-- boq_sku_catalogue: master list of BOQ line items, scoped by tier + job type.
-- scope_conditions JSONB: {fieldName: [allowedValue1, allowedValue2, ...]}
--   SKU is included only when scopeIntent[field] matches one of the allowed values.
--   null = no condition (always include).
-- wastage_multiplier: applied to the formula quantity (e.g. 1.10 for 10% tile wastage).
-- lab_item_code: links to rate_card.activity_code for rate lookup.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boq_sku_catalogue (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code             TEXT          NOT NULL UNIQUE,
  sku_name             TEXT          NOT NULL,
  category             TEXT          NOT NULL DEFAULT 'labour'
                         CHECK (category IN ('labour', 'material')),
  lab_item_code        TEXT,
  unit                 TEXT          NOT NULL,
  sequence_order       INTEGER       NOT NULL DEFAULT 0,
  scope_conditions     JSONB,
  wastage_multiplier   NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
  applicable_tiers     TEXT[]        NOT NULL DEFAULT ARRAY['standard', 'premium'],
  applicable_job_types TEXT[]        NOT NULL DEFAULT ARRAY['bathroom', 'kitchen', 'general'],
  is_active            BOOLEAN       NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boq_sku_sequence ON boq_sku_catalogue (sequence_order);
CREATE INDEX IF NOT EXISTS idx_boq_sku_active   ON boq_sku_catalogue (is_active);

ALTER TABLE boq_sku_catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boq_sku_catalogue_authenticated_read"
  ON boq_sku_catalogue FOR SELECT TO authenticated USING (true);

CREATE POLICY "boq_sku_catalogue_admin_all"
  ON boq_sku_catalogue FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()
            AND users.platform_role IN ('admin', 'coordinator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()
            AND users.platform_role IN ('admin', 'coordinator'))
  );

-- Seed: bathroom renovation SKUs aligned with existing rate_card activity codes.
-- scope_conditions enumerate the allowed scope values (not the excluded ones).
-- tilesScope values: replace-all | replace-floor-only | replace-walls-only | retain-all
-- fixturesScope values: replace-all | replace-selected | retain-all
-- plumbingScope values: reroute | retain
-- electricalScope values: add-change | retain
INSERT INTO boq_sku_catalogue
  (sku_code, sku_name, category, lab_item_code, unit, sequence_order,
   scope_conditions, wastage_multiplier, applicable_tiers, applicable_job_types)
VALUES
  ('demolition-floor',
   'Demolition – Floor Tiles', 'labour', 'demolition-floor', 'sq ft', 10,
   '{"tilesScope": ["replace-all", "replace-floor-only", "replace-walls-only"]}',
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('demolition-wall',
   'Demolition – Wall Tiles', 'labour', 'demolition-wall', 'sq ft', 20,
   '{"tilesScope": ["replace-all", "replace-floor-only", "replace-walls-only"]}',
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('waterproofing',
   'Waterproofing Treatment', 'labour', 'waterproofing', 'sq ft', 30,
   NULL,
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('floor-screed',
   'Floor Screed', 'labour', 'floor-screed', 'sq ft', 40,
   NULL,
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('floor-tiling',
   'Floor Tiling', 'labour', 'floor-tiling', 'sq ft', 50,
   '{"tilesScope": ["replace-all", "replace-floor-only"]}',
   1.100, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('wall-tiling',
   'Wall Tiling', 'labour', 'wall-tiling', 'sq ft', 60,
   '{"tilesScope": ["replace-all", "replace-walls-only"]}',
   1.100, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('plastering-wall',
   'Wall Plastering', 'labour', 'plastering-wall', 'sq ft', 70,
   NULL,
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('grouting',
   'Tile Grouting', 'labour', 'grouting', 'sq ft', 80,
   '{"tilesScope": ["replace-all", "replace-floor-only", "replace-walls-only"]}',
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('plumbing-reroute',
   'Plumbing Reroute', 'labour', 'plumbing-reroute', 'job', 90,
   '{"plumbingScope": ["reroute"]}',
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('electrical-points',
   'Electrical New Points', 'labour', 'electrical-points', 'point', 100,
   '{"electricalScope": ["add-change"]}',
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('fixture-fitting',
   'Fixture & Sanitary Fitting', 'labour', 'fixture-fitting', 'job', 110,
   '{"fixturesScope": ["replace-all", "replace-selected"]}',
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','general']),

  ('supervision',
   'Site Supervision', 'labour', 'supervision', 'day', 120,
   NULL,
   1.000, ARRAY['standard','premium'], ARRAY['bathroom','kitchen','general'])
ON CONFLICT (sku_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- calculation_rules_engine: one formula per SKU.
-- formula_expression is a JS arithmetic expression evaluated server-side against
-- measurement variables extracted from the scope report.
--
-- Available variables (all numeric):
--   floorArea, totalWallArea, ceilingArea
--   bathroomLength, bathroomWidth, bathroomHeight
--   newPointsTotal   (sum of screen07_electrical.newPoints values)
--   totalCalendarDays (from screen16_timeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculation_rules_engine (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code          TEXT        NOT NULL UNIQUE,
  sku_code           TEXT        NOT NULL REFERENCES boq_sku_catalogue(sku_code),
  formula_expression TEXT        NOT NULL,
  description        TEXT,
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE calculation_rules_engine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calc_rules_authenticated_read"
  ON calculation_rules_engine FOR SELECT TO authenticated USING (true);

CREATE POLICY "calc_rules_admin_all"
  ON calculation_rules_engine FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()
            AND users.platform_role IN ('admin', 'coordinator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()
            AND users.platform_role IN ('admin', 'coordinator'))
  );

INSERT INTO calculation_rules_engine (rule_code, sku_code, formula_expression, description)
VALUES
  ('calc-demolition-floor',  'demolition-floor',  'floorArea',
   'Floor area from screen14 measurements'),
  ('calc-demolition-wall',   'demolition-wall',   'totalWallArea',
   'Wall area from screen14 measurements'),
  ('calc-waterproofing',     'waterproofing',     'floorArea',
   'Floor area for waterproofing treatment'),
  ('calc-floor-screed',      'floor-screed',      'floorArea',
   'Floor area for screed levelling'),
  ('calc-floor-tiling',      'floor-tiling',      'floorArea',
   'Floor area for tiling (wastage_multiplier adds 10%)'),
  ('calc-wall-tiling',       'wall-tiling',       'totalWallArea',
   'Wall area for tiling (wastage_multiplier adds 10%)'),
  ('calc-plastering-wall',   'plastering-wall',   'totalWallArea',
   'Wall area for plastering'),
  ('calc-grouting',          'grouting',          'floorArea + totalWallArea',
   'Combined floor + wall area for tile grouting'),
  ('calc-plumbing-reroute',  'plumbing-reroute',  '1',
   'Fixed quantity: 1 job'),
  ('calc-electrical-points', 'electrical-points', 'newPointsTotal',
   'Total new electrical points from screen07'),
  ('calc-fixture-fitting',   'fixture-fitting',   '1',
   'Fixed quantity: 1 job'),
  ('calc-supervision',       'supervision',       'totalCalendarDays',
   'Project duration from screen16 timeline')
ON CONFLICT (rule_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- boq_generated: one record per BOQ generation run.
-- Superseding an existing draft creates a new row and marks the old one
-- 'superseded' (done in application code before insert).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boq_generated (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref       TEXT          NOT NULL,
  report_id         UUID,
  tier              TEXT          NOT NULL,
  job_card_type     TEXT          NOT NULL,
  status            TEXT          NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'approved', 'superseded')),
  line_items        JSONB         NOT NULL DEFAULT '[]',
  subtotal_labour   NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal_material NUMERIC(14,2) NOT NULL DEFAULT 0,
  platform_fee      NUMERIC(14,2) NOT NULL DEFAULT 0,
  bocw_cess         NUMERIC(14,2) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  generated_by      UUID          REFERENCES users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boq_generated_booking ON boq_generated (booking_ref);
CREATE INDEX IF NOT EXISTS idx_boq_generated_status  ON boq_generated (status);

CREATE TRIGGER trg_boq_generated_updated_at
  BEFORE UPDATE ON boq_generated
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE boq_generated ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boq_generated_authenticated_all"
  ON boq_generated FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- milestone_payment_templates: reusable payment schedule blueprints per tier.
-- payment_pct values for a given (tier, job_card_type) must sum to 100.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS milestone_payment_templates (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tier            TEXT          NOT NULL,
  job_card_type   TEXT          NOT NULL DEFAULT 'general',
  milestone_name  TEXT          NOT NULL,
  sequence_order  INTEGER       NOT NULL,
  payment_pct     NUMERIC(5,2)  NOT NULL CHECK (payment_pct > 0 AND payment_pct <= 100),
  trigger_event   TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpt_tier_jobtype
  ON milestone_payment_templates (tier, job_card_type);

ALTER TABLE milestone_payment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestone_templates_authenticated_read"
  ON milestone_payment_templates FOR SELECT TO authenticated USING (true);

-- Seed milestone templates (standard + premium, general job card type)
INSERT INTO milestone_payment_templates
  (tier, job_card_type, milestone_name, sequence_order, payment_pct, trigger_event)
VALUES
  ('standard', 'general', 'Advance / Mobilisation',   1, 20.00, 'booking_confirmed'),
  ('standard', 'general', 'Demolition Complete',       2, 20.00, 'demolition_complete'),
  ('standard', 'general', 'Rough-ins Complete',        3, 20.00, 'rough_ins_complete'),
  ('standard', 'general', 'Tiling Complete',           4, 25.00, 'tiling_complete'),
  ('standard', 'general', 'Finishing & Handover',      5, 15.00, 'handover'),

  ('premium',  'general', 'Advance / Mobilisation',   1, 15.00, 'booking_confirmed'),
  ('premium',  'general', 'Demolition Complete',       2, 20.00, 'demolition_complete'),
  ('premium',  'general', 'Rough-ins Complete',        3, 15.00, 'rough_ins_complete'),
  ('premium',  'general', 'First Fix Complete',        4, 15.00, 'first_fix_complete'),
  ('premium',  'general', 'Tiling Complete',           5, 20.00, 'tiling_complete'),
  ('premium',  'general', 'Finishing & Handover',      6, 15.00, 'handover');

-- ---------------------------------------------------------------------------
-- milestone_payment_schedule: generated schedule rows linked to a boq_generated row.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS milestone_payment_schedule (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref     TEXT          NOT NULL,
  boq_id          UUID          NOT NULL REFERENCES boq_generated(id),
  milestone_name  TEXT          NOT NULL,
  sequence_order  INTEGER       NOT NULL DEFAULT 0,
  payment_pct     NUMERIC(5,2)  NOT NULL,
  payment_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  trigger_event   TEXT,
  status          TEXT          NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'released', 'paid')),
  released_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mps_booking_ref ON milestone_payment_schedule (booking_ref);
CREATE INDEX IF NOT EXISTS idx_mps_boq_id      ON milestone_payment_schedule (boq_id);

ALTER TABLE milestone_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestone_schedule_authenticated_all"
  ON milestone_payment_schedule FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
