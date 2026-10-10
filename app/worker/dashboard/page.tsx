import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'

// A real, confirmed, pre-existing gap closed: every worker gets a real auth.users + users row
// (platform_role='worker') and a real login_email/Worker2026 password the moment they're
// onboarded (createWorkerAuthAccount, app/onboarding/[trade]/actions.ts, Session 65) -- but
// until app/login/actions.ts's fix alongside this file, nothing in the login redirect chain
// ever sent them anywhere, and no dashboard existed for them to land on even if it had. This
// page is that dashboard, for real: a worker's own actual Dynamic Scheduler bookings
// (task_ledger.assigned_worker_id), the same real source of truth the Supervisor dashboard's
// own "My Deployments" section (app/supervisor/dashboard/page.tsx) already reads, built the
// same way, no new migration -- every column here already exists live.

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function WorkerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'worker') redirect('/login')

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id, full_name, trade, worker_code, zones, is_available, skill_grade, jobs_completed, phone')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const displayName = workerRecord?.full_name ?? profile?.full_name ?? user.email?.split('@')[0] ?? 'Worker'
  const todayLocal = new Date().toLocaleDateString('en-CA')

  const { data: deployments } = workerRecord
    ? await supabase
        .from('task_ledger')
        .select('slot_id, booking_ref, substage_id, target_date, shift_window, required_skill_code, slot_status')
        .eq('assigned_worker_id', workerRecord.id)
        .neq('slot_status', 'Cancelled_Delayed')
        .order('target_date', { ascending: true })
        .limit(30)
    : { data: [] }

  const bookingRefs = [...new Set((deployments ?? []).map(d => d.booking_ref))]
  const { data: jobs } = bookingRefs.length > 0
    ? await supabase.from('guest_enquiries').select('booking_ref, job_title, zone, district').in('booking_ref', bookingRefs)
    : { data: [] }
  const jobByBookingRef = Object.fromEntries((jobs ?? []).map(j => [j.booking_ref, j]))

  const substageIds = [...new Set((deployments ?? []).map(d => d.substage_id).filter((v): v is string => !!v))]
  const { data: substages } = substageIds.length > 0
    ? await supabase.from('job_milestone_substages').select('id, substage_name, milestone_code').in('id', substageIds)
    : { data: [] }
  const substageById = Object.fromEntries((substages ?? []).map(s => [s.id, s]))

  const upcoming = (deployments ?? []).filter(d => d.target_date >= todayLocal)
  const past = (deployments ?? []).filter(d => d.target_date < todayLocal)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864] text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-blue-300">Pro Engineering</p>
          <p className="font-bold">Worker — {displayName}</p>
        </div>
        <SignOutButton />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <p className="text-lg font-bold text-gray-800">Hello, {displayName}</p>
          <p className="text-sm text-gray-500">{formatDate(new Date())}</p>
        </div>

        {workerRecord && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">My Profile</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Trade</span><p className="font-semibold text-gray-800">{workerRecord.trade}</p></div>
              <div><span className="text-gray-400">Worker Code</span><p className="font-semibold text-gray-800">{workerRecord.worker_code ?? '—'}</p></div>
              <div><span className="text-gray-400">Zones</span><p className="font-semibold text-gray-800">{(workerRecord.zones ?? []).join(', ') || '—'}</p></div>
              <div><span className="text-gray-400">Status</span><p className={`font-semibold ${workerRecord.is_available ? 'text-green-600' : 'text-red-600'}`}>{workerRecord.is_available ? 'Available' : 'Not Available'}</p></div>
            </div>
          </div>
        )}

        {!workerRecord && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <p className="text-sm text-amber-800">Your login is active, but no worker record is linked to it yet. Contact your Coordinator.</p>
          </div>
        )}

        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">My Jobs &amp; Bookings (Dynamic Scheduler)</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {upcoming.map(d => {
              const job = jobByBookingRef[d.booking_ref]
              const substage = d.substage_id ? substageById[d.substage_id] : null
              const isToday = d.target_date === todayLocal
              const statusCls = d.slot_status === 'Completed'
                ? 'bg-green-100 text-green-700 border-green-300'
                : isToday ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-blue-100 text-blue-700 border-blue-300'
              const statusLabel = d.slot_status === 'Completed' ? 'Completed' : isToday ? 'Today' : 'Planned'
              return (
                <div key={d.slot_id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusCls}`}>{statusLabel}</span>
                    <span className="text-xs text-gray-400 font-medium">{d.target_date} · {d.shift_window === 'FULL_DAY' ? 'Full Day' : `Half Day — ${d.shift_window}`}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{substage?.substage_name ?? d.required_skill_code}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.booking_ref} · {job?.job_title ?? ''} · {job?.zone ?? job?.district ?? ''}{substage?.milestone_code ? ` · ${substage.milestone_code}` : ''}</p>
                </div>
              )
            })}
            {upcoming.length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No upcoming bookings yet.</p>
              </div>
            )}
          </div>
        </section>

        {past.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Past Bookings</p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {past.slice(-10).reverse().map(d => {
                const job = jobByBookingRef[d.booking_ref]
                const substage = d.substage_id ? substageById[d.substage_id] : null
                return (
                  <div key={d.slot_id} className="px-5 py-3">
                    <p className="text-xs text-gray-400">{d.target_date} · {d.booking_ref}</p>
                    <p className="text-sm text-gray-700">{substage?.substage_name ?? d.required_skill_code}{job?.job_title ? ` — ${job.job_title}` : ''}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
