// Phase C4 — adjoining zones, only after confirming the donor zone itself has spare capacity.
// "donor_capacity_check_required is what stops a pull from quietly creating a new shortage in
// the zone it pulled from — it's a mandatory pre-check, not optional." (flow document, C4 sig.)
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

/**
 * zone_adjacency FKs to geo_hierarchy ZONE-level rows, but workers.zones/task_ledger demand
 * are keyed by SECTOR-level names (the exact same zone-vs-sector distinction already fixed in
 * lib/zoneCoverage.ts for the Coordinator allocation build, 2 Oct 2026 — reused here rather
 * than re-solving it, same junction table, just resolving by zone_id instead of zone_name).
 */
export async function getSectorNamesForZoneId(supabase: AnyClient, zoneId: string): Promise<string[]> {
  const { data: coverage, error } = await supabase
    .from('geo_zone_sector_coverage')
    .select('sector_id')
    .eq('zone_id', zoneId)
  if (error) throw new Error(`getSectorNamesForZoneId (coverage): ${error.message}`)
  const sectorIds = Array.from(new Set<string>((coverage ?? []).map((c: { sector_id: string }) => c.sector_id)))
  if (sectorIds.length === 0) return []

  const { data: sectors, error: sectorError } = await supabase
    .from('geo_hierarchy')
    .select('name')
    .in('id', sectorIds)
  if (sectorError) throw new Error(`getSectorNamesForZoneId (sectors): ${sectorError.message}`)
  return (sectors ?? []).map((s: { name: string }) => s.name)
}

/**
 * Reverse lookup: given a SECTOR name (what guest_enquiries.zone / a job's own zone actually
 * is), find every ZONE-level id that covers it, via the same many-to-many junction. A sector
 * can be served by multiple zones (confirmed design, Session 65) — zone_adjacency's own
 * from_zone_id needs one of these, not the sector id itself.
 */
export async function getZoneIdsForSectorName(supabase: AnyClient, sectorName: string): Promise<string[]> {
  const { data: sectorRow, error: sectorError } = await supabase
    .from('geo_hierarchy')
    .select('id')
    .eq('level', 'sector')
    .eq('name', sectorName)
    .maybeSingle()
  if (sectorError) throw new Error(`getZoneIdsForSectorName (sector): ${sectorError.message}`)
  if (!sectorRow) return []

  const { data: coverage, error: coverageError } = await supabase
    .from('geo_zone_sector_coverage')
    .select('zone_id')
    .eq('sector_id', sectorRow.id)
  if (coverageError) throw new Error(`getZoneIdsForSectorName (coverage): ${coverageError.message}`)
  return Array.from(new Set<string>((coverage ?? []).map((c: { zone_id: string }) => c.zone_id)))
}

/** Returns the real zone_ids eligible to donate to `fromZoneId`, per zone_adjacency. */
export async function getAdjoiningZones(supabase: AnyClient, fromZoneId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('zone_adjacency')
    .select('to_zone_id, eligible_for_pull')
    .eq('from_zone_id', fromZoneId)
    .eq('eligible_for_pull', true)
  if (error) throw new Error(`getAdjoiningZones: ${error.message}`)
  return (data ?? []).map((r: { to_zone_id: string }) => r.to_zone_id)
}

/**
 * Donor-capacity check: a donor zone is "spare" for a trade/date only if it has more idle
 * (available, unbooked) workers of that trade on that date than it has its own open Task
 * Ledger demand for that same trade/date. Mandatory before ANY cross-zone pull is offered —
 * never skipped, never optional, per the project owner's explicit confirmed rule.
 */
export async function donorZoneHasSpareCapacity(
  supabase: AnyClient,
  params: { donorZoneSectorNames: string[]; trade: string; targetDate: string }
): Promise<boolean> {
  const { data: idleWorkers, error: workerError } = await supabase
    .from('workers')
    .select('id')
    .eq('trade', params.trade)
    .eq('is_available', true)
    .overlaps('zones', params.donorZoneSectorNames)
  if (workerError) throw new Error(`donorZoneHasSpareCapacity (workers): ${workerError.message}`)
  const idleCount = (idleWorkers ?? []).length

  const { count: openDemand, error: demandError } = await supabase
    .from('task_ledger')
    .select('slot_id', { count: 'exact', head: true })
    .eq('required_skill_code', params.trade)
    .eq('target_date', params.targetDate)
    .eq('slot_status', 'Pending')
    .is('assigned_worker_id', null)
  if (demandError) throw new Error(`donorZoneHasSpareCapacity (demand): ${demandError.message}`)

  return idleCount > (openDemand ?? 0)
}
