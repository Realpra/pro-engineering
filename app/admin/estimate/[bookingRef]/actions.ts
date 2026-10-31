'use server'

import { createClient } from '@/lib/supabase/server'
import { logJobMovement } from '@/lib/jobMovementLog'
import { revalidatePath } from 'next/cache'

// ── processClientRemarks ───────────────────────────────────────────────────────

type ProcessDecision = {
  skuCode: string
  coordinatorAction: 'accepted' | 'declined' | 'deferred'
  originalClientAction?: 'accepted' | 'review_requested' | 'rejected'
  coordinatorRemark?: string
  newQty?: number
  newRate?: number
}

type ProcessResult = {
  error?: string
  success?: boolean
  newTotal?: number
  deferredCount?: number
  subEstimateCreated?: boolean
}

export async function processClientRemarks(
  bookingRef: string,
  boqId: string,
  decisions: ProcessDecision[],
): Promise<ProcessResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Fetch current boq_generated row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: boq, error: boqFetchErr } = await (supabase as any)
    .from('boq_generated')
    .select('*')
    .eq('id', boqId)
    .single()

  if (boqFetchErr) return { error: (boqFetchErr as { message: string }).message }
  if (!boq) return { error: 'BOQ not found' }

  // 2. Fetch latest unprocessed client response so we can mark it processed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clientResponse } = await (supabase as any)
    .from('estimate_client_responses')
    .select('id')
    .eq('boq_id', boqId)
    .eq('coordinator_processed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Apply decisions to line items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyItem = Record<string, any>
  let lineItems: AnyItem[] = [...((boq.line_items ?? []) as AnyItem[])]
  const deferredItems: AnyItem[] = [...((boq.deferred_items ?? []) as AnyItem[])]

  for (const decision of decisions) {
    if (decision.coordinatorAction === 'accepted') {
      const hasNewValues = decision.newQty != null || decision.newRate != null
      if (hasNewValues) {
        lineItems = lineItems.map((item) => {
          if (item.skuCode !== decision.skuCode) return item
          const newQty = decision.newQty ?? item.quantity
          const newRate = decision.newRate ?? item.rate
          return { ...item, quantity: newQty, rate: newRate, amount: round2(newQty * newRate) }
        })
      } else if (decision.originalClientAction === 'rejected') {
        // Client wanted the item removed entirely and coordinator accepted that — defer it
        const idx = lineItems.findIndex((i) => i.skuCode === decision.skuCode)
        if (idx !== -1) {
          const [removed] = lineItems.splice(idx, 1)
          deferredItems.push({
            ...removed,
            coordinatorRemark: decision.coordinatorRemark ?? null,
          })
        }
      }
      // else: review_requested + accepted + no new values → item stays unchanged in line_items
    } else if (decision.coordinatorAction === 'declined') {
      // Keep item, attach coordinator notes to the line item object
      lineItems = lineItems.map((item) => {
        if (item.skuCode !== decision.skuCode) return item
        return { ...item, coordinatorNotes: decision.coordinatorRemark ?? '' }
      })
    } else if (decision.coordinatorAction === 'deferred') {
      const idx = lineItems.findIndex((i) => i.skuCode === decision.skuCode)
      if (idx !== -1) {
        const [removed] = lineItems.splice(idx, 1)
        deferredItems.push({
          ...removed,
          coordinatorRemark: decision.coordinatorRemark ?? null,
        })
      }
    }
  }

  // 4. Recompute subtotals — filter by skuCode prefix so risk flags are
  //    excluded from labour/material buckets and counted separately.
  const platformPremiumPct = Number(boq.platform_premium_pct ?? 12)
  const bocwCessPct        = Number(boq.bocw_cess_percent   ?? 1)
  const contingencyPct     = Number(boq.contingency_percent  ?? 0)

  const subtotalLabour = round2(
    lineItems
      .filter((i) => !i.isRiskFlag && String(i.skuCode ?? '').startsWith('LAB-'))
      .reduce((s, i) => s + (Number(i.amount) || 0), 0)
  )
  const subtotalMaterial = round2(
    lineItems
      .filter((i) => !i.isRiskFlag && String(i.skuCode ?? '').startsWith('MAT-'))
      .reduce((s, i) => s + (Number(i.amount) || 0), 0)
  )
  const subtotalRiskRemaining = round2(
    lineItems
      .filter((i) => i.isRiskFlag)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0)
  )

  // 5. Recompute deferred totals
  const deferredValue = round2(deferredItems.reduce((s, i) => s + (Number(i.amount) || 0), 0))
  const coreTotal = subtotalLabour + subtotalMaterial
  const deferredPct =
    coreTotal + deferredValue > 0
      ? round2((deferredValue / (coreTotal + deferredValue)) * 100)
      : 0

  // 6. Recompute total_amount using stored rate percentages (never hardcode)
  const platformPremium   = round2((subtotalLabour + subtotalMaterial) * (platformPremiumPct / 100))
  const bocwCessAmount    = round2(subtotalLabour * (bocwCessPct / 100))
  const gstAmount         = round2(platformPremium * 0.18)
  const contingencyAmount = round2((subtotalLabour + subtotalMaterial) * (contingencyPct / 100))
  const totalAmount = round2(
    subtotalLabour + subtotalMaterial + subtotalRiskRemaining +
    platformPremium + bocwCessAmount + gstAmount + contingencyAmount
  )

  // 7. Increment estimate version (null → 1.0, 1.0 → 2.0, etc.)
  const currentVersion = Number(boq.estimate_version ?? 0)
  const newVersion = round2(currentVersion === 0 ? 1.0 : currentVersion + 1.0)
  const newVersionLabel = `v${newVersion.toFixed(1)}`

  // 8. If deferred_pct > 25: create a sub-estimate row for the deferred items
  let subEstimateId: string | null = null
  let subEstimateCreated = false

  if (deferredPct > 25 && deferredItems.length > 0) {
    const subLabour = round2(
      deferredItems
        .filter((i) => !i.isRiskFlag && String(i.skuCode ?? '').startsWith('LAB-'))
        .reduce((s, i) => s + (Number(i.amount) || 0), 0)
    )
    const subMaterial = round2(
      deferredItems
        .filter((i) => !i.isRiskFlag && String(i.skuCode ?? '').startsWith('MAT-'))
        .reduce((s, i) => s + (Number(i.amount) || 0), 0)
    )
    const subRisk = round2(
      deferredItems
        .filter((i) => i.isRiskFlag)
        .reduce((s, i) => s + (Number(i.amount) || 0), 0)
    )
    const subPlatformFee = round2((subLabour + subMaterial) * (platformPremiumPct / 100))
    const subBocwCess    = round2(subLabour * (bocwCessPct / 100))
    const subGst         = round2(subPlatformFee * 0.18)
    const subTotal       = round2(subLabour + subMaterial + subRisk + subPlatformFee + subBocwCess + subGst)
    const subBookingRef = `${bookingRef}-deferred`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subBoq, error: subErr } = await (supabase as any)
      .from('boq_generated')
      .upsert(
        {
          booking_ref:             subBookingRef,
          report_id:               boq.report_id,
          version:                 1,
          tier:                    boq.tier,
          job_card_type:           boq.job_card_type,
          estimate_kind:           'sub_estimate',
          parent_estimate_id:      boqId,
          status:                  'draft',
          line_items:              deferredItems.map((i) => ({
            ...i,
            coordinatorRemark: undefined,
            coordinatorNotes: undefined,
          })),
          risk_flag_items:         [],
          deferred_items:          [],
          deferred_value:          0,
          deferred_pct:            0,
          subtotal_labour:         subLabour,
          subtotal_material:       subMaterial,
          subtotal_risk_flags:     subRisk,
          platform_premium_pct:    platformPremiumPct,
          platform_premium_amount: subPlatformFee,
          bocw_cess_percent:       bocwCessPct,
          bocw_cess_amount:        subBocwCess,
          gst_percent:             18,
          gst_amount:              subGst,
          contingency_percent:     0,
          contingency_amount:      0,
          total_amount:            subTotal,
          estimate_version:        1.0,
          estimate_version_label:  'v1.0',
          valid_until:             new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          updated_at:              new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: 'booking_ref' }
      )
      .select('id')
      .single()

    if (subErr) return { error: (subErr as { message: string }).message }
    subEstimateId = (subBoq as { id: string }).id
    subEstimateCreated = true
  }

  // 9. Update parent boq_generated row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    line_items:              lineItems,
    deferred_items:          deferredItems,
    deferred_value:          deferredValue,
    deferred_pct:            deferredPct,
    subtotal_labour:         subtotalLabour,
    subtotal_material:       subtotalMaterial,
    subtotal_risk_flags:     subtotalRiskRemaining,
    platform_premium_amount: platformPremium,
    bocw_cess_amount:        bocwCessAmount,
    gst_amount:              gstAmount,
    contingency_amount:      contingencyAmount,
    total_amount:            totalAmount,
    estimate_version:        newVersion,
    estimate_version_label:  newVersionLabel,
    status:                  'draft',
    updated_at:              new Date().toISOString(),
  }
  if (subEstimateId) updatePayload.sub_estimate_id = subEstimateId

  console.log('[processClientRemarks] boqId:', boqId)
  console.log('[processClientRemarks] updatePayload:', JSON.stringify(updatePayload, null, 2))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updateData, error: updateErr } = await (supabase as any)
    .from('boq_generated')
    .update(updatePayload)
    .eq('id', boqId)
    .select()

  console.log('[processClientRemarks] supabase response - error:', updateErr, 'data:', JSON.stringify(updateData))
  console.log('[processClientRemarks] rows affected:', updateData?.length ?? 0)

  if (updateErr) return { error: (updateErr as { message: string }).message }

  // 10. Mark the client response as coordinator-processed
  if (clientResponse?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('estimate_client_responses')
      .update({
        coordinator_processed:    true,
        coordinator_processed_at: new Date().toISOString(),
        item_decisions:           decisions,
      })
      .eq('id', clientResponse.id)
  }

  return {
    success:           true,
    newTotal:          totalAmount,
    deferredCount:     deferredItems.length,
    subEstimateCreated,
  }
}

