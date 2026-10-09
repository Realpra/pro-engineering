// Phase B3 — materializes Task Ledger rows from job_milestone_substages, the REAL, ALREADY-
// LIVE Plan Template (confirmed 7 Oct 2026 — not duplicated with a new table). Reads the
// substage's own early_start_date/early_finish_date + skilled/unskilled headcount, which
// already shift automatically whenever a delay/LTF/CPM recast pushes them — materialize never
// re-types or re-estimates this, only turns it into real day-grain rows.
//
// HELPER SPLIT (10 Oct 2026 correction): a sub-stage's skilled and unskilled headcount are two
// genuinely different demands, not one combined trade -- skilled workers are demanded under
// the sub-stage's own trade_type, unskilled under 'Helper' specifically (an onboardable trade
// in its own right), each with its own required_skill_code and its own shortfall count. Helper
// demand is never graded against the job tier's skill_floor (that ladder belongs to the skilled
// trade) -- min_proficiency_req is 0 for Helper rows.
//
import { getJobTierName } from './tierMapping'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

interface SubstageSource {
  id: string
  booking_ref: string
  trade_type: string
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  early_start_date: string
  early_finish_date: string
}

export interface MaterializeOptions {
  /** 'Recast' when this call is re-materializing a substage after a delay-driven reschedule
   *  (see recast.ts) -- tags inserted rows so the Coordinator UI runs the deviance walk on them
   *  automatically and shows the RECAST badge. Defaults to 'Planned' (the ordinary Materialize
   *  button, unchanged behavior). */
  origin?: 'Planned' | 'Recast'
  recastReason?: string
  recastFromSlotId?: string
}

/**
 * Idempotent within one origin: only inserts the SHORTFALL between how many Task Ledger rows
 * already exist (of the SAME origin) for this substage+date+skill and how many the substage's
 * own headcount calls for -- safe to call repeatedly without creating duplicate slots.
 * headcount_needed stays 1 on every row -- one row IS one worker-slot by design (matching this
 * codebase's own worker_day_slots/supervisor_daily_routes precedent of one row per worker per
 * day, not an aggregate count column).
 */
export async function materializeTaskLedgerForSubstage(
  supabase: AnyClient,
  substage: SubstageSource,
  opts: MaterializeOptions = {}
): Promise<{ inserted: number }> {
  const origin = opts.origin ?? 'Planned'

  const { data: job, error: jobError } = await supabase
    .from('guest_enquiries')
    .select('contact_name, preferred_start_date')
    .eq('booking_ref', substage.booking_ref)
    .maybeSingle()
  if (jobError) throw new Error(`materializeTaskLedgerForSubstage (job): ${jobError.message}`)

  const tierName = await getJobTierName(supabase, substage.booking_ref)
  const { data: tierRow, error: tierError } = await supabase
    .from('job_tier_master')
    .select('skill_floor')
    .eq('tier_name', tierName)
    .maybeSingle()
  if (tierError) throw new Error(`materializeTaskLedgerForSubstage (tier): ${tierError.message}`)
  const minProficiencyReq = tierRow?.skill_floor ?? 1

  const skilledPerDay = substage.skilled_workers_per_day ?? 0
  const unskilledPerDay = substage.unskilled_workers_per_day ?? 0
  if (skilledPerDay <= 0 && unskilledPerDay <= 0) return { inserted: 0 }

  const buckets: { code: string; perDay: number; minProficiencyReq: number }[] = []
  if (skilledPerDay > 0) buckets.push({ code: substage.trade_type, perDay: skilledPerDay, minProficiencyReq })
  if (unskilledPerDay > 0) buckets.push({ code: 'Helper', perDay: unskilledPerDay, minProficiencyReq: 0 })

  const start = new Date(substage.early_start_date)
  const end = new Date(substage.early_finish_date)
  let inserted = 0

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const targetDate = d.toISOString().slice(0, 10)

    for (const bucket of buckets) {
      const { count: existing, error: countError } = await supabase
        .from('task_ledger')
        .select('slot_id', { count: 'exact', head: true })
        .eq('substage_id', substage.id)
        .eq('target_date', targetDate)
        .eq('required_skill_code', bucket.code)
        .eq('origin', origin)
      if (countError) throw new Error(`materializeTaskLedgerForSubstage (count): ${countError.message}`)

      const shortfall = bucket.perDay - (existing ?? 0)
      if (shortfall <= 0) continue

      const rows = Array.from({ length: shortfall }, () => ({
        booking_ref: substage.booking_ref,
        substage_id: substage.id,
        client_name: job?.contact_name ?? null,
        project_start_date: job?.preferred_start_date ?? null,
        day_index: `${targetDate}`,
        target_date: targetDate,
        shift_window: 'FULL_DAY' as const,
        required_skill_code: bucket.code,
        min_proficiency_req: bucket.minProficiencyReq,
        headcount_needed: 1,
        slot_status: 'Pending' as const,
        origin,
        recast_reason: origin === 'Recast' ? (opts.recastReason ?? null) : null,
        recast_from_slot_id: origin === 'Recast' ? (opts.recastFromSlotId ?? null) : null,
      }))
      const { error: insertError } = await supabase.from('task_ledger').insert(rows)
      if (insertError) throw new Error(`materializeTaskLedgerForSubstage (insert): ${insertError.message}`)
      inserted += shortfall
    }
  }

  return { inserted }
}
