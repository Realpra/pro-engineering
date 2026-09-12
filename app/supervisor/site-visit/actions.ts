'use server'

import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

export async function initReport(
  supervisorId: string,
  bookingRef: string,
  jobTitle: string,
): Promise<{ reportId?: string; error?: string }> {
  const supabase = await createClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('site_visit_reports')
    .select('id')
    .eq('supervisor_id', supervisorId)
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (existing) return { reportId: existing.id }

  const { data: inserted, error: insertErr } = await (supabase as SupabaseAny)
    .from('site_visit_reports')
    .insert({
      supervisor_id: supervisorId,
      booking_ref: bookingRef,
      status: 'in_progress',
      screen01_job_details: { jobTitle },
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }
  return { reportId: inserted.id }
}

export async function saveScreen(
  reportId: string,
  screenNumber: number,
  columnName: string,
  data: object,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await (supabase as SupabaseAny)
    .from('site_visit_reports')
    .update({ [columnName]: data })
    .eq('id', reportId)

  if (error) return { error: error.message }
  return {}
}

export async function submitReport(reportId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: report, error: fetchErr } = await supabase
    .from('site_visit_reports')
    .select('booking_ref')
    .eq('id', reportId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const { error: updateErr } = await supabase
    .from('site_visit_reports')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', reportId)

  if (updateErr) return { error: updateErr.message }

  const { error: enquiryErr } = await supabase
    .from('guest_enquiries')
    .update({ status: 'scope_report_submitted' })
    .eq('booking_ref', report.booking_ref)

  if (enquiryErr) return { error: enquiryErr.message }

  return {}
}

export async function uploadSiteVisitPhoto(
  bookingRef: string,
  screenName: string,
  formData: FormData,
): Promise<{ success?: true; url?: string; error?: string }> {
  const supabase = await createClient()

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const safeScreenName = screenName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const path = `site-visit/${bookingRef}/${safeScreenName}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('site-photos')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)

  return { success: true, url: urlData.publicUrl }
}