// ── Estimate types ─────────────────────────────────────────────────────────────

type LineItem = {
  id: string
  activityCode: string
  activityName: string
  unit: string
  quantity: number
  rate: number
  amount: number
  isRiskFlag: boolean
  isSupervision: boolean
  editReason: string
}

type EstimateTotals = {
  subtotalLabour: number
  subtotalMaterial: number
  subtotalRiskFlags: number
  platformPremiumPct: number
  platformFee: number
  bocwCess: number
  gstAmount: number
  contingencyPct: number
  contingencyAmount: number
  discountPct: number
  discountAmount: number
  totalAmount: number
}

// ── BOQ types ──────────────────────────────────────────────────────────────────

export type BOQLineItem = {
  skuCode: string
  skuName: string
  description: string | null
  category: 'labour' | 'material' | 'risk'
  sectionName: string | null
  unit: string
  quantity: number
  wastageMultiplier: number
  rate: number
  amount: number
  isRiskFlag: boolean
  missingRate: boolean
}

type SkuRow = {
  sku_code: string
  sku_name: string
  description: string | null
  category: string
  lab_item_code: string | null
  unit: string
  sequence_order: number
  cascade_flag: string | null
  wastage_multiplier: number | string
  quantity_formula: string | null
  job_type: string | null
  item_type: string | null
  rate_budget: number | null
  rate_premium: number | null
  rate_luxury: number | null
  is_mandatory: boolean | null
  job_card_type: string | null
}

type RuleRow = {
  sku_code: string
  formula_expression: string
  scope_conditions: string | null
}

type RiskFlagDecision = {
  description: string
  selectedRemedy: string | null
  clientAcceptsRisk: boolean
}

// ── BOQ helpers ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function evalFormula(formula: string, vars: Record<string, number>): number {
  try {
    if (formula === '1') return 1
    // Replace variable names longest-first to avoid partial replacements
    // (e.g. 'totalWallArea' before 'wallArea')
    const sorted = Object.entries(vars).sort((a, b) => b[0].length - a[0].length)
    let expr = formula
    for (const [key, val] of sorted) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val))
    }
    // eslint-disable-next-line no-eval
    const result = Number(eval(expr))
    return isFinite(result) && result > 0 ? result : 0
  } catch {
    return 0
  }
}

