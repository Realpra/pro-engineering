import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CommandCenter, { type Job, type Substage, type WorkerOption, type SlotRow, type Escalation } from './CommandCenter'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// Allocation Command Center -- replaces the old status-gated, one-job-at-a-time
// /coordinator/allocate/[bookingRef] entry point with the industry-standard
// order confirmed via research into ServiceTitan/Procore/Primavera P6/Deputy/
// BuildOps (2 Oct 2026): demand (zone x day x job x trade x skill) and supply
// (zone x skill-tagged workers) are both aggregated FIRST, on one scrollable
// board, before any individual worker is looked at. The demand signal here is
// job_milestone_substages' own early_start_date/early_finish_date -- the real
// day-wise work-program dates fixed when the estimate was approved -- not a
// guest_enquiries.status label. Any job with a substage active on the
// selected day shows up here automatically; nothing needs its status to equal
// a specific value first.
export default async function AllocationCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; zone?: string }>
}) {
  const { date: dateParam, zone: zoneParam } = await searchParams
  const date = dateParam || todayISO()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) redirect('/login')

  // DEMAND: every substage active on this calendar day, across every job in
  // the system at once -- job_milestone_substages.early_start_date/
  // early_finish_date already shift automatically whenever a delay pushes the
  // CPM dates, so this is always the live, current day-wise requirement, not
  // a stale snapshot. .not('status','in',...) uses the exact same confirmed-
  // live filter shape already proven in app/api/cron/ltf-route-compile.
  const { data: substagesData } = await supabase
    .from('job_milestone_substages')
    .select('id, booking_ref, substage_code, substage_name, milestone_code, trade_type, skilled_workers_per_day, unskilled_workers_per_day, early_start_date, early_finish_date, status')
    .lte('early_start_date', date)
    .gte('early_finish_date', date)
    .not('status', 'in', '(completed,sent_back)')

  const substages = (substagesData ?? []) as Substage[]
  const bookingRefs = [...new Set(substages.map(s => s.booking_ref))]

  const [{ data: jobsData }, { data: workersData }, { data: slotsData }, { data: escalationsData }] = await Promise.all([
    bookingRefs.length > 0
      ? supabase
          .from('guest_enquiries')
          .select('booking_ref, job_title, zone, district, contact_name, is_active')
          .in('booking_ref', bookingRefs)
      : Promise.resolve({ data: [] as Job[] }),
    supabase
      .from('workers')
      .select('id, full_name, trade, skill_level, zones, daily_wage_inr, is_available, coordinator_deployable_at')
      .eq('is_active', true)
      .or('approval_status.in.(admin_approved,coordinator_approved),coordinator_deployable_at.not.is.null')
      .order('daily_wage_inr', { ascending: true }),
    // Every slot on this date, across EVERY booking (not scoped to one job) --
    // this is what lets a worker already on Job A show as unavailable/
    // conflicting when you try to also assign them to Job B the same day,
    // which the old per-job page's own-booking-only query could never catch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('worker_day_slots')
      .select('worker_id, slot_date, booking_ref, substage_code, status')
      .eq('slot_date', date),
    bookingRefs.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (supabase as any)
          .from('worker_allocation_escalations')
          .select('id, substage_id, trade, skill_level_needed, remark, status, raised_at')
          .in('booking_ref', bookingRefs)
          .eq('status', 'pending')
      : Promise.resolve({ data: [] as Escalation[] }),
  ])

  const jobs = (jobsData ?? []) as Job[]
  const workers = (workersData ?? []) as WorkerOption[]
  const slots = (slotsData ?? []) as SlotRow[]
  const escalations = (escalationsData ?? []) as Escalation[]

  const zones = [...new Set(jobs.map(j => j.zone).filter((z): z is string => !!z))].sort()
  const activeZone = zoneParam && zones.includes(zoneParam) ? zoneParam : null

  const visibleJobs = activeZone ? jobs.filter(j => j.zone === activeZone) : jobs
  const visibleRefs = new Set(visibleJobs.map(j => j.booking_ref))
  const visibleSubstages = substages.filter(s => visibleRefs.has(s.booking_ref))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/coordinator/jobs" className="text-white/80 hover:text-white shrink-0" aria-label="Back to jobs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Allocation Command Center</h1>
            <p className="text-blue-200 text-xs">Zone → Day → Job → Trade → Skill → Available Worker</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <CommandCenter
          date={date}
          zones={zones}
          activeZone={activeZone}
          jobs={visibleJobs}
          substages={visibleSubstages}
          workers={workers}
          slots={slots}
          escalations={escalations}
        />
      </main>
    </div>
  )
}
