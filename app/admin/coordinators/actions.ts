'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { allocateWorkerRange } from '../../coordinator/allocate/[bookingRef]/actions'
import { logJobMovement } from '@/lib/jobMovementLog'

async function requireAdminOrAbove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!['admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    return { error: 'Not authorized' as const }
  }
  return { supabase, userId: user.id }
}

// Coordinator/Sub-Coordinator coverage: multiple states + multiple zones, kept
// as two independent arrays (project owner's explicit decision, 1 Oct 2026) --
// not nested under each other, since NCR-type zones can cross state lines.
export async function updateCoverage(
  targetUserId: string,
  coverageStates: string[],
  coverageZones: string[],
): Promise<{ error?: string }> {
  const ctx = await requireAdminOrAbove()
  if ('error' in ctx) return ctx
  const { error } = await ctx.supabase
    .from('users')
    .update({ coverage_states: coverageStates, coverage_zones: coverageZones })
    .eq('id', targetUserId)
  if (error) return { error: error.message }
  revalidatePath('/admin/coordinators')
  return {}
}

// Every new job gets driving_role/driving_user_id stamped here, whether it
// goes to a Coordinator or a Sub-Coordinator -- this is the one entry point
// for job routing confirmed across this session. A job routed to
// Sub-Coordinator has no Coordinator yet; one gets picked later, at the
// "Confirm Job for Execution" gate (app/admin/estimate -- built separately).
// Worker non-availability escalation, resolved here: Admin sees every worker
// of that trade platform-wide (no zone filter) and picks one manually, with
// a remark -- the project owner's confirmed simplification over an earlier
// proposed zone-adjacency ranking algorithm.
export async function resolveEscalation(
  escalationId: string,
  bookingRef: string,
  substageCode: string,
  workerId: string,
  slotDate: string,
): Promise<{ error?: string }> {
  const ctx = await requireAdminOrAbove()
  if ('error' in ctx) return ctx

  // Reuses the exact same cross-job double-booking guard the Coordinator's
  // own Command Center uses -- Admin resolving platform-wide must not be
  // able to double-book a worker any more than a zone-scoped Coordinator can.
  const rangeRes = await allocateWorkerRange({ bookingRef, substageCode, workerId, startDate: slotDate, endDate: slotDate, skipSundays: false })
  if (rangeRes.error) return { error: rangeRes.error }
  if ((rangeRes.conflicts?.length ?? 0) > 0) {
    return { error: `That worker is already booked on ${rangeRes.conflicts![0].bookingRef} that day.` }
  }

  const { error } = await ctx.supabase
    .from('worker_allocation_escalations')
    .update({
      status: 'resolved',
      resolved_worker_id: workerId,
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', escalationId)
  if (error) return { error: error.message }

  revalidatePath('/admin/coordinators')
  revalidatePath(`/coordinator/allocate/${bookingRef}`)
  revalidatePath('/coordinator/allocate')
  return {}
}

// Admin exhausted the platform-wide pool too -- the last hop in the chain
// the project owner specified (Coordinator -> own zones -> Admin ->
// Superadmin). Superadmin resolves it the same way, or accepts the gap.
export async function escalateEscalationToSuperadmin(
  escalationId: string,
  remark: string,
): Promise<{ error?: string }> {
  const ctx = await requireAdminOrAbove()
  if ('error' in ctx) return ctx
  const { error } = await ctx.supabase
    .from('worker_allocation_escalations')
    .update({
      status: 'escalated_to_superadmin',
      escalated_to_superadmin_at: new Date().toISOString(),
      escalated_to_superadmin_by: ctx.userId,
      escalated_to_superadmin_remark: remark,
    })
    .eq('id', escalationId)
  if (error) return { error: error.message }
  revalidatePath('/admin/coordinators')
  revalidatePath('/superadmin/allocation')
  return {}
}

export async function routeJobToDriver(
  bookingRef: string,
  driverUserId: string,
  driverRole: 'coordinator' | 'sub_coordinator',
): Promise<{ error?: string }> {
  const ctx = await requireAdminOrAbove()
  if ('error' in ctx) return ctx
  const { error } = await ctx.supabase
    .from('guest_enquiries')
    .update({
      driving_role: driverRole,
      driving_user_id: driverUserId,
      driving_assigned_at: new Date().toISOString(),
      driving_assigned_by: ctx.userId,
    })
    .eq('booking_ref', bookingRef)
  if (error) return { error: error.message }
  await logJobMovement(ctx.supabase, {
    bookingRef, stage: 'routing', action: 'forwarded',
    fromUserId: ctx.userId, toRole: driverRole, toUserId: driverUserId,
  })
  revalidatePath('/admin/coordinators')
  revalidatePath('/admin/dashboard')
  return {}
}
