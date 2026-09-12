'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
  // eslint-disable-next-line no-console
  console.log('[acceptTerms] boqId:', boqId)

  const supabase = await createClient()

  const { error } = await supabase
    .from('boq_generated')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', boqId)

  if (error) {
    // eslint-disable-next-line no-console
    console.log('[acceptTerms] error:', error)
    return { error: error.message }
  }

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