// Evaluates the scope_conditions TEXT from calculation_rules_engine against the
// booking's scopeIntent (screen02_scope_intent).
// Condition strings contain a field key and an allowed-values list, e.g.:
//   "tilesScope: replace-all, replace-floor-only"
//   "plumbingScope: reroute"
// null / empty / 'Always included' → always include.
function checkScopeConditions(
  condition: string | null | undefined,
  scopeIntent: Record<string, string>,
): boolean {
  if (!condition || condition.trim() === '' || /always included/i.test(condition)) return true

  const SCOPE_FIELDS = ['tilesScope', 'plumbingScope', 'electricalScope', 'fixturesScope', 'geyserScope'] as const

  for (const field of SCOPE_FIELDS) {
    if (!condition.includes(field)) continue
    // Extract everything after "fieldName:" up to the next newline or end
    const match = condition.match(new RegExp(`${field}\\s*:\\s*([^\\n]+)`))
    if (!match) return true
    const allowed = match[1].split(',').map(s => s.trim()).filter(Boolean)
    const actual  = scopeIntent[field] ?? ''
    return allowed.includes(actual)
  }

  // No recognised scope field found — default include
  return true
}

// Maps boq_sku_catalogue.lab_item_code → rate_card.activity_code.
// The rate_card uses short codes; the catalogue uses internal LAB-* codes.
const LAB_TO_RATE_CODE: Record<string, string> = {
  'LAB-ISO-01': 'ISO-LUMP',
  'LAB-DEM-01': 'DEM-FL',
  'LAB-DEM-02': 'DEM-WL',
  'LAB-MUK-01': 'MUK-LUMP',
  'LAB-CLR-01': 'CLR-LUMP',
  'LAB-CHZ-01': 'CHZ-RFT',
  'LAB-PLS-01': 'PLS-WL',
  'LAB-SCR-01': 'SCR-FL',
  'LAB-WPF-01': 'WPF',
  'LAB-PND-01': 'PND-LUMP',
  'LAB-TIL-01': 'TIL-WL',
  'LAB-TIL-02': 'TIL-FL',
  'LAB-WST-01': 'WST-LUMP',
  'LAB-GRT-01': 'GRT',
  'LAB-PLM-01': 'PLB-RFT',
  'LAB-TST-01': 'TST-LUMP',
  'LAB-DRN-01': 'DRN-UNIT',
  'LAB-ELE-01': 'ELE-PT-LAB',
  'LAB-SAN-01': 'FIX-FT',
  'LAB-SAN-02': 'FIX-FT',
  'LAB-PLM-02': 'FIX-FT',
  'LAB-APP-01': 'FIX-FT',
  'LAB-PNT-01': 'PNT-SQFT',
  'LAB-SLN-01': 'SLN-LUMP',
  'LAB-CLN-01': 'CLN-LUMP',
  'LAB-SUP-01': 'SUP-DY',
  'LAB-VTC-01': 'VTC-LUMP',
  'MAT-WPF-01': 'WPF',
  'MAT-TIL-FL': 'TIL-FL',
  'MAT-TIL-WL': 'TIL-WL',
  'MAT-ADH-FL': 'TIL-FL',
  'MAT-ADH-WL': 'TIL-WL',
  'MAT-GRT-01': 'GRT',
  'MAT-PPE-01': 'MAT-PPE-JOB',
  'MAT-PPE-02': 'MAT-PPE-DRAIN',
  'MAT-ELE-01': 'MAT-ELE-PT',
  'MAT-PNT-01': 'MAT-PNT-LUMP',
  'MAT-SLN-01': 'MAT-SLN-LUMP',
}

export async function saveEstimate(
  bookingRef: string,
  tier: string,
  jobCardType: string,
  lineItems: LineItem[],
  totals: EstimateTotals,
  notes: string,
): Promise<{ error?: string; boqId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('boq_generated')
    .update({
      line_items:              lineItems,
      subtotal_labour:         totals.subtotalLabour,
      subtotal_material:       totals.subtotalMaterial,
      subtotal_risk_flags:     totals.subtotalRiskFlags,
      platform_premium_pct:    totals.platformPremiumPct,
      platform_premium_amount: totals.platformFee,
      bocw_cess_amount:        totals.bocwCess,
      gst_amount:              totals.gstAmount,
      contingency_percent:     totals.contingencyPct,
      contingency_amount:      totals.contingencyAmount,
      total_amount:            totals.totalAmount,
      coordinator_notes:       notes || null,
      tier,
      status:                  'draft',
      updated_at:              new Date().toISOString(),
    })
    .eq('booking_ref', bookingRef)

  if (error) return { error: (error as { message: string }).message }
  return {}
}

export async function sendForAdminApproval(
  bookingRef: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('boq_generated')
    .update({ status: 'admin_review', updated_at: now })
    .eq('booking_ref', bookingRef)
    .eq('status', 'draft')

  if (error) return { error: (error as { message: string }).message }
  await logJobMovement(supabase, { bookingRef, stage: 'estimate', action: 'forwarded', itemType: 'boq_generated', toRole: 'admin' })
  return {}
}

export async function sendToClient(
  bookingRef: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const [boqResult, enquiryResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('boq_generated')
      .update({ status: 'sent_to_client', sent_to_client_at: now, updated_at: now })
      .eq('booking_ref', bookingRef),
    supabase
      .from('guest_enquiries')
      .update({ status: 'estimate_sent' })
      .eq('booking_ref', bookingRef),
  ])

  if (boqResult.error) return { error: (boqResult.error as { message: string }).message }
  if (enquiryResult.error) return { error: (enquiryResult.error as { message: string }).message }
  await logJobMovement(supabase, { bookingRef, stage: 'estimate', action: 'approved', itemType: 'boq_generated', toRole: 'client' })
  return {}
}

// ── getPolicyRate ──────────────────────────────────────────────────────────────

