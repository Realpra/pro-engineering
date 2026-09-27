'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ScopeActionResult = { success: true } | { error: string }

// ─── ACTION 1 ───────────────────────────────────────────────────────────────
// SA-12's original rule (june.md 10515-10522): "Critical snags cannot be
// Client accepted -- must be Resolved. Milestone locked until all snags are
// Resolved or Client accepted." Handover is the real-world equivalent of
// that milestone lock for this codebase's flow -- enforced here, not just
// recorded.
export async function adminApproveHandover(
  assessmentId: string,
  adminUserId: string,
  conditions: string
): Promise<ScopeActionResult> {
  const supabase: any = await createClient()

  const { data: assessment, error: fetchErr } = await supabase
    .from('pre_delivery_assessment')
    .select('booking_ref')
    .eq('id', assessmentId)
    .single()
  if (fetchErr) return { error: fetchErr.message }

  const { data: openSnags, error: snagErr } = await supabase
    .from('scope_snag_items')
    .select('snag_severity, resolution_status')
    .eq('booking_ref', assessment.booking_ref)
    .eq('resolution_status', 'open')
  if (snagErr) return { error: snagErr.message }

  if ((openSnags?.length ?? 0) > 0) {
    const criticalCount = openSnags.filter((s: any) => s.snag_severity === 'critical').length
    return {
      error: criticalCount > 0
        ? `${criticalCount} critical snag(s) are still open and must be Resolved before handover.`
        : `${openSnags.length} snag(s) are still open -- each must be Resolved or Client Accepted before handover.`,
    }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('pre_delivery_assessment')
    .update({
      admin_decision: 'approve_handover',
      admin_conditions: conditions,
      admin_decided_at: now,
      admin_decided_by: adminUserId,
      updated_at: now,
    })
    .eq('id', assessmentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/scope')
  return { success: true }
}

// ─── ACTION 2 ───────────────────────────────────────────────────────────────
export async function adminRejectHandover(
  assessmentId: string,
  adminUserId: string,
  conditions: string
): Promise<ScopeActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('pre_delivery_assessment')
    .update({
      admin_decision: 'reject_handover',
      admin_conditions: conditions,
      admin_decided_at: now,
      admin_decided_by: adminUserId,
      updated_at: now,
    })
    .eq('id', assessmentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/scope')
  return { success: true }
}

// ─── ACTION 3 ───────────────────────────────────────────────────────────────
export async function adminConditionalHandover(
  assessmentId: string,
  adminUserId: string,
  conditions: string
): Promise<ScopeActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('pre_delivery_assessment')
    .update({
      admin_decision: 'conditional_handover',
      admin_conditions: conditions,
      admin_decided_at: now,
      admin_decided_by: adminUserId,
      updated_at: now,
    })
    .eq('id', assessmentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/scope')
  return { success: true }
}

// ─── ACTION 3b ──────────────────────────────────────────────────────────────
export async function adminAssignSiteHead(
  assessmentId: string,
  siteHeadId: string,
  supervisorId: string,
  adminUserId: string
): Promise<ScopeActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('pre_delivery_assessment')
    .update({
      assigned_site_head: siteHeadId || null,
      assigned_supervisor: supervisorId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assessmentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/scope')
  return { success: true }
}

// ─── ACTION 3c ──────────────────────────────────────────────────────────────
export async function adminAddDailyPlanEntry(
  assessmentId: string,
  logEntry: string,
  adminUserId: string
): Promise<ScopeActionResult> {
  const supabase: any = await createClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('pre_delivery_assessment')
    .select('daily_plan_log')
    .eq('id', assessmentId)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const current = Array.isArray(existing?.daily_plan_log) ? existing.daily_plan_log : []
  const updated = [
    ...current,
    { text: logEntry, added_by: adminUserId, added_at: new Date().toISOString() },
  ]

  const { error } = await supabase
    .from('pre_delivery_assessment')
    .update({ daily_plan_log: updated, updated_at: new Date().toISOString() })
    .eq('id', assessmentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/scope')
  return { success: true }
}

// ─── ACTION 4 ───────────────────────────────────────────────────────────────
export async function adminApproveScopeChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<ScopeActionResult> {
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
  revalidatePath('/admin/scope')
  return { success: true }
}

// ─── ACTION 5 ───────────────────────────────────────────────────────────────
export async function adminRejectScopeChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<ScopeActionResult> {
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
  revalidatePath('/admin/scope')
  return { success: true }
}

// ─── ACTION 6 ───────────────────────────────────────────────────────────────
export async function adminPartialApproveScopeChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<ScopeActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('scope_change_requests')
    .update({
      admin_decision: 'partial',
      admin_remarks: remarks,
      admin_decided_at: now,
      admin_decided_by: adminUserId,
      change_status: 'admin_approved',
      updated_at: now,
    })
    .eq('id', requestId)
  if (error) return { error: error.message }
  revalidatePath('/admin/scope')
  return { success: true }
}
