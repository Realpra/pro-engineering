'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logJobMovement } from '@/lib/jobMovementLog'

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
  await supabase.from('guest_enquiries').update({ status: 'completed' }).eq('booking_ref', assessment.booking_ref)
  await logJobMovement(supabase, {
    bookingRef: assessment.booking_ref, stage: 'handover', action: 'decided',
    itemType: 'pre_delivery_assessment', itemId: assessmentId, fromUserId: adminUserId,
    remarks: 'Admin approved handover over client objection -- job completed' + (conditions ? `: ${conditions}` : ''),
  })
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
  const { data: a } = await supabase.from('pre_delivery_assessment').select('booking_ref').eq('id', assessmentId).maybeSingle()
  await logJobMovement(supabase, {
    bookingRef: a?.booking_ref ?? null, stage: 'handover', action: 'rejected',
    itemType: 'pre_delivery_assessment', itemId: assessmentId, fromUserId: adminUserId,
    remarks: 'Handover rejected -- work back for correction' + (conditions ? `: ${conditions}` : ''),
  })
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
  const { data: a } = await supabase.from('pre_delivery_assessment').select('booking_ref').eq('id', assessmentId).maybeSingle()
  if (a?.booking_ref) await supabase.from('guest_enquiries').update({ status: 'completed' }).eq('booking_ref', a.booking_ref)
  await logJobMovement(supabase, {
    bookingRef: a?.booking_ref ?? null, stage: 'handover', action: 'decided',
    itemType: 'pre_delivery_assessment', itemId: assessmentId, fromUserId: adminUserId,
    remarks: 'Admin approved handover with conditions -- job completed' + (conditions ? `: ${conditions}` : ''),
  })
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
// REBUILT 9-10 Oct 2026, two-part verdict from the project owner. Part 1
// (9 Oct): an execution-stage scope change is NEVER a separate sub-estimate
// -- it gets MERGED into the SAME main boq_generated row as a new version
// (route (ii), not route (i); supersedes the 8 Oct sub-estimate mechanism).
// Part 2 (10 Oct, after a live pg_constraint + information_schema check):
// the merge must NOT happen here, at admin-approval time. scope_change_
// requests already has its own real, live-displayed client-decision columns
// (client_acceptance/client_informed_at/revised_total_estimate/
// original_completion_date/revised_completion_date -- confirmed live, no
// CHECK constraint on this table, no migration needed) that Admin's own
// ScopeTabs.tsx already renders but nothing had ever written. This action
// now only computes and STORES the preview of what accepting this change
// would do; the actual merge only happens on the client's own decision --
// see submitScopeChangeClientDecision, app/client/dashboard/[bookingRef]/
// actions.ts. Built separately from the Milestones tab's own approve action
// (app/admin/milestones/actions.ts's adminApproveScopeContractChange) --
// the project owner's explicit instruction was two independently-correct
// implementations for these two different approval points, not one shared
// function -- they only share this comment's structure, not code.
export async function adminApproveScopeChange(
  requestId: string,
  adminUserId: string,
  remarks: string
): Promise<ScopeActionResult> {
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
      skuCode: `LAB-SC-${requestId.slice(0, 8)}-${idx + 1}`,
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

  // "Current completion date" -- no single column holds this on
  // guest_enquiries; derived from the live job_milestone_substages plan
  // (the same source the Milestone Plan tab itself uses), not guessed.
  // Left null if no plan has been generated yet for this booking.
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
  revalidatePath('/admin/scope')
  revalidatePath(`/admin/estimate/${request.booking_ref}`)
  return { success: true }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
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
  await logJobMovement(supabase, {
    scopeChangeRequestId: requestId, stage: 'scope_change', action: 'decided',
    itemType: 'scope_change_request', itemId: requestId, fromUserId: adminUserId,
    remarks: `Scope change rejected` + (remarks ? `: ${remarks}` : ''),
  })
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
  await logJobMovement(supabase, {
    scopeChangeRequestId: requestId, stage: 'scope_change', action: 'decided',
    itemType: 'scope_change_request', itemId: requestId, fromUserId: adminUserId,
    remarks: `Scope change partly approved` + (remarks ? `: ${remarks}` : ''),
  })
  revalidatePath('/admin/scope')
  return { success: true }
}
