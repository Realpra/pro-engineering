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

  // scope_snag_items: this is the real SA-12 Snag List (june.md 10515-10522)
  // -- a per-item, individually resolvable record, distinct in purpose from
  // supervisor_snag_items above (a point-in-time JSONB copy of what was found
  // during THIS inspection). Each item starts 'open' and is tracked/resolved
  // independently across however many follow-up visits it takes, which the
  // JSONB blob on pre_delivery_assessment cannot represent on its own.
  if (data.snag_items.length > 0) {
    const { error: snagErr } = await supabase.from('scope_snag_items').insert(
      data.snag_items.map(item => ({
        booking_ref: data.booking_ref,
        snag_location: item.location,
        snag_description: item.description,
        snag_severity: item.severity,
        snag_photo_url: item.photo_url,
        admin_flagged: data.supervisor_flagged_to_admin,
        resolution_status: 'open',
      })),
    )
    if (snagErr) return { error: snagErr.message }
  }

  revalidatePath('/supervisor/pre-delivery')
  return { success: true }
}

export type OpenSnag = {
  id: string
  booking_ref: string
  snag_location: string | null
  snag_description: string | null
  snag_severity: 'minor' | 'medium' | 'major' | 'critical'
  snag_photo_url: string | null
  resolution_status: 'open' | 'resolved' | 'client_accepted'
}

export async function getSnagsForJob(bookingRef: string): Promise<OpenSnag[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('scope_snag_items')
    .select('id, booking_ref, snag_location, snag_description, snag_severity, snag_photo_url, resolution_status')
    .eq('booking_ref', bookingRef)
    .order('snag_severity', { ascending: false })
  return (data as OpenSnag[]) ?? []
}

// Per the original SA-12 rule: a critical snag can only be marked Resolved
// (actually fixed), never Client Accepted -- that escape hatch is only for
// minor/medium/major items the client is willing to live with.
export async function resolveSnagItem(
  snagId: string,
  resolution: 'resolved' | 'client_accepted',
  resolvedBy: string,
  notes: string | null,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()

  const { data: snag, error: fetchErr } = await supabase
    .from('scope_snag_items')
    .select('snag_severity')
    .eq('id', snagId)
    .single()
  if (fetchErr) return { error: fetchErr.message }

  if (snag.snag_severity === 'critical' && resolution === 'client_accepted') {
    return { error: 'Critical snags cannot be client-accepted -- they must be marked Resolved.' }
  }

  const { error } = await supabase
    .from('scope_snag_items')
    .update({
      resolution_status: resolution,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      resolution_notes: notes,
    })
    .eq('id', snagId)

  if (error) return { error: error.message }
  revalidatePath('/supervisor/pre-delivery')
  return { success: true }
}
