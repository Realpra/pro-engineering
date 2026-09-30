'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// SA-ROUTE spec (June log line 40012-40016): "Confirm day plan button locks
// route." route_confirmed/route_locked_at already existed live (migration
// 20260628_supervisor_schedule.sql) but were only ever written as `false`/
// null by Sub-Coordinator's manual-add path -- no Supervisor-side action
// ever set them true. This is that missing action.
export async function confirmDayPlan(supervisorId: string, date: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('supervisor_daily_routes')
    .update({ route_confirmed: true, route_locked_at: new Date().toISOString() })
    .eq('supervisor_id', supervisorId)
    .eq('scheduled_date', date)
  if (error) return { error: error.message }
  revalidatePath('/supervisor/route')
  revalidatePath('/supervisor/route/plan')
  revalidatePath('/supervisor/dashboard')
  return {}
}

export type ManualSlotInput = {
  supervisorId: string
  scheduledDate: string
  slotType: string
  bookingRef: string | null
  siteAddress: string | null
  slotStart: string
  slotEnd: string
  departFrom: string | null
  departTime: string | null
  travelMinutes: number | null
  workDurationMinutes: number | null
  nextBookingRef: string | null
  travelToNextMinutes: number | null
  lunchBreak: boolean
  ltfNote: string | null
}

// "+ Add Slot to Route" (app/supervisor/route/plan) previously had no
// onClick/actions.ts at all (PENDING #26) -- every field was collected and
// discarded. Mirrors the shape of app/sub-coordinator/actions.ts's
// addRouteSlotManually, but scoped to the requesting supervisor's own id
// and marked planned_by='supervisor' (self-planned) rather than
// sub-coordinator-planned.
export async function addSlotManually(input: ManualSlotInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  let siteId: string | null = null
  if (input.bookingRef) {
    const { data: enquiry } = await supabase
      .from('guest_enquiries')
      .select('id')
      .eq('booking_ref', input.bookingRef)
      .maybeSingle()
    siteId = enquiry?.id ?? null
  }

  // next_site_id is the same UUID-referencing-guest_enquiries.id column as
  // site_id (confirmed by the real test insert failure fixed in f568b68) --
  // resolve it the same way, not the booking_ref string the form collects.
  let nextSiteId: string | null = null
  if (input.nextBookingRef) {
    const { data: nextEnquiry } = await supabase
      .from('guest_enquiries')
      .select('id')
      .eq('booking_ref', input.nextBookingRef)
      .maybeSingle()
    nextSiteId = nextEnquiry?.id ?? null
  }

  const { error } = await supabase.from('supervisor_daily_routes').insert({
    supervisor_id: input.supervisorId,
    scheduled_date: input.scheduledDate,
    slot_type: input.slotType,
    site_id: siteId,
    site_address: input.siteAddress,
    slot_start: input.slotStart,
    slot_end: input.slotEnd,
    depart_from: input.departFrom,
    depart_time: input.departTime,
    travel_minutes: input.travelMinutes,
    work_duration_minutes: input.workDurationMinutes,
    next_site_id: nextSiteId,
    travel_to_next_minutes: input.travelToNextMinutes,
    lunch_break: input.lunchBreak,
    ltf_note: input.ltfNote,
    visit_status: 'scheduled',
    route_confirmed: false,
    planned_by: 'supervisor',
    report_status: 'pending',
  })
  if (error) return { error: error.message }
  revalidatePath('/supervisor/route/plan')
  revalidatePath('/supervisor/route')
  revalidatePath('/supervisor/dashboard')
  return {}
}

// Project owner's rule (29 Sep 2026): Supervisor proposing NOT to do a
// scheduled day's work moves it to "pending" by default -- it stays assigned
// only if a higher role (superadmin/admin/coordinator/sub-coordinator)
// explicitly overrides the proposal (see overrideDecline in
// app/coordinator/visit-requests/actions.ts). Needs
// 20260929_supervisor_daily_routes_decline_override.sql run first.
//
// FIXED 30 Sep 2026 (real bug caught by a live re-decline test): a slot
// declined, then overridden, then declined a second time kept the FIRST
// cycle's override_confirmed_at -- since Coordinator's query only shows
// slots where that's still null, the second, genuinely-new decline never
// appeared as needing a decision at all. Every fresh decline must clear the
// previous cycle's override fields, not just set its own.
export async function declineSlot(slotId: string, supervisorUserId: string, reason: string): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: 'Explain why you cannot do this visit.' }
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('supervisor_daily_routes')
    .update({
      visit_status: 'supervisor_declined',
      decline_reason: reason.trim(),
      declined_at: new Date().toISOString(),
      declined_by: supervisorUserId,
      override_confirmed_at: null,
      override_confirmed_by: null,
    })
    .eq('id', slotId)
  if (error) return { error: error.message }
  revalidatePath('/supervisor/route')
  revalidatePath('/supervisor/route/plan')
  revalidatePath('/coordinator/visit-requests')
  return {}
}

// The "balance of all pending" (declined, not overridden by a higher role)
// is open for ANY supervisor to pick up into their own empty slot -- not
// only the one who originally declined it.
export async function claimPendingSlot(params: {
  slotId: string
  supervisorId: string
  scheduledDate: string
  slotStart: string
  slotEnd: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('supervisor_daily_routes')
    .update({
      supervisor_id: params.supervisorId,
      scheduled_date: params.scheduledDate,
      slot_start: params.slotStart,
      slot_end: params.slotEnd,
      visit_status: 'scheduled',
      decline_reason: null,
      declined_at: null,
      declined_by: null,
      planned_by: 'supervisor',
    })
    .eq('id', params.slotId)
    .eq('visit_status', 'supervisor_declined')
    .is('override_confirmed_at', null)
  if (error) return { error: error.message }
  revalidatePath('/supervisor/route')
  revalidatePath('/supervisor/route/plan')
  return {}
}
