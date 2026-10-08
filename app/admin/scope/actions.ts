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
// Approving a scope change here must do more than mark the request itself
// approved -- per the project owner's explicit design (8 Oct 2026): an
// approved scope change is dealt with exactly like an estimate, as a new
// sub-estimate under the same job, running through the same generate ->
// send-to-client -> accept/decline/review cycle the main estimate already
// uses. Built separately from the Milestones tab's own approve action
// (app/admin/milestones/actions.ts's adminApproveScopeContractChange) --
// the project owner's explicit instruction was two separate, independently-
// correct implementations for these two different approval points, not one
// shared function.
export async function adminApproveScopeChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<ScopeActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()

  const { data: request, error: fetchErr } = await supabase
    .from('scope_change_requests')
    .select('booking_ref, proposed_additions, supervisor_rough_estimate, cost_impact_net, justification_cos')
    .eq('id', requestId)
    .single()
  if (fetchErr) return { error: fetchErr.message }

  // The parent estimate this job's client already accepted -- inherit its
  // tier/job_card_type/rate percentages rather than guessing fresh ones.
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
        skuCode: `SCOPE-CHANGE-${idx + 1}`,
        skuName: item.description ?? 'Scope change item',
        description: item.description ?? null,
        category: 'labour',
        sectionName: 'Approved Scope Change',
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

    const subBookingRef = `${request.booking_ref}-sc-${requestId.slice(0, 8)}`

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
    // A sub-estimate failure must not block the approval itself from being
    // recorded -- surfaced via the request's own admin_remarks instead of
    // silently losing the approval, same discipline as this project's other
    // best-effort side-writes.
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
      revalidatePath('/admin/scope')
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
  revalidatePath('/admin/scope')
  revalidatePath(`/admin/estimate/${request.booking_ref}`)
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
