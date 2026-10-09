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
// REBUILT 9 Oct 2026 per the project owner's explicit, verbatim verdict:
// an execution-stage scope change is NEVER a separate (sub-)estimate. It is
// MERGED into the SAME main boq_generated row as a new version -- "it gets
// to become a new job from when it happens... job value changed, milestone/
// sub-stage and every act is redefined" -- route (ii), not route (i). This
// supersedes the sub-estimate mechanism built 8 Oct 2026. Built separately
// from the Milestones tab's own approve action
// (app/admin/milestones/actions.ts's adminApproveScopeContractChange) --
// the project owner's explicit instruction was two separate, independently-
// correct implementations for these two different approval points, not one
// shared function -- this file only takes the shared STRUCTURE, not a
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

  // The job's live main estimate -- the one the client already accepted and
  // is executing against. Fetched whole (not a partial column list) because
  // its own line_items/subtotal/percent fields are the merge base now, not
  // just inherited tier/job_card_type for a brand-new row.
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
    return { error: 'No live estimate found for this booking -- cannot merge scope change into it.' }
  }

  const rawItems: any[] = Array.isArray(request.proposed_additions) && request.proposed_additions.length > 0
    ? request.proposed_additions
    : (Array.isArray(request.supervisor_rough_estimate) ? request.supervisor_rough_estimate : [])

  if (rawItems.length === 0) {
    return { error: 'This request has no proposed items to merge -- nothing to approve into the estimate.' }
  }

  const newLineItems = rawItems.map((item: any, idx: number) => ({
    // 'LAB-' is this project's real, load-bearing prefix convention for
    // "counts toward subtotal_labour" -- generateBOQ and processClientRemarks
    // both filter line_items this way (by skuCode prefix, not the category
    // field), confirmed by reading both. Matched here deliberately so these
    // merged items are actually included in the recomputed totals below,
    // not silently dropped from subtotal_labour.
    skuCode: `LAB-SC-${requestId.slice(0, 8)}-${idx + 1}`,
    skuName: item.description ?? 'Scope change item',
    description: item.description ?? null,
    category: 'labour',
    sectionName: 'Approved Scope Change (Execution Stage)',
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

  // Percentages are inherited from the SAME live estimate, never reinvented
  // -- a scope change does not get to silently change the job's premium/
  // BOCW/contingency rates.
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

  // The revised estimate goes back through the SAME generate -> send-to-
  // client -> accept/decline/review cycle the original estimate used -- it
  // is a real new figure the client must agree to again, never a silent
  // total change. client_accepted_at/client_rejected_at are cleared because
  // they record THIS client's act of accepting/rejecting; the version they
  // apply to no longer exists once merged.
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
