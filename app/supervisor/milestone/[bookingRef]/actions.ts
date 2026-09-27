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

  // evidence_submitted was written in 3 incompatible shapes depending on
  // which role's action ran (this one: a plain object; Client's
  // confirmTokenPayment: a JSON string; Admin's PaymentCard.tsx reads it as
  // an ARRAY and counts .length -- always 0 for the first two shapes).
  // Standardize on the JSONB-array convention job_milestone_substages.
  // evidence_submitted already uses.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('milestone_payment_schedule')
    .update({
      status: 'evidence_submitted',
      evidence_submitted: [{
        item: milestoneCode,
        notes,
        uploaded_by: workerId,
        uploaded_at: now,
      }],
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

  // coordinator_approved_at is also written by Client's verifyPayment
  // (app/client/payment/actions.ts) for a completely different event --
  // "coordinator verified the client's M0 token payment UTR" -- sharing one
  // column name for two distinct real-world facts (Duplicate/Conflict #2).
  // milestone_evidence_approved_at is the correctly-scoped new column for
  // THIS event; coordinator_approved_at is kept in sync for out-of-scope
  // readers (admin/dashboard, PaymentCard.tsx, MilestoneTabs.tsx) not yet
  // migrated to the new name.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('milestone_payment_schedule')
    .update({
      status: 'coordinator_approved',
      coordinator_approved_at: now,
      milestone_evidence_approved_at: now,
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
