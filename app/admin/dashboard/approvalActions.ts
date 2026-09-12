'use server'

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
