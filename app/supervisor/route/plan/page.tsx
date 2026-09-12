import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../../dashboard/SignOutButton'

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

export default async function RoutePlanPage() {
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
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const { data: todayRoute } = await supabase
    .from('supervisor_daily_routes')
    .select(`id, slot_start, slot_end, site_id, site_address, visit_status,
      milestone_id, qip_template_id, ltf_note, slot_type, planned_by,
      depart_from, depart_time, travel_minutes, arrive_time, buffer_minutes,
      work_start, work_end, work_duration_minutes,
      next_site_id, travel_to_next_minutes, depart_to_next, arrive_next,
      lunch_break, lunch_start, lunch_end,
      report_status, report_submitted_at, scheduled_date`)
    .eq('supervisor_id', workerRecord?.id ?? '')
    .in('scheduled_date', [today, tomorrow])
    .order('scheduled_date', { ascending: true })
    .order('slot_start', { ascending: true })

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district')
    .eq('supervisor_id', workerRecord?.id ?? '')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const todaySlots = (todayRoute ?? []).filter(s => s.scheduled_date === today)
  const tomorrowSlots = (todayRoute ?? []).filter(s => s.scheduled_date === tomorrow)

  const slotTypes = [
    { value: 'inspection', label: '🟢 QIP Inspection' },
    { value: 'overhang', label: '🔴 Overhang' },
    { value: 'client_visit', label: '🔵 Client Visit' },
    { value: 'scope_survey', label: '🔵 Scope Survey' },
    { value: 'estimate_visit', label: '💰 Estimate Visit' },
    { value: 'hq', label: '🟡 HQ Briefing' },
  ]

  const defaultSlots = [
    { time: '08:30', label: 'Overhang / Morning' },
    { time: '11:30', label: 'Mid Morning' },
    { time: '14:30', label: 'Post Lunch' },
    { time: '16:30', label: 'Afternoon' },
  ]

  const plannedByLabel = (p: string | null) => {
    if (p === 'subcoordinator') return '📋 Sub-Coordinator'
    if (p === 'supervisor') return '👤 Self-Planned'
    return '⚙️ System'
  }

  const reportBadge = (status: string | null) => {
    if (status === 'submitted') return 'bg-green-100 text-green-700 border-green-300'
    if (status === 'pending') return 'bg-orange-100 text-orange-700 border-orange-300'
    return 'bg-gray-100 text-gray-500 border-gray-300'
  }

  const reportLabel = (status: string | null) => {
    if (status === 'submitted') return '✓ Submitted'
    if (status === 'pending') return '⚠ Pending'
    return '— Not Started'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* HEADER */}
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/supervisor/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Route Planning</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* INFO BANNER */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <p className="text-white font-bold text-sm mb-1">Route Planning Rules</p>
          <div className="space-y-1 text-xs text-blue-200">
            <p>• LTF feeds compile automatically at 20:00 each evening</p>
            <p>• Route shown to supervisor at 07:30 AM next day</p>
            <p>• Sub-coordinator or supervisor can plan manually</p>
            <p>• Coordinator / Admin override takes priority over all</p>
            <p>• First site — no later than 10:00 AM · Direct to site (auto)</p>
            <p>• Lunch break — 30 min around 1:00 PM</p>
            <p>• Cannot double-book two slots simultaneously</p>
          </div>
        </div>

        {/* DEFAULT SLOT TIMES */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Standard Inspection Slots
          </p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {defaultSlots.map(slot => (
              <div key={slot.time} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-bold text-gray-800">{slot.time} AM/PM</p>
                  <p className="text-xs text-gray-400">{slot.label} · 2 hour slot</p>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">2 hrs</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3 bg-yellow-50">
              <div>
                <p className="text-sm font-bold text-yellow-700">🍽 Lunch Break</p>
                <p className="text-xs text-yellow-600">Around 1:00 PM · 30 min</p>
              </div>
              <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-lg">30 min</span>
            </div>
          </div>
        </section>

        {/* TODAY'S ROUTE */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Today — {today}
            </p>
            <span className="text-xs text-gray-400">{todaySlots.length} slots planned</span>
          </div>

          {todaySlots.length > 0 ? (
            <div className="space-y-3">
              {todaySlots.map((slot, idx) => (
                <div key={slot.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Slot header */}
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Slot {idx + 1} · {formatTime(slot.slot_start)} → {formatTime(slot.slot_end)}
                      </p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5 capitalize">
                        {slot.slot_type?.replace('_', ' ') ?? 'Inspection'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{plannedByLabel(slot.planned_by)}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${reportBadge(slot.report_status)}`}>
                        {reportLabel(slot.report_status)}
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    {/* Site */}
                    <div className="flex items-start gap-3">
                      <span className="text-base shrink-0 mt-0.5">🏗</span>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 font-medium">Site</p>
                        <p className="text-sm font-semibold text-gray-800">{slot.site_id ?? '—'}</p>
                        {slot.site_address && (
                          <p className="text-xs text-gray-500 mt-0.5">📍 {slot.site_address}</p>
                        )}
                      </div>
                    </div>

                    {/* Time planning grid */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Time Planning</p>
                      <div className="grid grid-cols-3 gap-y-2 gap-x-3 text-xs">
                        <div>
                          <p className="text-gray-400">Depart From</p>
                          <p className="font-semibold text-gray-700">{slot.depart_from ?? (idx === 0 ? 'Home Base' : 'Prev Site')}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Depart Time</p>
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
                        <div>
                          <p className="text-gray-400">Buffer</p>
                          <p className="font-semibold text-gray-700">{slot.buffer_minutes ?? 0} min</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Planned By</p>
                          <p className="font-semibold text-gray-700 capitalize">{slot.planned_by ?? 'system'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Lunch */}
                    {slot.lunch_break && (
                      <div className="bg-yellow-50 rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-base">🍽</span>
                        <div className="grid grid-cols-3 gap-x-3 text-xs flex-1">
                          <div>
                            <p className="text-gray-400">Lunch From</p>
                            <p className="font-semibold text-yellow-700">{formatTime(slot.lunch_start)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Lunch To</p>
                            <p className="font-semibold text-yellow-700">{formatTime(slot.lunch_end)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Duration</p>
                            <p className="font-semibold text-yellow-700">30 min</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Travel out */}
                    {slot.next_site_id && (
                      <div className="bg-blue-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Travel to Next Site</p>
                        <div className="grid grid-cols-3 gap-y-2 gap-x-3 text-xs">
                          <div>
                            <p className="text-gray-400">Next Site</p>
                            <p className="font-semibold text-blue-700">{slot.next_site_id}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Depart</p>
                            <p className="font-semibold text-blue-700">{formatTime(slot.depart_to_next)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Travel</p>
                            <p className="font-semibold text-blue-700">{travelLabel(slot.travel_to_next_minutes)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Arrive Next</p>
                            <p className="font-semibold text-blue-700">{formatTime(slot.arrive_next)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* LTF note */}
                    {slot.ltf_note && (
                      <div className="bg-green-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 font-medium mb-0.5">LTF Note from Site Head</p>
                        <p className="text-xs text-green-800 font-semibold">"{slot.ltf_note}"</p>
                      </div>
                    )}

                    {/* Report status */}
                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${reportBadge(slot.report_status)}`}>
                        {reportLabel(slot.report_status)}
                      </span>
                      {slot.report_status !== 'submitted' && (
                        <Link
                          href={`/supervisor/site-visit?slot=${slot.id}`}
                          className="text-xs text-[#2E74B5] font-semibold underline"
                        >
                          Submit Report →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
              <p className="text-gray-500 text-sm font-semibold">No slots planned for today</p>
              <p className="text-gray-400 text-xs mt-1">LTF feeds compile at 20:00 · Or add slots manually below</p>
            </div>
          )}
        </section>

        {/* TOMORROW'S ROUTE */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Tomorrow — {tomorrow}
            </p>
            <span className="text-xs text-gray-400">{tomorrowSlots.length} slots planned</span>
          </div>

          {tomorrowSlots.length > 0 ? (
            <div className="space-y-3">
              {tomorrowSlots.map((slot, idx) => (
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
                    <span className="text-xs text-gray-500">{plannedByLabel(slot.planned_by)}</span>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-800">{slot.site_id ?? '—'}</p>
                    {slot.site_address && (
                      <p className="text-xs text-gray-500 mt-0.5">📍 {slot.site_address}</p>
                    )}
                    {slot.ltf_note && (
                      <div className="mt-2 bg-green-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-green-800 font-semibold">"{slot.ltf_note}"</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-center">
              <p className="text-gray-400 text-sm">No slots planned for tomorrow yet</p>
              <p className="text-gray-400 text-xs mt-1">LTF feeds compile tonight at 20:00</p>
            </div>
          )}
        </section>

        {/* MANUAL ADD SLOT */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Add Slot Manually
          </p>
          <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden">
            <div className="bg-[#1F3864] px-5 py-3">
              <p className="text-white font-bold text-sm">New Slot</p>
              <p className="text-blue-300 text-xs mt-0.5">Self-planned · Can be overridden by Sub-Coordinator or Coordinator</p>
            </div>
            <div className="px-5 py-4 space-y-4">

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Scheduled Date</p>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value={today}>Today — {today}</option>
                  <option value={tomorrow}>Tomorrow — {tomorrow}</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot Type</p>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  {slotTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Site / Booking</p>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">Select site...</option>
                  {(activeJobs ?? []).map(job => (
                    <option key={job.booking_ref} value={job.booking_ref}>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot Start</p>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                    <option value="08:30">08:30 AM</option>
                    <option value="09:00">09:00 AM</option>
                    <option value="11:30">11:30 AM</option>
                    <option value="14:30">02:30 PM</option>
                    <option value="16:30">04:30 PM</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot End</p>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                    <option value="10:30">10:30 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="13:30">01:30 PM</option>
                    <option value="16:30">04:30 PM</option>
                    <option value="18:30">06:30 PM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Depart From</p>
                  <input
                    type="text"
                    placeholder="Home / Prev site..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Depart Time</p>
                  <input
                    type="time"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Travel Time (min)</p>
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Work Duration (min)</p>
                  <input
                    type="number"
                    placeholder="e.g. 120"
                    defaultValue="120"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Next Site (if applicable)</p>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">None — last site today</option>
                  {(activeJobs ?? []).map(job => (
                    <option key={job.booking_ref} value={job.booking_ref}>
                      {job.booking_ref} — {job.job_title ?? job.job_type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Travel to Next (min)</p>
                  <input
                    type="number"
                    placeholder="e.g. 20"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded" />
                    <span className="text-xs font-semibold text-gray-600">🍽 Lunch Break</span>
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">LTF Note (from Site Head)</p>
                <textarea
                  rows={2}
                  placeholder="e.g. Ready by 11:00 AM — waterproofing coat 2 complete"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                />
              </div>

              <button className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm">
                + Add Slot to Route
              </button>

            </div>
          </div>
        </section>

        {/* ACTIVE JOBS REFERENCE */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Active Jobs — Quick Reference
          </p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(activeJobs ?? []).map(job => (
              <div key={job.booking_ref} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">{job.booking_ref}</p>
                  <p className="text-sm font-semibold text-gray-800">{job.job_title ?? job.job_type}</p>
                  <p className="text-xs text-gray-400 mt-0.5">📍 {[job.zone, job.district].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            ))}
            {(activeJobs ?? []).length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No active jobs assigned</p>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  )
}