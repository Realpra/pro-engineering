import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from './SignOutButton'
import SiteHeadNotReadyButton from './SiteHeadNotReadyButton'
import SOSButton from './SOSButton'

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

function travelLabel(mins: number | null) {
  if (!mins) return '—'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function plannedByLabel(p: string | null) {
  if (p === 'subcoordinator') return 'Planned by Sub-Coordinator'
  if (p === 'supervisor') return 'Self-planned'
  return 'System calculated'
}

function reportStatusBadge(status: string | null) {
  if (status === 'submitted') return { label: '✓ Report Submitted', cls: 'bg-green-100 text-green-700 border-green-300' }
  if (status === 'pending') return { label: '⚠ Report Pending', cls: 'bg-orange-100 text-orange-700 border-orange-300' }
  return { label: '— Not Started', cls: 'bg-gray-100 text-gray-500 border-gray-300' }
}

function slotTypeLabel(type: string | null) {
  if (type === 'overhang') return { label: '🔴 OVERHANG', cls: 'text-red-600' }
  if (type === 'client_visit') return { label: '🔵 CLIENT VISIT', cls: 'text-blue-600' }
  if (type === 'scope_survey') return { label: '🔵 SCOPE SURVEY', cls: 'text-blue-600' }
  if (type === 'hq') return { label: '🟡 HQ BRIEFING', cls: 'text-yellow-600' }
  if (type === 'estimate_visit') return { label: '💰 ESTIMATE VISIT', cls: 'text-purple-600' }
  return { label: '🟢 QIP INSPECTION', cls: 'text-green-600' }
}

// PENDING #31 (confirmed regression, Session 58): slot_type is fully modeled
// but every route slot linked to the same Flow (ii) Daily Execution Visit
// regardless of stated purpose. A client_visit/scope_survey/estimate_visit
// slot should open the pre-confirm Flow (i) Site Survey instead; an 'hq'
// slot has no site visit to report at all.
function visitHref(
  slot: { id: string; slot_type: string | null; site_id: string | null },
  siteIdToBookingRef: Record<string, string>,
): string | null {
  if (slot.slot_type === 'hq') return null
  if (slot.slot_type === 'client_visit' || slot.slot_type === 'scope_survey' || slot.slot_type === 'estimate_visit') {
    const bookingRef = slot.site_id ? siteIdToBookingRef[slot.site_id] : null
    return bookingRef ? `/site-survey/${bookingRef}` : null
  }
  return `/supervisor/site-visit?slot=${slot.id}`
}

function borderColor(type: string | null, reportStatus: string | null) {
  if (type === 'overhang') return 'border-l-red-500'
  if (reportStatus === 'pending') return 'border-l-orange-400'
  if (type === 'client_visit' || type === 'scope_survey') return 'border-l-blue-500'
  if (type === 'hq') return 'border-l-yellow-500'
  return 'border-l-green-500'
}

export default async function SupervisorDashboardPage() {
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
    .select('id, full_name, district, trade')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: activeJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('id, booking_ref, job_title, job_type, zone, district, status, is_active')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  const { data: pendingSubstages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select('id, substage_code, substage_name, milestone_code, trade_type, booking_ref, status, completion_pct, site_checklist, site_evidence_checklist, site_evidence_submitted, supervisor_submitted_at, is_critical_path')
        .in('booking_ref', bookingRefs)
        .in('status', ['in_progress', 'pending'])
        .order('supervisor_submitted_at', { ascending: true })
    : { data: [] }

  const criticalSubstages = (pendingSubstages ?? []).filter(s => s.is_critical_path)
  const urgentItems = (pendingSubstages ?? []).filter(s =>
    s.supervisor_submitted_at && slaUrgent(s.supervisor_submitted_at)
  )

  const today = new Date().toISOString().split('T')[0]
  const todayLocal = new Date().toLocaleDateString('en-CA')

  const { data: todayLog } = workerRecord
    ? await supabase
        .from('daily_site_logs')
        .select('morning_submitted_at, evening_submitted_at')
        .eq('supervisor_id', workerRecord.id)
        .eq('log_date', todayLocal)
        .maybeSingle()
    : { data: null }

  const dailyLogPending = !todayLog?.morning_submitted_at || !todayLog?.evening_submitted_at
  const hasMilestoneReviewJob = (activeJobs ?? []).some(j => j.status === 'milestone_review')
  const { data: todayRoute } = await supabase
    .from('supervisor_daily_routes')
    .select(`id, slot_start, slot_end, site_id, site_address, visit_status,
      milestone_id, qip_template_id, ltf_note, slot_type, planned_by,
      depart_from, depart_time, travel_minutes, arrive_time, buffer_minutes,
      work_start, work_end, work_duration_minutes,
      next_site_id, travel_to_next_minutes, depart_to_next, arrive_next,
      lunch_break, lunch_start, lunch_end,
      report_status, report_submitted_at`)
    .eq('supervisor_id', workerRecord?.id ?? '')
    .eq('scheduled_date', today)
    .order('slot_start', { ascending: true })

  // supervisor_daily_routes.site_id is a UUID referencing guest_enquiries.id
  // (confirmed live -- caught by a real test insert failing with "site_id is
  // of type uuid but expression is of type text"), NOT a booking_ref string
  // as PENDING #31's fix first assumed. Resolve it to the real booking_ref
  // guest_enquiries expects before building any /site-survey/[bookingRef] link.
  const routeSiteIds = Array.from(new Set((todayRoute ?? []).map(s => s.site_id).filter((v): v is string => Boolean(v))))
  const { data: routeSiteJobs } = routeSiteIds.length > 0
    ? await supabase.from('guest_enquiries').select('id, booking_ref').in('id', routeSiteIds)
    : { data: [] }
  const siteIdToBookingRef = Object.fromEntries((routeSiteJobs ?? []).map(j => [j.id, j.booking_ref]))

  const { data: directives } = await supabase
    .from('site_instructions')
    .select('id, instruction_type, priority, instruction_text, issued_at, status')
    .eq('issued_to', user.id)
    .eq('status', 'pending')
    .order('issued_at', { ascending: false })

  const now = new Date()
  const istHour = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24

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

  const totalSlots = (todayRoute ?? []).length
  const totalDistance = (todayRoute ?? []).reduce((sum, s) => sum + (s.travel_minutes ?? 0), 0)
  const pendingReports = (todayRoute ?? []).filter(s => s.report_status === 'pending').length

  // SA-1 spec: "today's task list auto-generated from the job timeline...
  // tasks carry forward if incomplete -- amber yesterday, red if overdue two
  // days." The live page previously showed 4 hardcoded generic strings with
  // no backing data at all. Rebuilt here as a real list derived from data
  // already queried on this page (daily-log submission state, pending
  // substage approvals, critical-path items) -- no new table, per the
  // methodology's search-before-create-fresh check; a fully persisted
  // multi-day carry-forward/aging model would need one, and is deferred
  // rather than built on a guess.
  const pendingApprovalsForToday = (pendingSubstages ?? []).filter(s => s.supervisor_submitted_at)
  type TaskAge = 'ok' | 'amber' | 'red'
  const dailyTasks: { label: string; age: TaskAge }[] = [
    {
      label: 'Submit morning daily log',
      age: todayLog?.morning_submitted_at ? 'ok' : istHour >= 9.5 ? 'red' : 'amber',
    },
    {
      label: 'Submit evening daily log',
      age: todayLog?.evening_submitted_at ? 'ok' : istHour >= 19 ? 'red' : 'amber',
    },
    ...(pendingReports > 0
      ? [{ label: `Submit ${pendingReports} inspection report${pendingReports > 1 ? 's' : ''}`, age: 'red' as TaskAge }]
      : []),
    ...(pendingApprovalsForToday.length > 0
      ? [{
          label: `Review ${pendingApprovalsForToday.length} pending approval${pendingApprovalsForToday.length > 1 ? 's' : ''}`,
          age: (pendingApprovalsForToday.some(s => slaUrgent(s.supervisor_submitted_at)) ? 'red' : 'amber') as TaskAge,
        }]
      : []),
    ...(criticalSubstages.length > 0
      ? [{ label: `${criticalSubstages.length} critical-path item${criticalSubstages.length > 1 ? 's' : ''} need instruction`, age: 'red' as TaskAge }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {workerRecord && (
        <SOSButton
          supervisorId={workerRecord.id}
          supervisorUserId={user.id}
          bookingRef={(activeJobs ?? [])[0]?.booking_ref ?? null}
        />
      )}

      {/* HEADER */}
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#2E74B5] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Pro Engineering</p>
              <p className="text-blue-300 text-xs truncate">Supervisor HQ — {displayName}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* SIDEBAR NAV */}
      <div className="bg-[#162c50] border-b border-[#2E74B5]/30 overflow-x-auto">
        <div className="flex items-center gap-1 px-3 py-2 min-w-max">
          {[
            { href: '/supervisor/dashboard', label: '🏠 Dashboard', active: true, badge: false },
            { href: '/supervisor/route', label: '📍 Route', badge: false },
            { href: '/supervisor/site-visit', label: '🔍 Site Visit', badge: false },
            { href: '/supervisor/milestone-tracker', label: '📊 Milestones', badge: false },
            { href: '/supervisor/daily-log', label: '📋 Daily Log', badge: dailyLogPending },
            { href: '/supervisor/pre-delivery', label: '✅ Pre-Delivery', badge: hasMilestoneReviewJob },
            { href: '/supervisor/scope-verification', label: '🗂 Scope', badge: false },
            { href: '/supervisor/estimate', label: '💰 Estimates', badge: false },
            { href: '/supervisor/extra-works', label: '🔧 Extra Works', badge: false },
            { href: '/supervisor/directives', label: '📣 Directives', badge: false },
            { href: '/supervisor/reports', label: '📝 Reports', badge: false },
            { href: '/supervisor/certificate', label: '🏅 Certificate', badge: false },
            { href: '/book', label: '+ New Job', badge: false },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                item.active
                  ? 'bg-[#2E74B5] text-white'
                  : 'text-blue-300 hover:text-white hover:bg-[#2E74B5]/40'
              }`}
            >
              {item.label}
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 border border-[#162c50]" />
              )}
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

        {/* LAYER 0 — OVERRIDE BANNER */}
        {directives && directives.filter(d => d.priority === 'critical').length > 0 && (
          <div className="bg-red-600 rounded-2xl px-5 py-4 shadow-md">
            <p className="text-white font-bold text-xs uppercase tracking-widest mb-2">
              🔴 Coordinator Override — Action Required
            </p>
            {directives.filter(d => d.priority === 'critical').map(d => (
              <div key={d.id} className="mb-2 last:mb-0">
                <p className="text-white text-sm font-semibold leading-snug">{d.instruction_text}</p>
                <p className="text-red-200 text-xs mt-1">
                  {instructionIcon(d.instruction_type)} {d.instruction_type.toUpperCase()} ·
                  Received {new Date(d.issued_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            <Link href="/supervisor/directives" className="inline-block mt-2 text-xs text-red-200 underline font-semibold">
              View & Acknowledge →
            </Link>
          </div>
        )}

        {/* LAYER 1 — URGENT STRIP */}
        {(urgentItems.length > 0 || pendingReports > 0) && (
          <div className="bg-orange-50 border border-orange-300 rounded-2xl px-5 py-4">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-widest mb-3">
              ⚡ Urgent — Act Before Leaving
            </p>
            <div className="space-y-3">
              {pendingReports > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-orange-800">
                      {pendingReports} Inspection Report{pendingReports > 1 ? 's' : ''} Pending
                    </p>
                    <p className="text-xs text-orange-600">Submit before EOD · LTF feeds due 20:00</p>
                  </div>
                  <Link
                    href="/supervisor/reports"
                    className="shrink-0 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Submit Now →
                  </Link>
                </div>
              )}
              {urgentItems.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-orange-800">{s.substage_code} · {s.booking_ref}</p>
                    <p className="text-xs text-orange-600">SLA: {slaCountdown(s.supervisor_submitted_at)}</p>
                  </div>
                  <Link
                    href={`/supervisor/approval/${s.id}`}
                    className="shrink-0 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Review Now →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LAYER 2 — TODAY'S COMPILED SCHEDULE */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Today's Schedule
            </p>
            <Link href="/supervisor/route" className="text-xs text-[#2E74B5] font-semibold">
              Edit Route →
            </Link>
          </div>

          {/* Route summary */}
          {todayRoute && todayRoute.length > 0 && (
            <div className="bg-[#1F3864] rounded-2xl px-5 py-3 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{totalSlots}</p>
                    <p className="text-blue-300 text-xs">Slots</p>
                  </div>
                  <div className="w-px h-8 bg-blue-400/30" />
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{travelLabel(totalDistance)}</p>
                    <p className="text-blue-300 text-xs">Total Travel</p>
                  </div>
                  <div className="w-px h-8 bg-blue-400/30" />
                  <div className="text-center">
                    <p className={`font-bold text-lg ${pendingReports > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                      {pendingReports}
                    </p>
                    <p className="text-blue-300 text-xs">Reports Due</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-blue-300 text-xs">Compiled from LTF</p>
                  <p className="text-blue-300 text-xs">{today}</p>
                </div>
              </div>
            </div>
          )}

          {/* Supervisor Start Rule */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3 mb-3">
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">🗺️</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-[#1F3864]">Reporting Mode — Direct to Site (Auto)</p>
                <p className="text-xs text-gray-500 mt-0.5">No later than 10:00 AM at first site · No HQ reporting today</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {todayRoute && todayRoute[0]?.planned_by
                    ? plannedByLabel(todayRoute[0].planned_by)
                    : 'Route not yet compiled'}
                </p>
              </div>
              <Link href="/supervisor/route/plan" className="shrink-0 text-xs text-[#2E74B5] font-semibold underline">
                Edit
              </Link>
            </div>
          </div>

          {/* SLOT CARDS */}
          {todayRoute && todayRoute.length > 0 ? (
            <div className="space-y-4">
              {todayRoute.map((slot, idx) => {
                const typeInfo = slotTypeLabel(slot.slot_type)
                const rptBadge = reportStatusBadge(slot.report_status)
                const borderCls = borderColor(slot.slot_type, slot.report_status)
                return (
                  <div key={slot.id} className={`bg-white rounded-2xl border border-gray-200 border-l-4 ${borderCls} shadow-sm overflow-hidden`}>

                    {/* Slot header */}
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-xs font-bold ${typeInfo.cls}`}>{typeInfo.label}</p>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">
                            {formatTime(slot.slot_start)} → {formatTime(slot.slot_end)}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${rptBadge.cls}`}>
                          {rptBadge.label}
                        </span>
                      </div>
                    </div>

                    <div className="px-5 py-4 space-y-3">

                      {/* TRAVEL IN */}
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-sm">🚗</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Travel In</p>
                          <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                            <div>
                              <p className="text-gray-400">From</p>
                              <p className="font-semibold text-gray-700">{slot.depart_from ?? (idx === 0 ? 'Home Base' : 'Prev Site')}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Depart</p>
                              <p className="font-semibold text-gray-700">{formatTime(slot.depart_time)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Travel</p>
                              <p className="font-semibold text-gray-700">{travelLabel(slot.travel_minutes)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Arrive</p>
                              <p className="font-semibold text-gray-700">{formatTime(slot.arrive_time)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Buffer</p>
                              <p className="font-semibold text-gray-700">{slot.buffer_minutes ?? 0} min</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Planned by</p>
                              <p className="font-semibold text-gray-700 capitalize">{slot.planned_by ?? 'system'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* DIVIDER */}
                      <div className="border-t border-gray-100" />

                      {/* AT SITE */}
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#1F3864]/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-sm">🏗</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">At Site</p>
                          <p className="text-sm font-bold text-gray-800 mt-1">{(slot.site_id && siteIdToBookingRef[slot.site_id]) ?? 'Site TBC'}</p>
                          {slot.site_address && (
                            <p className="text-xs text-gray-500 mt-0.5">📍 {slot.site_address}</p>
                          )}
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div>
                              <p className="text-gray-400">Work Start</p>
                              <p className="font-semibold text-gray-700">{formatTime(slot.work_start)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Work End</p>
                              <p className="font-semibold text-gray-700">{formatTime(slot.work_end)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Duration</p>
                              <p className="font-semibold text-gray-700">{travelLabel(slot.work_duration_minutes)}</p>
                            </div>
                          </div>
                          {slot.qip_template_id && (
                            <div className="mt-2 bg-blue-50 rounded-xl px-3 py-2">
                              <p className="text-xs text-blue-700 font-semibold">QIP: {slot.milestone_id}</p>
                              <p className="text-xs text-blue-600">Template: {slot.qip_template_id}</p>
                            </div>
                          )}
                          {slot.ltf_note && (
                            <div className="mt-2 bg-green-50 rounded-xl px-3 py-2">
                              <p className="text-xs text-gray-400 font-medium mb-0.5">LTF Note from Site Head</p>
                              <p className="text-xs text-green-800 font-semibold">"{slot.ltf_note}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* LUNCH BREAK */}
                      {slot.lunch_break && (
                        <>
                          <div className="border-t border-gray-100" />
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-sm">🍽</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider">Lunch Break</p>
                              <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                                <div>
                                  <p className="text-gray-400">From</p>
                                  <p className="font-semibold text-gray-700">{formatTime(slot.lunch_start)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">To</p>
                                  <p className="font-semibold text-gray-700">{formatTime(slot.lunch_end)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">Duration</p>
                                  <p className="font-semibold text-gray-700">30 min</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* TRAVEL OUT */}
                      {slot.next_site_id && (
                        <>
                          <div className="border-t border-gray-100" />
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-sm">🚗</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Travel Out → Next Site</p>
                              <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                                <div>
                                  <p className="text-gray-400">Next Site</p>
                                  <p className="font-semibold text-gray-700">{slot.next_site_id}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">Depart</p>
                                  <p className="font-semibold text-gray-700">{formatTime(slot.depart_to_next)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">Travel</p>
                                  <p className="font-semibold text-gray-700">{travelLabel(slot.travel_to_next_minutes)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">Arrive Next</p>
                                  <p className="font-semibold text-gray-700">{formatTime(slot.arrive_next)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* REPORT STATUS */}
                      <div className="border-t border-gray-100" />
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${rptBadge.cls}`}>
                            {rptBadge.label}
                          </span>
                          {slot.report_submitted_at && (
                            <span className="text-xs text-gray-400">
                              {new Date(slot.report_submitted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {slot.report_status !== 'submitted' && visitHref(slot, siteIdToBookingRef) && (
                          <Link
                            href={visitHref(slot, siteIdToBookingRef)!}
                            className="text-xs text-[#2E74B5] font-semibold underline"
                          >
                            Submit Report →
                          </Link>
                        )}
                      </div>

                      {/* ACTIONS */}
                      <div className="flex gap-2 pt-1">
                        <SiteHeadNotReadyButton slotId={slot.id} />
                        {visitHref(slot, siteIdToBookingRef) && (
                          <Link
                            href={visitHref(slot, siteIdToBookingRef)!}
                            className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl text-center"
                          >
                            Begin Inspection →
                          </Link>
                        )}
                      </div>

                    </div>
                  </div>
                )
              })}

              {/* EOD BLOCK */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg shrink-0">📋</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">End of Day</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">Daily Log + LTF Feeds</p>
                    <div className="space-y-1 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Submit daily log</span>
                        <Link href="/supervisor/daily-log" className="text-[#2E74B5] font-semibold">Open →</Link>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">LTF feeds due by 20:00</span>
                        <span className={`font-semibold ${pendingReports > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {pendingReports > 0 ? `${pendingReports} pending` : 'All clear'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
              <p className="text-gray-500 text-sm font-semibold">No route compiled yet</p>
              <p className="text-gray-400 text-xs mt-1 mb-4">LTF feeds compile at 20:00 · Route shown at 07:30 AM</p>
              <Link
                href="/supervisor/route/plan"
                className="inline-block bg-[#1F3864] text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                + Plan Route Manually
              </Link>
            </div>
          )}
        </section>

        {/* BLOCK 1 — INSPECTIONS DUE */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Inspections Due / Pending</p>
            <Link href="/supervisor/inspections" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(pendingSubstages ?? []).slice(0, 3).map(s => (
              <div key={s.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {s.is_critical_path && <span className="text-xs font-bold text-red-500">🔴 CRITICAL</span>}
                      <span className="text-xs text-gray-400 font-medium">{s.substage_code}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{s.substage_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.booking_ref} · {s.milestone_code} · {s.trade_type}</p>
                    {s.supervisor_submitted_at && (
                      <p className={`text-xs font-semibold mt-1 ${slaUrgent(s.supervisor_submitted_at) ? 'text-red-600' : 'text-orange-500'}`}>
                        SLA: {slaCountdown(s.supervisor_submitted_at)}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/supervisor/approval/${s.id}`}
                    className="shrink-0 bg-[#1F3864] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Review →
                  </Link>
                </div>
              </div>
            ))}
            {(pendingSubstages ?? []).length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No pending inspections</p>
              </div>
            )}
          </div>
        </section>

        {/* BLOCK 2 — CRITICAL PATH */}
        {criticalSubstages.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Critical Path Alerts</p>
              <Link href="/supervisor/milestone-tracker" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
            </div>
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {criticalSubstages.map(s => (
                <div key={s.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-red-500 mb-0.5">🔴 CRITICAL PATH</p>
                    <p className="text-sm font-semibold text-gray-800">{s.substage_code} — {s.substage_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.booking_ref} · {s.milestone_code} · Delay shifts handover date</p>
                  </div>
                  <Link
                    href={`/supervisor/instruction?site=${s.booking_ref}`}
                    className="shrink-0 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Instruct →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* BLOCK 3 — PENDING APPROVALS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending Approvals</p>
            <Link href="/supervisor/approvals" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(pendingSubstages ?? []).filter(s => s.supervisor_submitted_at).slice(0, 3).map(s => {
              const checklist = (s.site_checklist as any[]) ?? []
              const evidence = (s.site_evidence_checklist as any[]) ?? []
              const evidenceSubmitted = (s.site_evidence_submitted as any[]) ?? []
              const checkedCount = checklist.filter((c: any) => c.checked).length
              const evidenceCount = evidenceSubmitted.filter(Boolean).length
              return (
                <div key={s.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-800">{s.substage_code}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{s.substage_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.booking_ref} · {s.milestone_code}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${slaUrgent(s.supervisor_submitted_at) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {slaCountdown(s.supervisor_submitted_at)}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-2 mb-3">
                    <p className="text-xs text-gray-500">
                      Site Head ✓ → <span className="font-bold text-[#1F3864]">[Supervisor ←YOU]</span> → Sub-Coord → Finance
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-600">
                    <div>Checklist: <span className="font-semibold">{checkedCount}/{checklist.length}</span></div>
                    <div>Evidence: <span className="font-semibold">{evidenceCount}/{evidence.length}</span></div>
                    <div>Progress: <span className="font-semibold">{s.completion_pct ?? 0}%</span></div>
                    <div>Status: <span className="font-semibold capitalize">{s.status?.replace('_', ' ')}</span></div>
                  </div>
                  <Link
                    href={`/supervisor/approval/${s.id}`}
                    className="block w-full bg-green-600 text-white text-xs font-bold py-2 rounded-xl text-center"
                  >
                    Review, Approve or Send Back →
                  </Link>
                </div>
              )
            })}
            {(pendingSubstages ?? []).filter(s => s.supervisor_submitted_at).length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No pending approvals</p>
              </div>
            )}
          </div>
        </section>

        {/* BLOCK 4 — SCOPE SURVEYS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Scope Surveys / Client Visits</p>
            <Link href="/supervisor/scope-verification" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(activeJobs ?? []).slice(0, 3).map(job => (
              <div key={job.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400 font-medium">{job.booking_ref}</p>
                    <p className="text-sm font-semibold text-gray-800">{job.job_title ?? 'Active Job'}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{job.job_type} · {[job.zone, job.district].filter(Boolean).join(', ')}</p>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5 items-end">
                    {job.status === 'confirmed' && (
                      <Link
                        href={`/site-survey/${job.booking_ref}`}
                        className="bg-[#1F3864] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                      >
                        Start Site Survey →
                      </Link>
                    )}
                    <Link
                      href={`/supervisor/scope-verification?ref=${job.booking_ref}`}
                      className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                    >
                      Open →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {(activeJobs ?? []).length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No active jobs</p>
              </div>
            )}
          </div>
        </section>

        {/* BLOCK 5 — ESTIMATE PREPARATION */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Estimate Preparation</p>
            <Link href="/supervisor/estimate" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(activeJobs ?? []).slice(0, 2).map(job => (
              <div key={job.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                      Draft
                    </span>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{job.booking_ref} — {job.job_title ?? 'Job'}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{job.job_type}</p>
                  </div>
                  <Link
                    href={`/supervisor/estimate?ref=${job.booking_ref}`}
                    className="shrink-0 bg-[#1F3864] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Open Estimate →
                  </Link>
                </div>
              </div>
            ))}
            {(activeJobs ?? []).length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No estimates in progress</p>
              </div>
            )}
          </div>
        </section>

        {/* BLOCK 6 — EXTRA WORKS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Extra Works / Client Requests</p>
            <Link href="/supervisor/extra-works" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-6 text-center">
            <p className="text-gray-400 text-sm">No extra works pending</p>
            <Link href="/supervisor/extra-works/new" className="inline-block mt-2 text-xs text-[#2E74B5] font-semibold underline">
              + Raise New Arising
            </Link>
          </div>
        </section>

        {/* BLOCK 7 — DIRECTIVES */}
        {directives && directives.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">HQ / Coordinator Directives</p>
              <Link href="/supervisor/directives" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {directives.map(d => (
                <div key={d.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{instructionIcon(d.instruction_type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${priorityBadge(d.priority)}`}>
                          {d.priority}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">{d.instruction_type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 leading-snug">{d.instruction_text}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(d.issued_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* REPORTS & PROPOSALS */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reports & Proposals</p>
            <Link href="/supervisor/reports" className="text-xs text-[#2E74B5] font-semibold">View All →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Method Improvement', href: '/supervisor/reports/new?type=method', icon: '🔧' },
              { label: 'Safety Critical', href: '/supervisor/reports/new?type=safety', icon: '⚠️' },
              { label: 'Site Report', href: '/supervisor/reports/new?type=site', icon: '📋' },
              { label: 'Payment Policy', href: '/supervisor/reports/new?type=payment', icon: '💰' },
            ].map(r => (
              <Link
                key={r.href}
                href={r.href}
                className="bg-white border border-gray-200 rounded-2xl px-4 py-4 flex items-center gap-3 active:bg-gray-50 transition-colors shadow-sm"
              >
                <span className="text-xl">{r.icon}</span>
                <p className="text-xs font-semibold text-gray-700 leading-snug">{r.label}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* DAILY TASKS -- real, derived from today's actual data, not decorative */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Today's Tasks</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {dailyTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  task.age === 'ok' ? 'border-green-500 bg-green-50' : task.age === 'red' ? 'border-red-500 bg-red-50' : 'border-orange-400 bg-orange-50'
                }`}>
                  <span className={`text-xs font-bold ${task.age === 'ok' ? 'text-green-600' : task.age === 'red' ? 'text-red-600' : 'text-orange-500'}`}>
                    {task.age === 'ok' ? '✓' : i + 1}
                  </span>
                </div>
                <p className={`text-sm font-medium leading-snug ${task.age === 'ok' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {task.label}
                </p>
              </div>
            ))}
            {dailyTasks.every(t => t.age === 'ok') && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">All caught up for today</p>
              </div>
            )}
          </div>
        </section>

        {/* EARNINGS SUMMARY -- SA-14 spec widget. Flagged, not fabricated:
            no pay-rate/formula for Supervisor exists anywhere in this schema
            or codebase (SA-14 Earnings was never built at all), so this
            cannot show a real number without inventing a policy that was
            never specified. */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Earnings Summary</p>
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-center">
            <p className="text-gray-500 text-sm font-semibold">Not available yet</p>
            <p className="text-gray-400 text-xs mt-1">
              No Supervisor pay-rate or earnings-calculation policy exists in the system yet (SA-14) --
              needs that decision before real numbers can show here.
            </p>
          </div>
        </section>

      </main>
    </div>
  )
}
