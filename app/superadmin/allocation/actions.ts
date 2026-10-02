'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { allocateWorkerRange } from '../../coordinator/allocate/[bookingRef]/actions'

async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.platform_role !== 'super_admin') return { error: 'Not authorized' as const }
  return { supabase, userId: user.id }
}

// Last hop of the escalation chain (Coordinator's own zones -> Admin
// platform-wide -> Superadmin). Reuses the same cross-job double-booking
// guard as every other level.
export async function superadminResolveEscalation(
  escalationId: string,
  bookingRef: string,
  substageCode: string,
  workerId: string,
  slotDate: string,
): Promise<{ error?: string }> {
  const ctx = await requireSuperadmin()
  if ('error' in ctx) return ctx

  const rangeRes = await allocateWorkerRange({ bookingRef, substageCode, workerId, startDate: slotDate, endDate: slotDate, skipSundays: false })
  if (rangeRes.error) return { error: rangeRes.error }
  if ((rangeRes.conflicts?.length ?? 0) > 0) {
    return { error: `That worker is already booked on ${rangeRes.conflicts![0].bookingRef} that day.` }
  }

  const { error } = await ctx.supabase
    .from('worker_allocation_escalations')
    .update({ status: 'resolved', resolved_worker_id: workerId, resolved_by: ctx.userId, resolved_at: new Date().toISOString() })
    .eq('id', escalationId)
  if (error) return { error: error.message }

  revalidatePath('/superadmin/allocation')
  revalidatePath('/admin/coordinators')
  revalidatePath('/coordinator/allocate')
  return {}
}

// Genuinely nobody platform-wide, at any tier -- Superadmin accepts the
// gap (closes the escalation without a worker) rather than it sitting open
// forever. The original reason stays on record via escalated_to_superadmin_remark.
export async function acceptAllocationGap(escalationId: string): Promise<{ error?: string }> {
  const ctx = await requireSuperadmin()
  if ('error' in ctx) return ctx
  const { error } = await ctx.supabase
    .from('worker_allocation_escalations')
    .update({ status: 'cancelled', resolved_by: ctx.userId, resolved_at: new Date().toISOString() })
    .eq('id', escalationId)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/allocation')
  return {}
}
