import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CommandCenter, { type Job, type Substage, type WorkerOption, type SlotRow, type Escalation, type PendingPlanJob } from './CommandCenter'

// Allocation Command Center -- replaces the old status-gated, one-job-at-a-
// time, single-day /coordinator/allocate/[bookingRef] entry point with the
// industry-standard order confirmed via research into ServiceTitan/Procore/
// Primavera P6/Deputy/BuildOps (2 Oct 2026): demand (zone x day x job x
// trade x skill) and supply (zone/skill-tagged workers) are both aggregated
// FIRST, on one board covering the job's FULL duration (not one day at a
// time), before any individual worker is looked at. The demand signal is
// job_milestone_substages' own early_start_date/early_finish_date -- the
// real day-wise work-program dates fixed when the estimate was approved,
// which already shift automatically whenever a delay/strike/LTF pushes the
// CPM dates. Any job with a substage plan shows up here automatically, for
// its whole span; nothing needs its status to equal a specific value first,
// and nothing needs a single day to be picked before it becomes visible.
export default async function AllocationCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>
}) {
  const { zone: zoneParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) redirect('/login')

  // DEMAND, FULL DURATION: every still-open substage across every job in the
  // system -- not filtered to "today" -- so each job's calendar covers its
  // whole defined span and keeps extending automatically as later substages
  // get their own CPM dates. Same confirmed-live filter shape as
  // app/api/cron/ltf-route-compile.
  const { data: substagesData } = await supabase
    .from('job_milestone_substages')
    .select('id, booking_ref, substage_code, substage_name, milestone_code, trade_type, skilled_workers_per_day, unskilled_workers_per_day, early_start_date, early_finish_date, status')
    .not('status', 'in', '(completed,sent_back)')

  const substages = (substagesData ?? []) as Substage[]
  const bookingRefs = [...new Set(substages.map(s => s.booking_ref))]

  // Bound the worker_day_slots fetch window defensively (a stray bad date
  // should never blow this query up) -- real job spans are weeks/months, not
  // years, so clamping to a generous [-14, +180] day window around today
  // loses nothing a real work program would ever need.
  const today = new Date()
  const windowStart = new Date(today); windowStart.setDate(windowStart.getDate() - 14)
  const windowEnd = new Date(today); windowEnd.setDate(windowEnd.getDate() + 180)
  const toISO = (d: Date) => d.toISOString().split('T')[0]

  const [{ data: jobsData }, { data: workersData }, { data: slotsData }, { data: escalationsData }, { data: confirmedJobsData }] = await Promise.all([
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
    // Every slot in the window, across EVERY booking (not scoped to one job)
    // -- this is what lets a worker already on Job A show as booked when you
    // try to also assign them to Job B on the same day, across the WHOLE
    // calendar, not just a single selected day.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('worker_day_slots')
      .select('worker_id, slot_date, booking_ref, substage_code, status')
      .gte('slot_date', toISO(windowStart))
      .lte('slot_date', toISO(windowEnd)),
    bookingRefs.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (supabase as any)
          .from('worker_allocation_escalations')
          .select('id, substage_id, trade, skill_level_needed, remark, status, raised_at')
          .in('booking_ref', bookingRefs)
          .eq('status', 'pending')
      : Promise.resolve({ data: [] as Escalation[] }),
    // PENDING-ALLOCATION SIGNAL: jobs already confirmed for execution (the
    // one real "ready to work" gate, built Session 68) that have no
    // milestone/substage plan at all yet -- allocation genuinely cannot
    // start for these, and they would otherwise just silently never appear
    // anywhere. Surfaced below as its own banner instead of disappearing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('guest_enquiries')
      .select('booking_ref, job_title, zone, confirmed_for_execution_at')
      .not('confirmed_for_execution_at', 'is', null),
  ])

  const jobs = (jobsData ?? []) as Job[]
  const workers = (workersData ?? []) as WorkerOption[]
  const slots = (slotsData ?? []) as SlotRow[]
  const escalations = (escalationsData ?? []) as Escalation[]
  const pendingPlan = ((confirmedJobsData ?? []) as PendingPlanJob[]).filter(j => !bookingRefs.includes(j.booking_ref))

  const zones = [...new Set([...jobs.map(j => j.zone), ...pendingPlan.map(j => j.zone)].filter((z): z is string => !!z))].sort()
  const activeZone = zoneParam && zones.includes(zoneParam) ? zoneParam : null

  const visibleJobs = activeZone ? jobs.filter(j => j.zone === activeZone) : jobs
  const visibleRefs = new Set(visibleJobs.map(j => j.booking_ref))
  const visibleSubstages = substages.filter(s => visibleRefs.has(s.booking_ref))
  const visiblePendingPlan = activeZone ? pendingPlan.filter(j => j.zone === activeZone) : pendingPlan

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
            <p className="text-blue-200 text-xs">Zone → Job → Full Calendar → Trade → Skill → Available Worker</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <CommandCenter
          zones={zones}
          activeZone={activeZone}
          jobs={visibleJobs}
          substages={visibleSubstages}
          workers={workers}
          slots={slots}
          escalations={escalations}
          pendingPlan={visiblePendingPlan}
        />
      </main>
    </div>
  )
}
