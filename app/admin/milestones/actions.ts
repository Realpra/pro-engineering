'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logJobMovement } from '@/lib/jobMovementLog'

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
// REBUILT 9-10 Oct 2026, two-part verdict from the project owner. Part 1
// (9 Oct): an execution-stage scope change is NEVER a separate sub-estimate
// -- it gets MERGED into the SAME main boq_generated row as a new version
// ("it gets to become a new job from when it happens" -- route (ii), not
// route (i); supersedes the 8 Oct sub-estimate mechanism). Part 2 (10 Oct,
// after a live pg_constraint + information_schema check): the merge must
// NOT happen here, at admin-approval time. scope_change_requests already has
// its own real, live-displayed client-decision columns (client_acceptance/
// client_informed_at/revised_total_estimate/original_completion_date/
// revised_completion_date -- confirmed live, no CHECK constraint on this
// table, no migration needed) that Admin's own MilestoneTabs.tsx already
// renders but nothing had ever written. This action now only computes and
// STORES the preview of what accepting this change would do; the actual
// merge only happens on the client's own decision -- see
// submitScopeChangeClientDecision, app/client/dashboard/[bookingRef]/
// actions.ts. Built separately from /admin/scope's own adminApproveScopeChange
// -- the project owner's explicit instruction was two independently-correct
// implementations for the two different approval places (this tab's
// contract-value gate and that one), not one shared function, even though
// both approve the same underlying scope_change_requests table and share
// only this comment's structure, not code.
export async function adminApproveScopeContractChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()

  const { data: request, error: fetchErr } = await supabase
    .from('scope_change_requests')
    .select('booking_ref, proposed_additions, supervisor_rough_estimate, timeline_impact_days')
    .eq('id', requestId)
    .single()
  if (fetchErr) return { error: fetchErr.message }

  const { data: parentBoq, error: boqFetchErr } = await supabase
    .from('boq_generated')
    .select('line_items, platform_premium_pct, bocw_cess_percent, contingency_percent')
    .eq('booking_ref', request.booking_ref)
    .neq('status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (boqFetchErr) return { error: boqFetchErr.message }

  let revisedTotalEstimate: number | null = null
  if (parentBoq) {
    const rawItems: any[] = Array.isArray(request.proposed_additions) && request.proposed_additions.length > 0
      ? request.proposed_additions
      : (Array.isArray(request.supervisor_rough_estimate) ? request.supervisor_rough_estimate : [])

    // Same 'LAB-' prefix convention as the real merge in
    // submitScopeChangeClientDecision (subtotal_labour is computed by
    // skuCode prefix, not the category field) -- only the amount matters
    // for this preview total, not the full line-item shape.
    const newItems = rawItems.map((item: any, idx: number) => ({
      skuCode: `LAB-CC-${requestId.slice(0, 8)}-${idx + 1}`,
      isRiskFlag: false,
      amount: Number(item.amount ?? 0) || 0,
    }))
    const existingLineItems: any[] = Array.isArray(parentBoq.line_items) ? parentBoq.line_items : []
    const mergedLineItems = [...existingLineItems, ...newItems]

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

    const platformPremiumPct = Number(parentBoq.platform_premium_pct ?? 0)
    const bocwCessPct = Number(parentBoq.bocw_cess_percent ?? 0)
    const contingencyPct = Number(parentBoq.contingency_percent ?? 0)
    const platformPremiumAmount = round2((subtotalLabour + subtotalMaterial) * (platformPremiumPct / 100))
    const bocwCessAmount = round2(subtotalLabour * (bocwCessPct / 100))
    const gstAmount = round2(platformPremiumAmount * 0.18)
    const contingencyAmount = round2((subtotalLabour + subtotalMaterial) * (contingencyPct / 100))
    revisedTotalEstimate = round2(
      subtotalLabour + subtotalMaterial + subtotalRiskFlags +
      platformPremiumAmount + bocwCessAmount + gstAmount + contingencyAmount
    )
  }

  // "Current completion date" -- derived from the live job_milestone_
  // substages plan (the same source the Milestone Plan tab itself uses),
  // not guessed; left null if no plan has been generated yet.
  const { data: substageRows } = await supabase
    .from('job_milestone_substages')
    .select('early_finish_date')
    .eq('booking_ref', request.booking_ref)
    .not('early_finish_date', 'is', null)
    .order('early_finish_date', { ascending: false })
    .limit(1)
  const originalCompletionDate: string | null = substageRows?.[0]?.early_finish_date ?? null
  let revisedCompletionDate: string | null = null
  if (originalCompletionDate && request.timeline_impact_days != null) {
    const d = new Date(originalCompletionDate)
    d.setDate(d.getDate() + Number(request.timeline_impact_days))
    revisedCompletionDate = d.toISOString().split('T')[0]
  }

  const { error } = await supabase
    .from('scope_change_requests')
    .update({
      admin_decision: 'approved',
      admin_remarks: remarks,
      admin_decided_at: now,
      admin_decided_by: adminUserId,
      change_status: 'admin_approved',
      revised_total_estimate: revisedTotalEstimate,
      original_completion_date: originalCompletionDate,
      revised_completion_date: revisedCompletionDate,
      client_informed_at: now,
      updated_at: now,
    })
    .eq('id', requestId)
  if (error) return { error: error.message }
  await logJobMovement(supabase, {
    bookingRef: request.booking_ref, stage: 'scope_change', action: 'decided',
    itemType: 'scope_change_request', itemId: requestId, fromUserId: adminUserId, toRole: 'client',
    remarks: 'Scope change approved, sent to client for decision' + (remarks ? `: ${remarks}` : ''),
  })
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
  await logJobMovement(supabase, {
    scopeChangeRequestId: requestId, stage: 'scope_change', action: 'decided',
    itemType: 'scope_change_request', itemId: requestId, fromUserId: adminUserId,
    remarks: `Scope change rejected` + (remarks ? `: ${remarks}` : ''),
  })
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
  await logJobMovement(supabase, {
    substageId, stage: 'milestone', action: 'approved',
    itemType: 'job_milestone_substage', itemId: substageId, fromUserId: adminUserId,
  })
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
  await logJobMovement(supabase, {
    substageId, stage: 'milestone', action: 'returned',
    itemType: 'job_milestone_substage', itemId: substageId, fromUserId: adminUserId,
    toRole: 'site_incharge', remarks: rejectionReason,
  })
  revalidatePath(PATH)
  return { success: true }
}
