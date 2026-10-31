'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

// Owner, 31 Oct 2026: a Coordinator or Sub-Coordinator who gets the wrong job (wrong zone,
// too busy) returns it to Admin with a reason. The job goes back to Admin's routing list
// (driving role/user cleared). Counted as a routing send-back for the "pending job" rule.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logJobMovement } from '@/lib/jobMovementLog'

export async function returnJobToAdmin(bookingRef: string, reason: string): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: 'Give the reason for returning the job.' }
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  const role = profile?.platform_role ?? ''
  if (!['coordinator', 'sub_coordinator'].includes(role)) {
    return { error: 'Only the Coordinator or Sub-Coordinator the job was routed to can return it.' }
  }

  const { data: rows, error } = await supabase
    .from('guest_enquiries')
    .update({ driving_role: null, driving_user_id: null, driving_assigned_at: null, driving_assigned_by: null })
    .eq('booking_ref', bookingRef)
    .eq('driving_user_id', user.id)
    .is('confirmed_for_execution_at', null)
    .select('id')
  if (error) return { error: error.message }
  if (!rows || rows.length === 0) return { error: 'This job is not routed to you, or is already confirmed for execution.' }

  await logJobMovement(supabase, {
    bookingRef, stage: 'routing', action: 'returned',
    fromUserId: user.id, fromRole: role, toRole: 'admin', remarks: reason.trim(),
  })
  revalidatePath('/coordinator/jobs')
  revalidatePath('/sub-coordinator/jobs')
  revalidatePath('/admin/coordinators')
  return {}
}
