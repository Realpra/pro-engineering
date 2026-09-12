'use server'

import { createClient } from '@/lib/supabase/server'

export type LineItemResponse = {
  skuCode: string
  action: 'accepted' | 'review_requested' | 'rejected'
  remarks: string
  suggestedRate: number | null
  suggestedQty: number | null
  // Snapshot of original BOQ values at the time the client submitted — used by
  // the coordinator panel so it never depends on the live (possibly modified) line_items.
  skuName: string | null
  description: string | null
  unit: string | null
  originalQty: number | null
  originalRate: number | null
  originalAmount: number | null
}

export async function submitClientResponse(
  bookingRef: string,
  boqId: string,
  estimateVersion: number,
  responseType: 'accepted' | 'review_requested' | 'rejected',
  overallRemarks: string,
  lineItemResponses: LineItemResponse[],
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const now = new Date().toISOString()

  // Insert response record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase as any)
    .from('estimate_client_responses')
    .insert({
      booking_ref:          bookingRef,
      boq_id:               boqId,
      estimate_version:     estimateVersion,
      response_type:        responseType,
      overall_remarks:      overallRemarks || null,
      line_item_responses:  lineItemResponses,
      responded_at:         now,
    })

  if (insertErr) return { error: (insertErr as { message: string }).message }

  // Update statuses based on response type
  if (responseType === 'accepted') {
    const [boqRes, enquiryRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('boq_generated')
        .update({ status: 'accepted', client_accepted_at: now, updated_at: now })
        .eq('id', boqId),
      supabase
        .from('guest_enquiries')
        .update({ status: 'estimate_accepted' })
        .eq('booking_ref', bookingRef),
    ])
    if (boqRes.error) return { error: (boqRes.error as { message: string }).message }
    if (enquiryRes.error) return { error: enquiryRes.error.message }
  } else if (responseType === 'rejected') {
    const [boqRes, enquiryRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('boq_generated')
        .update({ status: 'rejected', client_rejected_at: now, updated_at: now })
        .eq('id', boqId),
      supabase
        .from('guest_enquiries')
        .update({ status: 'estimate_rejected' })
        .eq('booking_ref', bookingRef),
    ])
    if (boqRes.error) return { error: (boqRes.error as { message: string }).message }
    if (enquiryRes.error) return { error: enquiryRes.error.message }
  } else {
    const [boqRes, enquiryRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('boq_generated')
        .update({ status: 'client_review', updated_at: now })
        .eq('id', boqId),
      supabase
        .from('guest_enquiries')
        .update({ status: 'client_review_requested' })
        .eq('booking_ref', bookingRef),
    ])
    if (boqRes.error) return { error: (boqRes.error as { message: string }).message }
    if (enquiryRes.error) return { error: enquiryRes.error.message }
  }

  return {}
}