export async function getPolicyRate(
  vertical: string,
  jobCategory: string,
  tier: string,
): Promise<{
  premiumPct: number
  minDeviationPct: number
  maxDeviationPct: number
  allowedMin: number
  allowedMax: number
  contingencyMax: number
  adminApprovalLimit: number
}> {
  const supabase = await createClient()

  const [premiumResult, contingencyResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('platform_premium_policy')
      .select('premium_pct, min_deviation_pct, max_deviation_pct')
      .eq('vertical', vertical)
      .eq('job_category', jobCategory)
      .eq('tier', tier)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('contingency_policy')
      .select('max_contingency_pct, admin_approval_limit_pct')
      .eq('vertical', vertical)
      .eq('job_category', jobCategory)
      .eq('tier', tier)
      .maybeSingle(),
  ])

  const premiumPct      = Number(premiumResult.data?.premium_pct ?? 12)
  const minDeviationPct = Number(premiumResult.data?.min_deviation_pct ?? -5)
  const maxDeviationPct = Number(premiumResult.data?.max_deviation_pct ?? 10)

  return {
    premiumPct,
    minDeviationPct,
    maxDeviationPct,
    allowedMin:          premiumPct + minDeviationPct,
    allowedMax:          premiumPct + maxDeviationPct,
    contingencyMax:      Number(contingencyResult.data?.max_contingency_pct ?? 5),
    adminApprovalLimit:  Number(contingencyResult.data?.admin_approval_limit_pct ?? 10),
  }
}

// ── requestPremiumApproval ─────────────────────────────────────────────────────

