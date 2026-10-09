// Phase D1/E1-E6 — records a real field-reported delay and redefines the affected slot, then
// cascades the shift to every later still-open day of this job's remaining plan (E3's full
// scope, not just the one affected slot).
//
// CONSISTENCY FIX (10 Oct 2026): a recast row used to be silently run through matchSlot()
// (auto-pick/auto-propose), unlike every ordinary slot which now goes through the visible
// Find-Candidates/Book flow built the same day. Recast slots are left Pending/unmatched here
// too, for the exact same reason -- a delay-driven substitute is no less a real decision than
// an ordinary one, so it gets the same visible candidate list, not a silent pick.
//
// STILL SCOPED HONESTLY: C2 Case 2 (a genuine continuous opportunity elsewhere beating the
// own-job default hold) is not implemented -- only Case 1's default hold is. The cascade below
// shifts every later Pending slot on this SAME booking by the same daysLost (the real-world
// effect of one trade's delay pushing every day after it back) -- it does not re-run a full
// CPM critical-path recompute across substages; that is the Milestone Plan's own concern
// (computeCPMSchedule), not this engine's.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

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

export async function recastForDelay(supabase: AnyClient, params: RecastParams) {
  const { data: slot, error: slotError } = await supabase
    .from('task_ledger')
    .select('*')
    .eq('slot_id', params.affectedSlotId)
    .maybeSingle()
  if (slotError) throw new Error(`recastForDelay (slot): ${slotError.message}`)
  if (!slot) throw new Error(`recastForDelay: slot ${params.affectedSlotId} not found`)
  const typedSlot = slot as TaskLedgerRow

  // E1 — mark delayed, never edited away afterward.
  const { error: cancelError } = await supabase
    .from('task_ledger')
    .update({ slot_status: 'Cancelled_Delayed', recast_reason: params.reasonRemarks ?? params.eventType })
    .eq('slot_id', params.affectedSlotId)
  if (cancelError) throw new Error(`recastForDelay (cancel): ${cancelError.message}`)

  // E6 — the released worker (if any) becomes free for that one date, derived fresh.
  await releaseWorkerAndSoftHold(supabase, typedSlot.assigned_worker_id, typedSlot.booking_ref, typedSlot.target_date)

  // E3/E5 — the new recast row for the directly-affected slot. Left Pending/unmatched (see
  // file header's consistency-fix note) -- the Coordinator finds candidates and books it
  // through the same visible flow as any other slot, never a silent auto-pick.
  const newTargetDate = addDays(typedSlot.target_date, params.daysLost)
  const { data: newSlot, error: insertError } = await supabase
    .from('task_ledger')
    .insert({
      booking_ref: typedSlot.booking_ref,
      substage_id: typedSlot.substage_id,
      client_name: typedSlot.client_name,
      project_start_date: typedSlot.project_start_date,
      day_index: `${typedSlot.day_index}-Recast`,
      target_date: newTargetDate,
      shift_window: typedSlot.shift_window,
      required_skill_code: params.skillChanged ? (params.newRequiredSkillCode ?? typedSlot.required_skill_code) : typedSlot.required_skill_code,
      min_proficiency_req: typedSlot.min_proficiency_req,
      headcount_needed: 1,
      slot_status: 'Pending',
      origin: 'Recast',
      recast_from_slot_id: typedSlot.slot_id,
      recast_reason: params.reasonRemarks ?? params.eventType,
    })
    .select('*')
    .single()
  if (insertError) throw new Error(`recastForDelay (recast insert): ${insertError.message}`)

  // E2 — the Delay/Event Log row, with the confirmed reason-category + admin-approval gate.
  const { error: eventError } = await supabase.from('delay_event_log').insert({
    booking_ref: typedSlot.booking_ref,
    affected_slot_id: typedSlot.slot_id,
    event_type: params.eventType,
    days_lost: params.daysLost,
    skill_changed: params.skillChanged,
    new_required_skill_code: params.skillChanged ? (params.newRequiredSkillCode ?? null) : null,
    resulting_recast_slot_id: newSlot.slot_id,
    worker_released_id: typedSlot.assigned_worker_id,
    external_event_id: params.externalEventId ?? null,
    logged_by: params.loggedByUserId,
    reason_category: params.reasonCategory,
    reason_remarks: params.reasonRemarks ?? null,
  })
  if (eventError) throw new Error(`recastForDelay (delay_event_log): ${eventError.message}`)

  // E3 FULL SCOPE — a delay doesn't just redefine the one day it hits, it pushes every later
  // still-open day of this SAME job back by the same amount (the real-world effect: the next
  // worker literally cannot start until this one finishes). Every other Pending slot on this
  // booking dated after the affected slot's ORIGINAL date gets the identical treatment --
  // cancelled, released, and reinserted daysLost later, left unmatched for its own
  // Find-Candidates/Book pass (never auto-matched, same as the root slot above). Fetched once,
  // before any of this cascade's own inserts exist, so it can never re-shift a row it just
  // created.
  const cascadedSlotIds: string[] = []
  if (params.daysLost > 0) {
    const { data: laterSlots, error: laterError } = await supabase
      .from('task_ledger')
      .select('*')
      .eq('booking_ref', typedSlot.booking_ref)
      .eq('slot_status', 'Pending')
      .gt('target_date', typedSlot.target_date)
      .neq('slot_id', typedSlot.slot_id)
    if (laterError) throw new Error(`recastForDelay (later slots): ${laterError.message}`)

    for (const later of (laterSlots ?? []) as TaskLedgerRow[]) {
      const cascaded = await cascadeShiftSlot(
        supabase,
        later,
        params.daysLost,
        `Cascaded ${params.daysLost}d from the delay on slot ${typedSlot.slot_id} (${params.reasonRemarks ?? params.eventType}).`
      )
      cascadedSlotIds.push(cascaded.slot_id as string)
    }
  }

  return { recastSlotId: newSlot.slot_id as string, cascadedSlotIds }
}

