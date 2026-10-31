'use server'

// Coordinator-facing actions over the Dynamic Scheduling Engine
// (lib/scheduling-engine/) -- the "wire real Coordinator server actions/UI
// onto this engine" phase agreed 7 Oct 2026. Additive only: a new tab on the
// Estimate Console, zero edits to the existing live Coordinator allocation
// pages (app/coordinator/allocate/*), which keep running on worker_day_slots
// exactly as before until this new path is itself live-tested and proven.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { materializeTaskLedgerForSubstage } from '@/lib/scheduling-engine/materialize'
import { matchSlot, confirmDevianceMatch, listCandidatesForSlot, assignCandidateToSlot, cancelBooking, type CandidateListResult } from '@/lib/scheduling-engine/match'
import { recastForDelay, type RecastParams } from '@/lib/scheduling-engine/recast'
import { fillSlotWithSavior } from '@/lib/scheduling-engine/saviors'
import { getAvailabilityGrid, type AvailabilityToken } from '@/lib/scheduling-engine/availability'
import { logJobMovement } from '@/lib/jobMovementLog'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

// Same guard, same allowed roles, as the live Command Center's own
// requireAllocator() (app/coordinator/allocate/[bookingRef]/actions.ts) --
// Sub-Coordinator's access to a job stops at handoff (confirmed design,
// Session 68), and worker allocation is a Coordinator/Admin/Superadmin
// concern, not a Sub-Coordinator one.
async function requireAllocator() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    return { error: 'Not authorized' as const }
  }
  return { supabase, userId: user.id }
}

export type TaskLedgerSubstage = {
  id: string
  booking_ref: string
  substage_code: string | null
  substage_name: string | null
  trade_type: string
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  early_start_date: string
  early_finish_date: string
  status: string | null
}

export type TaskLedgerSlot = {
  slot_id: string
  substage_id: string | null
  target_date: string
  shift_window: 'AM' | 'PM' | 'FULL_DAY'
  required_skill_code: string
  min_proficiency_req: number
  slot_status: 'Pending' | 'Completed' | 'Cancelled_Delayed'
  assigned_worker_id: string | null
  assigned_worker_name: string | null
  match_score: string | null
  deviance_level_applied: number | null
  compliance_check_status: string | null
  operational_action_trigger: string | null
  filled_via_saviors_id: string | null
  origin: 'Planned' | 'Recast'
  recast_from_slot_id: string | null
}

export type PendingDecision = {
  slotId: string
  candidateWorkerId: string
  candidateWorkerName: string
  skillMatchPct: string | null
  devianceLevel: number | null
  decisionReason: string | null
}