export async function requestPremiumApproval(
  bookingRef: string,
  boqId: string,
  requestedPct: number,
  policyPct: number,
  boqTotal: number,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('premium_approval_requests')
    .select('id, status')
    .eq('booking_ref', bookingRef)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'An approval request is already pending for this booking.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('premium_approval_requests')
    .insert({
      booking_ref:   bookingRef,
      boq_id:        boqId,
      requested_pct: requestedPct,
      policy_pct:    policyPct,
      boq_total:     boqTotal,
      reason,
      status:        'pending',
      requested_by:  user.id,
    })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── generateBOQ ────────────────────────────────────────────────────────────────
//
// Reads the approved scope report for a booking, evaluates each SKU from
// boq_sku_catalogue using the formula in calculation_rules_engine, prices
// each line item from rate_card (zone-specific with 'default' fallback),
// writes the result to boq_generated, and calls writeMilestoneSchedule to
// insert fresh milestone_payment_schedule rows based on job_card_type.
//
// Parameters
//   tier        – 'standard' | 'premium'
//   jobCardType – 'bathroom' | 'kitchen' | 'general'
//
// Returns the boq_generated.id on success.
// ---------------------------------------------------------------------------

export type BOQResult = {
  error?: string
  boqId?: string
  lineItems?: BOQLineItem[]
  subtotalLabour?: number
  subtotalMaterial?: number
  platformFee?: number
  bocwCess?: number
  gstAmount?: number
  totalAmount?: number
}

export async function generateBOQ(
  bookingRef: string,
  tier: string,
  jobCardType: string,
): Promise<BOQResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email!)
    .single()

  console.log('[generateBOQ] START', { bookingRef, tier, jobCardType })

  // ── 1. Fetch scope report screens ────────────────────────────────────────────
  const { data: report, error: reportErr } = await supabase
    .from('site_visit_reports')
    .select('id, screen02_scope_intent, screen14_measurements, screen07_electrical, screen12_logistics, screen16_timeline, screen17_risk_decisions')
    .eq('booking_ref', bookingRef)
    // report_type discriminates Flow (i) Site Survey from Flow (ii) Daily
    // Execution Visit -- both flows can reach status 'submitted'/'admin_review'
    // on the same booking_ref, and the column names below only carry the
    // structured scope/measurement/risk data this function expects when the
    // row is a Site Survey (see 20260927_site_visit_reports_flow_discriminator.sql).
    .eq('report_type', 'site_survey')
    .in('status', ['submitted', 'admin_review'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (reportErr) return { error: reportErr.message }
  if (!report) return { error: 'No submitted scope report found for this booking' }

  const r = report as Record<string, unknown>

  console.log('[generateBOQ] 1. report:', {
    id: r.id,
    screen02_scope_intent:  r.screen02_scope_intent,
    screen14_measurements:  r.screen14_measurements,
    screen16_timeline:      r.screen16_timeline,
    screen07_electrical:    r.screen07_electrical,
  })

  // ── 2. Fetch BOQ SKU catalogue ───────────────────────────────────────────────
  const { data: skus, error: skuErr } = await supabase
    .from('boq_sku_catalogue')
    .select('sku_code, sku_name, description, category, lab_item_code, unit, sequence_order, cascade_flag, wastage_multiplier, quantity_formula, job_type, item_type, rate_budget, rate_premium, rate_luxury, is_mandatory, job_card_type')
    .eq('is_active', true)
    .eq('job_type', 'bathroom-renovation')
    .order('sequence_order', { ascending: true })

  console.log('[generateBOQ] 2. SKUs fetched:', skus?.length ?? 0, 'error:', skuErr?.message)

  if (skuErr) return { error: skuErr.message }

  // ── 3. Fetch calculation rules ───────────────────────────────────────────────
  const { data: rules, error: rulesErr } = await supabase
    .from('calculation_rules_engine')
    .select('sku_code, formula_expression, scope_conditions')
    .eq('job_type', 'bathroom-renovation')

  console.log('[generateBOQ] 3. Rules fetched:', rules?.length ?? 0, 'error:', rulesErr?.message)

  console.log('[generateBOQ] rules fetch result: count:', rules?.length ?? 0, 'error:', rulesErr?.message ?? 'none')
  if (rulesErr) return { error: rulesErr.message }

  const ruleMap: Record<string, { formula: string; scopeConditions: string | null }> = {}
  for (const rule of (rules ?? []) as RuleRow[]) {
    ruleMap[rule.sku_code] = {
      formula:         rule.formula_expression,
      scopeConditions: rule.scope_conditions ?? null,
    }
  }

  // ── 4. Fetch rate_card for job zone (with fuzzy + 'default' fallback) ─────────
  const { data: job } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, zone, district, job_type')
    .eq('booking_ref', bookingRef)
    .single()

  console.log('[generateBOQ] zone from job:', job?.zone, 'district:', job?.district)

  // ── 4b. Fetch platform premium rate from policy ───────────────────────────────
  const jcMap: Record<string, string> = { L: 'labour-only', M: 'material-supply', LM: 'turnkey' }
  const policyJobCat = jcMap[jobCardType] ?? 'labour-only'
  const policyVertical = job?.job_type ?? 'civil-engineering'

  let policyPremiumPct = 12
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: policyRow } = await (supabase as any)
      .from('platform_premium_policy')
      .select('premium_pct')
      .eq('vertical', policyVertical)
      .eq('job_category', policyJobCat)
      .eq('tier', tier)
      .maybeSingle()
    if (policyRow?.premium_pct != null) {
      policyPremiumPct = Number(policyRow.premium_pct)
    }
  } catch (e) {
    console.log('[generateBOQ] policy lookup failed, using default 12%:', (e as Error).message)
  }

  console.log('[generateBOQ] policy premium pct:', policyPremiumPct, 'for', policyVertical, policyJobCat, tier)

  const zoneName = job?.zone ?? 'Noida Sector 62'
  let finalGeoId = '66666666-0000-0000-0000-000000000001'
  const { data: geoRow } = await supabase
    .from('geo_hierarchy')
    .select('id')
    .eq('name', zoneName)
    .eq('level', 'sector')
    .maybeSingle()
  if (geoRow?.id) finalGeoId = geoRow.id
  console.log('[generateBOQ] 4. finalGeoId:', finalGeoId, 'for zone:', zoneName)

  const rateMap: Record<string, number> = {}
  try {
    const { data: rates, error: ratesErr } = await supabase
      .from('rate_card')
      .select('activity_code, base_rate')
      .eq('geo_id', finalGeoId)
      .eq('is_active', true)

    console.log('[generateBOQ] rate_card query: geo_id:', finalGeoId, 'rows:', rates?.length ?? 0, 'error:', ratesErr?.message)

    if (rates && rates.length > 0) {
      for (const r of rates) {
        rateMap[r.activity_code] = Number(r.base_rate ?? 0)
      }
      console.log('[generateBOQ] rateMap from DB:', Object.keys(rateMap).length, 'keys:', Object.keys(rateMap).join(', '))
    } else {
      console.log('[generateBOQ] rate_card returned no rows — falling back to hardcoded rateMap')
      Object.assign(rateMap, {
        'DEM-FL': 35, 'DEM-WL': 28, 'WPF': 130, 'SCR-FL': 45,
        'TIL-FL': 185, 'TIL-WL': 165, 'TIL-LF': 220, 'PLS-WL': 38,
        'GRT': 25, 'PLB-RRT': 6400, 'ELC-PT': 1800, 'FIX-FT': 2200,
        'SUP-DY': 1100, 'PLB-RFT': 75, 'ELE-PT-LAB': 250, 'PNT-SQFT': 18,
        'SLN-LUMP': 650, 'CLN-LUMP': 800, 'ISO-LUMP': 500, 'CLR-LUMP': 1200,
        'MUK-LUMP': 1500, 'CHZ-RFT': 20, 'PND-LUMP': 500, 'WST-LUMP': 800,
        'TST-LUMP': 600, 'DRN-UNIT': 500, 'VTC-LUMP': 0,
        'MAT-PPE-JOB': 6400, 'MAT-PPE-DRAIN': 1500, 'MAT-ELE-PT': 180,
        'MAT-PNT-LUMP': 450, 'MAT-SLN-LUMP': 250,
      })
    }
  } catch (e) {
    console.log('[generateBOQ] rate_card query threw:', (e as Error).message)
  }

  // ── 5. Build measurement variable map for formula evaluation ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const measurements = (r.screen14_measurements as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const electrical   = (r.screen07_electrical   as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeline     = (r.screen16_timeline     as any) ?? {}
  const newPoints    = electrical.newPoints ?? {}
  const scopeIntent  = (r.screen02_scope_intent as Record<string, string> | null) ?? {}

  const _elecTotal = (newPoints.exhaust ?? 0) + (newPoints.socket ?? 0) + (newPoints.geyser ?? 0) + (newPoints.light ?? 0)

  const vars: Record<string, number> = {
    // camelCase (from screen14)
    floorArea:            Number(measurements.floorArea         ?? 0),
    totalWallArea:        Number(measurements.totalWallArea      ?? 0),
    bathroomLength:       Number(measurements.bathroomLength     ?? 0),
    bathroomWidth:        Number(measurements.bathroomWidth      ?? 0),
    ceilingArea:          Number(measurements.ceilingArea        ?? measurements.floorArea ?? 0),
    totalCalendarDays:    Number(timeline.totalCalendarDays      ?? 15),
    newExhaustPoints:     Number(newPoints.exhaust  ?? 0),
    newSocketPoints:      Number(newPoints.socket   ?? 0),
    newGeyserPoints:      Number(newPoints.geyser   ?? 0),
    newLightPoints:       Number(newPoints.light    ?? 0),
    electricalPoints:     Number(_elecTotal),
    newPointsTotal:       Number(_elecTotal),
    // snake_case aliases (used by calculation_rules_engine formulas)
    floor_area:           Number(measurements.floorArea         ?? 0),
    total_wall_area:      Number(measurements.totalWallArea      ?? 0),
    bathroom_length:      Number(measurements.bathroomLength     ?? 0),
    bathroom_width:       Number(measurements.bathroomWidth      ?? 0),
    ceiling_area:         Number(measurements.ceilingArea        ?? measurements.floorArea ?? 0),
    total_calendar_days:  Number(timeline.totalCalendarDays      ?? 15),
    new_exhaust_points:   Number(newPoints.exhaust  ?? 0),
    new_socket_points:    Number(newPoints.socket   ?? 0),
    new_geyser_points:    Number(newPoints.geyser   ?? 0),
    new_light_points:     Number(newPoints.light    ?? 0),
    electrical_points:    Number(_elecTotal),
    perimeter:            Number(((measurements.bathroomLength ?? 0) + (measurements.bathroomWidth ?? 0)) * 2),
  }

  console.log('[generateBOQ] 5. vars:', vars)
  console.log('[generateBOQ] 5. scopeIntent:', scopeIntent)
  console.log('[generateBOQ] 5. raw screen14 keys:', Object.keys(measurements))

  // ── 6. Evaluate each SKU → line items ────────────────────────────────────────
  const lineItems: BOQLineItem[] = []

  for (const [idx, sku] of ((skus ?? []) as SkuRow[]).entries()) {
    if (jobCardType === 'L' && !sku.sku_code.startsWith('LAB-')) continue
    if (jobCardType === 'M' && !sku.sku_code.startsWith('MAT-')) continue
    const rule            = ruleMap[sku.sku_code]
    const formula         = rule?.formula ?? sku.quantity_formula ?? ''
    const scopeConditions = rule?.scopeConditions ?? null
    const scopePass       = checkScopeConditions(scopeConditions, scopeIntent)

    const baseQty = formula ? evalFormula(formula, vars) : 0

    const wastage  = Number(sku.wastage_multiplier) || 1
    const quantity = round2(baseQty * wastage)

    const rateCode = LAB_TO_RATE_CODE[sku.lab_item_code ?? ''] ?? sku.lab_item_code ?? ''
    const rate     = rateMap[rateCode] ?? rateMap[sku.sku_code] ?? rateMap[sku.lab_item_code ?? ''] ?? 0
    const amount   = round2(quantity * rate)

    if (idx < 5) console.log('[generateBOQ] 6. SKU:', sku.sku_code, { scopePass, formula, baseQty, rate, amount })
    if (idx < 5) console.log('[generateBOQ] rate lookup:', sku.lab_item_code, '→ rateCode:', rateCode, '→ rate:', rate)
    console.log('[generateBOQ] rate check:', sku.lab_item_code, '→', LAB_TO_RATE_CODE[sku.lab_item_code ?? ''], '→', rateMap[LAB_TO_RATE_CODE[sku.lab_item_code ?? ''] ?? ''])

    if (!scopePass) continue
    if (!formula) continue
    if (baseQty <= 0) continue

    const isRiskFlagItem = sku.item_type === 'risk' || sku.category === 'risk'

    lineItems.push({
      skuCode:           sku.sku_code,
      skuName:           sku.sku_name || sku.sku_code,
      description:       sku.description ?? null,
      // category: copied from boq_sku_catalogue.item_type
      // values: 'labour' | 'material' | 'risk'
      // sectionName: for client dashboard grouping by section
      // NOTE: existing BOQs generated before this fix have category: null
      // they display correctly in 5A via the !isRiskFlag filter
      category:          (isRiskFlagItem ? 'risk' : (sku.item_type ?? sku.category ?? 'labour')) as 'labour' | 'material' | 'risk',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sectionName:       (sku as any).section_name ?? null,
      unit:              sku.unit,
      quantity,
      wastageMultiplier: wastage,
      rate,
      amount,
      isRiskFlag:        isRiskFlagItem,
      missingRate:       rate === 0,
    })
  }

  console.log('[generateBOQ] 6. lineItems built:', lineItems.length, lineItems.map(i => i.skuCode))

  // ── 7. Add risk flag items where client chose to proceed (not accepts risk) ───
  // screen17_risk_decisions.flags[].clientAcceptsRisk = true means NO remediation.
  // selectedRemedy contains a cost string like "Rs 4500" when work is to be done.
  const riskDecisions = (r.screen17_risk_decisions as { flags?: RiskFlagDecision[] } | null) ?? {}
  ;(riskDecisions.flags ?? []).forEach((flag, idx) => {
    if (flag.clientAcceptsRisk || !flag.selectedRemedy) return
    const match = flag.selectedRemedy.match(/Rs\s*([\d,]+)/)
    if (!match) return
    const cost = parseFloat(match[1].replace(/,/g, ''))
    if (!cost || isNaN(cost)) return
    lineItems.push({
      skuCode:           `RISK-${idx}`,
      skuName:           flag.description,
      description:       null,
      // category: copied from boq_sku_catalogue.item_type
      // values: 'labour' | 'material' | 'risk'
      // sectionName: for client dashboard grouping by section
      // NOTE: existing BOQs generated before this fix have category: null
      // they display correctly in 5A via the !isRiskFlag filter
      category:          'risk',
      sectionName:       null,
      unit:              'lumpsum',
      quantity:          1,
      wastageMultiplier: 1,
      rate:              cost,
      amount:            cost,
      isRiskFlag:        true,
      missingRate:       false,
    })
  })

  // ── 8. Compute totals ─────────────────────────────────────────────────────────
  const riskItems         = lineItems.filter(i => i.isRiskFlag)
  const subtotalRiskFlags = round2(riskItems.reduce((s, i) => s + i.amount, 0))
  const subtotalLabour = round2(
    lineItems.filter(i => !i.isRiskFlag && i.skuCode.startsWith('LAB-')).reduce((s, i) => s + i.amount, 0)
  )
  const subtotalMaterial = round2(
    lineItems.filter(i => !i.isRiskFlag && i.skuCode.startsWith('MAT-')).reduce((s, i) => s + i.amount, 0)
  )
  const platformFee = round2((subtotalLabour + subtotalMaterial) * (policyPremiumPct / 100))
  const bocwCess    = round2(subtotalLabour * 0.01)
  const gstAmount   = round2(platformFee * 0.18)
  const totalAmount = round2(subtotalLabour + subtotalMaterial + subtotalRiskFlags + platformFee + bocwCess + gstAmount)
  const reportId          = r.id as string

  // ── 9. Upsert boq_generated (ON CONFLICT booking_ref DO UPDATE) ───────────────
  // Preserve status if the row is already in a significant workflow state —
  // regenerating line items must not reset client_review / sent_to_client etc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingForStatus } = await (supabase as any)
    .from('boq_generated')
    .select('status')
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  const PRESERVE_STATUSES = ['client_review', 'sent_to_client', 'admin_review', 'accepted', 'rejected']
  const statusToSave =
    existingForStatus && PRESERVE_STATUSES.includes(existingForStatus.status)
      ? existingForStatus.status
      : 'draft'

  const { data: saved, error: saveErr } = await supabase
    .from('boq_generated')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({
      booking_ref:             bookingRef,
      report_id:               reportId,
      version:                 1,
      tier,
      job_card_type:           jobCardType,
      status:                  statusToSave,
      line_items:              lineItems,
      risk_flag_items:         riskItems,
      subtotal_labour:         subtotalLabour,
      subtotal_material:       subtotalMaterial,
      subtotal_risk_flags:     subtotalRiskFlags,
      platform_premium_pct:    policyPremiumPct,
      platform_premium_amount: platformFee,
      bocw_cess_percent:       1,
      bocw_cess_amount:        bocwCess,
      gst_percent:             18,
      gst_amount:              gstAmount,
      contingency_percent:     0,
      contingency_amount:      0,
      total_amount:            totalAmount,
      valid_until:             new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      updated_at:              new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any, { onConflict: 'booking_ref' })
    .select('id')
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boqErr = saveErr as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boq = saved as any
  if (boqErr) return { error: (boqErr as { message: string }).message }

  // ── 10. Write milestone payment schedule ──────────────────────────────────────
  const milestoneResult = await writeMilestoneSchedule(
    bookingRef,
    (boq as { id: string }).id,
    jobCardType,
    totalAmount,
  )
  if (milestoneResult.error) {
    console.error('[generateBOQ] milestone write error:', milestoneResult.error)
  }

  return {
    boqId: (boq as { id: string }).id,
    lineItems,
    subtotalLabour,
    subtotalMaterial,
    platformFee,
    bocwCess,
    gstAmount,
    totalAmount,
  }
}

