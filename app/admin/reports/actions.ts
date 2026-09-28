'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ReportActionResult = { success: true } | { error: string }

// ─── ACTION 1 ───────────────────────────────────────────────────────────────
export async function adminAcknowledgeInstruction(
  instructionId: string,
  adminUserId: string
): Promise<ReportActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('site_instructions')
    .update({ admin_acknowledged_at: new Date().toISOString() })
    .eq('id', instructionId)
  if (error) return { error: error.message }
  revalidatePath('/admin/reports')
  return { success: true }
}

// ─── ACTION 2 ───────────────────────────────────────────────────────────────
// NOTE: spec assumes a `category_code` column on site_instructions for
// instruction-number sequencing. Verified live — it does not exist. The
// category code is derived from instruction_type here instead, and folded
// into the generated instruction_number string only (not stored separately).
export type DirectiveInput = {
  booking_ref: string
  client_ref: string
  instruction_type: string
  subject: string
  instruction_text: string
  admin_directive_text: string
  target_roles: string[]
  target_audience: string
  directive_priority: string
  directive_type: string
  trade: string
  skill_level: string
  job_type: string
  zone: string
  sector: string
  policy_reference: string
  effective_from: string
  expiry_date: string
  acknowledgement_required: boolean
  acknowledgement_deadline: string
  copy_to_super_admin: boolean
}

export async function adminIssueDirective(
  adminUserId: string,
  categoryCode: string,
  data: DirectiveInput
): Promise<ReportActionResult> {
  const supabase: any = await createClient()

  const year = new Date().getFullYear()
  const prefix = `PE/${categoryCode}/${year}/`
  const { count } = await supabase
    .from('site_instructions')
    .select('id', { count: 'exact', head: true })
    .like('instruction_number', `${prefix}%`)
  const seq = String((count ?? 0) + 1).padStart(3, '0')
  const instructionNumber = `${prefix}${seq}`

  const { error } = await supabase.from('site_instructions').insert({
    instruction_number: instructionNumber,
    booking_ref: data.booking_ref || null,
    client_ref: data.client_ref || null,
    instruction_type: data.instruction_type,
    instruction_category: 'directive',
    subject: data.subject || null,
    instruction_text: data.instruction_text,
    admin_directive_text: data.admin_directive_text || null,
    target_roles: data.target_roles,
    target_audience: data.target_audience || null,
    directive_priority: data.directive_priority || null,
    directive_type: data.directive_type || null,
    trade: data.trade || null,
    skill_level: data.skill_level || null,
    job_type: data.job_type || null,
    zone: data.zone || null,
    sector: data.sector || null,
    policy_reference: data.policy_reference || null,
    effective_from: data.effective_from || null,
    expiry_date: data.expiry_date || null,
    acknowledgement_required: data.acknowledgement_required,
    acknowledgement_deadline: data.acknowledgement_deadline || null,
    copy_to_super_admin: data.copy_to_super_admin,
    issued_by: adminUserId,
    issued_at: new Date().toISOString(),
    // 'active' violates the real status CHECK (pending/acknowledged/actioned/
    // resolved, confirmed live) -- this insert would have failed outright.
    status: 'pending',
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/reports')
  return { success: true }
}

// ─── ACTION 3 ───────────────────────────────────────────────────────────────
export async function adminDecideOnLog(
  logId: string,
  adminUserId: string,
  decision: string,
  remarks: string
): Promise<ReportActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('daily_site_logs')
    .update({
      decision_on_log: decision,
      decision_by: adminUserId,
      decision_at: new Date().toISOString(),
      decision_remarks: remarks,
    })
    .eq('id', logId)
  if (error) return { error: error.message }
  revalidatePath('/admin/reports')
  return { success: true }
}

// ─── ACTION 4 ───────────────────────────────────────────────────────────────
export async function adminApprovePenalty(
  wastageLogId: string,
  adminUserId: string,
  penaltyAmount: number
): Promise<ReportActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('client_wastage_log')
    .update({
      penalty_applicable: true,
      penalty_amount: penaltyAmount,
      penalty_approved_by: adminUserId,
      penalty_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', wastageLogId)
  if (error) return { error: error.message }
  revalidatePath('/admin/reports')
  return { success: true }
}

// ─── ACTION 5 ───────────────────────────────────────────────────────────────
export async function adminWaivePenalty(
  wastageLogId: string,
  adminUserId: string
): Promise<ReportActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('client_wastage_log')
    .update({
      penalty_applicable: false,
      penalty_approved_by: adminUserId,
      penalty_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', wastageLogId)
  if (error) return { error: error.message }
  revalidatePath('/admin/reports')
  return { success: true }
}
