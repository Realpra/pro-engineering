import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from './SignOutButton'
import { sendInstruction } from '../actions'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(t: string | null | undefined) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

function slaCountdown(submittedAt: string | null): string {
  if (!submittedAt) return '—'
  const submitted = new Date(submittedAt)
  const submittedHour = submitted.getHours()
  let deadline: Date
  if (submittedHour < 12) {
    deadline = new Date(submitted)
    deadline.setHours(17, 0, 0, 0)
  } else {
    deadline = new Date(submitted)
    deadline.setDate(deadline.getDate() + 1)
    deadline.setHours(9, 0, 0, 0)
  }
  const now = new Date()
  const diffMs = deadline.getTime() - now.getTime()
  if (diffMs <= 0) return 'OVERDUE'
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} min left`
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours}h ${mins}m left`
}

function slaUrgent(submittedAt: string | null): boolean {
  if (!submittedAt) return false
  const submitted = new Date(submittedAt)
  const submittedHour = submitted.getHours()
  let deadline: Date
  if (submittedHour < 12) {
    deadline = new Date(submitted)
    deadline.setHours(17, 0, 0, 0)
  } else {
    deadline = new Date(submitted)
    deadline.setDate(deadline.getDate() + 1)
    deadline.setHours(9, 0, 0, 0)
  }
  const now = new Date()
  return (deadline.getTime() - now.getTime()) < 60 * 60 * 1000
}