export async function getTaskLedgerData(bookingRef: string): Promise<{
  error?: string
  substages?: TaskLedgerSubstage[]
  slots?: TaskLedgerSlot[]
  pendingDecisions?: PendingDecision[]
}> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  const { supabase } = ctx

  const [{ data: substagesData, error: substagesError }, { data: slotsData, error: slotsError }] = await Promise.all([
    supabase
      .from('job_milestone_substages')
      .select('id, booking_ref, substage_code, substage_name, trade_type, skilled_workers_per_day, unskilled_workers_per_day, early_start_date, early_finish_date, status')
      .eq('booking_ref', bookingRef)
      .order('early_start_date', { ascending: true }),
    (supabase as AnyClient)
      .from('task_ledger')
      .select('slot_id, substage_id, target_date, shift_window, required_skill_code, min_proficiency_req, slot_status, assigned_worker_id, match_score, deviance_level_applied, compliance_check_status, operational_action_trigger, filled_via_saviors_id, origin, recast_from_slot_id')
      .eq('booking_ref', bookingRef)
      .order('target_date', { ascending: true }),
  ])
  if (substagesError) return { error: substagesError.message }
  if (slotsError) return { error: slotsError.message }

  const slots = (slotsData ?? []) as Omit<TaskLedgerSlot, 'assigned_worker_name'>[]
  const workerIds = [...new Set(slots.map(s => s.assigned_worker_id).filter((id): id is string => !!id))]
  const workerNameById = new Map<string, string>()
  if (workerIds.length > 0) {
    const { data: workersData } = await supabase.from('workers').select('id, full_name').in('id', workerIds)
    for (const w of (workersData ?? []) as { id: string; full_name: string }[]) workerNameById.set(w.id, w.full_name)
  }
  const slotsWithNames: TaskLedgerSlot[] = slots.map(s => ({
    ...s,
    assigned_worker_name: s.assigned_worker_id ? (workerNameById.get(s.assigned_worker_id) ?? null) : null,
  }))

  // Pending-decision slots: matchSlot() sets this exact trigger value only
  // when its policy action was ASK_COORDINATOR and no worker was booked yet.
  // Legacy fallback only, 10 Oct 2026 -- matchSlot() itself is no longer called by any live
  // path (ordinary slots use findCandidatesForSlot/assignCandidate, recast slots are left
  // unmatched for the same flow now too), so this block only matters for a slot some earlier
  // live click-through already ran through the old silent-match path. Kept, not deleted, in
  // case such a row already exists; it renders nothing once none do.
  const pendingSlotIds = slots
    .filter(s => s.operational_action_trigger === 'BUILD_UPSKILL_SUPERVISE' && !s.assigned_worker_id)
    .map(s => s.slot_id)

  let pendingDecisions: PendingDecision[] = []
  if (pendingSlotIds.length > 0) {
    const { data: matchLogRows } = await (supabase as AnyClient)
      .from('match_log')
      .select('slot_id, candidate_worker_id, skill_match_pct, deviance_level_applied, decision_reason')
      .in('slot_id', pendingSlotIds)
      .eq('selected', true)
    const candidateIds = [...new Set((matchLogRows ?? []).map((r: { candidate_worker_id: string }) => r.candidate_worker_id))]
    const candidateNameById = new Map<string, string>()
    if (candidateIds.length > 0) {
      const { data: candidatesData } = await supabase.from('workers').select('id, full_name').in('id', candidateIds)
      for (const w of (candidatesData ?? []) as { id: string; full_name: string }[]) candidateNameById.set(w.id, w.full_name)
    }
    pendingDecisions = (matchLogRows ?? []).map((r: { slot_id: string; candidate_worker_id: string; skill_match_pct: string | null; deviance_level_applied: number | null; decision_reason: string | null }) => ({
      slotId: r.slot_id,
      candidateWorkerId: r.candidate_worker_id,
      candidateWorkerName: candidateNameById.get(r.candidate_worker_id) ?? 'Unknown worker',
      skillMatchPct: r.skill_match_pct,
      devianceLevel: r.deviance_level_applied,
      decisionReason: r.decision_reason,
    }))
  }

  return { substages: (substagesData ?? []) as TaskLedgerSubstage[], slots: slotsWithNames, pendingDecisions }
}

export async function materializeSubstage(params: { bookingRef: string; substageId: string }): Promise<{ error?: string; inserted?: number }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  const { data: substage, error: substageError } = await ctx.supabase
    .from('job_milestone_substages')
    .select('id, booking_ref, trade_type, skilled_workers_per_day, unskilled_workers_per_day, early_start_date, early_finish_date, labour_assignments')
    .eq('id', params.substageId)
    .maybeSingle()
  if (substageError) return { error: substageError.message }
  if (!substage) return { error: 'Sub-stage not found.' }
  try {
    const result = await materializeTaskLedgerForSubstage(ctx.supabase, substage)
    if ((result.inserted ?? 0) > 0) {
      await logJobMovement(ctx.supabase, {
        bookingRef: params.bookingRef, stage: 'plan', action: 'created', fromUserId: ctx.userId,
        itemType: 'job_milestone_substage', itemId: params.substageId,
        remarks: `${result.inserted} day slot(s) created for deployment`,
      })
    }
    revalidatePath(`/admin/estimate/${params.bookingRef}`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Materialize failed.' }
  }
}

