'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type LogVisitRequestInput = {
  bookingRef: string
  visitCategory: 'scope_survey' | 'client_visit' | 'estimate_visit'
  requestedDate: string | null
  requestedSlot: 'morning' | 'afternoon' | 'evening' | null
  source: 'phone' | 'whatsapp' | 'email' | 'other'
  notes: string | null
  loggedByRole: 'coordinator' | 'admin'
  loggedByUserId: string
}

// Coordinator/Admin logging a request that came in by phone/WhatsApp/email --
// confirmed real need (project owner, 28-29 Sep 2026): a client's visit
// request doesn't only arrive through /book, staff receive it directly too.
export async function logVisitRequest(input: LogVisitRequestInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: enquiry } = await supabase
    .from('guest_enquiries')
    .select('booking_ref')
    .eq('booking_ref', input.bookingRef)
    .maybeSingle()
  if (!enquiry) return { error: 'No job found with that booking reference.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('site_visit_requests').insert({
    booking_ref: input.bookingRef,
    visit_category: input.visitCategory,
    requested_date: input.requestedDate,
    requested_slot: input.requestedSlot,
    requested_by_role: input.loggedByRole,
    requested_by: input.loggedByUserId,
    source: input.source,
    notes: input.notes,
    status: 'pending',
  })
  if (error) return { error: error.message }

  revalidatePath('/coordinator/visit-requests')
  return {}
}

export type ScheduleVisitRequestInput = {
  requestId: string
  bookingRef: string
  supervisorId: string
  scheduledDate: string
  slotStart: string
  slotEnd: string
  visitCategory: 'scope_survey' | 'client_visit' | 'estimate_visit'
  siteAddress: string | null
}

// Converts a pending request into the real, already-frozen
// supervisor_daily_routes assignment (same insert shape as
// app/supervisor/route/actions.ts's addSlotManually -- scheduled_date/
// slot_start/slot_end/site_id, NOT the incompatible slot_date/depart_time/
// arrive_time shape app/coordinator/routes/page.tsx queries, which was found
// this session to be stale against the live, frozen schema and left
// untouched, flagged separately).
export async function scheduleVisitRequest(input: ScheduleVisitRequestInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: enquiry } = await supabase
    .from('guest_enquiries')
    .select('id')
    .eq('booking_ref', input.bookingRef)
    .maybeSingle()
  if (!enquiry) return { error: 'Job not found for this booking reference.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: route, error: routeErr } = await (supabase as any)
    .from('supervisor_daily_routes')
    .insert({
      supervisor_id: input.supervisorId,
      scheduled_date: input.scheduledDate,
      slot_type: input.visitCategory,
      site_id: enquiry.id,
      site_address: input.siteAddress,
      slot_start: input.slotStart,
      slot_end: input.slotEnd,
      visit_status: 'scheduled',
      route_confirmed: false,
      planned_by: 'coordinator',
      report_status: 'pending',
    })
    .select('id')
    .single()
  if (routeErr) return { error: routeErr.message }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from('site_visit_requests')
    .update({ status: 'scheduled', scheduled_route_id: route.id, updated_at: new Date().toISOString() })
    .eq('id', input.requestId)
  if (updateErr) return { error: updateErr.message }

  revalidatePath('/coordinator/visit-requests')
  revalidatePath('/supervisor/route')
  revalidatePath('/supervisor/route/plan')
  revalidatePath('/supervisor/dashboard')
  return {}
}

export async function cancelVisitRequest(requestId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('site_visit_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) return { error: error.message }
  revalidatePath('/coordinator/visit-requests')
  return {}
}
