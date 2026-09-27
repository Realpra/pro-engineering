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

  // current_job_id has a confirmed dual-meaning bug: this path writes a
  // job_milestone_substages id into it, while Sub-Coordinator's own
  // assignWorkerToJob writes a guest_enquiries id into the SAME column --
  // two different entity types sharing one column. Add the correctly-typed
  // current_substage_id alongside (Amendment 3: an addition to the frozen
  // workers table, not a re-opening of it) rather than fixing this one side
  // in a way that could break an out-of-scope reader relying on
  // current_job_id's existing truthiness. See 20260927_workers_current_job_split.sql.
  const { error: workerErr } = await (supabase as AnyRecord)
    .from('workers')
    .update({ current_job_booking_ref: substage.booking_ref, current_job_id: substageId, current_substage_id: substageId })
    .eq('id', workerId)

  if (workerErr) return { error: workerErr.message }

  // worker_day_slots is a confirmed dead-end write -- inserted here on every
  // assignment but never read anywhere in the repo (job_milestone_substages
  // .labour_assignments, updated above, is the actual source every UI reads).
  // Retired per Duplicate/Conflict #12 -- see 20260927_retire_dead_sink_tables.sql.

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
    .update({ current_job_booking_ref: null, current_job_id: null, current_substage_id: null })
    .eq('id', workerId)

  if (workerErr) return { error: workerErr.message }

  revalidatePath('/supervisor/milestone-tracker')
  return { success: true }
}
