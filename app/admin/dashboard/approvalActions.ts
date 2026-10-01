'use server'

// DEAD CODE -- called only by app/admin/dashboard/WorkersTable.tsx, itself never imported
// by any page (confirmed by repo-wide grep, project owner decision 1 Oct 2026). Also has a
// real design flaw independent of being unreachable: every step below overwrites the same
// approved_by/approved_at columns Admin's live final-approval screen (app/admin/workers/
// WorkerCard.tsx) uses to show "Approved by X on date" -- do not wire this back in as-is.
// The live, correct chain is app/sub-coordinator/actions.ts + app/coordinator/workers/
// actions.ts + app/admin/workers/actions.ts, each with its own dedicated remark column.

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function reviewWorker(workerId: string, reviewerId: string) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('workers')
    .update({
      approval_status: 'sub_coordinator_reviewed',
      approved_by: reviewerId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/dashboard')
  return {}
}

export async function approveWorker(workerId: string, approverId: string) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('workers')
    .update({
      is_active: true,
      approval_status: 'coordinator_approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/dashboard')
  return {}
}

export async function returnForCorrection(
  workerId: string,
  reason: string,
  correctionAction: string,
  resubmissionAllowed: boolean,
  actorId: string
) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('workers')
    .update({
      is_active: false,
      approval_status: resubmissionAllowed ? 'returned_for_correction' : 'rejected',
      rejection_reason: reason,
      correction_action: correctionAction,
      approved_by: actorId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/dashboard')
  return {}
}

export async function sendToAdmin(workerId: string, actorId: string) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('workers')
    .update({
      approval_status: 'pending_admin_approval',
      approved_by: actorId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/dashboard')
  return {}
}

export async function rejectWorker(workerId: string, reason: string, rejectorId: string) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('workers')
    .update({
      is_active: false,
      approval_status: 'rejected',
      rejection_reason: reason,
      approved_by: rejectorId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/dashboard')
  return {}
}