export async function setSlotShiftWindow(params: {
  bookingRef: string
  slotId: string
  shiftWindow: 'AM' | 'PM' | 'FULL_DAY'
}): Promise<{ error?: string }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  const { error } = await ctx.supabase
    .from('task_ledger')
    .update({ shift_window: params.shiftWindow })
    .eq('slot_id', params.slotId)
    .is('assigned_worker_id', null)
  if (error) return { error: error.message }
  revalidatePath(`/admin/estimate/${params.bookingRef}`)
  return {}
}

// The real "find candidates, pick one" flow -- replaces blindly auto-matching with a visible,
// ranked (by deviance level, own-zone-first) list of every eligible worker the engine actually
// found, so the Coordinator picks directly instead of the system silently choosing for them.
export async function findCandidatesForSlot(params: { bookingRef: string; slotId: string }): Promise<{ error?: string; result?: CandidateListResult }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return { error: ctx.error }
  try {
    const result = await listCandidatesForSlot(ctx.supabase, params.slotId)
    revalidatePath(`/admin/estimate/${params.bookingRef}`)
    return { result }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Candidate search failed.' }
  }
}

export async function assignCandidate(params: {
  bookingRef: string
  slotId: string
  workerId: string
  devianceLevel: number
  matchScore: string
}): Promise<{ error?: string }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  try {
    await assignCandidateToSlot(ctx.supabase, {
      slotId: params.slotId,
      workerId: params.workerId,
      devianceLevel: params.devianceLevel,
      matchScore: params.matchScore,
      decidedByUserId: ctx.userId,
    })
    await logJobMovement(ctx.supabase, {
      bookingRef: params.bookingRef, stage: 'deployment', action: 'assigned', fromUserId: ctx.userId,
      itemType: 'task_ledger', itemId: params.slotId,
      remarks: `Worker booked on slot (deviance ${params.devianceLevel}, match ${params.matchScore})`,
    })
    revalidatePath(`/admin/estimate/${params.bookingRef}`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Assign failed.' }
  }
}

export async function runMatchOnSlot(params: { bookingRef: string; slotId: string }): Promise<{ error?: string; result?: import('@/lib/scheduling-engine/types').MatchResult }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return { error: ctx.error }
  try {
    const result = await matchSlot(ctx.supabase, params.slotId)
    revalidatePath(`/admin/estimate/${params.bookingRef}`)
    return { result }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Match failed.' }
  }
}

export async function confirmSlotMatch(params: { bookingRef: string; slotId: string; workerId: string; notes?: string }): Promise<{ error?: string }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  try {
    await confirmDevianceMatch(ctx.supabase, {
      slotId: params.slotId,
      workerId: params.workerId,
      decidedByUserId: ctx.userId,
      notes: params.notes,
    })
    await logJobMovement(ctx.supabase, {
      bookingRef: params.bookingRef, stage: 'deployment', action: 'assigned', fromUserId: ctx.userId,
      itemType: 'task_ledger', itemId: params.slotId, remarks: 'Substitute confirmed by Coordinator',
    })
    revalidatePath(`/admin/estimate/${params.bookingRef}`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Confirm failed.' }
  }
}

