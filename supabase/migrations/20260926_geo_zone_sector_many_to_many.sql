-- Correction to 20260926_worker_onboarding_full_spec.sql's geo_hierarchy tree:
-- project owner clarified a Sector is NOT exclusively owned by one Zone --
-- by location proximity, a single Sector can be served from multiple Zones.
-- parent_id (added in the prior migration) stays as the Sector's PRIMARY/
-- home Zone for simple display; this junction table is the real many-to-many
-- "which Zones can serve this Sector" relationship the worker-facing zone
-- picker and any coverage logic must actually query.

CREATE TABLE IF NOT EXISTS geo_zone_sector_coverage (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id    UUID NOT NULL REFERENCES geo_hierarchy(id) ON DELETE CASCADE,
  sector_id  UUID NOT NULL REFERENCES geo_hierarchy(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (zone_id, sector_id)
);

ALTER TABLE geo_zone_sector_coverage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "geo_zone_sector_coverage_authenticated_read" ON geo_zone_sector_coverage;
CREATE POLICY "geo_zone_sector_coverage_authenticated_read"
  ON geo_zone_sector_coverage FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "geo_zone_sector_coverage_anon_read" ON geo_zone_sector_coverage;
CREATE POLICY "geo_zone_sector_coverage_anon_read"
  ON geo_zone_sector_coverage FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_zone_sector_coverage_zone   ON geo_zone_sector_coverage (zone_id);
CREATE INDEX IF NOT EXISTS idx_geo_zone_sector_coverage_sector ON geo_zone_sector_coverage (sector_id);

-- Seed the primary coverage relationship for every Sector already seeded
-- against its parent Zone (Zone 1 -> Sectors 62/63/64). Additional Zones
-- serving the same Sector (the actual many-to-many case) get added as
-- extra rows here once a second Zone exists -- no second Zone is seeded
-- yet, so there is nothing else to add today.
INSERT INTO geo_zone_sector_coverage (zone_id, sector_id)
SELECT parent_id, id FROM geo_hierarchy
WHERE level = 'sector' AND parent_id IS NOT NULL
ON CONFLICT (zone_id, sector_id) DO NOTHING;
