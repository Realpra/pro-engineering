// Admin's policy repository lookup (owner, 31 Oct 2026).
//
// Contingency is an Admin-decided value that differs by type, job and region and evolves
// over time, so an estimate never types it in: it is extracted from the repository.
//   - job type      : the repository job type the estimate is built from (today the BOQ is
//                     built from boq_sku_catalogue job_type 'bathroom-renovation', per D39)
//   - job category  : boq_generated.job_card_type L / M / LM
//   - tier          : boq_generated.tier
//   - region        : the job's sector (guest_enquiries.zone) and every level above it
//   - date          : only rows in force today (is_active, effective_from/until)
// The most specific region wins; among equals, the latest effective_from wins.
//
// Admin approval limit for contingency: up to the row's admin_approval_limit_pct (owner: 5%)
// Admin approves; above it Super Admin approves.

export const JOB_CARD_TO_CATEGORY: Record<string, string> = {
  L: 'labour-only',
  M: 'material-supply',
  LM: 'turnkey',
}

// The repository job type the current BOQ engine builds from (generateBOQ's SKU filter).
export const CURRENT_BOQ_JOB_TYPE = 'bathroom-renovation'

// Owner's figure, used only if a row predates the admin_approval_limit_pct column.
export const DEFAULT_ADMIN_CONTINGENCY_LIMIT_PCT = 5

type GeoRow = { id: string; name: string; level: string | null; parent_id: string | null }

// Returns geo ids from most specific to least specific for the job's location name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveGeoChain(supabase: any, locationName: string | null | undefined): Promise<string[]> {
  if (!locationName) return []
  const { data: start } = await supabase
    .from('geo_hierarchy')
    .select('id, name, level, parent_id')
    .eq('name', locationName)
  const rows = (start ?? []) as GeoRow[]
  if (rows.length === 0) return []
  // Prefer the sector-level row when a name exists at several levels.
  const first = rows.find((r) => r.level === 'sector') ?? rows[0]

  const chain: string[] = [first.id]
  const seen = new Set(chain)

  // A sector can be served by several zones (geo_zone_sector_coverage); they rank next.
  if (first.level === 'sector') {
    const { data: cov } = await supabase
      .from('geo_zone_sector_coverage')
      .select('zone_id')
      .eq('sector_id', first.id)
    for (const c of (cov ?? []) as { zone_id: string }[]) {
      if (!seen.has(c.zone_id)) { chain.push(c.zone_id); seen.add(c.zone_id) }
    }
  }

  // Then walk parent_id upward from every id gathered so far (region, district, state...).
  let frontier = [...chain]
  for (let depth = 0; depth < 8 && frontier.length > 0; depth++) {
    const { data: parents } = await supabase
      .from('geo_hierarchy')
      .select('id, parent_id')
      .in('id', frontier)
    const next: string[] = []
    for (const p of (parents ?? []) as { id: string; parent_id: string | null }[]) {
      if (p.parent_id && !seen.has(p.parent_id)) { chain.push(p.parent_id); seen.add(p.parent_id); next.push(p.parent_id) }
    }
    frontier = next
  }
  return chain
}

function inForce(row: { is_active?: boolean | null; effective_from?: string | null; effective_until?: string | null }, today: string) {
  if (row.is_active === false) return false
  if (row.effective_from && row.effective_from > today) return false
  if (row.effective_until && row.effective_until < today) return false
  return true
}

export type ContingencyPolicyRow = {
  id: string
  vertical: string | null
  job_category: string | null
  job_type: string | null
  tier: string | null
  contingency_pct: number | string | null
  min_deviation_pct: number | string | null
  max_deviation_pct: number | string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean | null
  geo_id?: string | null
  admin_approval_limit_pct?: number | string | null
}

