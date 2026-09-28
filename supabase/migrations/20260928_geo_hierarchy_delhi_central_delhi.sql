-- Client process freeze: real geo_hierarchy coverage for Delhi, so /book's
-- client-facing zone/district picker can eventually write a real sector-level
-- name into guest_enquiries.zone (the same column generateBOQ looks up against
-- geo_hierarchy.name WHERE level='sector') instead of the fake Delhi-compass
-- zone values it writes today (north/south/east/west/central/northeast),
-- which can never match anything in geo_hierarchy and silently fall back to
-- the hardcoded default Noida Sector 62 rate card for every /book job.
--
-- Follows the exact precedent already set when Noida was built
-- (20260926_worker_onboarding_full_spec.sql): fresh, level-tagged rows are
-- created alongside whatever flat/legacy rows already exist (the original
-- seed's 'Delhi' type='city' row, and its unreconciled 'Noida Sector 137/143/
-- 168' rows) -- those are left untouched, not reused, not deleted.
--
-- Project owner's decisions (confirmed):
--   - State: Delhi
--   - District: Central Delhi
--   - Region: Central Delhi (same name as district -- a deliberate pass-
--     through level for now, to be split into multiple named regions later
--     as more districts/offices are added)
--   - Zone: "IIT Zone" (Zone is the unit that proliferates as new offices
--     open, per the project owner's own description)
--   - Sector: real place names, not numerals, since Delhi is organized by
--     area rather than numbered sectors the way Noida is -- "Hauz Khas",
--     "Panchsheel Park"
--
-- Uses the same safe upsert pattern as the Noida build (explicit
-- SELECT-then-INSERT-or-UPDATE, never ON CONFLICT): the original migration
-- declared name UNIQUE, but a live test in Session 66 hit Postgres error
-- 42P10 ("no unique or exclusion constraint matching ON CONFLICT") -- the
-- live constraint state cannot be trusted from this sandbox, so this
-- migration does not depend on it either way. Region and District share the
-- literal name "Central Delhi" by design, so every lookup below filters on
-- level as well as name to avoid an ambiguous match.
DO $$
DECLARE
  v_delhi_state_id           UUID;
  v_central_delhi_district_id UUID;
  v_central_delhi_region_id   UUID;
  v_iit_zone_id                UUID;
BEGIN
  -- State: Delhi
  SELECT id INTO v_delhi_state_id FROM geo_hierarchy WHERE name = 'Delhi' AND level = 'state' LIMIT 1;
  IF v_delhi_state_id IS NULL THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active)
      VALUES ('Delhi', 'state', 'DL', true)
      RETURNING id INTO v_delhi_state_id;
  ELSE
    UPDATE geo_hierarchy SET short_code = 'DL', is_active = true
      WHERE id = v_delhi_state_id;
  END IF;

  -- District: Central Delhi
  SELECT id INTO v_central_delhi_district_id FROM geo_hierarchy WHERE name = 'Central Delhi' AND level = 'district' LIMIT 1;
  IF v_central_delhi_district_id IS NULL THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Central Delhi', 'district', 'CD', true, v_delhi_state_id)
      RETURNING id INTO v_central_delhi_district_id;
  ELSE
    UPDATE geo_hierarchy SET short_code = 'CD', is_active = true, parent_id = v_delhi_state_id
      WHERE id = v_central_delhi_district_id;
  END IF;

  -- Region: Central Delhi (same name as district, distinguished by level)
  SELECT id INTO v_central_delhi_region_id FROM geo_hierarchy WHERE name = 'Central Delhi' AND level = 'region' LIMIT 1;
  IF v_central_delhi_region_id IS NULL THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Central Delhi', 'region', 'CDR', true, v_central_delhi_district_id)
      RETURNING id INTO v_central_delhi_region_id;
  ELSE
    UPDATE geo_hierarchy SET short_code = 'CDR', is_active = true, parent_id = v_central_delhi_district_id
      WHERE id = v_central_delhi_region_id;
  END IF;

  -- Zone: IIT Zone
  SELECT id INTO v_iit_zone_id FROM geo_hierarchy WHERE name = 'IIT Zone' AND level = 'zone' LIMIT 1;
  IF v_iit_zone_id IS NULL THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('IIT Zone', 'zone', 'IITZ', true, v_central_delhi_region_id)
      RETURNING id INTO v_iit_zone_id;
  ELSE
    UPDATE geo_hierarchy SET short_code = 'IITZ', is_active = true, parent_id = v_central_delhi_region_id
      WHERE id = v_iit_zone_id;
  END IF;

  -- Sectors (real Delhi place names, not numerals)
  IF NOT EXISTS (SELECT 1 FROM geo_hierarchy WHERE name = 'Hauz Khas' AND level = 'sector') THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Hauz Khas', 'sector', 'HK', true, v_iit_zone_id);
  ELSE
    UPDATE geo_hierarchy SET short_code = 'HK', is_active = true, parent_id = v_iit_zone_id
      WHERE name = 'Hauz Khas' AND level = 'sector';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM geo_hierarchy WHERE name = 'Panchsheel Park' AND level = 'sector') THEN
    INSERT INTO geo_hierarchy (name, level, short_code, is_active, parent_id)
      VALUES ('Panchsheel Park', 'sector', 'PSP', true, v_iit_zone_id);
  ELSE
    UPDATE geo_hierarchy SET short_code = 'PSP', is_active = true, parent_id = v_iit_zone_id
      WHERE name = 'Panchsheel Park' AND level = 'sector';
  END IF;
END $$;
