import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import ConfirmDayPlanButton from './ConfirmDayPlanButton'

// SA-ROUTE (June log line 40012-40016): "New page at /supervisor/route.
// Reads from supervisor_schedule, ltf_feeds, site_visit_reports. Shows:
// fixed obligations first, overdue visits, LTF-driven visits in time
// sequence, free slots. Confirm day plan button locks route."
//
// Confirmed by grep this page never existed at all -- every link to
// /supervisor/route (the primary nav tab, present on every Supervisor
// page, plus Dashboard's own "Edit Route ->" link) 404'd. The manual
// slot-editing UI that already existed lives at /supervisor/route/plan
// and stays there (a genuinely different job -- editing vs. viewing the
// compiled plan) rather than being merged in here.
//
// "ltf_feeds" as a literal table was never built; the LTF-driven-visit
// concept it named lives on supervisor_daily_routes.ltf_note (already
// wired end to end -- confirmed by grep, populated by Sub-Coordinator's
// route actions). "Free slots" here is reported as a simple count rather
// than exact time-gap computation, a disclosed simplification.
function formatTime(t: string | null | undefined) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default async function SupervisorRoutePage() {
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

  const { data: fixedObligations } = workerRecord
    ? await supabase
        .from('supervisor_schedule')
        .select('id, obligation_type, obligation_description, time_slot, confirmed')
        .eq('supervisor_id', workerRecord.id)
        .eq('schedule_date', today)
    : { data: [] }

  const { data: todayRoute } = workerRecord
    ? await supabase
        .from('supervisor_daily_routes')
        .select('id, slot_start, slot_end, site_id, site_address, slot_type, ltf_note, report_status, route_confirmed')
        .eq('supervisor_id', workerRecord.id)
        .eq('scheduled_date', today)
        .order('slot_start', { ascending: true })
    : { data: [] }

  const { data: overdueRoute } = workerRecord
    ? await supabase
        .from('supervisor_daily_routes')
        .select('id, scheduled_date, slot_start, site_id, site_address, slot_type, report_status')
        .eq('supervisor_id', workerRecord.id)
        .lt('scheduled_date', today)
        .neq('report_status', 'submitted')
        .order('scheduled_date', { ascending: true })
    : { data: [] }

  const routeSiteIds = Array.from(new Set([
    ...(todayRoute ?? []).map(s => s.site_id),
    ...(overdueRoute ?? []).map(s => s.site_id),
  ].filter((v): v is string => Boolean(v))))
  const { data: siteJobs } = routeSiteIds.length > 0
    ? await supabase.from('guest_enquiries').select('id, booking_ref').in('id', routeSiteIds)
    : { data: [] }
  const siteIdToBookingRef = Object.fromEntries((siteJobs ?? []).map(j => [j.id, j.booking_ref]))

  const ltfDrivenVisits = (todayRoute ?? []).filter(s => s.ltf_note)
  const otherVisits = (todayRoute ?? []).filter(s => !s.ltf_note)
  const allConfirmed = (todayRoute ?? []).length > 0 && (todayRoute ?? []).every(s => s.route_confirmed)
  const morningStart = 8 * 60 + 30
  const eveningEnd = 18 * 60 + 30
  const bookedMinutes = (todayRoute ?? []).reduce((sum, s) => {
    if (!s.slot_start || !s.slot_end) return sum
    const [sh, sm] = s.slot_start.split(':').map(Number)
    const [eh, em] = s.slot_end.split(':').map(Number)
    return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
  }, 0)
  const freeMinutes = Math.max(0, (eveningEnd - morningStart) - bookedMinutes)

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Today's Route</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{today}</p>
          <Link href="/supervisor/route/plan" className="text-xs text-[#2E74B5] font-semibold underline">
            Edit / Add Slots →
          </Link>
        </div>

        {/* FIXED OBLIGATIONS */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">1. Fixed Obligations</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(fixedObligations ?? []).map(o => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 capitalize">{o.obligation_type.replace('_', ' ')}</p>
                  {o.obligation_description && <p className="text-xs text-gray-500 mt-0.5">{o.obligation_description}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{o.time_slot ?? '—'}</span>
              </div>
            ))}
            {(fixedObligations ?? []).length === 0 && (
              <div className="px-5 py-5 text-center"><p className="text-gray-400 text-sm">No fixed obligations today</p></div>
            )}
          </div>
        </section>

        {/* OVERDUE VISITS */}
        {(overdueRoute ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">2. Overdue Visits</p>
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(overdueRoute ?? []).map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-700">{(s.site_id && siteIdToBookingRef[s.site_id]) ?? 'Site TBC'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Was due {s.scheduled_date} · {s.slot_type ?? 'inspection'}</p>
                  </div>
                  <Link href={`/supervisor/site-visit?slot=${s.id}`} className="shrink-0 text-xs text-red-600 font-semibold underline">
                    Visit Now →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* LTF-DRIVEN VISITS */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">3. LTF-Driven Visits</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {ltfDrivenVisits.map(s => (
              <div key={s.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">{formatTime(s.slot_start)} — {(s.site_id && siteIdToBookingRef[s.site_id]) ?? 'Site TBC'}</p>
                  <span className="text-xs text-gray-400 shrink-0 capitalize">{s.report_status ?? 'pending'}</span>
                </div>
                <p className="text-xs text-green-700 mt-1">"{s.ltf_note}"</p>
              </div>
            ))}
            {ltfDrivenVisits.length === 0 && (
              <div className="px-5 py-5 text-center"><p className="text-gray-400 text-sm">No LTF-driven visits today</p></div>
            )}
          </div>
        </section>

        {/* OTHER SCHEDULED VISITS (not fixed obligation or LTF-driven) */}
        {otherVisits.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Other Scheduled Visits</p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {otherVisits.map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">{formatTime(s.slot_start)} — {(s.site_id && siteIdToBookingRef[s.site_id]) ?? 'Site TBC'}</p>
                  <span className="text-xs text-gray-400 shrink-0 capitalize">{s.slot_type?.replace('_', ' ') ?? 'inspection'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FREE SLOTS */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">4. Free Time Today</p>
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-gray-700">
              {freeMinutes > 0 ? `~${Math.floor(freeMinutes / 60)}h ${freeMinutes % 60}m unscheduled` : 'Fully booked'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">between 08:30 AM and 06:30 PM, outside booked slots</p>
          </div>
        </section>

        {/* CONFIRM DAY PLAN */}
        {workerRecord && (todayRoute ?? []).length > 0 && (
          <ConfirmDayPlanButton supervisorId={workerRecord.id} date={today} alreadyConfirmed={allConfirmed} />
        )}

      </main>
    </div>
  )
}