export default async function SubCoordinatorDashboardPage() {
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

  // All active jobs
  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('id, booking_ref, job_title, job_type, zone, district, status, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  // Pending substages — awaiting sub-coordinator review
  const { data: pendingSubstages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          trade_type, booking_ref, status, completion_pct,
          supervisor_submitted_at, subcoordinator_reviewed_at,
          coordinator_approved_at, is_critical_path, float_days`)
        .in('booking_ref', bookingRefs)
        .not('supervisor_submitted_at', 'is', null)
        .is('subcoordinator_reviewed_at', null)
        .order('supervisor_submitted_at', { ascending: true })
    : { data: [] }

  // LTF feeds for today
  const today = new Date().toISOString().split('T')[0]
  const { data: ltfFeeds } = await supabase
    .from('ltf_feeds')
    .select('id, site_id, booking_ref, submitted_by, submitted_at, is_ready_tomorrow, target_time_slot, contractor_notes, accountability_flag')
    .gte('submitted_at', `${today}T00:00:00`)
    .order('submitted_at', { ascending: false })

  // Today's supervisor routes
  const { data: supervisorRoutes } = await supabase
    .from('supervisor_daily_routes')
    .select(`id, supervisor_id, scheduled_date, slot_start, slot_end,
      site_id, site_address, visit_status, slot_type, planned_by,
      depart_time, travel_minutes, work_start, work_end,
      lunch_break, report_status, ltf_note`)
    .eq('scheduled_date', today)
    .order('slot_start', { ascending: true })

  // Workers
  const { data: workers } = await supabase
    .from('workers')
    .select('id, full_name, trade, district, zone, is_available, is_active')
    .eq('is_active', true)
    .order('trade', { ascending: true })

  // Site instructions issued by sub-coordinator
  const { data: instructions } = await supabase
    .from('site_instructions')
    .select('id, instruction_type, priority, instruction_text, issued_at, status, booking_ref')
    .eq('issued_by', user.id)
    .order('issued_at', { ascending: false })
    .limit(10)

  const now = new Date()
  const istHour = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24

  const urgentItems = (pendingSubstages ?? []).filter(s => slaUrgent(s.supervisor_submitted_at))
  const overdueItems = (pendingSubstages ?? []).filter(s => slaCountdown(s.supervisor_submitted_at) === 'OVERDUE')
  const ltfReady = (ltfFeeds ?? []).filter(f => f.is_ready_tomorrow)
  const ltfNotReady = (ltfFeeds ?? []).filter(f => !f.is_ready_tomorrow)
  const availableWorkers = (workers ?? []).filter(w => w.is_available)
  const routeSlots = (supervisorRoutes ?? []).length
  const pendingReports = (supervisorRoutes ?? []).filter(s => s.report_status === 'pending').length

  const priorityBadge = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-700 border-red-300'
    if (p === 'high') return 'bg-orange-100 text-orange-700 border-orange-300'
    if (p === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-blue-100 text-blue-700 border-blue-300'
  }

  const instructionIcon = (type: string) => {
    if (type === 'hold') return '🔴'
    if (type === 'expedite') return '🟠'
    if (type === 'revised') return '🟡'
    if (type === 'resource') return '🟢'
    return '⚠️'
  }

  async function sendInstructionAction(formData: FormData) {
    'use server'
    await sendInstruction(formData)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* HEADER */}
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#2E74B5] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Pro Engineering</p>
              <p className="text-blue-300 text-xs truncate">Sub-Coordinator HQ — {displayName}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* NAV */}
      <div className="bg-[#162c50] border-b border-[#2E74B5]/30 overflow-x-auto">
        <div className="flex items-center gap-1 px-3 py-2 min-w-max">
          {[
            { href: '/sub-coordinator/dashboard', label: '🏠 Dashboard', active: true },
            { href: '/sub-coordinator/route', label: '📍 Route Plan' },
            { href: '/sub-coordinator/ltf', label: '📋 LTF Feeds' },
            { href: '/sub-coordinator/workers', label: '👷 Workers' },
            { href: '/sub-coordinator/approvals', label: '✅ Approvals' },
            { href: '/sub-coordinator/instructions', label: '📣 Instructions' },
            { href: '/sub-coordinator/jobs', label: '🏗 Jobs' },
            { href: '/book', label: '+ New Job' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                item.active
                  ? 'bg-[#2E74B5] text-white'
                  : 'text-blue-300 hover:text-white hover:bg-[#2E74B5]/40'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* GREETING */}
        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">
            {greeting(istHour)}, {displayName.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(now)}</p>
        </div>

        {/* SUMMARY STRIP */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className={`font-bold text-xl ${overdueItems.length > 0 ? 'text-red-400' : 'text-white'}`}>
                {overdueItems.length}
              </p>
              <p className="text-blue-300 text-xs">Overdue</p>
            </div>
            <div>
              <p className={`font-bold text-xl ${urgentItems.length > 0 ? 'text-orange-400' : 'text-white'}`}>
                {urgentItems.length}
              </p>
              <p className="text-blue-300 text-xs">Urgent</p>
            </div>
            <div>
              <p className="text-white font-bold text-xl">{ltfReady.length}</p>
              <p className="text-blue-300 text-xs">LTF Ready</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-xl">{availableWorkers.length}</p>
              <p className="text-blue-300 text-xs">Workers Free</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30 grid grid-cols-3 gap-3 text-center text-xs">
            <div><span className="text-blue-300">Active Jobs</span><br /><span className="text-white font-bold">{(activeJobs ?? []).length}</span></div>
            <div><span className="text-blue-300">Route Slots</span><br /><span className="text-white font-bold">{routeSlots}</span></div>
            <div><span className="text-blue-300">Reports Due</span><br /><span className={`font-bold ${pendingReports > 0 ? 'text-orange-400' : 'text-white'}`}>{pendingReports}</span></div>
          </div>
        </div>

        {/* URGENT STRIP */}
        {(overdueItems.length > 0 || urgentItems.length > 0) && (
          <div className="bg-orange-50 border border-orange-300 rounded-2xl px-5 py-4">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-widest mb-3">
              ⚡ Urgent — Act Now
            </p>
            <div className="space-y-2">
              {overdueItems.slice(0, 2).map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-red-700">{s.substage_code} · {s.booking_ref}</p>
                    <p className="text-xs text-red-600">SLA: OVERDUE</p>
                  </div>
                  <Link href={`/sub-coordinator/approvals`} className="shrink-0 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                    Review →
                  </Link>
                </div>
              ))}
              {urgentItems.slice(0, 2).map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-orange-800">{s.substage_code} · {s.booking_ref}</p>
                    <p className="text-xs text-orange-600">SLA: {slaCountdown(s.supervisor_submitted_at)}</p>
                  </div>
                  <Link href={`/sub-coordinator/approvals`} className="shrink-0 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                    Review →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LTF FEEDS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              LTF Feeds — Tonight
            </p>
            <Link href="/sub-coordinator/ltf" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {(ltfFeeds ?? []).length > 0 ? (
              <div className="divide-y divide-gray-100">
                {(ltfFeeds ?? []).slice(0, 5).map(feed => (
                  <div key={feed.id} className="px-5 py-3 flex items-start gap-3">
                    <span className={`text-base shrink-0 mt-0.5 ${feed.is_ready_tomorrow ? '🟢' : '🔴'}`}>
                      {feed.is_ready_tomorrow ? '🟢' : '🔴'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-400">{feed.booking_ref}</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {feed.is_ready_tomorrow ? 'Ready Tomorrow' : 'Not Ready'}
                          </p>
                          {feed.contractor_notes && (
                            <p className="text-xs text-gray-500 mt-0.5">"{feed.contractor_notes}"</p>
                          )}
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${feed.target_time_slot ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {feed.target_time_slot ?? 'No slot'}
                        </span>
                      </div>
                      {feed.accountability_flag && (
                        <p className="text-xs text-red-500 font-semibold mt-0.5">⚠ Accountability flag raised</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No LTF feeds received yet today</p>
                <p className="text-gray-400 text-xs mt-1">Feeds compile at 20:00 · Route built overnight</p>
              </div>
            )}
          </div>
        </section>

        {/* PENDING APPROVALS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Pending Approvals
            </p>
            <Link href="/sub-coordinator/approvals" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(pendingSubstages ?? []).slice(0, 3).map(s => (
              <div key={s.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    {s.is_critical_path && <p className="text-xs font-bold text-red-500 mb-0.5">🔴 Critical Path</p>}
                    <p className="text-xs text-gray-400">{s.substage_code} · {s.booking_ref} · {s.milestone_code}</p>
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{s.substage_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.trade_type} · Float: {s.float_days ?? 0}d</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${slaUrgent(s.supervisor_submitted_at) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {slaCountdown(s.supervisor_submitted_at)}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-2 mb-2">
                  <p className="text-xs text-gray-500">
                    Site Head ✓ → Supervisor ✓ → <span className="font-bold text-[#1F3864]">[Sub-Coord ←YOU]</span> → Finance
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2 rounded-xl">
                    Send Back
                  </button>
                  <Link
                    href="/sub-coordinator/approvals"
                    className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded-xl text-center"
                  >
                    Approve → Finance
                  </Link>
                </div>
              </div>
            ))}
            {(pendingSubstages ?? []).length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No pending approvals</p>
              </div>
            )}
          </div>
        </section>

        {/* TODAY'S SUPERVISOR ROUTES */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Supervisor Routes — Today
            </p>
            <Link href="/sub-coordinator/route" className="text-xs text-[#2E74B5] font-semibold">Manage →</Link>
          </div>
          {(supervisorRoutes ?? []).length > 0 ? (
            <div className="space-y-2">
              {(supervisorRoutes ?? []).map((slot, idx) => (
                <div key={slot.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-400 font-medium">
                        Slot {idx + 1} · {formatTime(slot.slot_start)} → {formatTime(slot.slot_end)}
                      </p>
                      <p className="text-sm font-semibold text-gray-800">{slot.site_id ?? 'Site TBC'}</p>
                      {slot.site_address && <p className="text-xs text-gray-400 mt-0.5">📍 {slot.site_address}</p>}
                      {slot.ltf_note && <p className="text-xs text-green-700 mt-0.5">"{slot.ltf_note}"</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${
                        slot.visit_status === 'visited' ? 'bg-green-100 text-green-700 border-green-300' :
                        slot.visit_status === 'overhang' ? 'bg-red-100 text-red-700 border-red-300' :
                        'bg-blue-100 text-blue-700 border-blue-300'
                      }`}>
                        {slot.visit_status ?? 'scheduled'}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        slot.report_status === 'submitted' ? 'bg-green-100 text-green-700 border-green-300' :
                        slot.report_status === 'pending' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                        'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {slot.report_status === 'submitted' ? '✓ Report' : slot.report_status === 'pending' ? '⚠ Report' : '— Report'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-center">
              <p className="text-gray-400 text-sm">No routes compiled yet</p>
              <p className="text-gray-400 text-xs mt-1">LTF feeds compile at 20:00 · Routes built overnight</p>
              <Link
                href="/sub-coordinator/route"
                className="inline-block mt-3 bg-[#1F3864] text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                + Plan Route Manually
              </Link>
            </div>
          )}
        </section>

        {/* WORKER AVAILABILITY */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Worker Availability
            </p>
            <Link href="/sub-coordinator/workers" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {(workers ?? []).length > 0 ? (
              <>
                <div className="bg-gray-50 px-5 py-2 border-b border-gray-100">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="font-bold text-green-600">{availableWorkers.length}</p><p className="text-gray-400">Available</p></div>
                    <div><p className="font-bold text-orange-600">{(workers ?? []).length - availableWorkers.length}</p><p className="text-gray-400">Deployed</p></div>
                    <div><p className="font-bold text-[#1F3864]">{(workers ?? []).length}</p><p className="text-gray-400">Total Active</p></div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {availableWorkers.slice(0, 5).map(w => (
                    <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{w.full_name}</p>
                        <p className="text-xs text-gray-400 capitalize">{w.trade} · {w.district}</p>
                      </div>
                      <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        Available
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No workers in system</p>
              </div>
            )}
          </div>
        </section>

        {/* ACTIVE JOBS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Active Jobs
            </p>
            <Link href="/sub-coordinator/jobs" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(activeJobs ?? []).slice(0, 3).map(job => (
              <div key={job.booking_ref} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{job.booking_ref}</p>
                  <p className="text-sm font-semibold text-gray-800">{job.job_title ?? job.job_type}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{[job.zone, job.district].filter(Boolean).join(', ')}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200 capitalize">
                  {job.status?.replace('_', ' ')}
                </span>
              </div>
            ))}
            {(activeJobs ?? []).length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No active jobs</p>
              </div>
            )}
          </div>
        </section>

        {/* RECENT INSTRUCTIONS */}
        {(instructions ?? []).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Instructions Issued
              </p>
              <Link href="/sub-coordinator/instructions" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(instructions ?? []).slice(0, 3).map(inst => (
                <div key={inst.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="text-base shrink-0">{instructionIcon(inst.instruction_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${priorityBadge(inst.priority)}`}>
                        {inst.priority}
                      </span>
                      <span className="text-xs text-gray-400">{inst.booking_ref}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 leading-snug">{inst.instruction_text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(inst.issued_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ISSUE INSTRUCTION */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Issue Instruction
          </p>
          <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden">
            <div className="bg-[#1F3864] px-5 py-3">
              <p className="text-white font-bold text-sm">New Instruction to Supervisor / Site</p>
            </div>
            <form action={sendInstructionAction} className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Site / Booking</p>
                <select name="booking_ref" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">Select site...</option>
                  {(activeJobs ?? []).map(job => (
                    <option key={job.booking_ref} value={job.booking_ref}>
                      {job.booking_ref} — {job.job_title ?? job.job_type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Instruction Type</p>
                <select name="instruction_type" required defaultValue="hold" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="hold">🔴 Hold</option>
                  <option value="expedite">🟠 Expedite</option>
                  <option value="revised">🟡 Revise</option>
                  <option value="resource">🟢 Resource</option>
                  <option value="alert">⚠️ Alert</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Priority</p>
                <select name="priority" required defaultValue="medium" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Issue To (optional)</p>
                <input
                  name="issued_to"
                  type="text"
                  placeholder="Supervisor user ID (optional)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Message</p>
                <textarea
                  name="instruction_text"
                  required
                  rows={3}
                  placeholder="Type instruction to supervisor / site incharge..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                />
              </div>
              <button type="submit" className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm">
                Send Instruction
              </button>
            </form>
          </div>
        </section>

      </main>
    </div>
  )
}