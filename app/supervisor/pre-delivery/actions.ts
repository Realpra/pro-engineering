'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

// Supervisor is not staff under is_staff() (project owner's explicit
// decision, 28 Sep 2026) -- its own session can't read the users table
// beyond its own row, so recipient lookups need a service-role client.
// Matches the exact precedent already used for checkPhoneExists (Session 65).
function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

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

  let assessmentId: string
  if (existing) {
    const { error } = await supabase.from('pre_delivery_assessment').update(payload).eq('id', existing.id)
    if (error) return { error: error.message }
    assessmentId = existing.id
  } else {
    const { data: inserted, error } = await supabase
      .from('pre_delivery_assessment')
      .insert(payload)
      .select('id')
      .single()
    if (error) return { error: error.message }
    assessmentId = inserted.id
  }

  // scope_snag_items: this is the real SA-12 Snag List (june.md 10515-10522)
  // -- a per-item, individually resolvable record, distinct in purpose from
  // supervisor_snag_items above (a point-in-time JSONB copy of what was found
  // during THIS inspection). Each item starts 'open' and is tracked/resolved
  // independently across however many follow-up visits it takes, which the
  // JSONB blob on pre_delivery_assessment cannot represent on its own.
  //
  // A live test insert against the real database failed with a NOT NULL
  // violation on raised_by_role -- a column (along with raised_by,
  // pre_delivery_assessment_id, snag_trade, resolution_required) that
  // already existed live before this session touched the table, invisible
  // to every grep-based inventory since no app code referenced them. Fixed
  // to actually populate the columns that exist, including a real FK
  // (pre_delivery_assessment_id) instead of only the loose booking_ref
  // TEXT-match every other table in this schema relies on.
  if (data.snag_items.length > 0) {
    const { error: snagErr } = await supabase.from('scope_snag_items').insert(
      data.snag_items.map(item => ({
        pre_delivery_assessment_id: assessmentId,
        booking_ref: data.booking_ref,
        raised_by_role: 'supervisor',
        raised_by: supervisorId,
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

// SA-13 Client Handover Sign-Off (June log line 11224-11228, final 4-screen
// redesign). The original 12-point/6-group category LABELS are never
// enumerated anywhere in any of the 4 design logs (confirmed by full-text
// search) -- these 6 are a reasonable placeholder set, not sourced content,
// and are flagged as such rather than presented as spec fact.
export const DISSATISFACTION_CATEGORIES = [
  'Workmanship quality',
  'Cleanliness / site left untidy',
  'Snags not resolved',
  'Timeline delay',
  'Behaviour / conduct of crew',
  'Other',
] as const

export async function uploadHandoverPhoto(
  bookingRef: string,
  formData: FormData,
): Promise<{ success?: true; url?: string; error?: string }> {
  const supabase = await createClient()
  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `pre-delivery/${bookingRef}/handover/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, file, { upsert: true })
  if (uploadError) return { error: uploadError.message }
  const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)
  return { success: true, url: urlData.publicUrl }
}

export type SubmitClientHandoverInput = {
  assessmentId: string
  bookingRef: string
  satisfied: boolean
  dissatisfactionCategories: string[]
  signatureDataUrl: string | null
  handoverPhotoUrls: string[]
}

export async function submitClientHandover(
  input: SubmitClientHandoverInput,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()

  let signatureUrl: string | null = null
  if (input.signatureDataUrl) {
    const base64 = input.signatureDataUrl.split(',')[1]
    const bytes = Buffer.from(base64, 'base64')
    const path = `pre-delivery/${input.bookingRef}/signature-${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('site-photos')
      .upload(path, bytes, { contentType: 'image/png', upsert: true })
    if (uploadError) return { error: uploadError.message }
    const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)
    signatureUrl = urlData.publicUrl
  }

  const { error } = await supabase
    .from('pre_delivery_assessment')
    .update({
      client_handover_satisfied: input.satisfied,
      client_dissatisfaction_categories: input.satisfied ? null : input.dissatisfactionCategories,
      client_signature_url: signatureUrl,
      client_handover_photo_urls: input.handoverPhotoUrls,
      client_handover_at: new Date().toISOString(),
    })
    .eq('id', input.assessmentId)
  if (error) return { error: error.message }

  // Spec: "Dissatisfaction items routed to Sub-Coordinator attention queue."
  // No dedicated "attention queue" surface exists for Sub-Coordinator
  // (confirmed by grep) -- reuses the same site_instructions fan-out
  // pattern already frozen for the SOS/broadcast fixes this session.
  if (!input.satisfied) {
    const { data: subCoordinators } = await adminClient().from('users').select('id').eq('platform_role', 'sub_coordinator')
    if (subCoordinators && subCoordinators.length > 0) {
      await supabase.from('site_instructions').insert(
        subCoordinators.map(sc => ({
          booking_ref: input.bookingRef,
          instruction_type: 'client_handover_dissatisfaction',
          instruction_category: 'system_alert',
          priority: 'high',
          instruction_text: `Client dissatisfied at handover (${input.bookingRef}): ${input.dissatisfactionCategories.join(', ')}`,
          issued_to: sc.id,
          issued_at: new Date().toISOString(),
          status: 'pending',
          is_active: true,
        })),
      )
    }
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

export type AssessmentSummary = {
  id: string
  supervisor_clearance: 'cleared' | 'not_cleared' | 'conditional' | null
  client_handover_satisfied: boolean | null
  client_handover_at: string | null
}

export async function getAssessmentForJob(bookingRef: string): Promise<AssessmentSummary | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pre_delivery_assessment')
    .select('id, supervisor_clearance, client_handover_satisfied, client_handover_at')
    .eq('booking_ref', bookingRef)
    .maybeSingle()
  return (data as AssessmentSummary) ?? null
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
