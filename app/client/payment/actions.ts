'use server'

import { createClient } from '@/lib/supabase/server'

export async function getPaymentDetails(bookingRef: string) {
  const supabase = await createClient()

  const [milestoneResult, bookingResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('milestone_payment_schedule')
      .select('payment_amount, status')
      .eq('booking_ref', bookingRef)
      .eq('milestone_code', 'M0')
      .maybeSingle(),
    supabase.from('guest_enquiries').select('job_title, status').eq('booking_ref', bookingRef).single(),
  ])

  return {
    amount: Number(milestoneResult.data?.payment_amount ?? 0),
    jobTitle: bookingResult.data?.job_title ?? null,
    bookingRef,
    milestoneStatus: milestoneResult.data?.status ?? null,
  }
}

export async function confirmTokenPayment(
  bookingRef: string,
  utrNumber: string,
  screenshotBase64: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestone } = await (supabase as any)
    .from('milestone_payment_schedule')
    .select('payment_amount')
    .eq('booking_ref', bookingRef)
    .eq('milestone_code', 'M0')
    .maybeSingle()

  const amount = Number(milestone?.payment_amount ?? 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('payment_confirmations')
    .select('id')
    .eq('booking_ref', bookingRef)
    .eq('milestone_code', 'M0')
    .not('status', 'eq', 'rejected')
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'Payment already submitted. Please wait for coordinator verification.' }
  }

  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase as any)
    .from('payment_confirmations')
    .insert({
      booking_ref: bookingRef,
      milestone_code: 'M0',
      utr_number: utrNumber,
      screenshot_base64: screenshotBase64,
      amount,
      status: 'pending_verification',
      created_at: now,
      updated_at: now,
    })

  if (insertErr) return { success: false, error: insertErr.message }

  // Standardized on the same JSONB-array shape as Supervisor's
  // submitMilestoneEvidence -- was previously a JSON.stringify()'d string,
  // one of the 3 incompatible shapes behind Duplicate/Conflict #8.
  const [milestoneUpdate, enquiryUpdate] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('milestone_payment_schedule')
      .update({ status: 'verification_pending', evidence_submitted: [{ item: 'M0 token payment', utr_number: utrNumber, uploaded_at: now }] })
      .eq('booking_ref', bookingRef)
      .eq('milestone_code', 'M0'),
    supabase
      .from('guest_enquiries')
      .update({ status: 'payment_pending_verification' })
      .eq('booking_ref', bookingRef),
  ])

  if (milestoneUpdate.error) return { success: false, error: milestoneUpdate.error.message }
  if (enquiryUpdate.error) return { success: false, error: enquiryUpdate.error.message }

  return { success: true }
}

export async function verifyPayment(
  bookingRef: string,
  paymentConfirmationId: string,
  coordinatorId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    return { success: false, error: 'Unauthorized' }
  }

  const now = new Date().toISOString()

  // boq_generated.client_accepted_at/status are NOT touched here. They belong to the
  // client's own act of accepting an estimate (submitOverallResponse, dashboard/
  // [bookingRef]/actions.ts) -- a distinct, client-initiated event from admin verifying
  // a token payment, and one that can legitimately recur on a NEW boq_generated row when
  // the estimate is revised (survey-stage to-fro, or an execution-stage scope change) and
  // the client re-accepts. Admin's payment verification is never that event, and this
  // update was also unscoped (no boq_id filter -- would have touched every version of the
  // BOQ for this booking_ref, not just the accepted one).
  const [pcUpdate, milestoneUpdate, enquiryUpdate] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('payment_confirmations')
      .update({ status: 'verified', coordinator_verified_at: now, coordinator_verified_by: coordinatorId })
      .eq('id', paymentConfirmationId),
    // coordinator_approved_at is the correct, canonical name for a
    // different event -- Supervisor's coordinatorApproveMilestone
    // ("coordinator approved milestone evidence"), confirmed by
    // PaymentCard.tsx's own "Days Waiting"/"Coordinator Approved" logic.
    // This M0 token-payment verification is a distinct fact and now writes
    // ONLY the correctly-scoped token_payment_verified_at column, resolved
    // canonically, no dual-write (Duplicate/Conflict #2).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('milestone_payment_schedule')
      .update({ status: 'paid', token_payment_verified_at: now })
      .eq('booking_ref', bookingRef)
      .eq('milestone_code', 'M0'),
    supabase
      .from('guest_enquiries')
      .update({ status: 'work_started' })
      .eq('booking_ref', bookingRef),
  ])

  const err = pcUpdate.error || milestoneUpdate.error || enquiryUpdate.error
  if (err) return { success: false, error: err.message }

  return { success: true }
}

export async function rejectPayment(
  bookingRef: string,
  paymentConfirmationId: string,
  rejectionReason: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    return { success: false, error: 'Unauthorized' }
  }

  const [pcUpdate, enquiryUpdate] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('payment_confirmations')
      .update({ status: 'rejected', rejection_reason: rejectionReason })
      .eq('id', paymentConfirmationId),
    supabase
      .from('guest_enquiries')
      .update({ status: 'estimate_accepted' })
      .eq('booking_ref', bookingRef),
  ])

  if (pcUpdate.error) return { success: false, error: pcUpdate.error.message }
  if (enquiryUpdate.error) return { success: false, error: enquiryUpdate.error.message }

  return { success: true }
}