export async function reportSlotDelay(params: {
  bookingRef: string
  affectedSlotId: string
  eventType: string
  daysLost: number
  skillChanged: boolean
  newRequiredSkillCode?: string
  reasonCategory: RecastParams['reasonCategory']
  reasonRemarks?: string
}): Promise<{ error?: string; affectedSubstageIds?: string[]; insertedCount?: number }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  try {
    const result = await recastForDelay(ctx.supabase, {
      affectedSlotId: params.affectedSlotId,
      eventType: params.eventType,
      daysLost: params.daysLost,
      skillChanged: params.skillChanged,
      newRequiredSkillCode: params.newRequiredSkillCode,
      reasonCategory: params.reasonCategory,
      reasonRemarks: params.reasonRemarks,
      loggedByUserId: ctx.userId,
    })
    await logJobMovement(ctx.supabase, {
      bookingRef: params.bookingRef, stage: 'plan', action: 'recast', fromUserId: ctx.userId,
      itemType: 'task_ledger', itemId: params.affectedSlotId,
      remarks: `Delay (${params.reasonCategory}, ${params.eventType}): ${params.daysLost} day(s) lost; ${result.insertedCount} slot(s) recast${params.reasonRemarks ? ' -- ' + params.reasonRemarks : ''}`,
    })
    revalidatePath(`/admin/estimate/${params.bookingRef}`)
    return { affectedSubstageIds: result.affectedSubstageIds, insertedCount: result.insertedCount }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Delay report failed.' }
  }
}

// Always-available cancel/unassign (10 Oct 2026 correction): "one alloted can always be
// cancelled. system shall not fail/obstruct that logic." No condition gates this beyond the
// same role check every other action here already has.
export async function cancelSlotBooking(params: { bookingRef: string; slotId: string; remarks?: string }): Promise<{ error?: string }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  try {
    await cancelBooking(ctx.supabase, { slotId: params.slotId, cancelledByUserId: ctx.userId, remarks: params.remarks })
    await logJobMovement(ctx.supabase, {
      bookingRef: params.bookingRef, stage: 'deployment', action: 'removed', fromUserId: ctx.userId,
      itemType: 'task_ledger', itemId: params.slotId, remarks: params.remarks ? `Booking cancelled: ${params.remarks}` : 'Booking cancelled',
    })
    revalidatePath(`/admin/estimate/${params.bookingRef}`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Cancel failed.' }
  }
}

export async function logSaviorForSlot(params: {
  bookingRef: string
  slotId: string
  fullName: string
  mobile?: string
  tradeCode: string
  rateAgreed?: number
  daysAssigned?: number
  remarks?: string
}): Promise<{ error?: string }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  try {
    await fillSlotWithSavior(ctx.supabase, {
      slotId: params.slotId,
      fullName: params.fullName,
      mobile: params.mobile,
      tradeCode: params.tradeCode,
      rateAgreed: params.rateAgreed,
      bookingRef: params.bookingRef,
      daysAssigned: params.daysAssigned,
      loggedByUserId: ctx.userId,
      remarks: params.remarks,
    })
    await logJobMovement(ctx.supabase, {
      bookingRef: params.bookingRef, stage: 'deployment', action: 'assigned', fromUserId: ctx.userId,
      itemType: 'task_ledger', itemId: params.slotId, remarks: `Savior (off-system) filled the slot: ${params.fullName}`,
    })
    revalidatePath(`/admin/estimate/${params.bookingRef}`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Savior log failed.' }
  }
}

// ── Day-by-day, skill-by-skill sequential deployment board (10 Oct 2026 correction) ────────
//
// "the design and layout is: for every day skill required has to be allotted one by one. the
// display of available and required on the days on this job both are shown in above and below
// rows bars... red (booked), green (available), amber (active other than booked, available)."
//
// One SKILL at a time (not the whole flat slot list): a REQUIRED row (one cell per day this
// skill is needed on THIS sub-stage) plus one row per eligible candidate showing their own
// real availability across that same date range -- red = booked full day, green = fully free,
// amber = half-day active elsewhere (the one state in between, read straight off the already-
// live AvailabilityToken, not a new concept). The Deployer books the earliest still-open day
// for the candidate of their choice (any existing booking in this project's own Find
// Candidates flow still works identically on the same slot); once every day for this skill is
// booked or explicitly skipped, the board moves to the next skill. "Skipped for the time being"
// is deliberately NOT persisted anywhere -- an ephemeral UI-only state (skippedSlotIds, passed
// back in on the next call), exactly matching "for the time being": reload and it's back.

