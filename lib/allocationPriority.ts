// Tier-priority rules for worker allocation (confirmed by the project owner,
// 2 Oct 2026). Job "category" is boq_generated.tier -- already real, already
// live, set once at estimate finalization via generateBOQ/EstimateConsole --
// reused as-is, not a new field. Rule: when a trade/skill is short, the
// highest-tier job's unfilled need is filled first from the available pool,
// then the next tier down, WITHOUT ever disturbing a worker already placed
// on a lower-tier job. This ranking only decides the ORDER jobs are shown/
// filled in -- it never removes an existing worker_day_slots row.

export const TIER_RANK: Record<string, number> = { luxury: 3, premium: 2, budget: 1 }
export const TIER_LABEL: Record<string, string> = { luxury: 'Higher', premium: 'Premium', budget: 'General' }
export const TIER_COLOR: Record<string, string> = {
  luxury: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  premium: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
  budget: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
}
export const DEFAULT_TIER = 'budget'

export function tierRank(tier: string | null | undefined): number {
  return TIER_RANK[tier ?? DEFAULT_TIER] ?? TIER_RANK[DEFAULT_TIER]
}

// Mirrors the exact "the real BOQ for this booking" query already proven
// live elsewhere (app/client/dashboard/[bookingRef]/page.tsx): latest
// non-draft version, one per booking_ref.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getJobTiers(supabase: any, bookingRefs: string[]): Promise<Record<string, string>> {
  if (bookingRefs.length === 0) return {}
  const { data } = await supabase
    .from('boq_generated')
    .select('booking_ref, tier, version')
    .in('booking_ref', bookingRefs)
    .neq('status', 'draft')
    .order('version', { ascending: false })

  const tiers: Record<string, string> = {}
  for (const row of (data ?? []) as { booking_ref: string; tier: string | null }[]) {
    if (!(row.booking_ref in tiers)) tiers[row.booking_ref] = row.tier ?? DEFAULT_TIER
  }
  for (const ref of bookingRefs) {
    if (!(ref in tiers)) tiers[ref] = DEFAULT_TIER
  }
  return tiers
}

export function sortByTierDesc<T extends { booking_ref: string }>(rows: T[], tiers: Record<string, string>): T[] {
  return [...rows].sort((a, b) => tierRank(tiers[b.booking_ref]) - tierRank(tiers[a.booking_ref]))
}
