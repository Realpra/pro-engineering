// Phase D1/E1-E6 — records a real field-reported delay and reschedules the whole job.
//
// CORRECTED DESIGN (10 Oct 2026, the project owner's own words): "it affects not the slot but
// may affect the whole job execution. therefore, the build is structured that the job gets
// again to entire scheduling including sub-stage, milestone, day wise etc the whole run."
// A delay is NOT a local "shift this slot and flat-add N days to every later row" patch (the
// prior build in this file) -- it is a real re-run of the job's own dependency-aware CPM
// schedule (the SAME computeCPMSchedule already used for the execution-stage scope-change
// cascade), so only sub-stages that are ACTUALLY downstream of the delayed one move, by exactly
// as much as their real FS/SS/FF/SF relationship calls for -- never a blanket date-add to every
// row that merely happens to be dated later.
//
// Mechanism: the delayed sub-stage's own `weather_delay_days` is bumped by daysLost (a real,
// already-live column computeCPMSchedule now reads into that sub-stage's own duration -- see
// milestonePlanActions.ts). computeCPMSchedule is then re-run for the whole booking. Every
// sub-stage whose early_start_date/early_finish_date actually changed as a result has its
// stale Pending Task Ledger rows cancelled and freshly re-materialized at the new dates, tagged
// origin='Recast' so the Coordinator UI runs the deviance walk on them automatically (no manual
// Find-Candidates click -- see TaskLedgerTab.tsx's own header comment on that).
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

import { computeCPMSchedule } from '@/app/admin/estimate/[bookingRef]/milestonePlanActions'
import { materializeTaskLedgerForSubstage } from './materialize'
import type { TaskLedgerRow } from './types'

export interface RecastParams {
  affectedSlotId: string
  eventType: string
  daysLost: number
  skillChanged: boolean
  newRequiredSkillCode?: string
  reasonCategory: 'Client' | 'Project Reasons' | 'Beyond Control'
  reasonRemarks?: string
  externalEventId?: string
  loggedByUserId: string
}

interface SubstageSnapshot {
  id: string
  booking_ref: string
  trade_type: string
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  early_start_date: string
  early_finish_date: string
  weather_delay_days: number | null
  labour_assignments: { trade: string; skillType: 'skilled' | 'unskilled'; qty: number; daysNeeded?: number }[] | null
}

