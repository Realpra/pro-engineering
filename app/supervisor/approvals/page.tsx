import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'

function slaCountdown(submittedAt: string | null): string {
  if (!submittedAt) return '—'
  const submitted = new Date(submittedAt)
  const submittedHour = submitted.getHours()
  let deadline: Date
  if (submittedHour < 12) {
    deadline = new Date(submitted)
    deadline.setHours(17, 0, 0, 0)
  } else {
    deadline = new Date(submitted)
    deadline.setDate(deadline.getDate() + 1)
    deadline.setHours(9, 0, 0, 0)
  }
  const now = new Date()
  const diffMs = deadline.getTime() - now.getTime()
  if (diffMs <= 0) return 'OVERDUE'
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} min left`
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours}h ${mins}m left`
}

function slaUrgent(submittedAt: string | null): boolean {
  if (!submittedAt) return false
  const submitted = new Date(submittedAt)
  const submittedHour = submitted.getHours()
  let deadline: Date
  if (submittedHour < 12) {
    deadline = new Date(submitted)
    deadline.setHours(17, 0, 0, 0)
  } else {
    deadline = new Date(submitted)
    deadline.setDate(deadline.getDate() + 1)
    deadline.setHours(9, 0, 0, 0)
  }
  const now = new Date()
  return (deadline.getTime() - now.getTime()) < 60 * 60 * 1000
}

function slaBlock(submittedAt: string | null): string {
  if (!submittedAt) return '—'
  const submitted = new Date(submittedAt)
  const hour = submitted.getHours()
  if (hour < 12) return 'Received before noon → Act same afternoon'
  return 'Received after noon → Act next morning by 09:00'
}

function paymentRule(amount: number | null): string {
  if (!amount) return '—'
  if (amount < 25000) return `Below ₹25,000 · 75% same half day · 25% next half day`
  return `Above ₹25,000 · Full amount same half day`
}

