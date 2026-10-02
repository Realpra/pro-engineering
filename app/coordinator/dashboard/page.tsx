import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { assignStaff } from '../actions'

export default async function CoordinatorDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'coordinator') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Coordinator'

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district, status, is_active, estimate_total, supervisor_id, contact_name')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const { data: supervisors } = await supabase
    .from('workers')
    .select('id, full_name')
    .eq('trade', 'Supervisor')
    .eq('is_active', true)
    .order('full_name')

  const { data: allJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, status, is_active')
    .order('created_at', { ascending: false })

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  const { data: pendingPayments } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select('id, substage_code, substage_name, booking_ref, milestone_code, subcoordinator_reviewed_at, substage_approved_at, is_critical_path')
        .in('booking_ref', bookingRefs)
        .not('subcoordinator_reviewed_at', 'is', null)
        .is('substage_approved_at', null)
        .order('subcoordinator_reviewed_at', { ascending: true })
    : { data: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: pendingVisitRequests } = await (supabase as any)
    .from('site_visit_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  // ALLOCATION PENDING: jobs with a real work plan (substages exist) but not
  // a single worker_day_slots row yet for any of those substages -- genuine
  // "plan exists, nobody staffed" jobs, not a guess. Separate from jobs that
  // are confirmed for execution but have no work plan at all yet (surfaced
  // on the Command Center itself with a "Build Milestone Plan" link).
  const { data: openSubstages } = await supabase
    .from('job_milestone_substages')
    .select('booking_ref')
    .not('status', 'in', '(completed,sent_back)')
  const openBookingRefs = [...new Set((openSubstages ?? []).map(s => s.booking_ref))]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: anyStaffedRows } = openBookingRefs.length > 0
    ? await (supabase as any).from('worker_day_slots').select('booking_ref').in('booking_ref', openBookingRefs)
    : { data: [] as { booking_ref: string }[] }
  const staffedRefs = new Set((anyStaffedRows ?? []).map((r: { booking_ref: string }) => r.booking_ref))
  const allocationPendingCount = openBookingRefs.filter(r => !staffedRefs.has(r)).length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: confirmedJobsRaw } = await (supabase as any)
    .from('guest_enquiries')
    .select('booking_ref')
    .not('confirmed_for_execution_at', 'is', null)
  const openRefSet = new Set(openBookingRefs)
  const confirmedNoPlanCount = ((confirmedJobsRaw ?? []) as { booking_ref: string }[]).filter(j => !openRefSet.has(j.booking_ref)).length

  const { data: scopeReports } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, status')
    .eq('status', 'scope_report_submitted')
    .order('created_at', { ascending: false })

  const { data: pendingWorkers } = await supabase
    .from('workers')
    .select('id, full_name, trade, approval_status')
    // 'subcoordinator_approved' was never written against workers.approval_status (Worker
    // Onboarding freeze, Session 65) -- 'sub_coordinator_reviewed' is the real value written
    // by reviewWorker() and means the sub-coordinator has recommended this worker ahead.
    .eq('approval_status', 'sub_coordinator_reviewed')
    .order('created_at', { ascending: false })

  const { data: allWorkers } = await supabase
    .from('workers')
    .select('id, full_name, trade, total_deployments, is_active')
    .eq('is_active', true)

  const { data: clientRemarksRaw } = await supabase
    .from('estimate_client_responses')
    .select('id, booking_ref, response_type, responded_at, coordinator_actioned_at')
    .eq('response_type', 'review_requested')
    .is('coordinator_actioned_at', null)
    .order('responded_at', { ascending: true })

  // Deduplicate client remarks by booking_ref — one entry per job
  const clientRemarksByRef = new Map<string, typeof clientRemarksRaw extends (infer T)[] | null ? T : never>()
  for (const r of clientRemarksRaw ?? []) {
    if (!clientRemarksByRef.has(r.booking_ref)) {
      clientRemarksByRef.set(r.booking_ref, r)
    }
  }
  const clientRemarks = Array.from(clientRemarksByRef.values())

  const totalActive = (activeJobs ?? []).length
  const totalPendingPayments = (pendingPayments ?? []).length

  const overduePayments = (pendingPayments ?? []).filter(p => {
    if (!p.subcoordinator_reviewed_at) return false
    const reviewed = new Date(p.subcoordinator_reviewed_at)
    const hour = reviewed.getHours()
    const deadline = new Date(reviewed)
    if (hour < 12) deadline.setHours(17, 0, 0, 0)
    else { deadline.setDate(deadline.getDate() + 1); deadline.setHours(9, 0, 0, 0) }
    return new Date() > deadline
  })

  const approaching120 = (allWorkers ?? []).filter(w => (w.total_deployments ?? 0) >= 100)

  const redFlashes: { label: string; link: string }[] = [
    ...overduePayments.map(p => ({ label: `Payment overdue — ${p.substage_code} · ${p.booking_ref}`, link: '/coordinator/payments' })),
    ...(pendingPayments ?? []).filter(p => p.is_critical_path && !overduePayments.find(o => o.id === p.id)).map(p => ({ label: `Critical path pending — ${p.substage_code} · ${p.booking_ref}`, link: '/coordinator/payments' })),
    ...approaching120.map(w => ({ label: `120-day alert — ${w.full_name} · ${w.trade} · ${w.total_deployments ?? 0} days`, link: '/coordinator/workers' })),
    ...clientRemarks.map(r => ({ label: `Client review remarks — ${r.booking_ref}`, link: '/coordinator/estimate' })),
  ]

  const totalAllocationPending = allocationPendingCount + confirmedNoPlanCount

  const navItems = [
    { href: '/coordinator/jobs', icon: '🏗', label: 'Job Pipeline', count: (allJobs ?? []).length, urgent: false },
    { href: '/coordinator/allocate', icon: '🧮', label: 'Allocate Workers', count: totalAllocationPending, urgent: totalAllocationPending > 0 },
    { href: '/coordinator/scope-reports', icon: '📋', label: 'Scope Reports', count: (scopeReports ?? []).length, urgent: (scopeReports ?? []).length > 0 },
    { href: '/coordinator/estimate', icon: '📐', label: 'Estimate Console', count: clientRemarks.length, urgent: clientRemarks.length > 0 },
    { href: '/coordinator/clients', icon: '👤', label: 'Clients', count: null, urgent: false },
    { href: '/coordinator/procurement', icon: '🚚', label: 'Procurement', count: null, urgent: false },
    { href: '/coordinator/payments', icon: '💰', label: 'Payments', count: totalPendingPayments, urgent: overduePayments.length > 0 },
    { href: '/coordinator/zone-registry', icon: '🗺', label: 'Zone Registry', count: null, urgent: false },
    { href: '/coordinator/workers', icon: '👷', label: 'Workers', count: (pendingWorkers ?? []).length, urgent: approaching120.length > 0 },
    { href: '/coordinator/routes', icon: '📍', label: 'Routes', count: null, urgent: false },
    { href: '/coordinator/visit-requests', icon: '📅', label: 'Visit Requests', count: pendingVisitRequests ?? 0, urgent: (pendingVisitRequests ?? 0) > 0 },
    { href: '/coordinator/reports', icon: '📝', label: 'Reports', count: null, urgent: false },
    { href: '/coordinator/escalations', icon: '⚠️', label: 'Escalations', count: null, urgent: false },
    { href: '/coordinator/cost', icon: '📈', label: 'Live Cost', count: null, urgent: false },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Pro Engineering</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName} · Coordinator</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/book"
              className="text-white text-xs font-bold bg-[#2E74B5] px-3 py-1.5 rounded-lg"
            >
              + New Job
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button className="text-blue-300 text-xs font-semibold border border-blue-400/40 px-3 py-1.5 rounded-lg">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* RED FLASH STRIP */}
        {redFlashes.length > 0 && (
          <section className="space-y-2">
            {redFlashes.map((flash, i) => (
              <Link key={i} href={flash.link} className="block">
                <div className="bg-red-600 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <span className="text-white text-lg shrink-0">🔴</span>
                  <p className="text-white text-xs font-bold leading-snug flex-1">{flash.label}</p>
                  <svg className="w-4 h-4 text-red-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* SUMMARY STRIP */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-white font-bold text-2xl">{totalActive}</p>
              <p className="text-blue-300 text-xs">Active Jobs</p>
            </div>
            <div>
              <p className={`font-bold text-2xl ${totalPendingPayments > 0 ? 'text-orange-400' : 'text-white'}`}>{totalPendingPayments}</p>
              <p className="text-blue-300 text-xs">Payments</p>
            </div>
            <div>
              <p className={`font-bold text-2xl ${(scopeReports ?? []).length > 0 ? 'text-yellow-400' : 'text-white'}`}>{(scopeReports ?? []).length}</p>
              <p className="text-blue-300 text-xs">Scope Gate</p>
            </div>
            <div>
              <p className={`font-bold text-2xl ${(pendingWorkers ?? []).length > 0 ? 'text-green-400' : 'text-white'}`}>{(pendingWorkers ?? []).length}</p>
              <p className="text-blue-300 text-xs">Workers</p>
            </div>
          </div>
        </div>

        {/* ACTIVE JOBS */}
        {(activeJobs ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active Jobs</p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(activeJobs ?? []).map(job => {
                const jobPayments = (pendingPayments ?? []).filter(p => p.booking_ref === job.booking_ref)
                return (
                  <div key={job.booking_ref} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">{job.booking_ref}</p>
                        <p className="text-sm font-bold text-gray-800 leading-snug">{job.job_title ?? job.job_type}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{[job.zone, job.district].filter(Boolean).join(', ')}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${
                          job.status === 'milestone_review' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                          job.status === 'confirmed' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                          'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>{job.status?.replace(/_/g, ' ')}</span>
                        {jobPayments.length > 0 && (
                          <p className="text-xs text-orange-500 font-semibold mt-1">{jobPayments.length} pending</p>
                        )}
                      </div>
                    </div>

                    <form action={assignStaff} className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Assign Staff</p>
                      <input type="hidden" name="booking_ref" value={job.booking_ref} />
                      <div className="mb-2">
                        <label className="text-xs text-gray-500 mb-1 block">Supervisor</label>
                        <select name="supervisor_id" defaultValue={job.supervisor_id ?? ''} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                          <option value="">— Select —</option>
                          {(supervisors ?? []).map(s => (
                            <option key={s.id} value={s.id}>{s.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="w-full text-xs bg-blue-700 text-white rounded-lg py-1.5 font-semibold">
                        Assign →
                      </button>
                    </form>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ALLOCATION PENDING -- jobs with a real work plan but zero workers
            booked yet, or confirmed-for-execution jobs with no work plan at
            all. The real, code-confirmed replacement for guessing which
            jobs need staffing by scrolling the whole pipeline. */}
        {totalAllocationPending > 0 && (
          <section>
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">🧮 Allocation Pending — {totalAllocationPending}</p>
            <Link href="/coordinator/allocate" className="block bg-white rounded-2xl border border-orange-200 shadow-sm px-5 py-3">
              <p className="text-sm font-semibold text-gray-700">
                {allocationPendingCount > 0 && `${allocationPendingCount} job${allocationPendingCount === 1 ? '' : 's'} with a plan but no workers booked yet`}
                {allocationPendingCount > 0 && confirmedNoPlanCount > 0 && ' · '}
                {confirmedNoPlanCount > 0 && `${confirmedNoPlanCount} confirmed job${confirmedNoPlanCount === 1 ? '' : 's'} with no work plan yet`}
              </p>
              <p className="text-xs text-orange-700 font-semibold mt-1">Open Allocation Command Center →</p>
            </Link>
          </section>
        )}

        {/* SCOPE REPORTS */}
        {(scopeReports ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-3">⚡ Scope Reports — Quality Gate Pending</p>
            <div className="bg-white rounded-2xl border border-yellow-200 shadow-sm divide-y divide-yellow-100 overflow-hidden">
              {(scopeReports ?? []).map(r => (
                <Link key={r.booking_ref} href="/coordinator/scope-reports" className="block px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">{r.booking_ref}</p>
                      <p className="text-sm font-bold text-gray-800">{r.job_title ?? r.job_type}</p>
                      <p className="text-xs text-gray-400">{r.zone}</p>
                    </div>
                    <span className="text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-300 px-2 py-1 rounded-full">Review Now</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CLIENT REMARKS */}
        {clientRemarks.length > 0 && (
          <section>
            <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-3">📩 Client Review Remarks</p>
            <div className="bg-white rounded-2xl border border-purple-200 shadow-sm divide-y divide-purple-100 overflow-hidden">
              {clientRemarks.map(r => (
                <Link key={r.booking_ref} href="/coordinator/estimate" className="block px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">{r.booking_ref}</p>
                      <p className="text-sm font-semibold text-gray-700">Client sent review remarks</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(r.responded_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-300 px-2 py-1 rounded-full">Action</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* PENDING WORKERS */}
        {(pendingWorkers ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">👷 Workers Awaiting Approval</p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(pendingWorkers ?? []).slice(0, 5).map(w => (
                <Link key={w.id} href="/coordinator/workers" className="block px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{w.full_name}</p>
                      <p className="text-xs text-gray-400">{w.trade}</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">Approve</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* MODULES GRID */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Modules</p>
          <div className="grid grid-cols-3 gap-3">
            {navItems.map(item => (
              <Link key={item.href} href={item.href} className="block">
                <div className={`bg-white rounded-2xl border shadow-sm px-3 py-4 text-center relative ${item.urgent ? 'border-orange-300' : 'border-gray-200'}`}>
                  {item.count !== null && item.count > 0 && (
                    <span className={`absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${item.urgent ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-700'}`}>
                      {item.count}
                    </span>
                  )}
                  <p className="text-2xl mb-1">{item.icon}</p>
                  <p className="text-xs font-semibold text-gray-700 leading-snug">{item.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}