'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

// Admin's decision on a job request that is not moving (owner, 31 Oct 2026): keep it live to
// pursue, or reject it. A rejected request leaves the active job list but stays on record as
// "request received but rejected" (supabase/migrations/20261031_job_movement_log_widen_and_request_decision.sql).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logJobMovement } from '@/lib/jobMovementLog'

export async function decideJobRequest(
  bookingRef: string,
  decision: 'pursue' | 'rejected',
  reason: string,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: 'Give the reason for this decision.' }
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  if (!['admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    return { error: 'Only Admin can decide on a job request.' }
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    request_decision: decision,
    request_decision_reason: reason.trim(),
    request_decided_at: now,
    request_decided_by: user.id,
  }
  if (decision === 'rejected') {
    update.is_active = false
    update.status = 'request_rejected'
  } else {
    update.is_active = true
  }

  const { error } = await supabase.from('guest_enquiries').update(update).eq('booking_ref', bookingRef)
  if (error) return { error: error.message }

  await logJobMovement(supabase, {
    bookingRef, stage: 'request', action: decision === 'rejected' ? 'rejected' : 'decided',
    fromUserId: user.id, fromRole: profile?.platform_role ?? null,
    remarks: (decision === 'rejected' ? 'Request rejected: ' : 'Keep live to pursue: ') + reason.trim(),
  })

  revalidatePath('/admin/job-movements')
  revalidatePath('/admin/dashboard')
  return {}
}