// ── writeMilestoneSchedule ─────────────────────────────────────────────────────
// Deletes any existing milestone_payment_schedule rows for this booking_ref, then
// inserts fresh rows based on job_card_type using the real DB column names verified
// from information_schema on 2026-06-30.
export async function writeMilestoneSchedule(
  bookingRef: string,
  boqId: string,
  jobCardType: string,
  totalAmount: number,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { error: deleteErr } = await (supabase as any)
    .from('milestone_payment_schedule')
    .delete()
    .eq('booking_ref', bookingRef)
  if (deleteErr) return { error: (deleteErr as { message: string }).message }

  const base = (pct: number) => ({
    booking_ref:  bookingRef,
    boq_id:       boqId,
    job_type:     jobCardType,
    status:       'pending',
    is_template:  false,
    created_at:   now,
    updated_at:   now,
    payment_amount: round2(totalAmount * pct / 100),
  })

  const lmRows = [
    {
      ...base(20),
      milestone_number:  1,
      milestone_code:    'M0',
      milestone_name:    'Mobilisation',
      description:       'Client accepts estimate. Token payment confirms booking.',
      payment_percent:   20,
      trigger_condition: 'Client accepts estimate. Token payment confirms booking.',
      evidence_required: ['Signed estimate', 'Token payment receipt'],
      planned_day:       0,
    },
    {
      ...base(30),
      milestone_number:  2,
      milestone_code:    'M1',
      milestone_name:    'First Fix',
      description:       'Pond test passed — no seepage in 24 hours. Hydraulic pressure test at 10 bar passed.',
      payment_percent:   30,
      trigger_condition: 'Pond test passed — no seepage in 24 hours. Hydraulic pressure test at 10 bar passed.',
      evidence_required: ['Pond test start photo', 'Pond test end photo after 24 hours', 'Hydraulic pressure gauge photo', 'Supervisor sign-off'],
      planned_day:       7,
    },
    {
      ...base(30),
      milestone_number:  3,
      milestone_code:    'M2',
      milestone_name:    'Tiling Complete',
      description:       'All wall and floor tiles laid. Grouting complete. No hollow tiles confirmed.',
      payment_percent:   30,
      trigger_condition: 'All wall and floor tiles laid. Grouting complete. No hollow tiles confirmed.',
      evidence_required: ['Wall tiling photo', 'Floor tiling photo', 'Grouting photo', 'Tap test confirmation'],
      planned_day:       14,
    },
    {
      ...base(20),
      milestone_number:  4,
      milestone_code:    'M3',
      milestone_name:    'Final Handover',
      description:       'All fixtures functional. Client signs handover checklist. Zero pending snags.',
      payment_percent:   20,
      trigger_condition: 'All fixtures functional. Client signs handover checklist. Zero pending snags.',
      evidence_required: ['Functional test videos', 'Signed handover checklist'],
      planned_day:       15,
    },
  ]

  const mRows = [
    {
      ...base(30),
      milestone_number:  1,
      milestone_code:    'M0',
      milestone_name:    'Order Confirmation',
      description:       'Client accepts estimate and confirms order.',
      payment_percent:   30,
      trigger_condition: 'Client accepts estimate and confirms order.',
      evidence_required: ['Signed estimate', 'Advance payment receipt'],
      planned_day:       0,
    },
    {
      ...base(40),
      milestone_number:  2,
      milestone_code:    'M1',
      milestone_name:    'Material Dispatched',
      description:       'All ordered materials dispatched from supplier/warehouse.',
      payment_percent:   40,
      trigger_condition: 'All ordered materials dispatched from supplier/warehouse.',
      evidence_required: ['Dispatch confirmation', 'Item-wise packing list'],
      planned_day:       3,
    },
    {
      ...base(30),
      milestone_number:  3,
      milestone_code:    'M2',
      milestone_name:    'Delivery Confirmed',
      description:       'Client confirms receipt of all materials in good condition at site.',
      payment_percent:   30,
      trigger_condition: 'Client confirms receipt of all materials in good condition at site.',
      evidence_required: ['Delivery photos', 'Client confirmation of receipt', 'Quantity verification against BOQ'],
      planned_day:       7,
    },
  ]

  const rows = jobCardType === 'M' ? mRows : lmRows

  const { error: insertErr } = await (supabase as any)
    .from('milestone_payment_schedule')
    .insert(rows)
  if (insertErr) return { error: (insertErr as { message: string }).message }

  return {}
}

