'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type SnagItem = {
  location: string
  description: string
  severity: 'minor' | 'medium' | 'major' | 'critical'
  photo_url: string | null
}

export type SubmitPreDeliveryInput = {
  booking_ref: string
  inspection_date: string
  clearance: 'cleared' | 'not_cleared' | 'conditional'
  snag_items: SnagItem[]
  supervisor_flagged_to_admin: boolean
  flag_reason: string | null
}

export async function uploadSnagPhoto(
  bookingRef: string,
  formData: FormData,
): Promise<{ success?: true; url?: string; error?: string }> {
  const supabase = await createClient()

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `pre-delivery/${bookingRef}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, file, { upsert: true })
  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)
  return { success: true, url: urlData.publicUrl }
}

export async function submitPreDeliveryAssessment(
  supervisorId: string,
  data: SubmitPreDeliveryInput,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const payload = {
    booking_ref: data.booking_ref,
    supervisor_inspection_date: data.inspection_date,
    supervisor_snag_items: data.snag_items,
    supervisor_clearance: data.clearance,
    supervisor_inspected_by: supervisorId,
    supervisor_flagged_to_admin: data.supervisor_flagged_to_admin,
    supervisor_flag_reason: data.flag_reason,
    updated_at: now,
  }

  const { data: existing } = await supabase
    .from('pre_delivery_assessment')
    .select('id')
    .eq('booking_ref', data.booking_ref)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('pre_delivery_assessment').update(payload).eq('id', existing.id)
    : await supabase.from('pre_delivery_assessment').insert(payload)

  if (error) return { error: error.message }

  // scope_snag_items (the fan-out this used to also write) is a confirmed
  // dead-end table -- nothing anywhere in the repo reads it back.
  // pre_delivery_assessment.supervisor_snag_items (written above) is the
  // real, actually-read source. Retired per Duplicate/Conflict #11 -- see
  // 20260927_retire_dead_sink_tables.sql.

  revalidatePath('/supervisor/pre-delivery')
  return { success: true }
}
