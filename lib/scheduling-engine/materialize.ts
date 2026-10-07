// Phase B3 — materializes Task Ledger rows from job_milestone_substages, the REAL, ALREADY-
// LIVE Plan Template (confirmed 7 Oct 2026 — not duplicated with a new table). Reads the
// substage's own early_start_date/early_finish_date + skilled/unskilled headcount, which
// already shift automatically whenever a delay/LTF/CPM recast pushes them — materialize never
// re-types or re-estimates this, only turns it into real day-grain rows.
//
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

/**
 * Idempotent: only inserts the SHORTFALL between how many Task Ledger rows already exist for
 * this substage+date and how many the substage's own headcount calls for — safe to call
 * repeatedly (e.g. once per day as the route-compile cron does for other tables) without
 * creating duplicate slots. headcount_needed stays 1 on every row — one row IS one worker-slot
 * by design (matching this codebase's own worker_day_slots/supervisor_daily_routes precedent of
 * one row per worker per day, not an aggregate count column).
 */
export async function materializeTaskLedgerForSubstage(
  supabase: AnyClient,
  substage: SubstageSource
): Promise<{ inserted: number }> {
  const { data: job, error: jobError } = await supabase
    .from('guest_enquiries')
    .select('contact_name, preferred_start_date, category_tier')
    .eq('booking_ref', substage.booking_ref)
    .maybeSingle()
  if (jobError) throw new Error(`materializeTaskLedgerForSubstage (job): ${jobError.message}`)

  const { data: tierRow, error: tierError } = await supabase
    .from('job_tier_master')
    .select('skill_floor')
    .eq('tier_name', job?.category_tier ?? 'Regular')
    .maybeSingle()
  if (tierError) throw new Error(`materializeTaskLedgerForSubstage (tier): ${tierError.message}`)
  const minProficiencyReq = tierRow?.skill_floor ?? 1

  const headcountPerDay = (substage.skilled_workers_per_day ?? 0) + (substage.unskilled_workers_per_day ?? 0)
  if (headcountPerDay <= 0) return { inserted: 0 }

  const start = new Date(substage.early_start_date)
  const end = new Date(substage.early_finish_date)
  let inserted = 0

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const targetDate = d.toISOString().slice(0, 10)

    const { count: existing, error: countError } = await supabase
      .from('task_ledger')
      .select('slot_id', { count: 'exact', head: true })
      .eq('substage_id', substage.id)
      .eq('target_date', targetDate)
      .eq('origin', 'Planned')
    if (countError) throw new Error(`materializeTaskLedgerForSubstage (count): ${countError.message}`)

    const shortfall = headcountPerDay - (existing ?? 0)
    if (shortfall <= 0) continue

    const rows = Array.from({ length: shortfall }, () => ({
      booking_ref: substage.booking_ref,
      substage_id: substage.id,
      client_name: job?.contact_name ?? null,
      project_start_date: job?.preferred_start_date ?? null,
      day_index: `${targetDate}`,
      target_date: targetDate,
      shift_window: 'FULL_DAY' as const,
      required_skill_code: substage.trade_type,
      min_proficiency_req: minProficiencyReq,
      headcount_needed: 1,
      slot_status: 'Pending' as const,
      origin: 'Planned' as const,
    }))
    const { error: insertError } = await supabase.from('task_ledger').insert(rows)
    if (insertError) throw new Error(`materializeTaskLedgerForSubstage (insert): ${insertError.message}`)
    inserted += shortfall
  }

  return { inserted }
}
