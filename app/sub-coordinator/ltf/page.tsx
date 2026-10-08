import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import { addLtfToRoute, rejectLtfFromRoute, chaseSiteHead, notifyCoordinator } from '../actions'

function formatDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

export default async function LTFFeedsPage() {
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
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const { data: todayFeeds } = await supabase
    .from('ltf_feeds')
    .select('id, site_id, booking_ref, submitted_by, submitted_at, is_ready_tomorrow, target_time_slot, contractor_notes, accountability_flag')
    .gte('submitted_at', `${today}T00:00:00`)
    .order('submitted_at', { ascending: false })

  const { data: yesterdayFeeds } = await supabase
    .from('ltf_feeds')
    .select('id, site_id, booking_ref, submitted_by, submitted_at, is_ready_tomorrow, target_time_slot, contractor_notes, accountability_flag')
    .gte('submitted_at', `${yesterday}T00:00:00`)
    .lt('submitted_at', `${today}T00:00:00`)
    .order('submitted_at', { ascending: false })

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, zone, district, supervisor_id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const jobMap = Object.fromEntries(
    (activeJobs ?? []).map(j => [j.booking_ref, j])
  )

  const readyFeeds = (todayFeeds ?? []).filter(f => f.is_ready_tomorrow)
  const notReadyFeeds = (todayFeeds ?? []).filter(f => !f.is_ready_tomorrow)
  const flaggedFeeds = (todayFeeds ?? []).filter(f => f.accountability_flag)
  const cutoffTime = '20:00'
  const now = new Date()
  const cutoffPassed = now.getHours() >= 20

  // Jobs that have NOT submitted LTF today
  const submittedBookingRefs = new Set((todayFeeds ?? []).map(f => f.booking_ref))
  const missingFeeds = (activeJobs ?? []).filter(j => !submittedBookingRefs.has(j.booking_ref))

  async function addToRouteAction(formData: FormData) {
    'use server'
    await addLtfToRoute(formData)
  }
  async function chaseSiteHeadAction(formData: FormData) {
    'use server'
    await chaseSiteHead(formData)
  }
  async function notifyCoordinatorAction(formData: FormData) {
    'use server'
    await notifyCoordinator(formData)
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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">LTF Feeds</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-bold text-sm">Tonight's LTF Summary</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cutoffPassed ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'}`}>
              {cutoffPassed ? 'Cutoff Passed 20:00' : `Cutoff: ${cutoffTime}`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-green-400 font-bold text-xl">{readyFeeds.length}</p>
              <p className="text-blue-300 text-xs">Ready</p>
            </div>
            <div>
              <p className="text-red-400 font-bold text-xl">{notReadyFeeds.length}</p>
              <p className="text-blue-300 text-xs">Not Ready</p>
            </div>
            <div>
              <p className="text-orange-400 font-bold text-xl">{missingFeeds.length}</p>
              <p className="text-blue-300 text-xs">Missing</p>
            </div>
            <div>
              <p className="text-yellow-400 font-bold text-xl">{flaggedFeeds.length}</p>
              <p className="text-blue-300 text-xs">Flagged</p>
            </div>
          </div>
        </div>

        {/* LTF RULES */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">LTF Rules</p>
          <div className="space-y-1 text-xs text-blue-600">
            <p>• Site heads submit LTF feeds by 20:00 each evening</p>
            <p>• Sub-coordinator compiles route from feeds overnight</p>
            <p>• Late feeds (after 20:00) cannot be auto-compiled</p>
            <p>• Late feed → notify supervisor → en-route check → accept/decline</p>
            <p>• Accountability flag raised if site head says ready but work not done</p>
          </div>
        </div>

        {/* READY FEEDS */}
        {readyFeeds.length > 0 && (
          <section>
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">
              ✅ Ready Tomorrow — {readyFeeds.length} Sites
            </p>
            <div className="space-y-3">
              {readyFeeds.map(feed => {
                const job = jobMap[feed.booking_ref]
                async function rejectAction() {
                  'use server'
                  await rejectLtfFromRoute(feed.id)
                }
                return (
                  <div key={feed.id} className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden">
                    <div className="bg-green-50 px-5 py-3 border-b border-green-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-400">{feed.booking_ref}</p>
                          <p className="text-sm font-bold text-gray-800">{job?.job_title ?? feed.site_id ?? '—'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[job?.zone, job?.district].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2 py-0.5 rounded-full">
                            ✓ Ready
                          </span>
                          {feed.target_time_slot && (
                            <p className="text-xs text-gray-500 mt-1">Slot: {feed.target_time_slot}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-3 space-y-2">
                      {feed.contractor_notes && (
                        <p className="text-xs text-gray-600 italic">"{feed.contractor_notes}"</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Submitted: {formatDateTime(feed.submitted_at)}</span>
                        {feed.accountability_flag && (
                          <span className="text-red-500 font-semibold">⚠ Flagged</span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <form action={rejectAction} className="flex-1">
                          <button type="submit" className="w-full border border-gray-300 text-gray-600 text-xs font-semibold py-2 rounded-xl">
                            Reject from Route
                          </button>
                        </form>
                        <form action={addToRouteAction} className="flex-1">
                          <input type="hidden" name="ltf_feed_id" value={feed.id} />
                          <input type="hidden" name="site_id" value={feed.site_id ?? ''} />
                          <input type="hidden" name="scheduled_date" value={tomorrow} />
                          <input type="hidden" name="slot_start" value="09:00" />
                          <input type="hidden" name="slot_end" value="11:00" />
                          <button type="submit" className="w-full bg-green-600 text-white text-xs font-bold py-2 rounded-xl">
                            Add to Route ✓
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* NOT READY FEEDS */}
        {notReadyFeeds.length > 0 && (
          <section>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">
              🔴 Not Ready — {notReadyFeeds.length} Sites
            </p>
            <div className="space-y-3">
              {notReadyFeeds.map(feed => {
                const job = jobMap[feed.booking_ref]
                return (
                  <div key={feed.id} className="bg-white rounded-2xl border border-red-200 shadow-sm px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400">{feed.booking_ref}</p>
                        <p className="text-sm font-bold text-gray-800">{job?.job_title ?? feed.site_id ?? '—'}</p>
                        {feed.contractor_notes && (
                          <p className="text-xs text-gray-500 mt-0.5 italic">"{feed.contractor_notes}"</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">Submitted: {formatDateTime(feed.submitted_at)}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full">
                        Not Ready
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* MISSING FEEDS */}
        {missingFeeds.length > 0 && (
          <section>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
              ⚠ Missing LTF — {missingFeeds.length} Sites Not Submitted
            </p>
            <div className="bg-white rounded-2xl border border-orange-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {missingFeeds.map(job => (
                <div key={job.booking_ref} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{job.booking_ref}</p>
                    <p className="text-sm font-semibold text-gray-800">{job.job_title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[job.zone, job.district].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <form action={chaseSiteHeadAction}>
                    <input type="hidden" name="booking_ref" value={job.booking_ref} />
                    <input type="hidden" name="issued_to" value={job.supervisor_id ?? ''} />
                    <button type="submit" className="shrink-0 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      Chase Site Head
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* LATE LTF HANDLING */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Late LTF Handling
          </p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">Late Feed Protocol</p>
              <p className="text-xs text-gray-500 mt-0.5">For feeds received after 20:00 cutoff</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs space-y-1">
                <p className="font-bold text-yellow-700">Auto-notification sent to Supervisor:</p>
                <p className="text-yellow-600 italic">"Late LTF feed received from [Site]. Contact Coordinator if re-routing is needed."</p>
              </div>
              <div className="space-y-2 text-xs text-gray-600">
                <p>1. Route cannot be auto-rebuilt after 20:00</p>
                <p>2. System checks if location falls en-route</p>
                <p>3. Supervisor can accept or decline to add to day plan</p>
                <p>4. Coordinator can manually insert into tomorrow's route</p>
              </div>
              <button type="button" className="w-full border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                Insert to Tomorrow's Route
              </button>

              <form action={notifyCoordinatorAction} className="space-y-2 border-t border-gray-100 pt-3">
                <p className="text-xs font-bold text-gray-500">Notify Coordinator</p>
                <select name="booking_ref" required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-gray-50">
                  <option value="">Select site...</option>
                  {(activeJobs ?? []).map(job => (
                    <option key={job.booking_ref} value={job.booking_ref}>
                      {job.booking_ref} — {job.job_title}
                    </option>
                  ))}
                </select>
                <input
                  name="coordinator_id"
                  type="text"
                  placeholder="Coordinator user ID"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-gray-50"
                />
                <textarea
                  name="message"
                  rows={2}
                  required
                  defaultValue="Late LTF feed received. Contact Coordinator if re-routing is needed."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-gray-50 resize-none"
                />
                <button type="submit" className="w-full bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl">
                  Notify Coordinator
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ACCOUNTABILITY FLAGS */}
        {flaggedFeeds.length > 0 && (
          <section>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">
              ⚠ Accountability Flags
            </p>
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {flaggedFeeds.map(feed => {
                const job = jobMap[feed.booking_ref]
                return (
                  <div key={feed.id} className="px-5 py-4">
                    <p className="text-xs text-gray-400">{feed.booking_ref}</p>
                    <p className="text-sm font-bold text-gray-800">{job?.job_title ?? '—'}</p>
                    <p className="text-xs text-red-600 font-semibold mt-1">
                      ⚠ Site Head said ready — supervisor found not ready
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(feed.submitted_at)}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* YESTERDAY'S FEEDS */}
        {(yesterdayFeeds ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Yesterday's Feeds
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(yesterdayFeeds ?? []).map(feed => {
                const job = jobMap[feed.booking_ref]
                return (
                  <div key={feed.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{feed.booking_ref} · {formatDateTime(feed.submitted_at)}</p>
                      <p className="text-sm font-semibold text-gray-700">{job?.job_title ?? '—'}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${feed.is_ready_tomorrow ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
                      {feed.is_ready_tomorrow ? '✓ Was Ready' : '✗ Not Ready'}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* EMPTY STATE */}
        {(todayFeeds ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
            <p className="text-gray-500 font-semibold text-sm">No LTF feeds today</p>
            <p className="text-gray-400 text-xs mt-1">Site heads submit feeds by 20:00 each evening</p>
          </div>
        )}

      </main>
    </div>
  )
}