// ── redistributeMilestonePayments ─────────────────────────────────────────────
// The project owner's explicit choice (9 Oct 2026, AskUserQuestion) for what
// happens to milestone_payment_schedule when the job value changes
// mid-execution: "Recalculate all remaining percentages" -- not a new
// milestone row for the new scope. Already-PAID milestones ('paid' for M0,
// 'payment_released' for M1-M4) are left completely untouched -- "amount
// received is continuing". Every other (not-yet-paid) row keeps its
// RELATIVE share of what was still outstanding, re-scaled against the new
// total, so paid + redistributed-remaining sums back to the new total
// exactly (rounding aside).
export async function redistributeMilestonePayments(
  bookingRef: string,
  newTotalAmount: number,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const PAID_STATUSES = ['paid', 'payment_released']

  const { data: rows, error: fetchErr } = await supabase
    .from('milestone_payment_schedule')
    .select('id, status, payment_percent, payment_amount')
    .eq('booking_ref', bookingRef)
  if (fetchErr) return { error: fetchErr.message }
  if (!rows || rows.length === 0) return {}

  type Row = { id: string; status: string; payment_percent: number | null; payment_amount: number | null }
  const paidRows = (rows as Row[]).filter((r) => PAID_STATUSES.includes(r.status))
  const remainingRows = (rows as Row[]).filter((r) => !PAID_STATUSES.includes(r.status))

  const paidAmount = round2(paidRows.reduce((s, r) => s + (Number(r.payment_amount) || 0), 0))
  const remainingBudget = round2(newTotalAmount - paidAmount)

  if (remainingBudget < 0) {
    return {
      error: `Revised total (Rs ${newTotalAmount.toFixed(2)}) is less than what is already paid ` +
        `(Rs ${paidAmount.toFixed(2)}) for this booking -- this needs manual review, not an ` +
        `automatic redistribution.`,
    }
  }
  if (remainingRows.length === 0) return {}

  const sumOriginalRemainingPct = remainingRows.reduce((s, r) => s + (Number(r.payment_percent) || 0), 0)
  const useEvenSplit = sumOriginalRemainingPct <= 0
  const now = new Date().toISOString()

  for (const row of remainingRows) {
    const share = useEvenSplit
      ? 1 / remainingRows.length
      : (Number(row.payment_percent) || 0) / sumOriginalRemainingPct
    const newAmount = round2(remainingBudget * share)
    const newPct = newTotalAmount > 0 ? round2((newAmount / newTotalAmount) * 100) : 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (supabase as any)
      .from('milestone_payment_schedule')
      .update({ payment_amount: newAmount, payment_percent: newPct, updated_at: now })
      .eq('id', row.id)
    if (updErr) return { error: (updErr as { message: string }).message }
  }
  return {}
}

