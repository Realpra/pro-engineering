import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'sub_coordinator') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Sub-Coordinator'

  const { data: allJobs } = await supabase
    .from('guest_enquiries')
    .select(`id, booking_ref, job_title, job_type, zone, district,
      status, is_active, preferred_start_date, estimate_total,
      supervisor_id, contact_name, scope_description`)
    .order('created_at', { ascending: false })

  const { data: substages } = await supabase
    .from('job_milestone_substages')
    .select(`id, substage_code, milestone_code, booking_ref, status,
      completion_pct, is_critical_path, supervisor_submitted_at,
      subcoordinator_reviewed_at, substage_approved_at`)
    .order('milestone_code', { ascending: true })

  const { data: supervisors } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('platform_role', 'supervisor')

  const supervisorMap = Object.fromEntries(
    (supervisors ?? []).map(s => [s.id, s.full_name])
  )

  const activeJobs = (allJobs ?? []).filter(j => j.is_active)
  const completedJobs = (allJobs ?? []).filter(j => !j.is_active)

  const getJobStats = (bookingRef: string) => {
    const jobSubstages = (substages ?? []).filter(s => s.booking_ref === bookingRef)
    const total = jobSubstages.length
    const completed = jobSubstages.filter(s => s.status === 'completed').length
    const inProgress = jobSubstages.filter(s => s.status === 'in_progress').length
    const critical = jobSubstages.filter(s => s.is_critical_path).length
    const pendingApproval = jobSubstages.filter(s =>
      s.supervisor_submitted_at && !s.subcoordinator_reviewed_at
    ).length
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, inProgress, critical, pendingApproval, pct }
  }

  const milestones = ['M0', 'M1', 'M2', 'M3', 'M4']

  const getMilestoneProgress = (bookingRef: string, mc: string) => {
    const group = (substages ?? []).filter(s => s.booking_ref === bookingRef && s.milestone_code === mc)
    if (group.length === 0) return null
    const completed = group.filter(s => s.status === 'completed').length
    return { total: group.length, completed, pct: Math.round((completed / group.length) * 100) }
  }

  const statusBadge = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-700 border-green-300'
    if (status === 'in_progress' || status === 'milestone_review') return 'bg-blue-100 text-blue-700 border-blue-300'
    if (status === 'confirmed') return 'bg-purple-100 text-purple-700 border-purple-300'
    return 'bg-gray-100 text-gray-500 border-gray-300'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/sub-coordinator/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Jobs Overview</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-white font-bold text-2xl">{activeJobs.length}</p>
              <p className="text-blue-300 text-xs">Active Jobs</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{completedJobs.length}</p>
              <p className="text-blue-300 text-xs">Completed</p>
            </div>
            <div>
              <p className="text-orange-400 font-bold text-2xl">
                {activeJobs.reduce((sum, j) => sum + getJobStats(j.booking_ref).pendingApproval, 0)}
              </p>
              <p className="text-blue-300 text-xs">Pending Approval</p>
            </div>
          </div>
        </div>

        {/* ACTIVE JOBS */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Active Jobs — {activeJobs.length}
          </p>
          <div className="space-y-4">
            {activeJobs.map(job => {
              const stats = getJobStats(job.booking_ref)
              return (
                <div key={job.booking_ref} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Job header */}
                  <div className="bg-[#1F3864] px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">{job.booking_ref}</p>
                        <p className="text-white font-bold text-base leading-snug mt-0.5">{job.job_title ?? job.job_type}</p>
                        <p className="text-blue-300 text-xs mt-0.5">
                          {[job.zone, job.district].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusBadge(job.status)}`}>
                        {job.status?.replace('_', ' ')}
                      </span>
                    </div>
                    {/* Overall progress */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-blue-300 text-xs">Overall Progress</p>
                        <p className="text-white font-bold text-sm">{stats.completed}/{stats.total} · {stats.pct}%</p>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${stats.pct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="font-bold text-blue-600">{stats.inProgress}</p>
                        <p className="text-gray-400">Active</p>
                      </div>
                      <div>
                        <p className="font-bold text-red-500">{stats.critical}</p>
                        <p className="text-gray-400">Critical</p>
                      </div>
                      <div>
                        <p className={`font-bold ${stats.pendingApproval > 0 ? 'text-orange-500' : 'text-gray-500'}`}>
                          {stats.pendingApproval}
                        </p>
                        <p className="text-gray-400">Pending</p>
                      </div>
                      <div>
                        <p className="font-bold text-green-600">{stats.completed}</p>
                        <p className="text-gray-400">Done</p>
                      </div>
                    </div>

                    {/* Milestone progress */}
                    <div className="space-y-1.5">
                      {milestones.map(mc => {
                        const mp = getMilestoneProgress(job.booking_ref, mc)
                        if (!mp) return null
                        return (
                          <div key={mc} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-[#2E74B5] w-6 shrink-0">{mc}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${mp.pct === 100 ? 'bg-green-500' : 'bg-[#2E74B5]'}`}
                                style={{ width: `${mp.pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-12 text-right">{mp.completed}/{mp.total}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Job details */}
                    <div className="border-t border-gray-100 pt-3 space-y-1.5 text-xs">
                      {supervisorMap[job.supervisor_id] && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Supervisor</span>
                          <span className="font-semibold text-gray-700">{supervisorMap[job.supervisor_id]}</span>
                        </div>
                      )}
                      {job.estimate_total && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Estimate</span>
                          <span className="font-semibold text-gray-700">₹{Number(job.estimate_total).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {job.contact_name && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Client</span>
                          <span className="font-semibold text-gray-700">{job.contact_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Link
                        href={`/sub-coordinator/approvals`}
                        className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl text-center"
                      >
                        View Approvals
                      </Link>
                      <Link
                        href={`/sub-coordinator/route`}
                        className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl text-center"
                      >
                        Plan Route →
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
            {activeJobs.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
                <p className="text-gray-400 text-sm">No active jobs</p>
              </div>
            )}
          </div>
        </section>

        {/* COMPLETED JOBS */}
        {completedJobs.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Completed Jobs — {completedJobs.length}
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {completedJobs.map(job => (
                <div key={job.booking_ref} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{job.booking_ref}</p>
                    <p className="text-sm font-semibold text-gray-700">{job.job_title ?? job.job_type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{[job.zone, job.district].filter(Boolean).join(', ')}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    ✓ Done
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}