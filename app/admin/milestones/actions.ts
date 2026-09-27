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
export async function adminApproveScopeContractChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<MilestoneActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
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
