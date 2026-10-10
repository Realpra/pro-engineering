// Phase B3 — materializes Task Ledger rows from job_milestone_substages, the REAL, ALREADY-
// LIVE Plan Template (confirmed 7 Oct 2026 — not duplicated with a new table). Reads the
// substage's own early_start_date/early_finish_date + headcount, which already shift
// automatically whenever a delay/LTF/CPM recast pushes them — materialize never re-types or
// re-estimates this, only turns it into real day-grain rows.
//
// ANY TRADE, NOT JUST SKILLED+HELPER (10 Oct 2026 correction, the project owner's own words:
// "the deployment of supervisor, site visit manager are also to be built in same detailing...
// it was to run like skilled"): a sub-stage's real demand is whatever its own
// labour_assignments rows say -- already a real, per-trade array on job_milestone_substages
// (the Milestone Plan's own "+ Add Trade Row", which has always offered Supervisor as a trade
// option, same as Mason/Tiler/Helper), just never actually consumed here until now. Each
// assignment's own `trade` becomes its own required_skill_code -- Helper runs through the
// identical bucket loop as any skilled trade (never a special case: Helper is a real worker
// with a real `workers.trade='Helper'` row, "no confusion as he was also a worker always"), and
// a Supervisor inspection requirement materializes and reschedules exactly the same way too, so
// it shows up on its own row in the Day-by-Day Deployment board and moves automatically when
// recast.ts's delay cascade re-materializes this same substage. A bucket whose daysNeeded is
// SHORTER than the substage's own full span (the real shape of a one-day inspection visit vs.
// a multi-day skilled activity) anchors to the LAST daysNeeded day(s) of the span -- "due
// inspection days are programmed... after sub-stage/activity completion", not spread across
// the whole activity. Falls back to the old flat skilled/unskilled-per-day fields only when a
// sub-stage has no labour_assignments at all (legacy rows saved before this correction, or the
// plain "+ Add Sub-stage" form which never itemizes by trade) -- never silently dropped.
import { getJobTierName } from './tierMapping'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export interface SubstageLabourAssignment {
  trade: string
  skillType: 'skilled' | 'unskilled'
  qty: number
  daysNeeded?: number
}

interface SubstageSource {
  id: string
  booking_ref: string
  trade_type: string
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  early_start_date: string
  early_finish_date: string
  labour_assignments?: SubstageLabourAssignment[] | null
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

  const fullSpanDays = Math.round(
    (new Date(substage.early_finish_date).getTime() - new Date(substage.early_start_date).getTime()) / 86400000
  ) + 1

  // One bucket per real labour_assignments row -- any trade, Helper included, no special case.
  const itemizedBuckets: { code: string; perDay: number; minProficiencyReq: number; daysNeeded: number }[] = (substage.labour_assignments ?? [])
    .filter(la => la.qty > 0)
    .map(la => ({
      code: la.trade,
      perDay: la.qty,
      minProficiencyReq: la.skillType === 'unskilled' ? 0 : minProficiencyReq,
      daysNeeded: la.daysNeeded && la.daysNeeded > 0 ? la.daysNeeded : fullSpanDays,
    }))

  // Legacy fallback -- only when this sub-stage was never itemized by trade at all (saved
  // before this correction, or added via the plain "+ Add Sub-stage" form).
  const skilledPerDay = substage.skilled_workers_per_day ?? 0
  const unskilledPerDay = substage.unskilled_workers_per_day ?? 0
  const legacyBuckets: { code: string; perDay: number; minProficiencyReq: number; daysNeeded: number }[] = []
  if (itemizedBuckets.length === 0) {
    if (skilledPerDay > 0) legacyBuckets.push({ code: substage.trade_type, perDay: skilledPerDay, minProficiencyReq, daysNeeded: fullSpanDays })
    if (unskilledPerDay > 0) legacyBuckets.push({ code: 'Helper', perDay: unskilledPerDay, minProficiencyReq: 0, daysNeeded: fullSpanDays })
  }

  const buckets = [...itemizedBuckets, ...legacyBuckets]
  if (buckets.length === 0) return { inserted: 0 }

  const spanEnd = new Date(substage.early_finish_date)
  let inserted = 0

  for (const bucket of buckets) {
    // A bucket needing fewer days than the substage's full span anchors to the END of the
    // span (a one-day Supervisor inspection visit happens after the activity completes, not
    // spread across it) -- a bucket needing the full span (the ordinary skilled/Helper case)
    // covers exactly early_start_date..early_finish_date as before.
    const bucketStart = new Date(spanEnd)
    bucketStart.setDate(bucketStart.getDate() - (Math.min(bucket.daysNeeded, fullSpanDays) - 1))

    for (let d = new Date(bucketStart); d <= spanEnd; d.setDate(d.getDate() + 1)) {
      const targetDate = d.toISOString().slice(0, 10)

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
