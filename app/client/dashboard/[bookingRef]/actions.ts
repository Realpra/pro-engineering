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

    // Per the project owner's explicit verdict (9 Oct 2026): an execution-
    // stage scope change, once merged into this same boq_generated row
    // (app/admin/scope|milestones/actions.ts), must redefine the whole job
    // the moment the client re-accepts it -- "it gets to become a new job
    // from when it happens... milestone/sub-stage and every act is
    // redefined". The job's FIRST-ever acceptance (no money has moved yet)
    // must NOT trigger this -- only a genuine mid-execution revision does.
    // Real signal, not guessed: at least one milestone_payment_schedule row
    // for this booking already reached a paid terminal state ('paid' for
    // M0, 'payment_released' for M1-M4) -- "amount received is continuing".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: paidCheck } = await (supabase as any)
      .from('milestone_payment_schedule')
      .select('id')
      .eq('booking_ref', bookingRef)
      .in('status', ['paid', 'payment_released'])
      .limit(1)

    if (paidCheck && paidCheck.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: acceptedBoq } = await (supabase as any)
        .from('boq_generated')
        .select('total_amount, estimate_version_label')
        .eq('id', boqId)
        .maybeSingle()

      const regenResult = await regeneratePlanForRevisedEstimate(bookingRef)
      const redistributeResult = await redistributeMilestonePayments(
        bookingRef,
        Number(acceptedBoq?.total_amount ?? 0),
      )

      const { data: { user: actingUser } } = await supabase.auth.getUser()
      await notifyCoordinatorsOfRevision(
        bookingRef,
        acceptedBoq?.estimate_version_label ?? 'revised estimate',
        Number(acceptedBoq?.total_amount ?? 0),
        actingUser?.id ?? null,
      )

      // A redefinition-cascade failure must not be swallowed silently --
      // the acceptance itself already succeeded (boqRes/enquiryRes above),
      // so this surfaces as a real error for staff to act on rather than a
      // plan that looks regenerated but silently wasn't.
      if (regenResult.error) return { error: `Estimate accepted, but plan regeneration failed: ${regenResult.error}` }
      if (redistributeResult.error) return { error: `Estimate accepted, but payment redistribution failed: ${redistributeResult.error}` }
    }
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