async function releaseWorkerAndSoftHold(
  supabase: AnyClient,
  workerId: string | null,
  bookingRef: string,
  targetDate: string
): Promise<void> {
  if (!workerId) return
  const { deriveAndUpsertAvailability } = await import('./availability')
  await deriveAndUpsertAvailability(supabase, workerId, targetDate)

  // C2 Case 1 default: soft-hold for this same job, non-blocking, overridable.
  await supabase
    .from('worker_supply_ledger')
    .update({ soft_hold_booking_ref: bookingRef, released_by_event_id: null })
    .eq('worker_id', workerId)
    .eq('target_date', targetDate)
}

async function cascadeShiftSlot(
  supabase: AnyClient,
  slot: TaskLedgerRow,
  daysLost: number,
  reason: string
): Promise<TaskLedgerRow> {
  const { error: cancelError } = await supabase
    .from('task_ledger')
    .update({ slot_status: 'Cancelled_Delayed', recast_reason: reason })
    .eq('slot_id', slot.slot_id)
  if (cancelError) throw new Error(`cascadeShiftSlot (cancel ${slot.slot_id}): ${cancelError.message}`)

  await releaseWorkerAndSoftHold(supabase, slot.assigned_worker_id, slot.booking_ref, slot.target_date)

  const newTargetDate = addDays(slot.target_date, daysLost)
  const { data: newSlot, error: insertError } = await supabase
    .from('task_ledger')
    .insert({
      booking_ref: slot.booking_ref,
      substage_id: slot.substage_id,
      client_name: slot.client_name,
      project_start_date: slot.project_start_date,
      day_index: `${slot.day_index}-Recast`,
      target_date: newTargetDate,
      shift_window: slot.shift_window,
      required_skill_code: slot.required_skill_code,
      min_proficiency_req: slot.min_proficiency_req,
      headcount_needed: slot.headcount_needed,
      slot_status: 'Pending',
      origin: 'Recast',
      recast_from_slot_id: slot.slot_id,
      recast_reason: reason,
    })
    .select('*')
    .single()
  if (insertError) throw new Error(`cascadeShiftSlot (insert from ${slot.slot_id}): ${insertError.message}`)
  return newSlot as TaskLedgerRow
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
