// Phase C1-C5 — the core matching orchestrator. One slot in, one outcome out: a booked
// worker, a proposed-pending-Coordinator-decision candidate, or NO SUPPLY. Every candidate
// actually considered is logged to match_log, selected or not — "the algorithm's own audit
// trail" (README). This is the ONE matching engine Phase C1's own open question confirmed:
// used identically whether the slot came from a brand-new job, an ongoing job's reschedule,
// or a disruption-triggered recast (recast.ts calls this same function, never its own copy).
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

import { resolveActionForLevel, getDeviancePolicyRows, devianceLevelFor } from './deviancePolicy'
import { findAvailableCandidates } from './availability'
import { getZoneIdsForSectorName, getAdjoiningZones, getSectorNamesForZoneId, donorZoneHasSpareCapacity } from './zoneAdjacency'
import { getJobTierName } from './tierMapping'
import { DEVIANCE_WALK_ORDER } from './types'
import type { MatchResult, TaskLedgerRow, DeviancePolicyRow } from './types'

function matchScoreLabel(level: number): string {
  if (level === 0) return '100% Fit'
  if (level > 0) return `${100 + level * 5}% Fit`
  return `${100 + level * 15}% Match`
}

/**
 * Runs the full Phase C1-C5 process for one open Task Ledger slot. Writes every candidate
 * considered to match_log (selected: true/false), and on a real match, updates the slot row
 * itself (assigned_worker_id only when the policy action is AUTO_BOOK — an ASK_COORDINATOR
 * result is returned as pendingCoordinatorDecision and must be confirmed via
 * confirmDevianceMatch() before any worker is actually booked).
 */
export async function matchSlot(supabase: AnyClient, slotId: string): Promise<MatchResult> {
  const { data: slot, error: slotError } = await supabase
    .from('task_ledger')
    .select('*')
    .eq('slot_id', slotId)
    .maybeSingle()
  if (slotError) throw new Error(`matchSlot (slot): ${slotError.message}`)
  if (!slot) throw new Error(`matchSlot: slot ${slotId} not found`)
  const typedSlot = slot as TaskLedgerRow

  const { data: job, error: jobError } = await supabase
    .from('guest_enquiries')
    .select('zone')
    .eq('booking_ref', typedSlot.booking_ref)
    .maybeSingle()
  if (jobError) throw new Error(`matchSlot (job): ${jobError.message}`)
  const tier = await getJobTierName(supabase, typedSlot.booking_ref)

  const { data: tierRow, error: tierError } = await supabase
    .from('job_tier_master')
    .select('skill_floor')
    .eq('tier_name', tier)
    .maybeSingle()
  if (tierError) throw new Error(`matchSlot (tier): ${tierError.message}`)
  const skillFloor = tierRow?.skill_floor ?? 1

  const policyRows = await getDeviancePolicyRows(supabase, typedSlot.required_skill_code, tier)
  const shiftWindow = typedSlot.shift_window

  // C1-C3: own zone, full -3..+3 walk, negative side first.
  const ownZoneSectors = job?.zone ? [job.zone] : []
  const result = await tryZone(
    supabase, typedSlot, slotId, ownZoneSectors, skillFloor, policyRows, tier, shiftWindow, 'OWN_ZONE'
  )
  if (result) return result

  // C4: adjoining zones, donor-capacity-checked, confirmed mandatory not optional.
  if (job?.zone) {
    const fromZoneIds = await getZoneIdsForSectorName(supabase, job.zone)
    for (const fromZoneId of fromZoneIds) {
      const adjoiningZoneIds = await getAdjoiningZones(supabase, fromZoneId)
      for (const toZoneId of adjoiningZoneIds) {
        const donorSectors = await getSectorNamesForZoneId(supabase, toZoneId)
        if (donorSectors.length === 0) continue
        const hasSpare = await donorZoneHasSpareCapacity(supabase, {
          donorZoneSectorNames: donorSectors,
          trade: typedSlot.required_skill_code,
          targetDate: typedSlot.target_date,
        })
        if (!hasSpare) continue
        const adjResult = await tryZone(
          supabase, typedSlot, slotId, donorSectors, skillFloor, policyRows, tier, shiftWindow, 'ADJOINING_ZONE'
        )
        if (adjResult) return adjResult
      }
    }
  }

  // C5: genuine NO SUPPLY — logged, flagged, never silently dropped. Saviors is a deliberate
  // follow-up human action (fillSlotWithSavior), never auto-invoked here.
  await supabase
    .from('task_ledger')
    .update({
      match_score: '0% Match',
      compliance_check_status: 'NO SUPPLY',
      operational_action_trigger: 'ESCALATE_TO_ADMIN',
    })
    .eq('slot_id', slotId)

  return {
    outcome: 'NO_SUPPLY',
    operational_action_trigger: 'ESCALATE_TO_ADMIN',
    via: 'NONE',
  }
}

