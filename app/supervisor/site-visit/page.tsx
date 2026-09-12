import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteVisitManager from './SiteVisitManager'

export default async function SiteVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; substage?: string }>
}) {
  const { slot, substage } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'supervisor') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Supervisor'

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  // Load slot data if slot param provided
  const { data: slotData } = slot
    ? await supabase
        .from('supervisor_daily_routes')
        .select(`id, slot_start, slot_end, site_id, site_address,
          milestone_id, qip_template_id, ltf_note, slot_type,
          work_start, work_end, visit_status`)
        .eq('id', slot)
        .maybeSingle()
    : { data: null }

  // Load substage data if substage param provided
  const { data: substageData } = substage
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          trade_type, booking_ref, status, completion_pct,
          supervisor_checklist, evidence_checklist, evidence_submitted,
          is_critical_path, planned_day, planned_hours, float_days,
          early_start_date, early_finish_date`)
        .eq('id', substage)
        .maybeSingle()
    : { data: null }

  // Load active jobs for this supervisor
  const { data: activeJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('booking_ref, job_title, job_type, zone, district')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <SiteVisitManager
      supervisorName={displayName}
      supervisorId={user.id}
      workerId={workerRecord?.id ?? ''}
      slotData={slotData}
      substageData={substageData}
      activeJobs={activeJobs ?? []}
    />
  )
}