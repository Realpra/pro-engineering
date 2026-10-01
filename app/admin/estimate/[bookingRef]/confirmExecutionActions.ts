'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// The single "job is ready for execution" gate (project owner's explicit
// decision, 1 Oct 2026, unifying two previously-disconnected signals:
// client-driven estimate_accepted/work_started vs. the admin-only `confirmed`
// status assignSupervisor used to set). Fires once the client has consented
// (guest_enquiries.status='estimate_accepted'). Picks a real Supervisor
// (assignSupervisor's own job, now reachable here since its only caller was
// dead code) and, only when the job was Sub-Coordinator-driven, also picks
// the real Coordinator who takes over from this point -- performing the
// handoff in the same step, since a Sub-Coordinator-driven job never had a
// Coordinator assigned before now.
export async function confirmJobForExecution(params: {
  bookingRef: string
  supervisorId: string
  coordinatorUserId: string | null // required only when driving_role was 'sub_coordinator'
  wasSubCoordinatorDriven: boolean
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!['admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    return { error: 'Only Admin/Superadmin can confirm a job for execution' }
  }

  if (params.wasSubCoordinatorDriven && !params.coordinatorUserId) {
    return { error: 'A Coordinator must be picked to take over this Sub-Coordinator-driven job' }
  }

  const updatePayload: Record<string, unknown> = {
    status: 'confirmed',
    is_active: true,
    supervisor_id: params.supervisorId,
    confirmed_for_execution_at: new Date().toISOString(),
    confirmed_for_execution_by: user.id,
  }

  if (params.wasSubCoordinatorDriven && params.coordinatorUserId) {
    updatePayload.driving_role = 'coordinator'
    updatePayload.driving_user_id = params.coordinatorUserId
    updatePayload.sub_coordinator_handoff_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('guest_enquiries')
    .update(updatePayload)
    .eq('booking_ref', params.bookingRef)
  if (error) return { error: error.message }

  revalidatePath(`/admin/estimate/${params.bookingRef}`)
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/coordinators')
  return {}
}
