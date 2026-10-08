import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import { addRouteSlotManually } from '../actions'

function formatTime(t: string | null | undefined) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

function travelLabel(mins: number | null) {
  if (!mins) return '—'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default async function SubCoordinatorRoutePage() {
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

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // All supervisor routes for today and tomorrow
  const { data: routes } = await supabase
    .from('supervisor_daily_routes')
    .select(`id, supervisor_id, scheduled_date, slot_start, slot_end,
      site_id, site_address, visit_status, slot_type, planned_by,
      depart_from, depart_time, travel_minutes, arrive_time, buffer_minutes,
      work_start, work_end, work_duration_minutes,
      next_site_id, travel_to_next_minutes, depart_to_next, arrive_next,
      lunch_break, lunch_start, lunch_end,
      report_status, report_submitted_at, ltf_note, qip_template_id, milestone_id`)
    .in('scheduled_date', [today, tomorrow])
    .order('scheduled_date', { ascending: true })
    .order('slot_start', { ascending: true })

  // Supervisors -- guest_enquiries.supervisor_id / supervisor_daily_routes.
  // supervisor_id are both workers.id, not users.id (confirmed convention
  // throughout this codebase).
  const { data: supervisors } = await supabase
    .from('workers')
    .select('id, full_name')
    .eq('trade', 'Supervisor')
    .eq('is_active', true)

  // Active jobs for site selection
  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('id, booking_ref, job_title, job_type, zone, district')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // LTF feeds for today -- ltf_feeds has no booking_ref column at all
  // (confirmed live schema), only site_id (a guest_enquiries.id).
  const { data: ltfFeeds } = await supabase
    .from('ltf_feeds')
    .select('id, site_id, is_ready_tomorrow, target_time_slot, contractor_notes')
    .gte('submitted_at', `${today}T00:00:00`)
    .eq('is_ready_tomorrow', true)

  const supervisorMap = Object.fromEntries(
    (supervisors ?? []).map(s => [s.id, s.full_name])
  )

  const todayRoutes = (routes ?? []).filter(r => r.scheduled_date === today)
  const tomorrowRoutes = (routes ?? []).filter(r => r.scheduled_date === tomorrow)

  const slotTypes = [
    { value: 'inspection', label: '🟢 QIP Inspection' },
    { value: 'overhang', label: '🔴 Overhang' },
    { value: 'client_visit', label: '🔵 Client Visit' },
    { value: 'scope_survey', label: '🔵 Scope Survey' },
    { value: 'estimate_visit', label: '💰 Estimate Visit' },
    { value: 'hq', label: '🟡 HQ Briefing' },
  ]

  const defaultSlots = [
    { time: '08:30', end: '10:30', label: 'Overhang / Morning' },
    { time: '11:30', end: '13:30', label: 'Mid Morning' },
    { time: '14:30', end: '16:30', label: 'Post Lunch' },
    { time: '16:30', end: '18:30', label: 'Afternoon' },
  ]

  const visitStatusBadge = (status: string | null) => {
    if (status === 'visited') return 'bg-green-100 text-green-700 border-green-300'
    if (status === 'overhang') return 'bg-red-100 text-red-700 border-red-300'
    return 'bg-blue-100 text-blue-700 border-blue-300'
  }

  const reportBadge = (status: string | null) => {
    if (status === 'submitted') return 'bg-green-100 text-green-700 border-green-300'
    if (status === 'pending') return 'bg-orange-100 text-orange-700 border-orange-300'
    return 'bg-gray-100 text-gray-500 border-gray-300'
  }

  async function addRouteSlotManuallyAction(formData: FormData) {
    'use server'
    await addRouteSlotManually(formData)
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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Route Plan</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* INFO */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <p className="text-white font-bold text-sm mb-2">Route Compilation Rules</p>
          <div className="space-y-1 text-xs text-blue-200">
            <p>• LTF feeds compile automatically at 20:00 each evening</p>
            <p>• Route shown to supervisor at 07:30 AM next day</p>
            <p>• Sub-coordinator can plan or modify routes manually</p>
            <p>• Coordinator / Admin override takes priority</p>
            <p>• Overhang sites placed first — 08:30 AM slot</p>
            <p>• Four standard slots: 08:30 / 11:30 / 14:30 / 16:30</p>
            <p>• Lunch break: 30 min around 1:00 PM</p>
          </div>
        </div>

        {/* LTF READY — QUICK ADD TO ROUTE */}
        {(ltfFeeds ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              LTF Ready — Add to Tomorrow's Route
            </p>
            <div className="bg-white rounded-2xl border border-green-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(ltfFeeds ?? []).map(feed => {
                const job = (activeJobs ?? []).find(j => j.id === feed.site_id)
                return (
                  <div key={feed.id} className="px-5 py-3 flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">🟢</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400">{job?.booking_ref ?? '—'}</p>
                      <p className="text-sm font-semibold text-gray-800">{job?.job_title ?? '—'}</p>
                      {feed.contractor_notes && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">"{feed.contractor_notes}"</p>
                      )}
                      <p className="text-xs text-blue-600 mt-0.5">Target slot: {feed.target_time_slot ?? 'Not specified'}</p>
                    </div>
                    <button className="shrink-0 bg-[#1F3864] text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      + Add
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* TODAY'S ROUTES */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Today — {today}
            </p>
            <span className="text-xs text-gray-400">{todayRoutes.length} slots</span>
          </div>

          {todayRoutes.length > 0 ? (
            <div className="space-y-3">
              {todayRoutes.map((slot, idx) => (
                <div key={slot.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Slot {idx + 1} · {formatTime(slot.slot_start)} → {formatTime(slot.slot_end)}
                        </p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5 capitalize">
                          {slot.slot_type?.replace('_', ' ') ?? 'Inspection'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${visitStatusBadge(slot.visit_status)}`}>
                          {slot.visit_status ?? 'scheduled'}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${reportBadge(slot.report_status)}`}>
                          {slot.report_status === 'submitted' ? '✓ Report' : slot.report_status === 'pending' ? '⚠ Report' : '— Report'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{slot.site_id ?? '—'}</p>
                        {slot.site_address && <p className="text-xs text-gray-400 mt-0.5">📍 {slot.site_address}</p>}
                        {slot.ltf_note && <p className="text-xs text-green-700 mt-0.5 italic">"{slot.ltf_note}"</p>}
                      </div>
                      <p className="text-xs text-gray-400 shrink-0">
                        {supervisorMap[slot.supervisor_id] ?? 'Supervisor'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-4 py-2">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-gray-400">Depart</p><p className="font-semibold">{formatTime(slot.depart_time)}</p></div>
                        <div><p className="text-gray-400">Travel</p><p className="font-semibold">{travelLabel(slot.travel_minutes)}</p></div>
                        <div><p className="text-gray-400">Work</p><p className="font-semibold">{travelLabel(slot.work_duration_minutes)}</p></div>
                      </div>
                    </div>
                    {slot.lunch_break && (
                      <div className="bg-yellow-50 rounded-xl px-4 py-2 flex items-center gap-2 text-xs">
                        <span>🍽</span>
                        <span className="text-yellow-700 font-semibold">Lunch: {formatTime(slot.lunch_start)} — {formatTime(slot.lunch_end)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-center">
              <p className="text-gray-400 text-sm">No slots planned for today</p>
            </div>
          )}
        </section>

        {/* TOMORROW'S ROUTES */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Tomorrow — {tomorrow}
            </p>
            <span className="text-xs text-gray-400">{tomorrowRoutes.length} slots</span>
          </div>

          {tomorrowRoutes.length > 0 ? (
            <div className="space-y-3">
              {tomorrowRoutes.map((slot, idx) => (
                <div key={slot.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Slot {idx + 1} · {formatTime(slot.slot_start)} → {formatTime(slot.slot_end)}
                      </p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5 capitalize">
                        {slot.slot_type?.replace('_', ' ') ?? 'Inspection'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">{supervisorMap[slot.supervisor_id] ?? 'Supervisor'}</span>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-sm font-semibold text-gray-800">{slot.site_id ?? '—'}</p>
                    {slot.site_address && <p className="text-xs text-gray-400 mt-0.5">📍 {slot.site_address}</p>}
                    {slot.ltf_note && <p className="text-xs text-green-700 mt-0.5 italic">"{slot.ltf_note}"</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-center">
              <p className="text-gray-400 text-sm">No slots planned for tomorrow yet</p>
              <p className="text-gray-400 text-xs mt-1">Will compile from LTF feeds at 20:00</p>
            </div>
          )}
        </section>

        {/* ADD SLOT MANUALLY */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Add Slot Manually
          </p>
          <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden">
            <div className="bg-[#1F3864] px-5 py-3">
              <p className="text-white font-bold text-sm">New Route Slot</p>
              <p className="text-blue-300 text-xs mt-0.5">Planned by Sub-Coordinator · Can be overridden by Coordinator</p>
            </div>
            <form action={addRouteSlotManuallyAction} className="px-5 py-4 space-y-4">

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Supervisor</p>
                <select name="supervisor_id" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">Select supervisor...</option>
                  {(supervisors ?? []).map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Scheduled Date</p>
                <select name="scheduled_date" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value={today}>Today — {today}</option>
                  <option value={tomorrow}>Tomorrow — {tomorrow}</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot Type</p>
                <select name="slot_type" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  {slotTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Site / Booking</p>
                <select name="site_id" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">Select site...</option>
                  {(activeJobs ?? []).map(job => (
                    <option key={job.booking_ref} value={job.id}>
                      {job.booking_ref} — {job.job_title ?? job.job_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Site Address</p>
                <input
                  type="text"
                  placeholder="Enter site address..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Standard Slot</p>
                <div className="grid grid-cols-2 gap-2">
                  {defaultSlots.map(slot => (
                    <button key={slot.time} type="button" className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 text-left active:bg-gray-50">
                      <p>{slot.time} — {slot.end}</p>
                      <p className="text-gray-400 font-normal">{slot.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot Start</p>
                  <input name="slot_start" type="time" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot End</p>
                  <input name="slot_end" type="time" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Depart Time</p>
                  <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Travel (min)</p>
                  <input type="number" placeholder="e.g. 30" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Work Duration (min)</p>
                  <input type="number" placeholder="e.g. 120" defaultValue="120" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded" />
                    <span className="text-xs font-semibold text-gray-600">🍽 Lunch Break</span>
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">LTF Note</p>
                <textarea
                  name="ltf_note"
                  rows={2}
                  placeholder="e.g. Ready by 11:00 AM — waterproofing coat 2 complete"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                />
              </div>

              <button type="submit" className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm">
                + Add Slot to Route
              </button>

            </form>
          </div>
        </section>

      </main>
    </div>
  )
}