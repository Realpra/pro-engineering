import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'
import RequestResourcesButton from './RequestResourcesButton'
import LTFSubmitButton from './LTFSubmitButton'
import SiteHeadScopeChangeButton from './SiteHeadScopeChangeButton'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAnyForVisits = any
import Link from 'next/link'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(time: string | null) {
  if (!time) return '—'
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default async function SiteInchargeDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'site_incharge') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Site Incharge'

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id, full_name, trade, district')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  // site_incharge_id is the correctly-scoped FK (Duplicate/Conflict #17):
  // Site Incharge is permanently on-site for a job, Supervisor only visits
  // periodically -- the two are not the same relationship and previously
  // shared one column (supervisor_id), so Site Incharge's own dashboard could
  // only ever see a job if it happened to also be assigned as its Supervisor.
  // Falls back to supervisor_id for any job not yet re-assigned via the new
  // column, so existing jobs don't disappear from Site Incharge's dashboard
  // the moment this ships.
  const { data: activeJob } = workerRecord
    ? await (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bySiteIncharge = await (supabase as any)
          .from('guest_enquiries')
          .select('id, booking_ref, job_title, job_type, zone, district, service_model, preferred_start_date, status')
          .eq('site_incharge_id', workerRecord.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (bySiteIncharge.data) return bySiteIncharge
        return supabase
          .from('guest_enquiries')
          .select('id, booking_ref, job_title, job_type, zone, district, service_model, preferred_start_date, status')
          .eq('supervisor_id', workerRecord.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      })()
    : { data: null }

  const { data: substages } = activeJob
    ? await supabase
        .from('job_milestone_substages')
        .select('id, substage_code, substage_name, milestone_code, status, planned_day, trade_type, is_critical_path, completion_pct, early_start_date, planned_hours, start_time_slot')
        .eq('booking_ref', activeJob.booking_ref)
        .order('milestone_code', { ascending: true })
        .order('planned_day', { ascending: true })
    : { data: [] }

  const { data: instructions } = await supabase
    .from('site_instructions')
    .select('id, instruction_type, priority, instruction_text, issued_at, status')
    .eq('issued_to', user.id)
    .eq('status', 'pending')
    .order('issued_at', { ascending: false })

  const today = new Date().toISOString().split('T')[0]
  const { data: shiftSchedule } = workerRecord
    ? await supabase
        .from('worker_shift_schedule')
        .select('id, legs, total_work_hours, total_travel_minutes, spans_midnight, status')
        .eq('worker_id', workerRecord.id)
        .eq('shift_date', today)
        .maybeSingle()
    : { data: null }

  // Owner, 31 Oct 2026 (D28): in the Supervisor's absence a visit may be given to this job's
  // Site Manager (the Site Head). Visits assigned to this worker are listed here.
  const { data: assignedVisits } = workerRecord
    ? await (supabase as SupabaseAnyForVisits)
        .from('supervisor_daily_routes')
        .select('id, scheduled_date, slot_start, slot_end, slot_type, site_id, visit_status')
        .eq('supervisor_id', workerRecord.id)
        .gte('scheduled_date', today)
        .in('visit_status', ['scheduled', 'in_progress'])
        .order('scheduled_date', { ascending: true })
    : { data: [] }
  const visitSiteIds = Array.from(new Set(((assignedVisits ?? []) as { site_id: string | null }[]).map(v => v.site_id).filter((v): v is string => Boolean(v))))
  const { data: visitSites } = visitSiteIds.length > 0
    ? await supabase.from('guest_enquiries').select('id, booking_ref').in('id', visitSiteIds)
    : { data: [] }
  const visitBookingRef = Object.fromEntries((visitSites ?? []).map(j => [j.id, j.booking_ref]))
  const SURVEY_SLOT_TYPES = ['scope_survey', 'client_visit', 'estimate_visit']

  const now = new Date()
  const istHour = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24

  const priorityColor = (p: string) => {
    if (p === 'critical') return 'bg-red-500/20 border-red-400/40 text-red-300'
    if (p === 'high') return 'bg-orange-500/20 border-orange-400/40 text-orange-300'
    if (p === 'medium') return 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300'
    return 'bg-blue-500/20 border-blue-400/40 text-blue-300'
  }

  const instructionIcon = (type: string) => {
    if (type === 'hold') return '🔴'
    if (type === 'expedite') return '🟠'
    if (type === 'revised') return '🟡'
    if (type === 'resource') return '🟢'
    if (type === 'alert') return '⚠️'
    return '📋'
  }

  const statusColor = (s: string) => {
    if (s === 'completed') return 'bg-green-500/20 text-green-300 border-green-400/30'
    if (s === 'in_progress') return 'bg-blue-500/20 text-blue-300 border-blue-400/30'
    return 'bg-gray-500/20 text-gray-400 border-gray-400/30'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#2E74B5] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">Pro Engineering</p>
              <p className="text-blue-300 text-xs truncate">Site Incharge — {displayName}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6 pb-8">

        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">
            {greeting(istHour)}, {displayName.split('_')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatDate(now)}</p>
        </div>

        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active Site</p>
          {activeJob ? (
            <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden">
              <div className="bg-[#1F3864] px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-0.5">{activeJob.booking_ref}</p>
                    <h2 className="text-white font-bold text-lg leading-snug">{activeJob.job_title ?? 'Active Job'}</h2>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-400/30 text-green-300 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Active
                  </span>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                {(activeJob.zone ?? activeJob.district) && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2E74B5]/10 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-[#2E74B5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Location</p>
                      <p className="text-sm font-semibold text-gray-800">{[activeJob.zone, activeJob.district].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                )}
                {activeJob.job_type && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2E74B5]/10 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-[#2E74B5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Job Type</p>
                      <p className="text-sm font-semibold text-gray-800 capitalize">{activeJob.job_type}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-8 flex flex-col items-center text-center">
              <p className="text-gray-600 font-semibold text-sm">No active site assigned</p>
              <p className="text-gray-400 text-xs mt-1">Your supervisor will assign a site here</p>
            </div>
          )}
        </section>

        {activeJob && (
          <section className="space-y-3">
            <LTFSubmitButton
              bookingRef={activeJob.booking_ref}
              siteId={activeJob.id}
              siteInchargeUserId={user.id}
            />
            <RequestResourcesButton
              siteInchargeUserId={user.id}
              bookingRef={activeJob.booking_ref}
            />
            <SiteHeadScopeChangeButton bookingRef={activeJob.booking_ref} />
            <a href="/objections" className="block w-full text-center rounded-xl border border-gray-300 text-gray-700 font-semibold py-2.5 text-sm">
              Client Invoice Objections
            </a>
          </section>
        )}

        {(assignedVisits ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Visits assigned to you ({(assignedVisits ?? []).length})
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {((assignedVisits ?? []) as { id: string; scheduled_date: string; slot_start: string | null; slot_end: string | null; slot_type: string | null; site_id: string | null }[]).map(v => {
                const ref = v.site_id ? visitBookingRef[v.site_id] : null
                const href = SURVEY_SLOT_TYPES.includes(v.slot_type ?? '') && ref
                  ? `/site-survey/${ref}`
                  : `/supervisor/site-visit?slot=${v.id}`
                return (
                  <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{ref ?? 'Site'}</p>
                      <p className="text-xs text-gray-500">
                        {v.scheduled_date} · {v.slot_start ?? '—'}–{v.slot_end ?? '—'} · {(v.slot_type ?? 'inspection').replace('_', ' ')}
                      </p>
                    </div>
                    <a href={href} className="shrink-0 text-xs font-bold text-white bg-[#1F3864] rounded-lg px-3 py-1.5">Open visit</a>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {instructions && instructions.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Instructions <span className="text-red-400">({instructions.length} Pending)</span>
            </p>
            <div className="space-y-3">
              {instructions.map((inst) => (
                <div key={inst.id} className={`rounded-2xl border px-5 py-4 ${priorityColor(inst.priority)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-lg shrink-0">{instructionIcon(inst.instruction_type)}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider mb-1 capitalize">{inst.instruction_type.replace('_', ' ')}</p>
                        <p className="text-sm font-medium leading-snug">{inst.instruction_text}</p>
                      </div>
                    </div>
                    <span className="text-xs opacity-70 shrink-0 mt-0.5">
                      {new Date(inst.issued_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {shiftSchedule && shiftSchedule.legs && (shiftSchedule.legs as any[]).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Today's Shift Schedule</p>
            <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden divide-y divide-gray-100">
              {(shiftSchedule.legs as any[]).map((leg: any, i: number) => (
                <div key={i} className="px-5 py-4 space-y-2">
                  <p className="text-xs font-bold text-[#1F3864] uppercase tracking-wider">Leg {leg.leg_number} — {leg.site_name}</p>
                  {leg.previous_site_name && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>🏠</span>
                      <span>Previous: {leg.previous_site_name} — finish {formatTime(leg.previous_site_finish_time)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>🚗</span>
                    <span>Travel {leg.travel_time_minutes} min → Arrive {formatTime(leg.arrival_time)}</span>
                  </div>
                  <div className="bg-[#1F3864]/5 rounded-xl px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Work Window</span>
                      <span className="text-sm font-bold text-[#1F3864]">{formatTime(leg.work_start_time)} → {formatTime(leg.work_end_time)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Duration</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {leg.work_duration_hours} hrs
                        {leg.work_duration_hours < 8 ? ' ⚡ Part Day' : ''}
                        {leg.work_duration_hours >= 15 ? ' 🔄 Multi-Shift' : ''}
                      </span>
                    </div>
                  </div>
                  {leg.travel_time_to_next_minutes && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>🚗</span>
                      <span>Travel to next {leg.travel_time_to_next_minutes} min → {leg.next_site_name} at {formatTime(leg.next_site_arrival)}</span>
                    </div>
                  )}
                </div>
              ))}
              <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">Total Work</span>
                <span className="text-sm font-bold text-[#1F3864]">{shiftSchedule.total_work_hours} hrs</span>
              </div>
            </div>
          </section>
        )}

        {substages && substages.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Substages</p>
            {['M0','M1','M2','M3','M4'].map(milestone => {
              const group = substages.filter(s => s.milestone_code === milestone)
              if (group.length === 0) return null
              return (
                <div key={milestone} className="mb-4">
                  <p className="text-xs font-bold text-[#2E74B5] uppercase tracking-wider mb-2">{milestone}</p>
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
                    {group.map(sub => (
                      <Link href={`/site-incharge/substage/${sub.id}`} key={sub.id} className="block px-5 py-4 active:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            {sub.is_critical_path && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 mb-1">
                                🔴 CRITICAL PATH
                              </span>
                            )}
                            <p className="text-xs text-gray-400 font-medium">{sub.substage_code}</p>
                            <p className="text-sm font-semibold text-gray-800 leading-snug">{sub.substage_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Trade: {sub.trade_type ?? '—'} · Day {sub.planned_day}</p>
                          </div>
                          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusColor(sub.status)}`}>
                            {sub.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-[#2E74B5] h-1.5 rounded-full transition-all"
                            style={{ width: `${sub.completion_pct ?? 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{sub.completion_pct ?? 0}% complete</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )}

      </main>
    </div>
  )
}
