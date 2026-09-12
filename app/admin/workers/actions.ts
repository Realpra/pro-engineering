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
