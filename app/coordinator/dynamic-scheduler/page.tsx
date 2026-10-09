// Coordinator Dynamic Scheduler — cross-job home for the Dynamic Scheduling Engine
// (lib/scheduling-engine/). Built 10 Oct 2026 per the project owner's explicit correction
// that the engine "has to be tied linked, separate is not in real life" -- until now its
// ONLY surface was a tab buried inside each individual booking's own Estimate Console
// (/admin/estimate/[bookingRef]?tab=task-ledger), reachable only if a Coordinator already
// knew which specific booking needed attention. This page is the missing cross-job view:
// every booking with any real Task Ledger activity, rolled up by how many of its slots are
// Unmatched / Awaiting Coordinator / No Supply / Matched / Delayed, so a shortage anywhere
// in the whole book of work is visible from one screen -- then links straight into that
// booking's own Task Ledger tab for the actual Find-Candidates/Book/Report-Delay/Log-Savior
// actions, which live there and are not duplicated here.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

type SlotRow = {
  booking_ref: string
  slot_status: 'Pending' | 'Completed' | 'Cancelled_Delayed'
  compliance_check_status: string | null
  operational_action_trigger: string | null
  assigned_worker_id: string | null
}

function classify(s: SlotRow): 'delayed' | 'noSupply' | 'awaiting' | 'matched' | 'unmatched' {
  if (s.slot_status === 'Cancelled_Delayed') return 'delayed'
  if (s.compliance_check_status === 'NO SUPPLY') return 'noSupply'
  if (s.operational_action_trigger === 'BUILD_UPSKILL_SUPERVISE' && !s.assigned_worker_id) return 'awaiting'
  if (s.assigned_worker_id) return 'matched'
  return 'unmatched'
}

export default async function DynamicSchedulerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  // Same allowed roles as every action in taskLedgerActions.ts's own requireAllocator() --
  // worker allocation is a Coordinator/Admin/Superadmin concern, not Sub-Coordinator's.
  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) {
    redirect('/login')
  }

  const { data: slotsData, error: slotsError } = await (supabase as AnyClient)
    .from('task_ledger')
    .select('booking_ref, slot_status, compliance_check_status, operational_action_trigger, assigned_worker_id, target_date')
    .order('target_date', { ascending: true })

  const slots = (slotsData ?? []) as (SlotRow & { target_date: string })[]

  type Bucket = { delayed: number; noSupply: number; awaiting: number; matched: number; unmatched: number; nextOpenDate: string | null }
  const byBooking = new Map<string, Bucket>()
  for (const s of slots) {
    const b = byBooking.get(s.booking_ref) ?? { delayed: 0, noSupply: 0, awaiting: 0, matched: 0, unmatched: 0, nextOpenDate: null }
    const cls = classify(s)
    b[cls] += 1
    if ((cls === 'unmatched' || cls === 'awaiting' || cls === 'noSupply') && !b.nextOpenDate) {
      b.nextOpenDate = s.target_date
    }
    byBooking.set(s.booking_ref, b)
  }

  const bookingRefs = [...byBooking.keys()]
  let jobsByRef = new Map<string, { job_title: string | null; zone: string | null; contact_name: string | null }>()
  if (bookingRefs.length > 0) {
    const { data: jobsData } = await supabase
      .from('guest_enquiries')
      .select('booking_ref, job_title, zone, contact_name')
      .in('booking_ref', bookingRefs)
    jobsByRef = new Map((jobsData ?? []).map(j => [j.booking_ref, j]))
  }

  const rows = bookingRefs
    .map(ref => ({ ref, job: jobsByRef.get(ref), bucket: byBooking.get(ref)! }))
    .sort((a, b) => {
      const aAttn = a.bucket.unmatched + a.bucket.awaiting + a.bucket.noSupply + a.bucket.delayed
      const bAttn = b.bucket.unmatched + b.bucket.awaiting + b.bucket.noSupply + b.bucket.delayed
      return bAttn - aAttn
    })

  const totals = rows.reduce(
    (acc, r) => ({
      delayed: acc.delayed + r.bucket.delayed,
      noSupply: acc.noSupply + r.bucket.noSupply,
      awaiting: acc.awaiting + r.bucket.awaiting,
      matched: acc.matched + r.bucket.matched,
      unmatched: acc.unmatched + r.bucket.unmatched,
    }),
    { delayed: 0, noSupply: 0, awaiting: 0, matched: 0, unmatched: 0 }
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] text-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/coordinator/dashboard" className="text-xs text-blue-200 hover:text-white mb-3 inline-block">
            ← Coordinator Dashboard
          </Link>
          <h1 className="text-lg font-bold">Dynamic Scheduler</h1>
          <p className="text-xs text-blue-200 mt-1">
            Every booking with real Task Ledger activity, across every zone — the real matching
            engine, not a parallel one. Open a booking to Find Candidates, confirm a proposed
            substitute, report a delay, or log a Savior.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {slotsError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{slotsError.message}</div>
        )}

        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Unmatched', count: totals.unmatched, cls: 'bg-gray-100 text-gray-700 border-gray-300' },
            { label: 'Awaiting Coord.', count: totals.awaiting, cls: 'bg-amber-100 text-amber-800 border-amber-300' },
            { label: 'No Supply', count: totals.noSupply, cls: 'bg-red-100 text-red-800 border-red-300' },
            { label: 'Delayed', count: totals.delayed, cls: 'bg-purple-100 text-purple-800 border-purple-300' },
            { label: 'Matched', count: totals.matched, cls: 'bg-green-100 text-green-800 border-green-300' },
          ].map(t => (
            <div key={t.label} className={`rounded-xl border-2 px-2 py-3 text-center ${t.cls}`}>
              <p className="text-xl font-bold">{t.count}</p>
              <p className="text-[10px] font-semibold mt-0.5">{t.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-sm text-[#1F3864]">Bookings — most attention needed first</h3>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">
              No Task Ledger activity anywhere yet. Open a booking&apos;s Estimate Console → Task
              Ledger tab and Materialize a sub-stage to begin.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map(({ ref, job, bucket }) => {
                const needsAttention = bucket.unmatched + bucket.awaiting + bucket.noSupply + bucket.delayed
                return (
                  <Link
                    key={ref}
                    href={`/admin/estimate/${ref}?tab=task-ledger`}
                    className="block px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">{ref}</p>
                        <p className="text-sm font-semibold text-gray-800">{job?.job_title ?? ref}</p>
                        <p className="text-xs text-gray-400">{[job?.zone, job?.contact_name].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                        {bucket.unmatched > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-gray-100 text-gray-700 border-gray-300">{bucket.unmatched} Unmatched</span>}
                        {bucket.awaiting > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-300">{bucket.awaiting} Awaiting</span>}
                        {bucket.noSupply > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-red-100 text-red-800 border-red-300">{bucket.noSupply} No Supply</span>}
                        {bucket.delayed > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-purple-100 text-purple-800 border-purple-300">{bucket.delayed} Delayed</span>}
                        {needsAttention === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-green-100 text-green-800 border-green-300">{bucket.matched} Matched</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
