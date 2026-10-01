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