async function tryZone(
  supabase: AnyClient,
  slot: TaskLedgerRow,
  slotId: string,
  sectorNames: string[],
  skillFloor: number,
  policyRows: DeviancePolicyRow[],
  tier: string,
  shiftWindow: 'AM' | 'PM' | 'FULL_DAY',
  via: 'OWN_ZONE' | 'ADJOINING_ZONE'
): Promise<MatchResult | null> {
  if (sectorNames.length === 0) return null

  for (const level of DEVIANCE_WALK_ORDER) {
    const action = resolveActionForLevel(policyRows, slot.required_skill_code, tier, level)
    if (!action || action === 'NOT_ALLOWED') continue

    const requiredGrade = skillFloor + level
    const candidates = await findAvailableCandidates(supabase, {
      trade: slot.required_skill_code,
      zones: sectorNames,
      targetDate: slot.target_date,
      shiftWindow,
    })
    const atThisLevel = candidates.filter((c) => c.skill_grade === requiredGrade)
    if (atThisLevel.length === 0) continue

    // Log every candidate at this level considered — not just the winner.
    const winner = atThisLevel[0]
    for (const c of atThisLevel) {
      await supabase.from('match_log').insert({
        slot_id: slotId,
        candidate_worker_id: c.id,
        target_date: slot.target_date,
        skill_match_pct: matchScoreLabel(devianceLevelFor(c.skill_grade ?? requiredGrade, skillFloor)),
        deviance_level_applied: level,
        proficiency_ok: true,
        compliance_ok: true,
        selected: c.id === winner.id,
        decision_reason:
          c.id === winner.id
            ? `Selected at deviance ${level} (${via === 'OWN_ZONE' ? 'own zone' : 'adjoining zone'}), policy action ${action}.`
            : `Considered at deviance ${level}, not selected (first-eligible-wins).`,
      })
    }

    const matchScore = matchScoreLabel(level)
    const pendingCoordinatorDecision = action === 'ASK_COORDINATOR'
    await supabase
      .from('task_ledger')
      .update({
        assigned_worker_id: pendingCoordinatorDecision ? null : winner.id,
        match_score: matchScore,
        deviance_level_applied: level,
        compliance_check_status: 'COMPLIANT',
        operational_action_trigger: pendingCoordinatorDecision
          ? 'BUILD_UPSKILL_SUPERVISE'
          : shiftWindow === 'FULL_DAY'
            ? 'DISPATCH_FULL'
            : shiftWindow === 'AM'
              ? 'DISPATCH_AM'
              : 'DISPATCH_PM',
      })
      .eq('slot_id', slotId)

    return {
      outcome: 'MATCHED',
      assignedWorkerId: winner.id,
      deviance_level_applied: level,
      match_score: matchScore,
      compliance_check_status: 'COMPLIANT',
      operational_action_trigger: pendingCoordinatorDecision ? 'BUILD_UPSKILL_SUPERVISE' : 'DISPATCH_FULL',
      via,
      action,
      pendingCoordinatorDecision,
    }
  }
  return null
}

export type CandidateRow = {
  id: string
  full_name: string
  skill_grade: number | null
  deviance_level: number
  match_score: string
}

export type CandidateListResult = {
  via: 'OWN_ZONE' | 'ADJOINING_ZONE' | 'NONE'
  level: number | null
  candidates: CandidateRow[]
}

/**
 * The real "list to choose from" read: walks the exact same zone+deviance search as
 * matchSlot(), but stops at the FIRST level/zone that has ANY eligible worker and returns
 * every one of them (not just a silently-picked winner) -- own zone first, full -3..+3 order,
 * then adjoining zones (donor-capacity-checked) if own zone has nobody at any level. Writes
 * every candidate found to match_log (selected: false) for the same audit trail matchSlot()
 * keeps -- assignCandidateToSlot() below flips the chosen one to selected: true rather than
 * re-inserting. Makes no booking itself.
 */
