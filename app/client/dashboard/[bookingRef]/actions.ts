'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { regeneratePlanForRevisedEstimate } from '@/app/admin/estimate/[bookingRef]/milestonePlanActions'
import { redistributeMilestonePayments, notifyCoordinatorsOfRevision } from '@/app/admin/estimate/[bookingRef]/actions'

type ActionResult = { success?: true; error?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: unknown): any[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export async function markClientViewed(boqId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('boq_generated')
    .update({ client_viewed_at: new Date().toISOString() })
    .eq('id', boqId)
    .is('client_viewed_at', null)

  if (error) return { error: error.message }
  return { success: true }
}

export async function submitLineItemResponse(
  bookingRef: string,
  boqId: string,
  lineItemKey: string,
  decision: string,
  remarks: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('estimate_client_responses')
    .select('id, line_item_responses')
    .eq('booking_ref', bookingRef)
    .eq('boq_id', boqId)
    .maybeSingle()

  if (existing) {
    const responses = asArray(existing.line_item_responses)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx = responses.findIndex((r: any) => r.key === lineItemKey)
    if (idx >= 0) {
      responses[idx] = { ...responses[idx], decision, remarks, responded_at: now }
    } else {
      responses.push({ key: lineItemKey, decision, remarks, responded_at: now })
    }

    const { error } = await supabase
      .from('estimate_client_responses')
      .update({ line_item_responses: responses })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('estimate_client_responses').insert({
      booking_ref: bookingRef,
      boq_id: boqId,
      response_type: 'pending',
      line_item_responses: [{ key: lineItemKey, decision, remarks, responded_at: now }],
      responded_at: now,
    })

    if (error) return { error: error.message }
  }

  revalidatePath(`/client/dashboard/${bookingRef}`)
  return { success: true }
}

export async function submitOverallResponse(
  bookingRef: string,
  boqId: string,
  responseType: string,
  remarks: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('estimate_client_responses')
    .select('id')
    .eq('booking_ref', bookingRef)
    .eq('boq_id', boqId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('estimate_client_responses')
      .update({ response_type: responseType, overall_remarks: remarks, responded_at: now })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('estimate_client_responses').insert({
      booking_ref: bookingRef,
      boq_id: boqId,
      response_type: responseType,
      overall_remarks: remarks,
      responded_at: now,
    })

    if (error) return { error: error.message }
  }

  if (responseType === 'accepted') {
    const [boqRes, enquiryRes] = await Promise.all([
      supabase.from('boq_generated').update({ client_accepted_at: now, status: 'accepted' }).eq('id', boqId),
      supabase.from('guest_enquiries').update({ status: 'estimate_accepted' }).eq('booking_ref', bookingRef),
    ])
    if (boqRes.error) return { error: boqRes.error.message }
    if (enquiryRes.error) return { error: enquiryRes.error.message }
    // NOTE: this is the job's own main-estimate accept/reject cycle only.
    // An execution-stage scope change has its own, separate client-decision
    // point -- see submitScopeChangeClientDecision below -- which is what
    // actually triggers the merge-into-main-estimate + plan-regeneration
    // cascade. This generic accept must never infer that on its own
    // (10 Oct 2026 correction: it originally did, via a "is any milestone
    // already paid" heuristic -- removed once scope_change_requests was
    // found to already have its own real client_acceptance/client_informed_at/
    // revised_total_estimate columns for exactly this purpose).
  } else if (responseType === 'rejected') {
    const { error } = await supabase
      .from('boq_generated')
      .update({ client_rejected_at: now, status: 'rejected' })
      .eq('id', boqId)
    if (error) return { error: error.message }
  }

  revalidatePath(`/client/dashboard/${bookingRef}`)
  return { success: true }
}

export async function acknowledgeRiskFlag(
  bookingRef: string,
  boqId: string,
  riskItemKey: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: boq } = await supabase
    .from('boq_generated')
    .select('risk_flag_items')
    .eq('id', boqId)
    .maybeSingle()

  if (!boq) return { error: 'Estimate not found.' }

  const items = asArray(boq.risk_flag_items)
  const updated = items.map((item, idx) => {
    const matches = item.key === riskItemKey || String(idx) === riskItemKey
    if (!matches) return item
    return { ...item, client_acknowledged: true, acknowledged_at: now }
  })

  const { error } = await supabase.from('boq_generated').update({ risk_flag_items: updated }).eq('id', boqId)

  if (error) return { error: error.message }

  revalidatePath(`/client/dashboard/${bookingRef}`)
  return { success: true }
}

export async function acceptTerms(bookingRef: string, boqId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // terms_accepted_by is TEXT, not UUID — store the user's email or full_name, never the raw id
  let acceptedBy: string | null = user?.email ?? null
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()
    acceptedBy = profile?.full_name ?? profile?.email ?? user.email ?? null
  }

  const { error } = await supabase
    .from('boq_generated')
    .update({ terms_accepted_at: new Date().toISOString(), terms_accepted_by: acceptedBy })
    .eq('id', boqId)

  if (error) return { error: error.message }

  revalidatePath('/client/dashboard/' + bookingRef)
  return { success: true }
}

