import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type RouteSlot = {
  id: any
  supervisor_id: any
  booking_ref: any
  slot_date: any
  slot_type: any
  depart_time: any
  arrive_time: any
  work_start: any
  work_end: any
  site_address: any
  ltf_note: any
  report_status: any
  planned_by: any
}

export default async function CoordinatorRoutesPage() {
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

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const { data: supervisors } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('platform_role', 'supervisor')
    .order('full_name', { ascending: true })

  const supervisorIds = (supervisors ?? []).map(s => s.id)

  const { data: todayRaw } = supervisorIds.length > 0
    ? await supabase
        .from('supervisor_daily_routes')
        .select(`id, supervisor_id, booking_ref, slot_date, slot_type,
          depart_time, arrive_time, work_start, work_end,
          site_address, ltf_note, report_status, planned_by`)
        .in('supervisor_id', supervisorIds)
        .eq('slot_date', today)
        .order('depart_time', { ascending: true })
    : { data: [] as RouteSlot[] }

  const { data: tomorrowRaw } = supervisorIds.length > 0
    ? await supabase
        .from('supervisor_daily_routes')
        .select(`id, supervisor_id, booking_ref, slot_date, slot_type,
          depart_time, arrive_time, work_start, work_end,
          site_address, ltf_note, report_status, planned_by`)
        .in('supervisor_id', supervisorIds)
        .eq('slot_date', tomorrow)
        .order('depart_time', { ascending: true })
    : { data: [] as RouteSlot[] }

  const todayRoutes: RouteSlot[] = todayRaw ?? []
  const tomorrowRoutes: RouteSlot[] = tomorrowRaw ?? []

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district')
    .eq('is_active', true)

  const supervisorMap = Object.fromEntries((supervisors ?? []).map(s => [s.id, s.full_name]))
  const jobMap = Object.fromEntries((activeJobs ?? []).map(j => [j.booking_ref, j]))

  const groupBySuper = (routes: RouteSlot[]) => {
    const map = new Map<string, RouteSlot[]>()
    for (const r of routes) {
      if (!map.has(r.supervisor_id)) map.set(r.supervisor_id, [])
      map.get(r.supervisor_id)!.push(r)
    }
    return map
  }

  const todayBySupervisor = groupBySuper(todayRoutes)
  const tomorrowBySupervisor = groupBySuper(tomorrowRoutes)

  const slotTypeBadge = (type: string) => {
    if (type === 'hq_reporting') return 'bg-purple-100 text-purple-700 border-purple-300'
    if (type === 'unit_reporting') return 'bg-blue-100 text-blue-700 border-blue-300'
    if (type === 'site_visit') return 'bg-green-100 text-green-700 border-green-300'
    if (type === 'late_ltf') return 'bg-orange-100 text-orange-700 border-orange-300'
    return 'bg-gray-100 text-gray-500 border-gray-200'
  }

  const slotTypeLabel = (type: string) => {
    if (type === 'hq_reporting') return 'HQ Reporting'
    if (type === 'unit_reporting') return 'Unit Reporting'
    if (type === 'site_visit') return 'Site Visit'
    if (type === 'late_ltf') return 'Late LTF'
    return type?.replace(/_/g, ' ') ?? 'Site'
  }

  const renderSlots = (slots: RouteSlot[], supId: string, dayLabel: string) => (
    <div key={supId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-[#1F3864] px-5 py-2.5">
        <p className="text-white font-bold text-sm">{supervisorMap[supId] ?? 'Unknown Supervisor'}</p>
        <p className="text-blue-300 text-xs mt-0.5">{slots.length} slot{slots.length !== 1 ? 's' : ''} {dayLabel}</p>
      </div>
      <div className="divide-y divide-gray-100">
        {slots.map(slot => {
          const job = slot.booking_ref ? jobMap[slot.booking_ref] : null
          return (
            <div key={slot.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${slotTypeBadge(slot.slot_type)}`}>
                      {slotTypeLabel(slot.slot_type)}
                    </span>
                    {slot.booking_ref && <span className="text-xs text-gray-400">{slot.booking_ref}</span>}
                  </div>
                  {job && <p className="text-sm font-semibold text-gray-700">{job.job_title ?? job.job_type}</p>}
                  {slot.site_address && <p className="text-xs text-gray-400">{slot.site_address}</p>}
                  {slot.ltf_note && <p className="text-xs text-orange-600 mt-0.5">📋 {slot.ltf_note}</p>}
                </div>
                <div className="shrink-0 text-right text-xs text-gray-400">
                  {slot.depart_time && <p>Depart: {slot.depart_time}</p>}
                  {slot.arrive_time && <p>Arrive: {slot.arrive_time}</p>}
                  {slot.work_start && slot.work_end && <p>{slot.work_start}–{slot.work_end}</p>}
                </div>
              </div>
              {slot.report_status && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  slot.report_status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>{slot.report_status}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/coordinator/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Routes</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-white font-bold text-2xl">{(supervisors ?? []).length}</p>
              <p className="text-blue-300 text-xs">Supervisors</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{todayRoutes.length}</p>
              <p className="text-blue-300 text-xs">Today Slots</p>
            </div>
            <div>
              <p className="text-orange-400 font-bold text-2xl">{tomorrowRoutes.length}</p>
              <p className="text-blue-300 text-xs">Tomorrow</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30 text-center">
            <p className="text-blue-200 text-xs">Override received by supervisor previous evening · Late LTF inserted manually</p>
          </div>
        </div>

        {/* OVERRIDE TYPES */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Override Types</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {[
              { icon: '🏢', type: 'HQ Reporting', desc: 'Supervisor reports to HQ instead of going directly to site' },
              { icon: '🏗', type: 'Unit Reporting', desc: 'Supervisor reports to a unit or assembly point before proceeding to site' },
              { icon: '⏰', type: 'Late LTF Insert', desc: 'Supervisor missed LTF cutoff — coordinator manually inserts site into tomorrow\'s route' },
              { icon: '📋', type: 'Directive Override', desc: 'Coordinator issues a directive that changes the supervisor\'s planned route' },
            ].map(item => (
              <div key={item.type} className="px-5 py-3 flex items-start gap-3">
                <span className="text-xl shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-800">{item.type}</p>
                  <p className="text-xs text-gray-400 leading-snug">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ADD OVERRIDE FORM */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Add Override Slot</p>
          <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden">
            <div className="bg-[#1F3864] px-5 py-3">
              <p className="text-white font-bold text-sm">Route Override</p>
              <p className="text-blue-300 text-xs mt-0.5">Received by supervisor previous evening / night</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Supervisor</p>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">Select supervisor...</option>
                  {(supervisors ?? []).map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Date</p>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                    <option value={today}>Today</option>
                    <option value={tomorrow}>Tomorrow</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Override Type</p>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                    <option value="hq_reporting">HQ Reporting</option>
                    <option value="unit_reporting">Unit Reporting</option>
                    <option value="late_ltf">Late LTF Insert</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Site / Job (if Late LTF)</p>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">Select site (optional)...</option>
                  {(activeJobs ?? []).map(j => (
                    <option key={j.booking_ref} value={j.booking_ref}>
                      {j.booking_ref} — {j.job_title ?? j.job_type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Depart Time</p>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                    {['06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30','10:00'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Arrive Time</p>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                    {['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Note to Supervisor</p>
                <textarea
                  rows={2}
                  placeholder="Reason for override — will appear as Override Banner on supervisor dashboard..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                />
              </div>
              <button className="w-full bg-[#1F3864] text-white font-bold py-3.5 rounded-xl text-sm">
                Add Override Slot
              </button>
            </div>
          </div>
        </section>

        {/* TODAY */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Today — {new Date(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          {todayBySupervisor.size === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
              <p className="text-gray-400 text-sm">No routes planned for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(todayBySupervisor.entries()).map(([supId, slots]) =>
                renderSlots(slots, supId, 'today')
              )}
            </div>
          )}
        </section>

        {/* TOMORROW */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Tomorrow — {new Date(tomorrow).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          {tomorrowBySupervisor.size === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
              <p className="text-gray-400 text-sm">No routes planned for tomorrow yet</p>
              <p className="text-gray-400 text-xs mt-1">Supervisors submit LTF by 20:00 tonight</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(tomorrowBySupervisor.entries()).map(([supId, slots]) =>
                renderSlots(slots, supId, 'tomorrow')
              )}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}