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

  if (data.supervisor_flagged_to_admin && data.snag_items.length > 0) {
    // Secondary, non-critical fan-out — a failure here shouldn't fail the
    // primary assessment submission that already succeeded above.
    const { error: snagErr } = await supabase.from('scope_snag_items').insert(
      data.snag_items.map(item => ({
        booking_ref: data.booking_ref,
        snag_location: item.location,
        snag_description: item.description,
        snag_severity: item.severity,
        snag_photo_url: item.photo_url,
        admin_flagged: true,
      })),
    )
    if (snagErr) {
      // eslint-disable-next-line no-console
      console.error('[submitPreDeliveryAssessment] scope_snag_items insert failed:', snagErr.message)
    }
  }

  revalidatePath('/supervisor/pre-delivery')
  return { success: true }
}
