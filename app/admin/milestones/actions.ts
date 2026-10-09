'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type MilestoneActionResult = { success: true } | { error: string }

const PATH = '/admin/milestones'

export type MilestoneTemplateInput = {
  vertical: string
  job_category: string
  job_type: string
  milestone_code: string
  milestone_name: string
  description: string
  payment_percent: number
  milestone_number: number
  planned_day: number
  skilled_workers_per_day: number
  unskilled_workers_per_day: number
  trade_type: string
  skill_level_required: string
  sector: string
  compliance_requirements: string[]
  quality_checklist: unknown[]
  methodology_ref: string
  payment_trigger_condition: string
  admin_notes: string
  evidence_checklist: unknown[]
}

function templateColumns(data: MilestoneTemplateInput) {
  return {
    vertical: data.vertical,
    job_category: data.job_category,
    job_type: data.job_type,
    milestone_code: data.milestone_code,
    milestone_name: data.milestone_name,
    description: data.description,
    payment_percent: data.payment_percent,
    milestone_number: data.milestone_number,
    planned_day: data.planned_day,
    skilled_workers_per_day: data.skilled_workers_per_day,
    unskilled_workers_per_day: data.unskilled_workers_per_day,
    trade_type: data.trade_type,
    skill_level_required: data.skill_level_required,
    sector: data.sector,
    compliance_requirements: data.compliance_requirements,
    quality_checklist: data.quality_checklist,
    methodology_ref: data.methodology_ref,
    payment_trigger_condition: data.payment_trigger_condition,
    admin_notes: data.admin_notes,
    evidence_checklist: data.evidence_checklist,
  }
}