export async function submitMilestonePaymentRequest(bookingRef: string, milestoneId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('milestone_payment_schedule')
    .update({ status: 'client_payment_pending' })
    .eq('id', milestoneId)

  if (error) return { error: error.message }

  revalidatePath(`/client/dashboard/${bookingRef}`)
  return { success: true }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Per the project owner's correction (9-10 Oct 2026): an execution-stage
// scope change needs its OWN, distinct client-decision stage -- the client
// deciding on THIS specific proposed change (its own cost/timeline impact),
// not a generic "accept the whole re-sent estimate" step. scope_change_
// requests already has the real, live-displayed columns for this
// (client_acceptance/client_informed_at/revised_total_estimate, confirmed
// via information_schema -- no migration needed). Admin's approval
// (app/admin/scope|milestones/actions.ts) only computes and stores the
// PREVIEW of what this change would do; this is where it actually happens,
// gated on the client's own real decision.
export async function submitScopeChangeClientDecision(
  bookingRef: string,
  requestId: string,
  decision: 'accepted' | 'rejected',
): Promise<ActionResult> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: request, error: fetchErr } = await (supabase as any)
    .from('scope_change_requests')
    .select('id, booking_ref, admin_decision, client_acceptance, proposed_additions, supervisor_rough_estimate')
    .eq('id', requestId)
    .eq('booking_ref', bookingRef)
    .single()
  if (fetchErr) return { error: fetchErr.message }
  if (request.admin_decision !== 'approved') {
    return { error: 'This scope change has not been approved by Admin yet.' }
  }
  if (request.client_acceptance && request.client_acceptance !== 'pending') {
    return { error: 'A decision has already been recorded for this scope change.' }
  }

  if (decision === 'rejected') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('scope_change_requests')
      .update({ client_acceptance: 'rejected', decision_timestamp: now, updated_at: now })
      .eq('id', requestId)
    if (error) return { error: error.message }
    revalidatePath(`/client/dashboard/${bookingRef}`)
    return { success: true }
  }

  // decision === 'accepted' -- merge into the main estimate now, for real
  // (same math admin's own approval already previewed), bump the version,
  // and run the full redefinition cascade.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parentBoq, error: boqFetchErr } = await (supabase as any)
    .from('boq_generated')
    .select('id, line_items, platform_premium_pct, bocw_cess_percent, contingency_percent, estimate_version')
    .eq('booking_ref', bookingRef)
    .neq('status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (boqFetchErr) return { error: boqFetchErr.message }
  if (!parentBoq) return { error: 'No live estimate found for this booking -- cannot merge scope change into it.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = Array.isArray(request.proposed_additions) && request.proposed_additions.length > 0
    ? request.proposed_additions
    : (Array.isArray(request.supervisor_rough_estimate) ? request.supervisor_rough_estimate : [])
  if (rawItems.length === 0) {
    return { error: 'This request has no proposed items to merge -- nothing to accept.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newLineItems = rawItems.map((item: any, idx: number) => ({
    // 'LAB-' prefix matters: generateBOQ/processClientRemarks compute
    // subtotal_labour by filtering on this exact skuCode prefix, not the
    // category field -- matched here deliberately.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // The client has already explicitly agreed to exactly this change and its
  // total -- this goes straight to accepted, no second redundant generic
  // accept step.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: boqUpdateErr } = await (supabase as any)
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
      status: 'accepted',
      client_accepted_at: now,
      updated_at: now,
    })
    .eq('id', parentBoq.id)
  if (boqUpdateErr) return { error: boqUpdateErr.message }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: scReqErr } = await (supabase as any)
    .from('scope_change_requests')
    .update({ client_acceptance: 'accepted', decision_timestamp: now, updated_at: now })
    .eq('id', requestId)
  if (scReqErr) return { error: scReqErr.message }

  const regenResult = await regeneratePlanForRevisedEstimate(bookingRef)
  const redistributeResult = await redistributeMilestonePayments(bookingRef, totalAmount)

  const { data: { user: actingUser } } = await supabase.auth.getUser()
  await notifyCoordinatorsOfRevision(bookingRef, newVersionLabel, totalAmount, actingUser?.id ?? null)

  // The acceptance itself (boq + scope_change_requests) already succeeded
  // above -- a cascade failure surfaces as a real error for staff to act
  // on, rather than silently leaving a plan that looks regenerated but
  // isn't.
  if (regenResult.error) return { error: `Scope change accepted, but plan regeneration failed: ${regenResult.error}` }
  if (redistributeResult.error) return { error: `Scope change accepted, but payment redistribution failed: ${redistributeResult.error}` }

  revalidatePath(`/client/dashboard/${bookingRef}`)
  return { success: true }
}

export async function submitClientScopeChange(
  bookingRef: string,
  data: {
    change_type: string
    description: string
    justification_cos: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rough_items: any[]
    timeline_concern: string
  },
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.from('scope_change_requests').insert({
    booking_ref: bookingRef,
    change_type: data.change_type,
    change_status: 'draft',
    raised_by_role: 'client',
    trigger_type: 'client_demand',
    client_request: data.description,
    justification_cos: data.justification_cos,
    supervisor_rough_estimate: data.rough_items,
    site_head_remarks: data.timeline_concern,
    requested_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath(`/client/dashboard/${bookingRef}`)
  return { success: true }
}
