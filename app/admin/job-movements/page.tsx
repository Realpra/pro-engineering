/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  classifyJob, maxReturnsOnOneItem, PENDING_RETURN_THRESHOLD,
  type JobClass, type MovementRow,
} from '@/lib/jobMovementLog'
import RequestDecisionPanel from './RequestDecisionPanel'

// Job Movement Log (owner, 31 Oct 2026): every movement of every job, in time
// order, with the action taken. Reads job_movement_log
// (supabase/migrations/20261031_job_movement_log.sql).

const FILTERS: { key: 'all' | JobClass; label: string }[] = [
  { key: 'all', label: 'All jobs' },
  { key: 'new', label: 'New' },
  { key: 'pending', label: 'Pending (returned more than once)' },
  { key: 'in_execution', label: 'In execution' },
  { key: 'rejected', label: 'Requests rejected (on record)' },
]

const CLASS_BADGE: Record<JobClass, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  pending: { label: 'Pending', cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  in_execution: { label: 'In execution', cls: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Request rejected', cls: 'bg-gray-200 text-gray-700 border-gray-300' },
}

const STAGE_LABEL: Record<string, string> = {
  request: 'Job request', routing: 'Routing', survey: 'Site survey', estimate: 'Estimate',
  premium: 'Premium', client: 'Client', execution: 'Execution', milestone: 'Milestone / sub-stage',
  scope_change: 'Scope change', site_visit: 'Site visit', staff: 'Staff', payment: 'Milestone payment',
  handover: 'Handover', plan: 'Plan', deployment: 'Worker deployment', incident: 'Incident',
}

const ACTION_LABEL: Record<string, { label: string; cls: string }> = {
  created: { label: 'Created', cls: 'text-gray-700' },
  forwarded: { label: 'Forwarded', cls: 'text-blue-700' },
  approved: { label: 'Approved', cls: 'text-green-700' },
  returned: { label: 'Sent back for correction', cls: 'text-red-700' },
  rejected: { label: 'Rejected', cls: 'text-red-700' },
  decided: { label: 'Decision', cls: 'text-purple-700' },
  client_accepted: { label: 'Client accepted', cls: 'text-green-700' },
  client_rejected: { label: 'Client rejected', cls: 'text-red-700' },
  client_review: { label: 'Client asked for review', cls: 'text-amber-700' },
  raised: { label: 'Raised', cls: 'text-gray-700' },
  scheduled: { label: 'Scheduled', cls: 'text-blue-700' },
  rescheduled: { label: 'Rescheduled', cls: 'text-amber-700' },
  declined: { label: 'Declined', cls: 'text-amber-700' },
  reassigned: { label: 'Reassigned', cls: 'text-blue-700' },
  cancelled: { label: 'Cancelled', cls: 'text-red-700' },
  assigned: { label: 'Assigned', cls: 'text-blue-700' },
  removed: { label: 'Removed', cls: 'text-amber-700' },
  held: { label: 'On hold', cls: 'text-amber-700' },
  released: { label: 'Released', cls: 'text-green-700' },
  completed: { label: 'Completed', cls: 'text-green-700' },
  recast: { label: 'Recast', cls: 'text-purple-700' },
}

function roleLabel(role: string | null): string {
  if (!role) return '—'
  return role.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmt(ts: string): string {
  return new Date(ts).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default async function JobMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter: rawFilter } = await searchParams
  const filter = (FILTERS.find((f) => f.key === rawFilter)?.key ?? 'all') as 'all' | JobClass

  const supabase = await createClient()
  const sb = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  if (!['admin', 'super_admin'].includes(profile?.platform_role ?? '')) redirect('/admin/dashboard')

  const [jobsRes, logRes, usersRes] = await Promise.all([
    sb.from('guest_enquiries')
      .select('booking_ref, job_title, contact_name, zone, status, is_active, confirmed_for_execution_at, created_at, request_decision, request_decision_reason, request_decided_at')
      .order('created_at', { ascending: false }),
    sb.from('job_movement_log').select('*').order('created_at', { ascending: true }),
    sb.from('users').select('id, full_name'),
  ])

  const loadError: string | null = logRes.error?.message ?? jobsRes.error?.message ?? null
  const rows = (logRes.data ?? []) as MovementRow[]
  const nameById: Record<string, string> = Object.fromEntries(
    ((usersRes.data ?? []) as { id: string; full_name: string | null }[]).map((u) => [u.id, u.full_name ?? '']),
  )

  const rowsByJob: Record<string, MovementRow[]> = {}
  for (const r of rows) (rowsByJob[r.booking_ref] ??= []).push(r)

  const jobs = ((jobsRes.data ?? []) as any[]).map((j) => {
    const list = rowsByJob[j.booking_ref] ?? []
    const returns = maxReturnsOnOneItem(list)
    const cls = classifyJob(returns >= PENDING_RETURN_THRESHOLD, j.status, j.confirmed_for_execution_at, j.request_decision)
    return { ...j, list, returns, cls }
  }).filter((j) => j.is_active || j.cls === 'rejected')

  const counts: Record<string, number> = { all: 0, new: 0, pending: 0, in_execution: 0, rejected: 0 }
  for (const j of jobs) { counts[j.cls] += 1; if (j.cls !== 'rejected') counts.all += 1 }
  const shown = filter === 'all' ? jobs.filter((j) => j.cls !== 'rejected') : jobs.filter((j) => j.cls === filter)

  const who = (id: string | null, role: string | null) => {
    const name = id ? nameById[id] : ''
    return [name, roleLabel(role)].filter((x) => x && x !== '—').join(' · ') || '—'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-white/80 hover:text-white shrink-0" aria-label="Back to dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Job Movement Log</h1>
            <p className="text-blue-200 text-xs">Every movement of every job, oldest first</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-gray-500">
          A job sent back for correction twice on the same item (survey, estimate or sub-stage) is
          <span className="font-semibold text-orange-700"> Pending</span>; the first send-back is normal.
          Decisions (premium, scope change, confirmed for execution) and client acts are shown but never
          counted. A client rejection or request for review re-runs the process and starts the count afresh.
          Movements before this log went live (31 Oct 2026) were not recorded. For a request that is
          not moving, Admin can keep it live to pursue or reject it; a rejected request leaves the active
          list and is kept under &ldquo;Requests rejected&rdquo;.
        </p>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load the log: {loadError}. If the table is missing, run
            supabase/migrations/20261031_job_movement_log.sql.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/admin/job-movements' : `/admin/job-movements?filter=${f.key}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                filter === f.key ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {f.label} ({counts[f.key] ?? 0})
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-400">No jobs in this view.</div>
        ) : (
          <div className="space-y-3">
            {shown.map((j) => (
              <details key={j.booking_ref} className="rounded-2xl border border-gray-100 bg-white shadow-sm" open={filter === 'pending'}>
                <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#1F3864]">{j.booking_ref}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${CLASS_BADGE[j.cls as JobClass].cls}`}>
                    {CLASS_BADGE[j.cls as JobClass].label}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{j.job_title ?? '—'}</span>
                  <span className="text-xs text-gray-400">{j.contact_name ?? '—'} · {j.zone ?? '—'} · {j.status ?? '—'}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {j.list.length} movement{j.list.length === 1 ? '' : 's'}
                    {j.returns > 0 && <> · most send-backs on one item: <b className={j.returns >= PENDING_RETURN_THRESHOLD ? 'text-orange-700' : ''}>{j.returns}</b></>}
                  </span>
                </summary>
                <div className="border-t border-gray-100 px-4 py-3">
                  {j.list.length === 0 ? (
                    <p className="text-xs text-gray-400">No movements recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400">
                            <th className="py-1 pr-3 font-semibold">Date &amp; time</th>
                            <th className="py-1 pr-3 font-semibold">Stage</th>
                            <th className="py-1 pr-3 font-semibold">Action</th>
                            <th className="py-1 pr-3 font-semibold">From</th>
                            <th className="py-1 pr-3 font-semibold">To</th>
                            <th className="py-1 font-semibold">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {j.list.map((r: MovementRow) => {
                            const a = ACTION_LABEL[r.action] ?? { label: r.action, cls: 'text-gray-700' }
                            return (
                              <tr key={r.id} className="align-top">
                                <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">{fmt(r.created_at)}</td>
                                <td className="py-1.5 pr-3 whitespace-nowrap">{STAGE_LABEL[r.stage] ?? r.stage}</td>
                                <td className={`py-1.5 pr-3 whitespace-nowrap font-semibold ${a.cls}`}>
                                  {a.label}
                                  {r.counts_as_return && <span className="ml-1 text-[10px] text-red-500">(counted)</span>}
                                  {r.resets_return_count && <span className="ml-1 text-[10px] text-amber-600">(count reset)</span>}
                                </td>
                                <td className="py-1.5 pr-3 whitespace-nowrap">{who(r.from_user_id, r.from_role)}</td>
                                <td className="py-1.5 pr-3 whitespace-nowrap">{who(r.to_user_id, r.to_role)}</td>
                                <td className="py-1.5 text-gray-600">{r.remarks ?? ''}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {j.cls !== 'in_execution' && (
                    <RequestDecisionPanel
                      bookingRef={j.booking_ref}
                      current={{ decision: j.request_decision, reason: j.request_decision_reason, decidedAt: j.request_decided_at }}
                    />
                  )}
                  <Link href={`/admin/estimate/${j.booking_ref}`} className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline">
                    Open job →
                  </Link>
                </div>
              </details>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
