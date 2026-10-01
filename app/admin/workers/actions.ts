'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type WorkerActionResult = { success: true } | { error: string }

// ACTION 1 — final admin approval
export async function adminApproveWorker(
  workerId: string,
  adminUserId: string
): Promise<WorkerActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workers')
    .update({
      approval_status: 'admin_approved',
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/workers')
  return { success: true }
}

// ACTION 1b — final approval, but flagged for a safety-license/government-
// certificate renewal (project owner's confirmed design, 1 Oct 2026): the
// worker IS admin_approved (deployable) like a plain approval, with an
// overlay flag for follow-up -- a genuinely new, separate concept from the
// pre-existing literal 'approved' value on 3 rows (Session 66's confirmed
// data-sanity canary, left untouched deliberately) and from the "Previously
// Approved" tab this repoints at these columns instead.
export async function adminApproveWorkerWithRenewalFlag(
  workerId: string,
  adminUserId: string,
  renewalReason: string,
): Promise<WorkerActionResult> {
  if (!renewalReason.trim()) return { error: 'State what needs renewal (e.g. safety license expiring, BOCW renewal due).' }
  const supabase = await createClient()

  const { error } = await supabase
    .from('workers')
    .update({
      approval_status: 'admin_approved',
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
      admin_renewal_flag_reason: renewalReason.trim(),
      admin_renewal_flagged_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/workers')
  return { success: true }
}

// ACTION 1c — approve provisionally, subject to remarked compliance (E7-i,
// WorkersTable_Review workbook, 1 Oct 2026): a 4th, distinct admin action alongside
// plain approve/approve-with-renewal-flag/return/reject -- the worker is deployable
// now, with a specific compliance item still open (not a credential-expiry renewal,
// which has its own mechanism above).
export async function adminApproveProvisional(
  workerId: string,
  adminUserId: string,
  complianceRemarks: string,
): Promise<WorkerActionResult> {
  if (!complianceRemarks.trim()) return { error: 'State the compliance item this approval is provisional on.' }
  const supabase = await createClient()

  const { error } = await supabase
    .from('workers')
    .update({
      approval_status: 'admin_approved',
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
      admin_provisional_remarks: complianceRemarks.trim(),
      admin_provisional_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/workers')
  return { success: true }
}

// ACTION 2 — return to coordinator for correction
export async function adminReturnWorker(
  workerId: string,
  adminUserId: string,
  correctionAction: string
): Promise<WorkerActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workers')
    .update({
      approval_status: 'returned_for_correction',
      correction_action: correctionAction,
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/workers')
  return { success: true }
}

// ACTION 3 — reject
export async function adminRejectWorker(
  workerId: string,
  adminUserId: string,
  rejectionReason: string
): Promise<WorkerActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workers')
    .update({
      approval_status: 'rejected',
      rejection_reason: rejectionReason,
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/workers')
  return { success: true }
}

// ACTION 4 — per-competency admin decision
export async function adminUpdateCompetency(
  workerId: string,
  adminUserId: string,
  competencyField: string,
  statusValue: string,
  remarksValue: string
): Promise<WorkerActionResult> {
  const supabase = await createClient()

  const statusField = `${competencyField}_status`
  const remarksField = `${competencyField}_admin_remarks`

  const updatePayload: Record<string, string> = {
    [statusField]: statusValue,
    [remarksField]: remarksValue,
  }

  // dynamic column names — mirror the project's untyped-client escape hatch
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      update: (values: Record<string, string>) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  })
    .from('workers')
    .update(updatePayload)
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/workers')
  return { success: true }
}

// ACTION 5 — trigger a re-assessment
export async function adminTriggerReassessment(
  workerId: string,
  adminUserId: string,
  competency: string,
  reason: string
): Promise<WorkerActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workers')
    .update({
      reassessment_triggered_by: adminUserId,
      reassessment_triggered_at: new Date().toISOString(),
      reassessment_reason: reason,
      reassessment_competency: competency,
      approval_status: 'returned_for_reassessment',
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/workers')
  return { success: true }
}

// ─── Part B: Competency Matrix + Schedule Assessment (WorkersTable_Review workbook,
// 1 Oct 2026, decision E6: "BUILD WHAT IS STATED FULL FOR REAL LIVE CASE") ──────────
//
// Rebuilt here, not ported verbatim: the dead app/admin/dashboard/WorkersTable.tsx's
// own double-booking check and its scheduleAssessment action (app/admin/dashboard/
// actions.ts) both query/insert columns (slot_time, sector, module_code, max_candidates,
// booked_count, status on assessment_slots) that do not exist in the real migration
// (supabase/migrations/20260622_assessment_slots.sql: id/slot_date/time_slot/
// assessor_name/created_at only) -- confirmed by repo-wide grep, there is no later
// migration that adds them. Since that dead code was never run against the live
// database (its only caller, WorkersTable.tsx, has zero imports), this was never
// caught. Built here against the real migration's columns instead -- still flagged
// for a live information_schema check before being called frozen, per this project's
// own "never guess live-only schema" rule.

export type CompetencyRow = { module_code: string; declared: boolean; mcq_passed: boolean | null; score: number | null }

export async function getWorkerCompetency(workerId: string): Promise<CompetencyRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('worker_competency')
    .select('module_code, declared, mcq_passed, score')
    .eq('worker_id', workerId)
  return data ?? []
}

export async function getTrainersForModule(moduleCode: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data: specialised } = await supabase
    .from('trainers')
    .select('id, name')
    .eq('is_active', true)
    .contains('specialisation', [moduleCode])
  if (specialised && specialised.length > 0) return specialised
  const { data: anyActive } = await supabase.from('trainers').select('id, name').eq('is_active', true)
  return anyActive ?? []
}

export async function scheduleAssessmentForWorker(
  workerId: string,
  moduleCode: string,
  slotDate: string,
  timeSlot: 'morning' | 'afternoon',
  trainerName: string,
): Promise<{ error?: string }> {
  if (!slotDate || !trainerName) return { error: 'Date and trainer are required.' }
  const supabase = await createClient()

  const { data: dup } = await supabase
    .from('assessment_bookings')
    .select('id, assessment_slots!inner(slot_date)')
    .eq('worker_id', workerId)
    .eq('module_code', moduleCode)
    .gte('assessment_slots.slot_date', new Date().toISOString().slice(0, 10))
  if (dup && dup.length > 0) return { error: 'This worker already has a pending assessment booked for this module.' }

  const { data: existingSlot, error: findErr } = await supabase
    .from('assessment_slots')
    .select('id')
    .eq('slot_date', slotDate)
    .eq('time_slot', timeSlot)
    .eq('assessor_name', trainerName)
    .maybeSingle()
  if (findErr) return { error: findErr.message }

  let slotId = existingSlot?.id as string | undefined
  if (!slotId) {
    const { data: newSlot, error: slotError } = await supabase
      .from('assessment_slots')
      .insert({ slot_date: slotDate, time_slot: timeSlot, assessor_name: trainerName })
      .select('id')
      .single()
    if (slotError) return { error: slotError.message }
    slotId = newSlot.id
  }

  const { error: bookingError } = await supabase
    .from('assessment_bookings')
    .insert({ worker_id: workerId, slot_id: slotId, module_code: moduleCode })
  if (bookingError) return { error: bookingError.message }

  revalidatePath('/admin/workers')
  return {}
}
