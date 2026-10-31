'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logJobMovement } from '@/lib/jobMovementLog'

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
  await logJobMovement(ctx.supabase, {
    bookingRef: params.bookingRef, stage: 'deployment', action: 'assigned', fromUserId: ctx.userId,
    itemType: 'worker', itemId: params.workerId, remarks: `Worker allocated to ${params.substageCode} for ${params.slotDate}`,
  })
  revalidatePath(`/coordinator/allocate/${params.bookingRef}`)
  revalidatePath('/coordinator/allocate')
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
  await logJobMovement(ctx.supabase, {
    bookingRef: params.bookingRef, stage: 'deployment', action: 'removed', fromUserId: ctx.userId,
    itemType: 'worker', itemId: params.workerId, remarks: `Worker removed from ${params.substageCode}`,
  })
  revalidatePath(`/coordinator/allocate/${params.bookingRef}`)
  revalidatePath('/coordinator/allocate')
  return {}
}

function listWorkingDates(start: string, end: string, skipSundays: boolean): string[] {
  const dates: string[] = []
  const cur = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cur.getTime() <= last.getTime()) {
    if (!skipSundays || cur.getUTCDay() !== 0) {
      dates.push(cur.toISOString().split('T')[0])
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

// Industry-standard pattern (ServiceTitan/BuildOps/Primavera P6, confirmed via
// research 2 Oct 2026): assignment acts on a date RANGE, not a single date --
// one action books a worker across a whole substage duration instead of one
// click per day. Also closes a real correctness bug: the single-job page's
// own existingSlots query only ever saw ITS OWN booking_ref, so the same
// worker could be double-booked onto two different jobs the same day with
// nothing to catch it. Checked here, across every booking, at commit time.
export async function allocateWorkerRange(params: {
  bookingRef: string
  substageCode: string
  workerId: string
  startDate: string
  endDate: string
  skipSundays?: boolean
}): Promise<{ error?: string; booked?: string[]; conflicts?: { date: string; bookingRef: string }[] }> {
  const ctx = await requireAllocator()
  if ('error' in ctx) return ctx
  if (!params.startDate || !params.endDate || params.endDate < params.startDate) {
    return { error: 'Invalid date range.' }
  }
  const dates = listWorkingDates(params.startDate, params.endDate, params.skipSundays ?? false)
  if (dates.length === 0) return { error: 'No working days in that range.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (ctx.supabase as any)
    .from('worker_day_slots')
    .select('slot_date, booking_ref')
    .eq('worker_id', params.workerId)
    .in('slot_date', dates)

  const takenByDate = new Map<string, string>(
    (existing ?? []).map((r: { slot_date: string; booking_ref: string }) => [r.slot_date, r.booking_ref])
  )
  const conflicts: { date: string; bookingRef: string }[] = []
  const toInsert: { worker_id: string; slot_date: string; booking_ref: string; substage_code: string; assigned_by: string; status: string }[] = []

  for (const d of dates) {
    const takenBy = takenByDate.get(d)
    if (takenBy && takenBy !== params.bookingRef) {
      conflicts.push({ date: d, bookingRef: takenBy })
      continue
    }
    if (takenBy === params.bookingRef) continue
    toInsert.push({
      worker_id: params.workerId,
      slot_date: d,
      booking_ref: params.bookingRef,
      substage_code: params.substageCode,
      assigned_by: ctx.userId,
      status: 'assigned',
    })
  }

  if (toInsert.length > 0) {
    const { error } = await ctx.supabase.from('worker_day_slots').insert(toInsert)
    if (error) return { error: error.message }
  }

  if (toInsert.length > 0) {
    await logJobMovement(ctx.supabase, {
      bookingRef: params.bookingRef, stage: 'deployment', action: 'assigned', fromUserId: ctx.userId,
      itemType: 'worker', itemId: params.workerId,
      remarks: `Worker allocated to ${params.substageCode} for ${toInsert.length} day(s), ${params.startDate} to ${params.endDate}${conflicts.length ? ` (${conflicts.length} day(s) skipped -- booked elsewhere)` : ''}`,
    })
  }
  revalidatePath(`/coordinator/allocate/${params.bookingRef}`)
  revalidatePath('/coordinator/allocate')
  return { booked: toInsert.map(r => r.slot_date), conflicts }
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
  await logJobMovement(ctx.supabase, {
    bookingRef: params.bookingRef, stage: 'deployment', action: 'raised', fromUserId: ctx.userId, toRole: 'admin',
    itemType: 'job_milestone_substage', itemId: params.substageId,
    remarks: `No ${params.trade} available in zone -- escalated: ${params.remark}`,
  })
  revalidatePath(`/coordinator/allocate/${params.bookingRef}`)
  revalidatePath('/coordinator/allocate')
  revalidatePath('/admin/coordinators')
  return {}
}
