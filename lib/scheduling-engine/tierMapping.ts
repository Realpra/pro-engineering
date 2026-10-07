// Maps the real, already-live, already-frozen job tier (`boq_generated.tier`,
// 'budget'/'premium'/'luxury' -- see lib/allocationPriority.ts, confirmed by
// the project owner 2 Oct 2026) onto this engine's `job_tier_master.tier_name`
// ('Regular'/'Premium'/'Platinum', confirmed 7 Oct 2026). Found and fixed
// before any UI was wired on top: match.ts/materialize.ts had been reading a
// `guest_enquiries.category_tier` column that was never created by any
// migration -- a guessed column, not a real one. The real tier concept lives
// on `boq_generated`, not `guest_enquiries`, and already has a canonical
// fetch pattern (`getJobTiers`) this engine reuses rather than re-deriving.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export const BOQ_TIER_TO_JOB_TIER_NAME: Record<string, string> = {
  budget: 'Regular',
  premium: 'Premium',
  luxury: 'Platinum',
}

/** Latest non-draft boq_generated.tier for a booking, mapped to job_tier_master.tier_name. */
export async function getJobTierName(supabase: AnyClient, bookingRef: string): Promise<string> {
  const { data, error } = await supabase
    .from('boq_generated')
    .select('tier')
    .eq('booking_ref', bookingRef)
    .neq('status', 'draft')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getJobTierName: ${error.message}`)
  return BOQ_TIER_TO_JOB_TIER_NAME[data?.tier ?? 'budget'] ?? 'Regular'
}
