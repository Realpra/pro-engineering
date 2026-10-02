// Resolves which SECTOR-level guest_enquiries.zone names are served by a
// set of ZONE-level users.coverage_zones names, via the real many-to-many
// geo_zone_sector_coverage junction table (20260926_geo_zone_sector_many_to_many.sql).
//
// Confirmed real bug, found via live click-through 2 Oct 2026: a real
// Coordinator's Allocation Command Center showed zero jobs even though a
// real job existed in his covered zone. Root cause: coverage_zones stores
// ZONE-level names ("Noida Zone 1"), guest_enquiries.zone stores SECTOR-
// level names ("Noida Sector 62") -- a different level of the same
// hierarchy. Comparing them with plain string equality/`.includes()` can
// structurally never match except by accident. The exact same broken
// pattern pre-existed in app/admin/coordinators/CoordinatorsTabs.tsx's
// job-routing "matching driver" grouping and
// app/admin/estimate/[bookingRef]/ConfirmExecutionPanel.tsx's coordinator
// matching -- fixed here too, once, via this one real resolution instead
// of three separate guesses.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSectorNamesServedByZones(supabase: any, zoneNames: string[]): Promise<Set<string>> {
  if (zoneNames.length === 0) return new Set()
  const { data: zoneRows } = await supabase
    .from('geo_hierarchy')
    .select('id')
    .eq('level', 'zone')
    .in('name', zoneNames)
  const zoneIds = (zoneRows ?? []).map((z: { id: string }) => z.id)
  if (zoneIds.length === 0) return new Set()

  const { data: coverage } = await supabase
    .from('geo_zone_sector_coverage')
    .select('sector_id')
    .in('zone_id', zoneIds)
  const sectorIds = [...new Set((coverage ?? []).map((c: { sector_id: string }) => c.sector_id))]
  if (sectorIds.length === 0) return new Set()

  const { data: sectors } = await supabase.from('geo_hierarchy').select('name').in('id', sectorIds)
  return new Set((sectors ?? []).map((s: { name: string }) => s.name))
}
