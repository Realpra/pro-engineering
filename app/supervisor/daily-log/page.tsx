import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import StageManager from './StageManager'

export default async function DailyLogPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await Promise.race([
    supabase.auth.getUser(),
    new Promise<{ data: { user: null }; error: null }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null }, error: null }), 5000)
    ),
  ])

  if (!user) redirect('/supervisor/login')

  const { data: worker } = await supabase
    .from('workers')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!worker) redirect('/supervisor/login')

  const today = new Date().toLocaleDateString('en-CA')

  const [jobResult, logResult] = await Promise.all([
    supabase
      .from('guest_enquiries')
      .select('booking_ref, job_title, zone')
      .eq('supervisor_id', worker.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('daily_site_logs')
      .select('morning_submitted_at, evening_submitted_at, ltf_ready_tomorrow')
      .eq('supervisor_id', worker.id)
      .eq('log_date', today)
      .maybeSingle(),
  ])

  const activeJob = jobResult.data
  const existingLog = logResult.data

  // Standardized on the same crew-eligibility gate SubstageCard.tsx (Supervisor's
  // milestone tracker) already uses -- admin_approved + is_available is the
  // final stage of the Worker Onboarding approval pipeline; this page
  // previously checked the earlier coordinator_approved stage, one of 3
  // disagreeing "who counts as available crew" definitions found across
  // Supervisor's own pages (Duplicate/Conflict #14). Also fixed a
  // district-vs-zone column mismatch: workers.zones is the array of zones a
  // worker actually covers, not workers.district (a different concept).
  let crewQuery = supabase
    .from('workers')
    .select('id, full_name, trade')
    .eq('is_active', true)
    .eq('approval_status', 'admin_approved')
    .eq('is_available', true)
    .neq('trade', 'Supervisor')
    .order('full_name', { ascending: true })
    .limit(8)

  if (activeJob?.zone) {
    crewQuery = crewQuery.contains('zones', [activeJob.zone])
  }

  const { data: crewData } = await crewQuery

  const morningSubmitted = !!existingLog?.morning_submitted_at
  const eveningSubmitted = !!existingLog?.evening_submitted_at
  const ltfSubmitted = existingLog != null && existingLog.ltf_ready_tomorrow !== null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            href="/supervisor/dashboard"
            className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 active:bg-white/20"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Daily Site Log</p>
            <p className="text-blue-300 text-xs truncate">{worker.full_name ?? 'Supervisor'}</p>
          </div>
          {activeJob && (
            <span className="ml-auto shrink-0 text-xs text-blue-300 font-semibold truncate max-w-[120px]">
              {activeJob.booking_ref}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <StageManager
          supervisorId={worker.id}
          bookingRef={activeJob?.booking_ref ?? ''}
          jobTitle={activeJob?.job_title ?? ''}
          crew={crewData ?? []}
          morningSubmitted={morningSubmitted}
          eveningSubmitted={eveningSubmitted}
          ltfSubmitted={ltfSubmitted}
        />
      </main>
    </div>
  )
}