// ── notifyCoordinatorsOfRevision ──────────────────────────────────────────────
// "deployments are reviewed so what is booked and still needed stays like
// any rescheduling" -- the project owner's own words for what Coordinator
// must do once a job's plan is redefined mid-execution. 'revised' is one of
// site_instructions' own real, pre-existing instruction_type values (not
// invented), and this reuses the exact fan-out-to-every-real-recipient shape
// already frozen elsewhere in this project (Site Incharge's requestResources,
// Supervisor's raiseSOS).
export async function notifyCoordinatorsOfRevision(
  bookingRef: string,
  versionLabel: string,
  newTotalAmount: number,
  issuedByUserId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: coordinators, error: coordErr } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('platform_role', 'coordinator')
  if (coordErr) return { error: coordErr.message }
  if (!coordinators || coordinators.length === 0) return {}

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('site_instructions').insert(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coordinators.map((c: any) => ({
      booking_ref: bookingRef,
      instruction_type: 'revised',
      instruction_category: 'system_alert',
      priority: 'high',
      instruction_text:
        `Job ${bookingRef}'s estimate was revised to ${versionLabel} (new total Rs ${newTotalAmount.toFixed(2)}) ` +
        `after an execution-stage scope change was approved. The milestone/sub-stage plan has been fully ` +
        `regenerated from the new estimate -- review current worker deployments against the redefined plan: ` +
        `what is already booked and still needed stays, the rest needs rescheduling.`,
      issued_by: issuedByUserId,
      issued_to: c.id,
      issued_at: now,
      status: 'pending',
      is_active: true,
    })),
  )
  if (error) return { error: error.message }
  return {}
}

// ── approveBoqField ────────────────────────────────────────────────────────────

export async function approveBoqField(
  boqId: string,
  field: 'platform_premium' | 'contingency',
  approvedBy: string
) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  if (field === 'platform_premium') {
    const { error } = await supabase
      .from('boq_generated')
      .update({
        platform_premium_status: 'approved',
        platform_premium_approved_by: approvedBy,
        platform_premium_approved_at: new Date().toISOString(),
      })
      .eq('id', boqId)
    if (error) return { success: false, error: error.message }
  }

  if (field === 'contingency') {
    const { error } = await supabase
      .from('boq_generated')
      .update({
        contingency_status: 'approved',
        contingency_approved_by: approvedBy,
        contingency_approved_at: new Date().toISOString(),
      })
      .eq('id', boqId)
    if (error) return { success: false, error: error.message }
  }

  return { success: true }
}

// ── sendEstimateBack ───────────────────────────────────────────────────────────
// Owner, 31 Oct 2026: Admin can send an estimate under review back to the Coordinator for
// correction, with a reason. Admin's send-back is logged but NOT counted towards a "pending"
// job. The reason lives in the job movement log (one record of the movement).
export async function sendEstimateBack(
  bookingRef: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: 'Give the reason for sending the estimate back.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  if (!['admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    return { error: 'Only Admin can send an estimate back.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase as any)
    .from('boq_generated')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('booking_ref', bookingRef)
    .eq('status', 'admin_review')
    .select('id')
  if (error) return { error: (error as { message: string }).message }
  if (!rows || rows.length === 0) return { error: 'This estimate is not waiting for Admin approval.' }

  await logJobMovement(supabase, {
    bookingRef, stage: 'estimate', action: 'returned', countsAsReturn: false,
    itemType: 'boq_generated', itemId: rows[0].id,
    fromUserId: user.id, fromRole: profile?.platform_role ?? null, toRole: 'coordinator',
    remarks: reason.trim(),
  })
  revalidatePath(`/admin/estimate/${bookingRef}`)
  return {}
}
