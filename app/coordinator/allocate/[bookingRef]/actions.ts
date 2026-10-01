'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireAllocator() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    return { error: 'Not authorized' as const }
  }
  return { supabase, userId: user.id }
}

// Reuses worker_day_slots as-is (the project owner's own explicit rejection
// of inventing a new worker-routing table applies here too -- this is the
// same table Supervisor's assignWorkerToSubstage already writes, restored
// per that earlier decision rather than redesigned). Coordinator writing the
// same shape means Supervisor's later reassignment-within-his-own-jobs
// (already agreed, unchanged) operates on the same real rows.
export async function allocateWorker(params: {
  bookingRef: string
  substageCode: string
  workerId: string
  slotDate: string
}): Promise<{ error?: string }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  const { error } = await ctx.supabase.from('worker_day_slots').insert({
    worker_id: params.workerId,
    slot_date: params.slotDate,
    booking_ref: params.bookingRef,
    substage_code: params.substageCode,
    assigned_by: ctx.userId,
    status: 'assigned',
  })
  if (error) return { error: error.message }
  revalidatePath(`/coordinator/allocate/${params.bookingRef}`)
  return {}
}

export async function removeAllocation(params: {
  bookingRef: string
  substageCode: string
  workerId: string
}): Promise<{ error?: string }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  const { error } = await ctx.supabase
    .from('worker_day_slots')
    .delete()
    .eq('booking_ref', params.bookingRef)
    .eq('substage_code', params.substageCode)
    .eq('worker_id', params.workerId)
  if (error) return { error: error.message }
  revalidatePath(`/coordinator/allocate/${params.bookingRef}`)
  return {}
}

// Escalation: Coordinator's own zone-scoped worker pool has nothing suitable
// for this trade/skill -- Admin gets a platform-wide, unscoped pick instead
// (project owner's confirmed simplification, replacing an earlier proposed
// zone-adjacency ranking algorithm).
export async function escalateAllocation(params: {
  bookingRef: string
  substageId: string
  trade: string
  skillLevelNeeded: string | null
  remark: string
}): Promise<{ error?: string }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  const { error } = await ctx.supabase.from('worker_allocation_escalations').insert({
    booking_ref: params.bookingRef,
    substage_id: params.substageId,
    trade: params.trade,
    skill_level_needed: params.skillLevelNeeded,
    raised_by: ctx.userId,
    remark: params.remark,
    status: 'pending',
  })
  if (error) return { error: error.message }
  revalidatePath(`/coordinator/allocate/${params.bookingRef}`)
  revalidatePath('/admin/coordinators')
  return {}
}
