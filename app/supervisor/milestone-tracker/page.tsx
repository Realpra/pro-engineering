import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import SubstageCard from './SubstageCard'
import { isVisitRole } from '@/lib/visitRoles'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function MilestoneTrackerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!isVisitRole(profile?.platform_role)) redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Supervisor'

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: activeJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('id, booking_ref, job_title, job_type, zone, district, status, preferred_start_date')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  const { data: substages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          trade_type, booking_ref, status, completion_pct,
          is_critical_path, planned_day, float_days,
          early_start_date, early_finish_date, planned_hours,
          supervisor_submitted_at, subcoordinator_reviewed_at,
          substage_approved_at, site_checklist,
          site_evidence_checklist, site_evidence_submitted, labour_assignments`)
        .in('booking_ref', bookingRefs)
        .order('milestone_code', { ascending: true })
        .order('planned_day', { ascending: true })
    : { data: [] }

  // PENDING #33 (project owner, Session 63): Supervisor may move workers
  // unilaterally between HIS OWN controlled/active jobs (deliberate
  // flexibility) -- but this pool previously had NO scoping at all and
  // offered every active worker on the entire platform for assignment. Scope
  // it to workers already on one of this supervisor's own active jobs, so
  // "assign" here means "reassign within my own jobs," not "recruit anyone."
  const [{ data: workersPool }, { data: zonesData }, { data: tradesData }] = await Promise.all([
    bookingRefs.length > 0
      ? supabase
          .from('workers')
          .select('id, full_name, trade, skill_level, zones, is_available, approval_status, current_job_booking_ref, coordinator_deployable_at')
          .in('current_job_booking_ref', bookingRefs)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('geo_hierarchy').select('id, name, level'),
    supabase.from('trade_config').select('trade_name'),
  ])

  const tradeNames = Array.from(
    new Set((tradesData ?? []).map(t => t.trade_name).filter((t): t is string => Boolean(t))),
  )

  const milestones = ['M0', 'M1', 'M2', 'M3', 'M4']
  const milestoneNames: Record<string, string> = {
    M0: 'Mobilisation & Preparatory Works',
    M1: 'First Fix — Civil & MEP Rough-in',
    M2: 'Mid Works — Waterproofing & Screed',
    M3: 'Second Fix — Finishing & Tiling',
    M4: 'Handover & DLP Start',
  }
  const milestonePayment: Record<string, number> = {
    M0: 20, M1: 25, M2: 20, M3: 25, M4: 10,
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/supervisor/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Milestone Tracker</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-6 pb-10">

        {(activeJobs ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-10 text-center">
            <p className="text-gray-500 font-semibold text-sm">No active jobs assigned</p>
            <Link href="/supervisor/dashboard" className="inline-block mt-4 bg-[#1F3864] text-white text-xs font-bold px-5 py-2.5 rounded-xl">
              Back to Dashboard
            </Link>
          </div>
        )}

        {(activeJobs ?? []).map(job => {
          const jobSubstages = (substages ?? []).filter(s => s.booking_ref === job.booking_ref)
          const totalSubstages = jobSubstages.length
          const completedCount = jobSubstages.filter(s => s.status === 'completed').length
          const inProgressCount = jobSubstages.filter(s => s.status === 'in_progress').length
          const criticalCount = jobSubstages.filter(s => s.is_critical_path).length
          const overallPct = totalSubstages > 0 ? Math.round((completedCount / totalSubstages) * 100) : 0

          return (
            <section key={job.booking_ref}>
              {/* Job Header */}
              <div className="bg-[#1F3864] rounded-2xl px-5 py-4 mb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">{job.booking_ref}</p>
                    <p className="text-white font-bold text-lg leading-snug mt-0.5">{job.job_title ?? 'Active Job'}</p>
                    <p className="text-blue-300 text-xs mt-0.5 capitalize">{job.job_type} · {[job.zone, job.district].filter(Boolean).join(', ')}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-400/30 capitalize">
                    {job.status}
                  </span>
                </div>

                {/* Overall progress */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-blue-300 text-xs">Overall Progress</p>
                    <p className="text-white font-bold text-sm">{completedCount}/{totalSubstages} substages · {overallPct}%</p>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-blue-400/30">
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{inProgressCount}</p>
                    <p className="text-blue-300 text-xs">In Progress</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-400 font-bold text-lg">{criticalCount}</p>
                    <p className="text-blue-300 text-xs">Critical Path</p>
                  </div>
                  <div className="text-center">
                    <p className="text-green-400 font-bold text-lg">{completedCount}</p>
                    <p className="text-blue-300 text-xs">Complete</p>
                  </div>
                </div>
              </div>

              {/* Milestone breakdown */}
              {milestones.map(mc => {
                const group = jobSubstages.filter(s => s.milestone_code === mc)
                if (group.length === 0) return null
                const mCompleted = group.filter(s => s.status === 'completed').length
                const mInProgress = group.filter(s => s.status === 'in_progress').length
                const mPct = Math.round((mCompleted / group.length) * 100)
                const mCritical = group.filter(s => s.is_critical_path)
                const allComplete = mCompleted === group.length

                return (
                  <div key={mc} className="mb-4">
                    {/* Milestone header */}
                    <div className={`rounded-2xl border shadow-sm overflow-hidden ${allComplete ? 'border-green-200' : 'border-gray-200'}`}>
                      <div className={`px-5 py-3 ${allComplete ? 'bg-green-50' : 'bg-white'} border-b border-gray-100`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${allComplete ? 'bg-green-500' : mInProgress > 0 ? 'bg-blue-500' : 'bg-gray-300'}`} />
                              <p className="text-xs font-bold text-[#2E74B5] uppercase tracking-wider">{mc}</p>
                              {allComplete && <span className="text-xs font-bold text-green-600">✓ Complete</span>}
                            </div>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{milestoneNames[mc]}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{milestonePayment[mc]}% of contract value</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-800">{mPct}%</p>
                            <p className="text-xs text-gray-400">{mCompleted}/{group.length}</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${allComplete ? 'bg-green-500' : 'bg-[#2E74B5]'}`}
                            style={{ width: `${mPct}%` }}
                          />
                        </div>
                        {mCritical.length > 0 && !allComplete && (
                          <p className="text-xs text-red-500 font-semibold mt-2">
                            🔴 {mCritical.length} critical path substage{mCritical.length > 1 ? 's' : ''} — delay shifts handover
                          </p>
                        )}
                      </div>

                      {/* Substage list */}
                      <div>
                        {group.map(s => (
                          <SubstageCard
                            key={s.id}
                            substage={s}
                            supervisorId={workerRecord?.id ?? ''}
                            workersPool={workersPool ?? []}
                            zones={zonesData ?? []}
                            trades={tradeNames}
                            jobZone={job.zone}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Sub-stage proposal */}
              <div className="bg-white rounded-2xl border border-dashed border-[#2E74B5]/40 px-5 py-4">
                <p className="text-xs font-bold text-[#1F3864] mb-1">Propose New Sub-Stage</p>
                <p className="text-xs text-gray-500 mb-3">
                  Supervisor can propose · Routes to Sub-Coordinator → Coordinator for approval · Work continues during approval
                </p>
                <Link
                  href={`/supervisor/milestone-tracker/propose?ref=${job.booking_ref}`}
                  className="inline-block bg-[#1F3864] text-white text-xs font-bold px-4 py-2.5 rounded-xl"
                >
                  + Propose Sub-Stage →
                </Link>
              </div>

            </section>
          )
        })}

      </main>
    </div>
  )
}