import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'

export default async function WorkersPage() {
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

  const { data: workers } = await supabase
    .from('workers')
    .select(`id, full_name, trade, district, is_available, is_active,
      skill_level, daily_wage_inr, current_job_id, phone,
      average_rating, total_deployments`)
    .eq('is_active', true)
    .order('trade', { ascending: true })
    .order('full_name', { ascending: true })

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, zone, district')
    .eq('is_active', true)

  const jobMap = Object.fromEntries(
    (activeJobs ?? []).map(j => [j.booking_ref, j])
  )

  const trades = [...new Set((workers ?? []).map(w => w.trade).filter(Boolean))]
  const availableWorkers = (workers ?? []).filter(w => w.is_available)
  const deployedWorkers = (workers ?? []).filter(w => !w.is_available)

  const skillBadge = (level: string | null) => {
    if (level === 'master') return 'bg-purple-100 text-purple-700 border-purple-300'
    if (level === 'senior') return 'bg-blue-100 text-blue-700 border-blue-300'
    if (level === 'skilled') return 'bg-green-100 text-green-700 border-green-300'
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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Workers</p>
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
              <p className="text-green-400 font-bold text-2xl">{availableWorkers.length}</p>
              <p className="text-blue-300 text-xs">Available</p>
            </div>
            <div>
              <p className="text-orange-400 font-bold text-2xl">{deployedWorkers.length}</p>
              <p className="text-blue-300 text-xs">Deployed</p>
            </div>
            <div>
              <p className="text-white font-bold text-2xl">{(workers ?? []).length}</p>
              <p className="text-blue-300 text-xs">Total Active</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30">
            <p className="text-blue-300 text-xs text-center">
              Trades: {trades.join(' · ')}
            </p>
          </div>
        </div>

        {/* Worker-to-job assignment moved to Coordinator (project owner's decision,
            1 Oct 2026) -- Sub-Coordinator's job is driving a job's intake/estimate
            to client consent, not allocating workers once it's in execution. */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-blue-900">
            Worker assignment to jobs is now handled by Coordinator (<code>/admin/coordinators</code> job
            routing, then the Estimate Console&apos;s Confirm-for-Execution step). This page stays
            read-only for worker availability.
          </p>
        </div>

        {/* AVAILABLE WORKERS */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Available Workers — {availableWorkers.length}
          </p>
          {availableWorkers.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {availableWorkers.map(w => (
                <div key={w.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-gray-800">{w.full_name}</p>
                        {w.skill_level && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${skillBadge(w.skill_level)}`}>
                            {w.skill_level}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 capitalize">{w.trade} · {w.district}</p>
                      {w.phone && <p className="text-xs text-gray-400 mt-0.5">📞 {w.phone}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        Available
                      </span>
                      {w.daily_wage_inr && (
                        <p className="text-xs text-gray-400 mt-1">₹{w.daily_wage_inr}/day</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                    {w.average_rating && <div>⭐ {Number(w.average_rating).toFixed(1)}</div>}
                    {w.total_deployments && <div>🏗 {w.total_deployments} jobs</div>}

                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
              <p className="text-gray-400 text-sm">No workers available</p>
              <p className="text-gray-400 text-xs mt-1">All workers are currently deployed</p>
            </div>
          )}
        </section>

        {/* DEPLOYED WORKERS */}
        {deployedWorkers.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Deployed Workers — {deployedWorkers.length}
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {deployedWorkers.map(w => {
                const currentJob = w.current_job_id ? jobMap[w.current_job_id] : null
                return (
                  <div key={w.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{w.full_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{w.trade} · {w.district}</p>
                      {currentJob && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          📍 {currentJob.job_title} — {[currentJob.zone, currentJob.district].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      Deployed
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* TRADE BREAKDOWN */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Trade Breakdown
          </p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {trades.map(trade => {
              const tradeWorkers = (workers ?? []).filter(w => w.trade === trade)
              const tradeAvailable = tradeWorkers.filter(w => w.is_available).length
              return (
                <div key={trade} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 capitalize">{trade}</p>
                    <p className="text-xs text-gray-400">{tradeWorkers.length} total · {tradeAvailable} available</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-[#2E74B5] h-2 rounded-full"
                        style={{ width: `${tradeWorkers.length > 0 ? (tradeAvailable / tradeWorkers.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 w-8 text-right">
                      {tradeWorkers.length > 0 ? Math.round((tradeAvailable / tradeWorkers.length) * 100) : 0}%
                    </span>
                  </div>
                </div>
              )
            })}
            {trades.length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-gray-400 text-sm">No workers in system</p>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  )
}

