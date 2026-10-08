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
// This tab's own approval point ("Scope Changes Affecting Contract Value")
// gets its own, separately-written sub-estimate creation -- the project
// owner's explicit instruction (8 Oct 2026) was two independently-correct
// implementations for the two different approval places (this tab and
// /admin/scope's own adminApproveScopeChange), not one shared function, even
// though both approve the same underlying scope_change_requests table.
// A contract-value scope change is dealt with the same way the project
// owner described for any approved scope change: a real sub-estimate under
// the same job, running through the same estimate approval cycle (generate
// -> send to client -> accept/decline/review) the main estimate already
// uses, rather than silently closing the request with no billable effect.
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

  const { data: parentBoq } = await supabase
    .from('boq_generated')
    .select('id, tier, job_card_type, report_id, platform_premium_pct, bocw_cess_percent')
    .eq('booking_ref', request.booking_ref)
    .neq('status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (parentBoq) {
    const rawItems: any[] = Array.isArray(request.proposed_additions) && request.proposed_additions.length > 0
      ? request.proposed_additions
      : (Array.isArray(request.supervisor_rough_estimate) ? request.supervisor_rough_estimate : [])

    const lineItems = rawItems.map((item: any, idx: number) => {
      const qty = Number(item.qty ?? item.quantity ?? 1) || 1
      const amount = Number(item.amount ?? 0) || 0
      return {
        skuCode: `CONTRACT-CHANGE-${idx + 1}`,
        skuName: item.description ?? 'Contract-value scope change item',
        description: item.description ?? null,
        category: 'labour',
        sectionName: 'Approved Contract-Value Scope Change',
        unit: item.unit ?? 'lump',
        quantity: qty,
        wastageMultiplier: 1,
        rate: qty > 0 ? Math.round((amount / qty) * 100) / 100 : amount,
        amount,
        isRiskFlag: false,
        missingRate: false,
      }
    })

    const subtotalLabour = Math.round(lineItems.reduce((s: number, i: any) => s + i.amount, 0) * 100) / 100
    const platformPremiumPct = Number(parentBoq.platform_premium_pct ?? 0)
    const bocwCessPct = Number(parentBoq.bocw_cess_percent ?? 0)
    const platformPremiumAmount = Math.round(subtotalLabour * (platformPremiumPct / 100) * 100) / 100
    const bocwCessAmount = Math.round(subtotalLabour * (bocwCessPct / 100) * 100) / 100
    const gstAmount = Math.round(platformPremiumAmount * 0.18 * 100) / 100
    const totalAmount = Math.round((subtotalLabour + platformPremiumAmount + bocwCessAmount + gstAmount) * 100) / 100

    const subBookingRef = `${request.booking_ref}-cc-${requestId.slice(0, 8)}`

    const { error: subErr } = await supabase.from('boq_generated').insert({
      booking_ref: subBookingRef,
      report_id: parentBoq.report_id,
      version: 1,
      tier: parentBoq.tier,
      job_card_type: parentBoq.job_card_type,
      estimate_kind: 'sub_estimate',
      parent_estimate_id: parentBoq.id,
      status: 'draft',
      line_items: lineItems,
      risk_flag_items: [],
      deferred_items: [],
      deferred_value: 0,
      deferred_pct: 0,
      subtotal_labour: subtotalLabour,
      subtotal_material: 0,
      subtotal_risk_flags: 0,
      platform_premium_pct: platformPremiumPct,
      platform_premium_amount: platformPremiumAmount,
      bocw_cess_percent: bocwCessPct,
      bocw_cess_amount: bocwCessAmount,
      gst_percent: 18,
      gst_amount: gstAmount,
      contingency_percent: 0,
      contingency_amount: 0,
      total_amount: totalAmount,
      estimate_version: 1.0,
      estimate_version_label: 'v1.0',
      coordinator_notes: request.justification_cos ?? null,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      updated_at: now,
    })
    if (subErr) {
      await supabase
        .from('scope_change_requests')
        .update({
          admin_decision: 'approved',
          admin_remarks: `${remarks}\n\n[Sub-estimate creation failed: ${subErr.message}]`,
          admin_decided_at: now,
          admin_decided_by: adminUserId,
          change_status: 'admin_approved',
          updated_at: now,
        })
        .eq('id', requestId)
      revalidatePath(PATH)
      return { error: `Approved, but sub-estimate creation failed: ${subErr.message}` }
    }
  }

  const { error } = await supabase
    .from('scope_change_requests')
    .update({
      admin_decision: 'approved',
      admin_remarks: remarks,
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