export type ContingencyLookup = {
  row: ContingencyPolicyRow | null
  contingencyPct: number | null
  adminLimitPct: number
  message: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lookupContingency(supabase: any, opts: {
  jobType: string | null
  jobCardType: string | null
  tier: string | null
  locationName: string | null
}): Promise<ContingencyLookup> {
  const category = JOB_CARD_TO_CATEGORY[opts.jobCardType ?? ''] ?? null
  if (!opts.jobType || !category || !opts.tier) {
    return { row: null, contingencyPct: null, adminLimitPct: DEFAULT_ADMIN_CONTINGENCY_LIMIT_PCT,
      message: 'Job type, job category or tier is not known, so no contingency row can be selected.' }
  }
  const { data, error } = await supabase
    .from('contingency_policy')
    .select('*')
    .eq('job_type', opts.jobType)
    .eq('job_category', category)
    .eq('tier', opts.tier)
  if (error) {
    return { row: null, contingencyPct: null, adminLimitPct: DEFAULT_ADMIN_CONTINGENCY_LIMIT_PCT, message: error.message }
  }
  const today = new Date().toISOString().slice(0, 10)
  const rows = ((data ?? []) as ContingencyPolicyRow[]).filter((r) => inForce(r, today))
  const chain = await resolveGeoChain(supabase, opts.locationName)
  const rank = (r: ContingencyPolicyRow) => {
    if (!r.geo_id) return chain.length // all-locations row ranks last
    const i = chain.indexOf(r.geo_id)
    return i === -1 ? -1 : i // -1 = row is for a different region
  }
  const eligible = rows.filter((r) => rank(r) >= 0)
  eligible.sort((a, b) => rank(a) - rank(b) || String(b.effective_from ?? '').localeCompare(String(a.effective_from ?? '')))
  const row = eligible[0] ?? null
  if (!row) {
    return { row: null, contingencyPct: null, adminLimitPct: DEFAULT_ADMIN_CONTINGENCY_LIMIT_PCT,
      message: `No contingency row in Admin's repository for ${opts.jobType} / ${category} / ${opts.tier} in force today for this location.` }
  }
  const limit = row.admin_approval_limit_pct
  return {
    row,
    contingencyPct: Number(row.contingency_pct ?? 0),
    adminLimitPct: limit == null ? DEFAULT_ADMIN_CONTINGENCY_LIMIT_PCT : Number(limit),
    message: null,
  }
}

export type PremiumLookup = {
  premiumPct: number | null
  minDeviationPct: number | null
  maxDeviationPct: number | null
  message: string | null
}

// Same repository rule for the platform premium (no region column on that table today).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lookupPremium(supabase: any, opts: {
  jobType: string | null
  jobCardType: string | null
  tier: string | null
}): Promise<PremiumLookup> {
  const category = JOB_CARD_TO_CATEGORY[opts.jobCardType ?? ''] ?? null
  if (!opts.jobType || !category || !opts.tier) {
    return { premiumPct: null, minDeviationPct: null, maxDeviationPct: null,
      message: 'Job type, job category or tier is not known, so no premium row can be selected.' }
  }
  const { data, error } = await supabase
    .from('platform_premium_policy')
    .select('*')
    .eq('job_type', opts.jobType)
    .eq('job_category', category)
    .eq('tier', opts.tier)
  if (error) return { premiumPct: null, minDeviationPct: null, maxDeviationPct: null, message: error.message }
  const today = new Date().toISOString().slice(0, 10)
  const rows = ((data ?? []) as ContingencyPolicyRow[] & { premium_pct?: unknown }[])
    .filter((r) => inForce(r, today))
    .sort((a, b) => String(b.effective_from ?? '').localeCompare(String(a.effective_from ?? '')))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = rows[0] as any
  if (!row) {
    return { premiumPct: null, minDeviationPct: null, maxDeviationPct: null,
      message: `No premium row in the repository for ${opts.jobType} / ${category} / ${opts.tier} in force today.` }
  }
  return {
    premiumPct: row.premium_pct == null ? null : Number(row.premium_pct),
    minDeviationPct: row.min_deviation_pct == null ? null : Number(row.min_deviation_pct),
    maxDeviationPct: row.max_deviation_pct == null ? null : Number(row.max_deviation_pct),
    message: null,
  }
}