// ─── ACTION 1 ───────────────────────────────────────────────────────────────
export async function addMilestoneTemplate(
  adminUserId: string,
  data: MilestoneTemplateInput
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase.from('milestone_stage_templates').insert({
    ...templateColumns(data),
    is_active: true,
    is_template: true,
    created_by: adminUserId,
  })
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ─── ACTION 2 ───────────────────────────────────────────────────────────────
export async function editMilestoneTemplate(
  templateId: string,
  adminUserId: string,
  data: MilestoneTemplateInput
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('milestone_stage_templates')
    .update({
      ...templateColumns(data),
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ─── ACTION 3 ───────────────────────────────────────────────────────────────
export async function activateMilestoneTemplate(
  templateId: string,
  adminUserId: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('milestone_stage_templates')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', templateId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ─── ACTION 4 ───────────────────────────────────────────────────────────────
export async function deactivateMilestoneTemplate(
  templateId: string,
  adminUserId: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('milestone_stage_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', templateId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ─── ACTION 5 ───────────────────────────────────────────────────────────────
// REBUILT 9 Oct 2026 per the project owner's explicit, verbatim verdict: an
// execution-stage scope change is NEVER a separate (sub-)estimate -- it is
// MERGED into the SAME main boq_generated row as a new version ("it gets to
// become a new job from when it happens... job value changed, milestone/
// sub-stage and every act is redefined" -- route (ii), not route (i)). This
// supersedes the sub-estimate mechanism built 8 Oct 2026. Built separately
// from /admin/scope's own adminApproveScopeChange -- the project owner's
// explicit instruction was two independently-correct implementations for
// the two different approval places (this tab's contract-value gate and
// that one), not one shared function, even though both approve the same
// underlying scope_change_requests table and share only the merge
// STRUCTURE, not a shared function.
export async function adminApproveScopeContractChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()

  const { data: request, error: fetchErr } = await supabase
    .from('scope_change_requests')
    .select('booking_ref, proposed_additions, supervisor_rough_estimate, cost_impact_net, justification_cos')
    .eq('id', requestId)
    .single()
  if (fetchErr) return { error: fetchErr.message }

  const { data: parentBoq, error: boqFetchErr } = await supabase
    .from('boq_generated')
    .select('*')
    .eq('booking_ref', request.booking_ref)
    .neq('status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (boqFetchErr) return { error: boqFetchErr.message }
  if (!parentBoq) {
    return { error: 'No live estimate found for this booking -- cannot merge contract-value change into it.' }
  }

  const rawItems: any[] = Array.isArray(request.proposed_additions) && request.proposed_additions.length > 0
    ? request.proposed_additions
    : (Array.isArray(request.supervisor_rough_estimate) ? request.supervisor_rough_estimate : [])

  if (rawItems.length === 0) {
    return { error: 'This request has no proposed items to merge -- nothing to approve into the estimate.' }
  }

  const newLineItems = rawItems.map((item: any, idx: number) => ({
    // 'LAB-' prefix matches generateBOQ/processClientRemarks' own real,
    // load-bearing convention for "counts toward subtotal_labour" (they
    // filter by skuCode prefix, not the category field) -- matched here
    // deliberately so these items are actually included below, not
    // silently dropped from subtotal_labour.
    skuCode: `LAB-CC-${requestId.slice(0, 8)}-${idx + 1}`,
    skuName: item.description ?? 'Contract-value scope change item',
    description: item.description ?? null,
    category: 'labour',
    sectionName: 'Approved Contract-Value Scope Change',
    unit: item.unit ?? 'lump',
    quantity: Number(item.qty ?? item.quantity ?? 1) || 1,
    wastageMultiplier: 1,
    rate: (() => {
      const qty = Number(item.qty ?? item.quantity ?? 1) || 1
      const amount = Number(item.amount ?? 0) || 0
      return qty > 0 ? round2(amount / qty) : amount
    })(),
    amount: Number(item.amount ?? 0) || 0,
    isRiskFlag: false,
    missingRate: false,
  }))

  const existingLineItems: any[] = Array.isArray(parentBoq.line_items) ? parentBoq.line_items : []
  const mergedLineItems = [...existingLineItems, ...newLineItems]

  const subtotalLabour = round2(
    mergedLineItems.filter((i) => !i.isRiskFlag && String(i.skuCode ?? '').startsWith('LAB-'))
      .reduce((s, i) => s + (Number(i.amount) || 0), 0)
  )
  const subtotalMaterial = round2(
    mergedLineItems.filter((i) => !i.isRiskFlag && String(i.skuCode ?? '').startsWith('MAT-'))
      .reduce((s, i) => s + (Number(i.amount) || 0), 0)
  )
  const subtotalRiskFlags = round2(
    mergedLineItems.filter((i) => i.isRiskFlag).reduce((s, i) => s + (Number(i.amount) || 0), 0)
  )

  // Percentages inherited from the SAME live estimate -- a scope change
  // never gets to silently change the job's premium/BOCW/contingency rates.
  const platformPremiumPct = Number(parentBoq.platform_premium_pct ?? 0)
  const bocwCessPct = Number(parentBoq.bocw_cess_percent ?? 0)
  const contingencyPct = Number(parentBoq.contingency_percent ?? 0)

  const platformPremiumAmount = round2((subtotalLabour + subtotalMaterial) * (platformPremiumPct / 100))
  const bocwCessAmount = round2(subtotalLabour * (bocwCessPct / 100))
  const gstAmount = round2(platformPremiumAmount * 0.18)
  const contingencyAmount = round2((subtotalLabour + subtotalMaterial) * (contingencyPct / 100))
  const totalAmount = round2(
    subtotalLabour + subtotalMaterial + subtotalRiskFlags +
    platformPremiumAmount + bocwCessAmount + gstAmount + contingencyAmount
  )

  const currentVersion = Number(parentBoq.estimate_version ?? 0)
  const newVersion = round2(currentVersion === 0 ? 1.0 : currentVersion + 1.0)
  const newVersionLabel = `v${newVersion.toFixed(1)}`

  // Revised estimate goes back through the SAME generate -> send-to-client
  // -> accept/decline/review cycle the original used -- client_accepted_at/
  // client_rejected_at are cleared since they record an act of accepting/
  // rejecting a version that no longer exists once merged.
  const { error: updateErr } = await supabase
    .from('boq_generated')
    .update({
      line_items: mergedLineItems,
      subtotal_labour: subtotalLabour,
      subtotal_material: subtotalMaterial,
      subtotal_risk_flags: subtotalRiskFlags,
      platform_premium_amount: platformPremiumAmount,
      bocw_cess_amount: bocwCessAmount,
      gst_amount: gstAmount,
      contingency_amount: contingencyAmount,
      total_amount: totalAmount,
      estimate_version: newVersion,
      estimate_version_label: newVersionLabel,
      status: 'draft',
      client_accepted_at: null,
      client_rejected_at: null,
      updated_at: now,
    })
    .eq('id', parentBoq.id)
  if (updateErr) return { error: updateErr.message }

  const { error } = await supabase
    .from('scope_change_requests')
    .update({
      admin_decision: 'approved',
      admin_remarks: `${remarks}\n\n[Merged into main estimate as ${newVersionLabel} -- new total Rs ${totalAmount.toFixed(2)}, pending client re-acceptance]`,
      admin_decided_at: now,
      admin_decided_by: adminUserId,
      change_status: 'admin_approved',
      updated_at: now,
    })
    .eq('id', requestId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  revalidatePath(`/admin/estimate/${request.booking_ref}`)
  return { success: true }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── ACTION 6 ───────────────────────────────────────────────────────────────
export async function adminRejectScopeContractChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('scope_change_requests')
    .update({
      admin_decision: 'rejected',
      admin_remarks: remarks,
      admin_decided_at: now,
      admin_decided_by: adminUserId,
      change_status: 'rejected',
      updated_at: now,
    })
    .eq('id', requestId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ─── ACTION 7 ───────────────────────────────────────────────────────────────
export async function adminOverrideEvidence(
  paymentId: string,
  adminUserId: string,
  overrideType: 'approve_without_evidence' | 'reject_despite_evidence',
  overrideReason: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    admin_override_type: overrideType,
    admin_override_reason: overrideReason,
    admin_override_by: adminUserId,
    admin_override_at: now,
    updated_at: now,
  }
  if (overrideType === 'approve_without_evidence') {
    patch.admin_approved_at = now
    patch.status = 'admin_approved'
  } else if (overrideType === 'reject_despite_evidence') {
    patch.status = 'admin_rejected'
  }
  const { error } = await supabase
    .from('milestone_payment_schedule')
    .update(patch)
    .eq('id', paymentId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ─── ACTION 8 ───────────────────────────────────────────────────────────────
export async function adminApproveSubstage(
  substageId: string,
  adminUserId: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
  // Every other role's page (coordinator, supervisor, sub-coordinator,
  // site-incharge) now reads substage_approved_at directly -- resolved
  // canonically, no dual-write to the legacy coordinator_approved_at column
  // (Supervisor Visit schema freeze, Session 67).
  const { error } = await supabase
    .from('job_milestone_substages')
    .update({
      substage_approval_status: 'approved',
      substage_approved_by: adminUserId,
      substage_approved_at: now,
      updated_at: now,
    })
    .eq('id', substageId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ─── ACTION 9 ───────────────────────────────────────────────────────────────
export async function adminRejectSubstage(
  substageId: string,
  adminUserId: string,
  rejectionReason: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('job_milestone_substages')
    .update({
      substage_approval_status: 'rejected',
      substage_rejection_reason: rejectionReason,
      substage_approved_by: adminUserId,
      substage_approved_at: now,
      // Same rejection marker app/sub-coordinator/actions.ts already uses on this
      // table, so other roles' pages see this substage as sent back rather than
      // silently stuck (coordinator_approved_at intentionally left null: rejected
      // means not approved).
      status: 'sent_back',
      updated_at: now,
    })
    .eq('id', substageId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}
