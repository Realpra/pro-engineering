// Coordinator Dynamic Scheduling Engine — shared types.
// Mirrors Coordinator_Complete_Dynamic_Scheme.xlsx / The_DESIGN_DEPLOYMENT_flow document,
// mapped onto the live schema per CLAUDE.md's Session 70-continued-further entry.
// This codebase has no generated Supabase types (confirmed environmental baseline across every
// prior session), so these are hand-written to match the real migration's columns, not inferred.

export type DevianceAction = 'AUTO_BOOK' | 'ASK_COORDINATOR' | 'NOT_ALLOWED'

export interface DeviancePolicyRow {
  policy_id: string
  applies_to_trade: string
  applies_to_tier: string
  deviance_level: number
  action: DevianceAction
}

export interface JobTierRow {
  tier_id: string
  tier_name: string
  priority_rank: number
  skill_floor: number
}

export interface TaskLedgerRow {
  slot_id: string
  booking_ref: string
  substage_id: string | null
  client_name: string | null
  project_start_date: string | null
  day_index: string | null
  active_slot: string | null
  target_date: string
  shift_window: 'AM' | 'PM' | 'FULL_DAY'
  shift_start_time: string | null
  shift_end_time: string | null
  hours_weight: number | null
  required_skill_code: string
  min_proficiency_req: number
  headcount_needed: number
  slot_status: 'Pending' | 'Completed' | 'Cancelled_Delayed'
  assigned_worker_id: string | null
  filled_via_saviors_id: string | null
  match_score: string | null
  deviance_level_applied: number | null
  compliance_check_status: string | null
  operational_action_trigger: string | null
  origin: 'Planned' | 'Recast'
  recast_from_slot_id: string | null
  continuity_block_id: string | null
  notice_given_at: string | null
  within_notice_protocol: boolean | null
  recast_reason: string | null
}

// WORKER CANDIDATE — pulled directly from `workers`, the already-frozen Worker Master.
// skill_grade (0-5, new this build) is the real number the deviance walk compares against a
// job's own tier floor. skill_level stays untouched elsewhere; this engine never reads it.
export interface WorkerCandidate {
  id: string
  full_name: string
  trade: string
  skill_grade: number | null
  zones: string[] | null
  is_available: boolean | null
}

export interface MatchResult {
  outcome: 'MATCHED' | 'NO_SUPPLY'
  assignedWorkerId?: string
  deviance_level_applied?: number
  match_score?: string
  compliance_check_status?: string
  operational_action_trigger: string
  via: 'OWN_ZONE' | 'ADJOINING_ZONE' | 'SAVIORS' | 'NONE'
  action?: DevianceAction
  /** Set when action === 'ASK_COORDINATOR' — the match is proposed, not yet booked. */
  pendingCoordinatorDecision?: boolean
}

/** Confirmed 7 Oct 2026: negative (cheaper, lower-standard) side walked first and fully,
 *  then positive (over-qualified, costlier) side only as a last resort. See Phase C3 in
 *  the flow document and the migration's own Deviance Policy section comment. */
export const DEVIANCE_WALK_ORDER: number[] = [0, -1, -2, -3, 1, 2, 3]
