// Phase D1/E1-E6 — records a real field-reported delay and redefines the affected slot.
//
// SCOPED HONESTLY: this pass implements the single-slot recast (E1, E2, the one new recast
// row E3/E5 produces for the cancelled slot itself, E4's default soft-hold for the released
// worker, E6's fresh availability release) — NOT yet the full "walk every still-open day of
// this job's remaining plan" cascade E3 describes for a delay that pushes EVERY later day
// forward (that needs the whole remaining Plan Template re-walked, a bigger operation left
// for the next pass, not silently claimed done here). C2 Case 2 (a genuine continuous
// opportunity elsewhere beating the own-job hold) is also not implemented — only Case 1's
// default hold is. Both gaps are flagged in CLAUDE.md, not guessed past.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

import { matchSlot } from './match'
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
  if (typedSlot.assigned_worker_id) {
    const { deriveAndUpsertAvailability } = await import('./availability')
    await deriveAndUpsertAvailability(supabase, typedSlot.assigned_worker_id, typedSlot.target_date)

    // C2 Case 1 default: soft-hold for this same job, non-blocking, overridable.
    await supabase
      .from('worker_supply_ledger')
      .update({ soft_hold_booking_ref: typedSlot.booking_ref, released_by_event_id: null })
      .eq('worker_id', typedSlot.assigned_worker_id)
      .eq('target_date', typedSlot.target_date)
  }

  // E3/E5 — the one new recast row (single-slot scope, see file header).
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

  // E5 — the recast slot runs through the SAME matching engine as any brand-new slot.
  const matchResult = await matchSlot(supabase, newSlot.slot_id)

  return { recastSlotId: newSlot.slot_id as string, matchResult }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
