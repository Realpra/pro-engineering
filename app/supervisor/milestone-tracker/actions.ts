'use server'

import { createClient } from '@/lib/supabase/server'
import { syncMilestonePaymentStatus } from '@/lib/milestones'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

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

  // current_job_id had a confirmed dual-meaning bug: this path wrote a
  // job_milestone_substages id into it, while Sub-Coordinator's own
  // assignWorkerToJob writes a guest_enquiries id into the SAME column --
  // two different entity types sharing one column. current_substage_id is
  // the correctly-typed column added alongside it (Amendment 3: an addition
  // to the frozen workers table, not a re-opening of it) -- see
  // 20260927_workers_current_job_split.sql. Resolved canonically, not
  // dual-written: this path now writes ONLY current_substage_id, the
  // correctly-typed field for what it actually knows (a substage id).
  // current_job_id is left untouched for Sub-Coordinator's separate
  // enquiry-id path, which this action never touches.
  const { error: workerErr } = await (supabase as AnyRecord)
    .from('workers')
    .update({ current_job_booking_ref: substage.booking_ref, current_substage_id: substageId })
    .eq('id', workerId)

  if (workerErr) return { error: workerErr.message }

  // worker_day_slots: restored per the project owner's explicit rejection of
  // dropping it -- this table traces to R24 in docs/ENTITY_RELATIONSHIP_FREEZE.md,
  // one of three overlapping worker-routing attempts whose proposed single
  // replacement (R27 worker_route_legs) explicitly needs the project owner's
  // own go-ahead before any redesign work starts, per that document's own
  // words ("it's a redesign, not a drip-fix"). Restoring the existing write
  // as-is rather than inventing that redesign here.
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

  const { error: workerErr } = await (supabase as AnyRecord)
    .from('workers')
    .update({ current_job_booking_ref: null, current_substage_id: null })
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