export default async function ApprovalsPage() {
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

  const { data: activeJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('booking_ref, job_title, job_type, zone, district')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
    : { data: [] }

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  // Substages submitted by site-incharge awaiting supervisor approval
  const { data: substages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          trade_type, booking_ref, status, completion_pct,
          site_checklist, site_evidence_checklist, site_evidence_submitted,
          supervisor_submitted_at, subcoordinator_reviewed_at,
          substage_approved_at, is_critical_path, planned_day,
          float_days, planned_hours, start_time_slot`)
        .in('booking_ref', bookingRefs)
        .in('status', ['in_progress', 'completed'])
        .not('supervisor_submitted_at', 'is', null)
        .order('supervisor_submitted_at', { ascending: true })
    : { data: [] }

  const jobMap = Object.fromEntries(
    (activeJobs ?? []).map(j => [j.booking_ref, j])
  )

  const overdue = (substages ?? []).filter(s =>
    slaCountdown(s.supervisor_submitted_at) === 'OVERDUE' &&
    !s.subcoordinator_reviewed_at
  )
  const urgent = (substages ?? []).filter(s =>
    slaUrgent(s.supervisor_submitted_at) &&
    slaCountdown(s.supervisor_submitted_at) !== 'OVERDUE' &&
    !s.subcoordinator_reviewed_at
  )
  const pending = (substages ?? []).filter(s =>
    !slaUrgent(s.supervisor_submitted_at) &&
    slaCountdown(s.supervisor_submitted_at) !== 'OVERDUE' &&
    !s.subcoordinator_reviewed_at
  )
  const approved = (substages ?? []).filter(s => s.subcoordinator_reviewed_at)

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Approvals</p>
            <p className="text-white font-bold text-sm leading-tight">Pending · {displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-red-400 font-bold text-xl">{overdue.length}</p>
              <p className="text-blue-300 text-xs">Overdue</p>
            </div>
            <div>
              <p className="text-orange-400 font-bold text-xl">{urgent.length}</p>
              <p className="text-blue-300 text-xs">Urgent</p>
            </div>
            <div>
              <p className="text-white font-bold text-xl">{pending.length}</p>
              <p className="text-blue-300 text-xs">Pending</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-xl">{approved.length}</p>
              <p className="text-blue-300 text-xs">Approved</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30">
            <p className="text-blue-200 text-xs text-center">
              Payment Chain: Site Head ✓ → <span className="text-white font-bold">[Supervisor ←YOU]</span> → Sub-Coord → Finance
            </p>
          </div>
        </div>

        {/* SLA RULES */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">SLA Rules</p>
          <div className="space-y-1 text-xs text-blue-600">
            <p>• Received before noon → Act same afternoon</p>
            <p>• Received after noon → Act next morning by 09:00</p>
            <p>• Three blocks: same afternoon / next morning / next afternoon</p>
            <p>• Below ₹25,000 → 75% same half day · 25% next half day</p>
          </div>
        </div>

        {/* OVERDUE */}
        {overdue.length > 0 && (
          <section>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">
              🔴 Overdue — SLA Breached
            </p>
            <div className="space-y-3">
              {overdue.map(s => {
                const job = jobMap[s.booking_ref]
                const checklist = (s.site_checklist as any[]) ?? []
                const evidence = (s.site_evidence_checklist as any[]) ?? []
                const evidenceSubmitted = (s.site_evidence_submitted as any[]) ?? []
                const checked = checklist.filter((c: any) => c.checked).length
                const evidenceDone = evidenceSubmitted.filter(Boolean).length
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-red-300 shadow-sm overflow-hidden">
                    <div className="bg-red-600 px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-red-200 text-xs">{s.substage_code} · {s.booking_ref} · {s.milestone_code}</p>
                          <p className="text-white font-bold text-sm mt-0.5">{s.substage_name}</p>
                          {s.is_critical_path && <p className="text-red-200 text-xs mt-0.5">🔴 Critical Path</p>}
                        </div>
                        <span className="shrink-0 bg-red-800 text-red-200 text-xs font-bold px-2 py-1 rounded-full">OVERDUE</span>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-gray-400">Trade</p><p className="font-semibold">{s.trade_type}</p></div>
                        <div><p className="text-gray-400">Status</p><p className="font-semibold capitalize">{s.status?.replace('_', ' ')}</p></div>
                        <div><p className="text-gray-400">Progress</p><p className="font-semibold">{s.completion_pct ?? 0}%</p></div>
                        <div><p className="text-gray-400">Float</p><p className={`font-semibold ${Number(s.float_days) === 0 ? 'text-red-600' : ''}`}>{s.float_days ?? 0} days</p></div>
                        <div><p className="text-gray-400">Checklist</p><p className="font-semibold">{checked}/{checklist.length} checked</p></div>
                        <div><p className="text-gray-400">Evidence</p><p className="font-semibold">{evidenceDone}/{evidence.length} uploaded</p></div>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-4 py-2 text-xs">
                        <p className="text-gray-500">{slaBlock(s.supervisor_submitted_at)}</p>
                        <p className="text-gray-500 mt-0.5">{paymentRule(null)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-4 py-2">
                        <p className="text-xs text-gray-500">
                          Submitted: {s.supervisor_submitted_at
                            ? new Date(s.supervisor_submitted_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </p>
                      </div>
                      <Link
                        href={`/supervisor/approval/${s.id}`}
                        className="block w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl text-center"
                      >
                        Review, Approve or Send Back →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* URGENT */}
        {urgent.length > 0 && (
          <section>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
              ⚡ Urgent — Expiring Soon
            </p>
            <div className="space-y-3">
              {urgent.map(s => {
                const job = jobMap[s.booking_ref]
                const checklist = (s.site_checklist as any[]) ?? []
                const evidence = (s.site_evidence_checklist as any[]) ?? []
                const evidenceSubmitted = (s.site_evidence_submitted as any[]) ?? []
                const checked = checklist.filter((c: any) => c.checked).length
                const evidenceDone = evidenceSubmitted.filter(Boolean).length
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-orange-300 shadow-sm overflow-hidden">
                    <div className="bg-orange-50 px-5 py-3 border-b border-orange-200">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-400">{s.substage_code} · {s.booking_ref} · {s.milestone_code}</p>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">{s.substage_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{job?.job_title} · {s.trade_type}</p>
                        </div>
                        <span className="shrink-0 bg-orange-100 text-orange-700 border border-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                          {slaCountdown(s.supervisor_submitted_at)}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-gray-400">Progress</p><p className="font-semibold">{s.completion_pct ?? 0}%</p></div>
                        <div><p className="text-gray-400">Float</p><p className={`font-semibold ${Number(s.float_days) === 0 ? 'text-red-600' : ''}`}>{s.float_days ?? 0} days</p></div>
                        <div><p className="text-gray-400">Checklist</p><p className="font-semibold">{checked}/{checklist.length}</p></div>
                        <div><p className="text-gray-400">Evidence</p><p className="font-semibold">{evidenceDone}/{evidence.length}</p></div>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-4 py-2 text-xs space-y-1">
                        <p className="text-gray-500">{slaBlock(s.supervisor_submitted_at)}</p>
                        <p className="text-gray-500">
                          Site Head ✓ → <span className="font-bold text-[#1F3864]">[Supervisor ←YOU]</span> → Sub-Coord → Finance
                        </p>
                      </div>
                      <Link
                        href={`/supervisor/approval/${s.id}`}
                        className="block w-full bg-orange-600 text-white text-xs font-bold py-2.5 rounded-xl text-center"
                      >
                        Review, Approve or Send Back →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* PENDING */}
        {pending.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Pending Approvals
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {pending.map(s => {
                const job = jobMap[s.booking_ref]
                const checklist = (s.site_checklist as any[]) ?? []
                const evidence = (s.site_evidence_checklist as any[]) ?? []
                const evidenceSubmitted = (s.site_evidence_submitted as any[]) ?? []
                const checked = checklist.filter((c: any) => c.checked).length
                const evidenceDone = evidenceSubmitted.filter(Boolean).length
                return (
                  <div key={s.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        {s.is_critical_path && (
                          <p className="text-xs font-bold text-red-500 mb-0.5">🔴 Critical Path</p>
                        )}
                        <p className="text-xs text-gray-400">{s.substage_code} · {s.milestone_code}</p>
                        <p className="text-sm font-bold text-gray-800 leading-snug mt-0.5">{s.substage_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.booking_ref} · {job?.job_title} · {s.trade_type}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
                        {slaCountdown(s.supervisor_submitted_at)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div><p className="text-gray-400">Progress</p><p className="font-semibold">{s.completion_pct ?? 0}%</p></div>
                      <div><p className="text-gray-400">Float</p><p className={`font-semibold ${Number(s.float_days) === 0 ? 'text-red-600' : ''}`}>{s.float_days ?? 0} days</p></div>
                      <div><p className="text-gray-400">Checklist</p><p className="font-semibold">{checked}/{checklist.length} checked</p></div>
                      <div><p className="text-gray-400">Evidence</p><p className="font-semibold">{evidenceDone}/{evidence.length} uploaded</p></div>
                      <div><p className="text-gray-400">Submitted</p>
                        <p className="font-semibold">
                          {s.supervisor_submitted_at
                            ? new Date(s.supervisor_submitted_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </p>
                      </div>
                      <div><p className="text-gray-400">SLA Rule</p><p className="font-semibold text-blue-600">{slaBlock(s.supervisor_submitted_at).split('→')[0].trim()}</p></div>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                      <div className="bg-[#2E74B5] h-1.5 rounded-full" style={{ width: `${s.completion_pct ?? 0}%` }} />
                    </div>

                    <Link
                      href={`/supervisor/approval/${s.id}`}
                      className="block w-full bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl text-center"
                    >
                      Review, Approve or Send Back →
                    </Link>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* APPROVED */}
        {approved.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Already Approved — Passed to Sub-Coordinator
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {approved.map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{s.substage_code} · {s.booking_ref}</p>
                    <p className="text-sm font-semibold text-gray-700 leading-snug">{s.substage_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Approved {s.subcoordinator_reviewed_at
                        ? new Date(s.subcoordinator_reviewed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                    ✓ Passed
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EMPTY */}
        {overdue.length === 0 && urgent.length === 0 && pending.length === 0 && approved.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-10 text-center">
            <p className="text-gray-500 font-semibold text-sm">No approvals pending</p>
            <p className="text-gray-400 text-xs mt-1">All substages are up to date</p>
            <Link
              href="/supervisor/dashboard"
              className="inline-block mt-4 bg-[#1F3864] text-white text-xs font-bold px-5 py-2.5 rounded-xl"
            >
              Back to Dashboard
            </Link>
          </div>
        )}

      </main>
    </div>
  )
}