export async function listCandidatesForSlot(supabase: AnyClient, slotId: string): Promise<CandidateListResult> {
  const { data: slot, error: slotError } = await supabase
    .from('task_ledger')
    .select('*')
    .eq('slot_id', slotId)
    .maybeSingle()
  if (slotError) throw new Error(`listCandidatesForSlot (slot): ${slotError.message}`)
  if (!slot) throw new Error(`listCandidatesForSlot: slot ${slotId} not found`)
  const typedSlot = slot as TaskLedgerRow

  const { data: job, error: jobError } = await supabase
    .from('guest_enquiries')
    .select('zone')
    .eq('booking_ref', typedSlot.booking_ref)
    .maybeSingle()
  if (jobError) throw new Error(`listCandidatesForSlot (job): ${jobError.message}`)
  const tier = await getJobTierName(supabase, typedSlot.booking_ref)

  const { data: tierRow, error: tierError } = await supabase
    .from('job_tier_master')
    .select('skill_floor')
    .eq('tier_name', tier)
    .maybeSingle()
  if (tierError) throw new Error(`listCandidatesForSlot (tier): ${tierError.message}`)
  const skillFloor = tierRow?.skill_floor ?? 1

  const policyRows = await getDeviancePolicyRows(supabase, typedSlot.required_skill_code, tier)
  const shiftWindow = typedSlot.shift_window

  const ownZoneSectors = job?.zone ? [job.zone] : []
  const ownResult = await listZone(
    supabase, typedSlot, slotId, ownZoneSectors, skillFloor, policyRows, tier, shiftWindow
  )
  if (ownResult) return { via: 'OWN_ZONE', ...ownResult }

  if (job?.zone) {
    const fromZoneIds = await getZoneIdsForSectorName(supabase, job.zone)
    for (const fromZoneId of fromZoneIds) {
      const adjoiningZoneIds = await getAdjoiningZones(supabase, fromZoneId)
      for (const toZoneId of adjoiningZoneIds) {
        const donorSectors = await getSectorNamesForZoneId(supabase, toZoneId)
        if (donorSectors.length === 0) continue
        const hasSpare = await donorZoneHasSpareCapacity(supabase, {
          donorZoneSectorNames: donorSectors,
          trade: typedSlot.required_skill_code,
          targetDate: typedSlot.target_date,
        })
        if (!hasSpare) continue
        const adjResult = await listZone(
          supabase, typedSlot, slotId, donorSectors, skillFloor, policyRows, tier, shiftWindow
        )
        if (adjResult) return { via: 'ADJOINING_ZONE', ...adjResult }
      }
    }
  }

  return { via: 'NONE', level: null, candidates: [] }
}

async function listZone(
  supabase: AnyClient,
  slot: TaskLedgerRow,
  slotId: string,
  sectorNames: string[],
  skillFloor: number,
  policyRows: DeviancePolicyRow[],
  tier: string,
  shiftWindow: 'AM' | 'PM' | 'FULL_DAY'
): Promise<{ level: number; candidates: CandidateRow[] } | null> {
  if (sectorNames.length === 0) return null

  for (const level of DEVIANCE_WALK_ORDER) {
    const action = resolveActionForLevel(policyRows, slot.required_skill_code, tier, level)
    if (!action || action === 'NOT_ALLOWED') continue

    const requiredGrade = skillFloor + level
    const candidates = await findAvailableCandidates(supabase, {
      trade: slot.required_skill_code,
      zones: sectorNames,
      targetDate: slot.target_date,
      shiftWindow,
    })
    const atThisLevel = candidates.filter((c) => c.skill_grade === requiredGrade)
    if (atThisLevel.length === 0) continue

    const matchScore = matchScoreLabel(level)
    for (const c of atThisLevel) {
      await supabase.from('match_log').insert({
        slot_id: slotId,
        candidate_worker_id: c.id,
        target_date: slot.target_date,
        skill_match_pct: matchScore,
        deviance_level_applied: level,
        proficiency_ok: true,
        compliance_ok: true,
        selected: false,
        decision_reason: `Listed at deviance ${level} for Coordinator selection.`,
      })
    }

    return {
      level,
      candidates: atThisLevel.map((c) => ({
        id: c.id,
        full_name: c.full_name,
        skill_grade: c.skill_grade,
        deviance_level: level,
        match_score: matchScore,
      })),
    }
  }
  return null
}

