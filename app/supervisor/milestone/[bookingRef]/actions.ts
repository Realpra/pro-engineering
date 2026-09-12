'use server'

import { createClient } from '@/lib/supabase/server'

export async function submitMilestoneEvidence({
  bookingRef,
  milestoneId,
  milestoneCode,
  notes,
  workerId,
}: {
  bookingRef: string
  milestoneId: string
  milestoneCode: string
  notes: string
  workerId: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('milestone_payment_schedule')
    .update({
      status: 'evidence_submitted',
      evidence_submitted: {
        notes,
        submitted_by: workerId,
        submitted_at: now,
        milestone_code: milestoneCode,
      },
      supervisor_submitted_at: now,
      updated_at: now,
    })
    .eq('id', milestoneId)
    .eq('booking_ref', bookingRef)

  if (error) return { error: error.message }

  await supabase
    .from('guest_enquiries')
    .update({ status: 'milestone_review' })
    .eq('booking_ref', bookingRef)

  return { success: true }
}

export async function coordinatorApproveMilestone({
  milestoneId,
  bookingRef,
}: {
  milestoneId: string
  bookingRef: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('milestone_payment_schedule')
    .update({
      status: 'coordinator_approved',
      coordinator_approved_at: now,
      updated_at: now,
    })
    .eq('id', milestoneId)
    .eq('booking_ref', bookingRef)

  if (error) return { error: error.message }
  return { success: true }
}

export async function releaseMilestonePayment({
  milestoneId,
  bookingRef,
}: {
  milestoneId: string
  bookingRef: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('milestone_payment_schedule')
    .update({
      status: 'payment_released',
      payment_released_at: now,
      updated_at: now,
    })
    .eq('id', milestoneId)
    .eq('booking_ref', bookingRef)

  if (error) return { error: error.message }
  return { success: true }
}
