'use server'

import { createClient } from '@/lib/supabase/server'

type CrewEntry = {
  worker_id: string
  name: string
  trade: string
  status: 'present' | 'absent' | 'late'
}

export async function uploadSitePhoto(
  formData: FormData
): Promise<{ path?: string; error?: string }> {
  const supabase = await createClient()
  const file        = formData.get('file')        as File   | null
  const supervisorId = formData.get('supervisorId') as string | null
  const prefix      = formData.get('prefix')      as string | null

  if (!file || !supervisorId || !prefix) return { error: 'Missing required fields' }

  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${supervisorId}/${prefix}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('site-log-photos')
    .upload(path, file, { upsert: true })

  if (error) return { error: error.message }
  return { path }
}

export async function submitMorningLog(params: {
  supervisorId: string
  bookingRef: string
  crewAttendance: CrewEntry[]
  sitePhotoUrl: string | null
  plannedScope: string
  weatherCondition: string | null
  materialsDelivered: boolean
  materialsDescription: string | null
  materialsPhotoUrl: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()

  const today = new Date().toLocaleDateString('en-CA')

  const { error } = await supabase
    .from('daily_site_logs')
    .upsert(
      {
        supervisor_id:         params.supervisorId,
        booking_ref:           params.bookingRef,
        log_date:              today,
        log_type:              'morning',
        morning_submitted_at:  new Date().toISOString(),
        crew_attendance:       params.crewAttendance,
        site_photo_url:        params.sitePhotoUrl,
        planned_scope:         params.plannedScope,
        weather_condition:     params.weatherCondition,
        materials_delivered:   params.materialsDelivered,
        materials_description: params.materialsDescription,
        materials_photo_url:   params.materialsPhotoUrl,
      },
      { onConflict: 'supervisor_id,log_date,log_type' }
    )

  if (error) return { error: error.message }
  return {}
}

// Evening-only fields. Previously LTFForm.tsx called this same function with
// hardcoded blank/false values for all of these, and since both stages share
// one row (matched by supervisor_id+log_date, no log_type discrimination)
// every LTF submission silently wiped the real Evening Report a few seconds
// after it was saved -- confirmed real data loss on every completed daily
// log. Now a genuinely partial update, touching only its own fields.
export async function submitEveningLog(params: {
  supervisorId: string
  scopeCompleted: string
  deviationFromPlan: boolean
  deviationDescription: string | null
  deviationReason: string | null
  eveningPhotoUrl: string | null
  issueReported: boolean
  issueDescription: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()

  const today = new Date().toLocaleDateString('en-CA')

  const { data, error } = await supabase
    .from('daily_site_logs')
    .update({
      evening_submitted_at:  new Date().toISOString(),
      scope_completed:       params.scopeCompleted,
      deviation_from_plan:   params.deviationFromPlan,
      deviation_description: params.deviationDescription,
      deviation_reason:      params.deviationReason,
      evening_photo_url:     params.eveningPhotoUrl,
      issue_reported:        params.issueReported,
      issue_description:     params.issueDescription,
      // escalate_to_admin was declared and read by Admin's entire escalation
      // queue/dashboard metric (app/admin/reports) but nothing ever wrote it
      // -- the queue was permanently empty by construction. A reported issue
      // or a real deviation is exactly what that queue exists to catch.
      escalate_to_admin:     params.issueReported || params.deviationFromPlan,
    })
    .eq('supervisor_id', params.supervisorId)
    .eq('log_date', today)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'No morning log found for today. Submit the morning log before submitting the evening log.' }
  }
  return {}
}

// LTF-only fields, split out from submitEveningLog -- see the comment above.
export async function submitLTFLog(params: {
  supervisorId: string
  ltfReadyTomorrow: boolean
  ltfTargetSlot: string | null
  ltfDelayReason: string | null
  ltfNotes: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()

  const today = new Date().toLocaleDateString('en-CA')

  const { data, error } = await supabase
    .from('daily_site_logs')
    .update({
      ltf_ready_tomorrow: params.ltfReadyTomorrow,
      ltf_target_slot:    params.ltfTargetSlot,
      ltf_delay_reason:   params.ltfDelayReason,
      ltf_notes:          params.ltfNotes,
    })
    .eq('supervisor_id', params.supervisorId)
    .eq('log_date', today)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'No morning log found for today. Submit the morning and evening logs before submitting LTF.' }
  }
  return {}
}