export async function recastForDelay(supabase: AnyClient, params: RecastParams) {
  const { data: slot, error: slotError } = await supabase
    .from('task_ledger')
    .select('*')
    .eq('slot_id', params.affectedSlotId)
    .maybeSingle()
  if (slotError) throw new Error(`recastForDelay (slot): ${slotError.message}`)
  if (!slot) throw new Error(`recastForDelay: slot ${params.affectedSlotId} not found`)
  const typedSlot = slot as TaskLedgerRow
  if (!typedSlot.substage_id) {
    throw new Error('recastForDelay: this slot has no substage_id -- cannot reschedule a slot that is not tied to a real Plan Template row.')
  }

  const { data: affectedSubstage, error: subError } = await supabase
    .from('job_milestone_substages')
    .select('id, booking_ref, trade_type, skilled_workers_per_day, unskilled_workers_per_day, early_start_date, early_finish_date, weather_delay_days')
    .eq('id', typedSlot.substage_id)
    .maybeSingle()
  if (subError) throw new Error(`recastForDelay (substage): ${subError.message}`)
  if (!affectedSubstage) throw new Error(`recastForDelay: substage ${typedSlot.substage_id} not found`)

  const reason = params.reasonRemarks ?? params.eventType

  // Optional: the resuming work itself needs a different trade (a flag, not the normal case).
  if (params.skillChanged && params.newRequiredSkillCode) {
    const { error: tradeErr } = await supabase
      .from('job_milestone_substages')
      .update({ trade_type: params.newRequiredSkillCode })
      .eq('id', affectedSubstage.id)
    if (tradeErr) throw new Error(`recastForDelay (trade_type): ${tradeErr.message}`)
  }

  // Snapshot every substage's current dates BEFORE the recompute, so we know afterward exactly
  // which ones actually moved -- never assume "everything dated later" moved.
  const { data: beforeRows, error: beforeError } = await supabase
    .from('job_milestone_substages')
    .select('id, early_start_date, early_finish_date')
    .eq('booking_ref', affectedSubstage.booking_ref)
  if (beforeError) throw new Error(`recastForDelay (before snapshot): ${beforeError.message}`)
  const beforeById = new Map<string, { early_start_date: string; early_finish_date: string }>(
    (beforeRows ?? []).map((r: { id: string; early_start_date: string; early_finish_date: string }) => [r.id, r])
  )

  // Bump the delayed sub-stage's own duration buffer -- computeCPMSchedule folds this into its
  // duration, so the propagation below is real dependency-aware CPM, not a flat date-add.
  const newWeatherDelay = (affectedSubstage.weather_delay_days ?? 0) + params.daysLost
  const { error: delayColError } = await supabase
    .from('job_milestone_substages')
    .update({ weather_delay_days: newWeatherDelay })
    .eq('id', affectedSubstage.id)
  if (delayColError) throw new Error(`recastForDelay (weather_delay_days): ${delayColError.message}`)

  // E2 -- the Delay/Event Log row, with the confirmed reason-category + admin-approval gate.
  const { error: eventError } = await supabase.from('delay_event_log').insert({
    booking_ref: affectedSubstage.booking_ref,
    affected_slot_id: typedSlot.slot_id,
    event_type: params.eventType,
    days_lost: params.daysLost,
    skill_changed: params.skillChanged,
    new_required_skill_code: params.skillChanged ? (params.newRequiredSkillCode ?? null) : null,
    worker_released_id: typedSlot.assigned_worker_id,
    external_event_id: params.externalEventId ?? null,
    logged_by: params.loggedByUserId,
    reason_category: params.reasonCategory,
    reason_remarks: params.reasonRemarks ?? null,
  })
  if (eventError) throw new Error(`recastForDelay (delay_event_log): ${eventError.message}`)

  // The whole job's dependency-aware schedule, re-run for real.
  const cpmResult = await computeCPMSchedule(affectedSubstage.booking_ref)
  if (!cpmResult.success) throw new Error(`recastForDelay (computeCPMSchedule): ${cpmResult.error}`)

  // Find every substage whose dates actually moved -- not a guess, a real before/after diff.
  const { data: afterRows, error: afterError } = await supabase
    .from('job_milestone_substages')
    .select('id, booking_ref, trade_type, skilled_workers_per_day, unskilled_workers_per_day, early_start_date, early_finish_date, weather_delay_days, labour_assignments')
    .eq('booking_ref', affectedSubstage.booking_ref)
  if (afterError) throw new Error(`recastForDelay (after snapshot): ${afterError.message}`)

  const changedSubstages = ((afterRows ?? []) as SubstageSnapshot[]).filter((s) => {
    const before = beforeById.get(s.id)
    return !before || before.early_start_date !== s.early_start_date || before.early_finish_date !== s.early_finish_date
  })

  const reschedule = `Rescheduled by ${params.daysLost}d -- ${reason}.`
  let totalInserted = 0
  const affectedSubstageIds: string[] = []

  for (const sub of changedSubstages) {
    affectedSubstageIds.push(sub.id)

    // Every still-open slot on this substage is now at a stale date -- cancel it (releasing
    // and re-deriving availability for any already-booked worker first) before re-materializing
    // fresh rows at the recomputed dates. Completed work is never touched.
    const { data: staleSlots, error: staleError } = await supabase
      .from('task_ledger')
      .select('slot_id, assigned_worker_id, target_date')
      .eq('substage_id', sub.id)
      .eq('slot_status', 'Pending')
    if (staleError) throw new Error(`recastForDelay (stale slots for ${sub.id}): ${staleError.message}`)

    for (const stale of (staleSlots ?? []) as { slot_id: string; assigned_worker_id: string | null; target_date: string }[]) {
      if (stale.assigned_worker_id) {
        const { deriveAndUpsertAvailability } = await import('./availability')
        await deriveAndUpsertAvailability(supabase, stale.assigned_worker_id, stale.target_date)
      }
      const { error: cancelError } = await supabase
        .from('task_ledger')
        .update({ slot_status: 'Cancelled_Delayed', recast_reason: reschedule })
        .eq('slot_id', stale.slot_id)
      if (cancelError) throw new Error(`recastForDelay (cancel ${stale.slot_id}): ${cancelError.message}`)
    }

    const { inserted } = await materializeTaskLedgerForSubstage(supabase, sub, {
      origin: 'Recast',
      recastReason: reschedule,
      recastFromSlotId: typedSlot.slot_id,
    })
    totalInserted += inserted
  }

  return { affectedSubstageIds, insertedCount: totalInserted }
}