/**
 * Books whichever candidate the Coordinator actually picked from listCandidatesForSlot()'s
 * returned list -- the real "pick from the list" counterpart to confirmDevianceMatch() (which
 * confirms a single system-PROPOSED ASK_COORDINATOR substitute). Flips that candidate's own
 * match_log row to selected: true rather than inserting a duplicate; deviance != 0 is still
 * recorded in human_decision_log, same as confirmDevianceMatch(), since picking a non-0-level
 * substitute is a real human decision either way.
 */
export async function assignCandidateToSlot(
  supabase: AnyClient,
  params: { slotId: string; workerId: string; devianceLevel: number; matchScore: string; decidedByUserId: string; notes?: string }
): Promise<void> {
  const { data: slot, error: slotError } = await supabase
    .from('task_ledger')
    .select('shift_window')
    .eq('slot_id', params.slotId)
    .maybeSingle()
  if (slotError) throw new Error(`assignCandidateToSlot (slot): ${slotError.message}`)
  const shiftWindow: 'AM' | 'PM' | 'FULL_DAY' = slot?.shift_window ?? 'FULL_DAY'

  const { data: matchLogRow, error: matchLogError } = await supabase
    .from('match_log')
    .select('match_attempt_id')
    .eq('slot_id', params.slotId)
    .eq('candidate_worker_id', params.workerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (matchLogError) throw new Error(`assignCandidateToSlot (match_log select): ${matchLogError.message}`)

  if (matchLogRow) {
    const { error: flipError } = await supabase
      .from('match_log')
      .update({ selected: true, decision_reason: 'Selected by Coordinator from candidate list.' })
      .eq('match_attempt_id', matchLogRow.match_attempt_id)
    if (flipError) throw new Error(`assignCandidateToSlot (match_log update): ${flipError.message}`)
  }

  const { error: updateError } = await supabase
    .from('task_ledger')
    .update({
      assigned_worker_id: params.workerId,
      match_score: params.matchScore,
      deviance_level_applied: params.devianceLevel,
      compliance_check_status: 'COMPLIANT',
      operational_action_trigger:
        shiftWindow === 'FULL_DAY' ? 'DISPATCH_FULL' : shiftWindow === 'AM' ? 'DISPATCH_AM' : 'DISPATCH_PM',
    })
    .eq('slot_id', params.slotId)
  if (updateError) throw new Error(`assignCandidateToSlot (task_ledger): ${updateError.message}`)

  if (params.devianceLevel !== 0) {
    const { error: decisionError } = await supabase.from('human_decision_log').insert({
      decision_type: 'Deviance Acceptance',
      related_slot_id: params.slotId,
      related_match_attempt_id: matchLogRow?.match_attempt_id ?? null,
      decided_by: params.decidedByUserId,
      decision_value_notes: params.notes ?? `Deviance ${params.devianceLevel} substitute picked from candidate list.`,
    })
    if (decisionError) throw new Error(`assignCandidateToSlot (decision_log): ${decisionError.message}`)
  }
}

/**
 * Confirms an ASK_COORDINATOR match proposed by matchSlot(): actually books the worker, and
 * records the human decision — "recorded in Human Decision Log as a Deviance Acceptance,
 * linked by related_match_attempt_id to the exact Match Log row it approved."
 */
export async function confirmDevianceMatch(
  supabase: AnyClient,
  params: { slotId: string; workerId: string; decidedByUserId: string; notes?: string }
): Promise<void> {
  const { data: matchLogRow, error: matchLogError } = await supabase
    .from('match_log')
    .select('match_attempt_id')
    .eq('slot_id', params.slotId)
    .eq('candidate_worker_id', params.workerId)
    .eq('selected', true)
    .maybeSingle()
  if (matchLogError) throw new Error(`confirmDevianceMatch (match_log): ${matchLogError.message}`)

  const { error: updateError } = await supabase
    .from('task_ledger')
    .update({ assigned_worker_id: params.workerId, operational_action_trigger: 'DISPATCH_FULL' })
    .eq('slot_id', params.slotId)
  if (updateError) throw new Error(`confirmDevianceMatch (task_ledger): ${updateError.message}`)

  const { error: decisionError } = await supabase.from('human_decision_log').insert({
    decision_type: 'Deviance Acceptance',
    related_slot_id: params.slotId,
    related_match_attempt_id: matchLogRow?.match_attempt_id ?? null,
    decided_by: params.decidedByUserId,
    decision_value_notes: params.notes ?? 'Deviance substitute accepted by Coordinator.',
  })
  if (decisionError) throw new Error(`confirmDevianceMatch (decision_log): ${decisionError.message}`)
}
