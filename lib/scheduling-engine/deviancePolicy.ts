// Phase C3 — the deviance ladder. Confirmed 7 Oct 2026: symmetric -3..+3, derived from the
// 0-5 worker skill-grade scale (1 = minimum onboarding admittance, Regular floor = 1, Premium
// floor = 3, Platinum floor = 4 — see Admin Policies 10B-i in the schema workbook). Walked
// negative-side-first and fully (cost economy), positive side only as a last resort.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

import { DEVIANCE_WALK_ORDER, type DeviancePolicyRow, type DevianceAction } from './types'

/** Fetches every Deviance Policy row relevant to a trade+tier, most-specific first. */
export async function getDeviancePolicyRows(
  supabase: AnyClient,
  trade: string,
  tier: string
): Promise<DeviancePolicyRow[]> {
  const { data, error } = await supabase
    .from('deviance_policy')
    .select('policy_id, applies_to_trade, applies_to_tier, deviance_level, action')
    .or(`applies_to_trade.eq.${trade},applies_to_trade.eq.ALL`)
    .or(`applies_to_tier.eq.${tier},applies_to_tier.eq.ALL`)
  if (error) throw new Error(`getDeviancePolicyRows: ${error.message}`)
  return (data ?? []) as DeviancePolicyRow[]
}

/**
 * Resolves the real action for one deviance level, preferring the most specific row
 * (exact trade + exact tier) over a trade-only, tier-only, or ALL/ALL match — same
 * specificity precedence the rest of this codebase's policy tables use (e.g.
 * compliance_policy's applies_to_trade fallback).
 */
export function resolveActionForLevel(
  rows: DeviancePolicyRow[],
  trade: string,
  tier: string,
  level: number
): DevianceAction | null {
  const candidates = rows.filter((r) => r.deviance_level === level)
  if (candidates.length === 0) return null
  const bySpecificity = (r: DeviancePolicyRow) => {
    const tradeMatch = r.applies_to_trade === trade
    const tierMatch = r.applies_to_tier === tier
    if (tradeMatch && tierMatch) return 0
    if (tradeMatch) return 1
    if (tierMatch) return 2
    return 3
  }
  candidates.sort((a, b) => bySpecificity(a) - bySpecificity(b))
  return candidates[0].action
}

/**
 * Walks the full -3..+3 ladder in the confirmed order (0, -1, -2, -3, then +1, +2, +3),
 * returning the first level whose actual worker grade would satisfy it AND whose policy
 * action is not NOT_ALLOWED. Does NOT pick a worker — callers combine this with a real
 * candidate-grade check per level (see match.ts).
 */
export function walkDevianceOrder(): number[] {
  return [...DEVIANCE_WALK_ORDER]
}

/** A candidate's grade vs. a job's tier floor, as a deviance level (positive = over-qualified). */
export function devianceLevelFor(candidateGrade: number, tierFloor: number): number {
  return candidateGrade - tierFloor
}
