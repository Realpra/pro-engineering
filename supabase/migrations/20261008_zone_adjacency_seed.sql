-- Seeds the real cross-zone fallback (Phase C4) between the two zones that
-- genuinely exist live today: 'Zone 1' (Noida -- Sector 62/63/64,
-- 20260926_worker_onboarding_full_spec.sql) and 'IIT Zone' (Delhi -- Hauz
-- Khas/Panchsheel Park, 20260928_geo_hierarchy_delhi_central_delhi.sql).
-- Project owner's instruction, 8 Oct 2026: "other sectors/locations other
-- than what is defined as Zone 1 be treated as adjoining zones" -- no new
-- zone invented, this is the one real other zone the live schema has.
-- Both directions seeded (Zone 1 <-> IIT Zone) so the fallback works from
-- either side. travel_time_minutes/distance_km left NULL -- the matching
-- engine (lib/scheduling-engine/zoneAdjacency.ts) never reads either
-- column, and no verified real-world figure for either was available to
-- enter here rather than guess one.

DO $$
DECLARE
  v_zone1_id UUID;
  v_iit_zone_id UUID;
BEGIN
  SELECT id INTO v_zone1_id FROM geo_hierarchy WHERE name = 'Zone 1' AND level = 'zone' LIMIT 1;
  SELECT id INTO v_iit_zone_id FROM geo_hierarchy WHERE name = 'IIT Zone' AND level = 'zone' LIMIT 1;

  IF v_zone1_id IS NULL THEN
    RAISE EXCEPTION 'zone_adjacency seed: Zone 1 not found in geo_hierarchy -- expected from 20260926_worker_onboarding_full_spec.sql';
  END IF;
  IF v_iit_zone_id IS NULL THEN
    RAISE EXCEPTION 'zone_adjacency seed: IIT Zone not found in geo_hierarchy -- expected from 20260928_geo_hierarchy_delhi_central_delhi.sql';
  END IF;

  INSERT INTO zone_adjacency (from_zone_id, to_zone_id, eligible_for_pull, donor_capacity_check_required)
    VALUES (v_zone1_id, v_iit_zone_id, true, true)
    ON CONFLICT (from_zone_id, to_zone_id) DO UPDATE
      SET eligible_for_pull = true, donor_capacity_check_required = true;

  INSERT INTO zone_adjacency (from_zone_id, to_zone_id, eligible_for_pull, donor_capacity_check_required)
    VALUES (v_iit_zone_id, v_zone1_id, true, true)
    ON CONFLICT (from_zone_id, to_zone_id) DO UPDATE
      SET eligible_for_pull = true, donor_capacity_check_required = true;
END $$;