export type SkillBoardDayCell = {
  date: string
  slotId: string
  booked: boolean
  workerName: string | null
}

export type SkillBoardCandidate = {
  id: string
  fullName: string
  matchScore: string
  devianceLevel: number
  jobsCompleted: number | null
  grid: Record<string, AvailabilityToken>
}

export type SkillBoard = {
  skillCode: string
  minProficiencyReq: number
  days: SkillBoardDayCell[]
  focusedSlotId: string | null
  focusedDate: string | null
  candidateVia: 'OWN_ZONE' | 'ADJOINING_ZONE' | 'NONE' | null
  candidateLevel: number | null
  candidates: SkillBoardCandidate[]
}

export async function getSkillDeploymentBoard(params: {
  bookingRef: string
  substageId: string
  skillCode: string
  skipSlotIds?: string[]
}): Promise<{ error?: string; board?: SkillBoard }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  const { data: rows, error: rowsError } = await (supabase as AnyClient)
    .from('task_ledger')
    .select('slot_id, target_date, assigned_worker_id, min_proficiency_req')
    .eq('substage_id', params.substageId)
    .eq('required_skill_code', params.skillCode)
    .neq('slot_status', 'Cancelled_Delayed')
    .order('target_date', { ascending: true })
  if (rowsError) return { error: rowsError.message }
  const slots = (rows ?? []) as { slot_id: string; target_date: string; assigned_worker_id: string | null; min_proficiency_req: number }[]
  if (slots.length === 0) {
    return { board: { skillCode: params.skillCode, minProficiencyReq: 0, days: [], focusedSlotId: null, focusedDate: null, candidateVia: null, candidateLevel: null, candidates: [] } }
  }

  const bookedWorkerIds = [...new Set(slots.map(s => s.assigned_worker_id).filter((id): id is string => !!id))]
  const nameById = new Map<string, string>()
  if (bookedWorkerIds.length > 0) {
    const { data: namedWorkers } = await supabase.from('workers').select('id, full_name').in('id', bookedWorkerIds)
    for (const w of (namedWorkers ?? []) as { id: string; full_name: string }[]) nameById.set(w.id, w.full_name)
  }

  const days: SkillBoardDayCell[] = slots.map(s => ({
    date: s.target_date,
    slotId: s.slot_id,
    booked: !!s.assigned_worker_id,
    workerName: s.assigned_worker_id ? (nameById.get(s.assigned_worker_id) ?? null) : null,
  }))

  const skip = new Set(params.skipSlotIds ?? [])
  const focused = slots.find(s => !s.assigned_worker_id && !skip.has(s.slot_id))

  let candidateVia: SkillBoard['candidateVia'] = null
  let candidateLevel: number | null = null
  let candidates: SkillBoardCandidate[] = []
  if (focused) {
    const result: CandidateListResult = await listCandidatesForSlot(supabase, focused.slot_id)
    candidateVia = result.via
    candidateLevel = result.level
    if (result.candidates.length > 0) {
      const grid = await getAvailabilityGrid(supabase, {
        workerIds: result.candidates.map(c => c.id),
        startDate: days[0].date,
        endDate: days[days.length - 1].date,
      })
      candidates = result.candidates.map(c => ({
        id: c.id,
        fullName: c.full_name,
        matchScore: c.match_score,
        devianceLevel: c.deviance_level,
        jobsCompleted: c.jobs_completed,
        grid: Object.fromEntries(grid.get(c.id) ?? new Map()),
      }))
    }
  }

  return {
    board: {
      skillCode: params.skillCode,
      minProficiencyReq: slots[0].min_proficiency_req,
      days,
      focusedSlotId: focused?.slot_id ?? null,
      focusedDate: focused?.target_date ?? null,
      candidateVia,
      candidateLevel,
      candidates,
    },
  }
}
