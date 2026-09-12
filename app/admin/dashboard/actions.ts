'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignSupervisor(bookingRef: string, supervisorId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('guest_enquiries')
    .update({ supervisor_id: supervisorId, status: 'confirmed', is_active: true })
    .eq('booking_ref', bookingRef)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/dashboard')
}

export async function scheduleAssessment(
  workerId: string,
  moduleCode: string,
  date: string,
  timeSlot: string,
  assessorName: string,
) {
  const supabase = await createClient()

  const { data: slot, error: slotError } = await supabase
    .from('assessment_slots')
    .insert({
      slot_date: date,
      slot_time: timeSlot === 'morning' ? '09:00:00' : '14:00:00',
      sector: 'civil',
      module_code: moduleCode,
      assessor_name: assessorName,
      max_candidates: 3,
      booked_count: 0,
      status: 'available',
    })
    .select('id')
    .single()

  if (slotError) throw new Error(slotError.message)

  const { error: bookingError } = await supabase
    .from('assessment_bookings')
    .insert({
      slot_id: slot.id,
      worker_id: workerId,
      booking_timestamp: new Date().toISOString(),
      module_code: moduleCode,
    })

  if (bookingError) throw new Error(bookingError.message)

  await supabase
    .from('assessment_slots')
    .update({ booked_count: 1 })
    .eq('id', slot.id)
}
