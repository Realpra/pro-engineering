'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

async function syncMilestonePaymentStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bookingRef: string,
  milestoneCode: string,
) {
  const { data: siblings } = await supabase
    .from('job_milestone_substages')
    .select('status')
    .eq('booking_ref', bookingRef)
    .eq('milestone_code', milestoneCode)

  const rows: AnyRecord[] = siblings ?? []
  const allDone = rows.length > 0 && rows.every(s => s.status === 'supervisor_submitted' || s.status === 'completed')

  if (allDone) {
    await supabase
      .from('milestone_payment_schedule')
      .update({ status: 'supervisor_submitted', supervisor_submitted_at: new Date().toISOString() })
      .eq('booking_ref', bookingRef)
      .eq('milestone_code', milestoneCode)
  }
}

export async function markSubstageComplete(
  substageId: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('job_milestone_substages')
    .update({
      status: 'supervisor_submitted',
      completion_pct: 100,
      supervisor_submitted_at: now,
      actual_completion_date: now.split('T')[0],
      updated_at: now,
    })
    .eq('id', substageId)
    .select('booking_ref, milestone_code')
    .single()

  if (error) return { error: error.message }

  await syncMilestonePaymentStatus(supabase, updated.booking_ref, updated.milestone_code)

  revalidatePath('/supervisor/milestone-tracker')
  return { success: true }
}

export async function assignWorkerToSubstage(
  substageId: string,
  workerId: string,
  plannedDate: string,
  preInstruction: string,
  supervisorId: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: substage, error: fetchErr } = await supabase
    .from('job_milestone_substages')
    .select('labour_assignments, booking_ref, substage_code')
    .eq('id', substageId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const assignments: AnyRecord[] = Array.isArray(substage.labour_assignments) ? substage.labour_assignments : []
  assignments.push({
    workerId,
    plannedDate,
    preInstruction: preInstruction || null,
    assignedBy: supervisorId,
    assignedAt: now,
  })

  const { error: updateErr } = await supabase
    .from('job_milestone_substages')
    .update({ labour_assignments: assignments, updated_at: now })
    .eq('id', substageId)

  if (updateErr) return { error: updateErr.message }

  const { error: workerErr } = await supabase
    .from('workers')
    .update({ current_job_booking_ref: substage.booking_ref, current_job_id: substageId })
    .eq('id', workerId)

  if (workerErr) return { error: workerErr.message }

  const { error: slotErr } = await supabase.from('worker_day_slots').insert({
    worker_id: workerId,
    slot_date: plannedDate,
    booking_ref: substage.booking_ref,
    substage_code: substage.substage_code,
    assigned_by: supervisorId,
    status: 'assigned',
  })

  if (slotErr) return { error: slotErr.message }

  revalidatePath('/supervisor/milestone-tracker')
  return { success: true }
}

export async function removeWorkerFromSubstage(
  substageId: string,
  workerId: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()

  const { data: substage, error: fetchErr } = await supabase
    .from('job_milestone_substages')
    .select('labour_assignments, substage_code')
    .eq('id', substageId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const assignments: AnyRecord[] = (Array.isArray(substage.labour_assignments) ? substage.labour_assignments : []).filter(
    a => a.workerId !== workerId,
  )

  const { error: updateErr } = await supabase
    .from('job_milestone_substages')
    .update({ labour_assignments: assignments, updated_at: new Date().toISOString() })
    .eq('id', substageId)

  if (updateErr) return { error: updateErr.message }

  const { error: workerErr } = await supabase
    .from('workers')
    .update({ current_job_booking_ref: null, current_job_id: null })
    .eq('id', workerId)

  if (workerErr) return { error: workerErr.message }

  await supabase
    .from('worker_day_slots')
    .delete()
    .eq('worker_id', workerId)
    .eq('substage_code', substage.substage_code)

  revalidatePath('/supervisor/milestone-tracker')
  return { success: true }
}
