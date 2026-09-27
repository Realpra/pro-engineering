import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import { sendBackSubstage, approveSubstageToCoordinator } from '../actions'

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

function paymentRule(amount: number | null): string {
  if (!amount) return 'Standard SLA applies'
  if (amount < 25000) return `Below ₹25,000 · 75% same half day · 25% next half day`
  return `Above ₹25,000 · Full amount same half day`
}

function slaBlock(submittedAt: string | null): string {
  if (!submittedAt) return '—'
  const hour = new Date(submittedAt).getHours()
  if (hour < 12) return 'Received before noon → Act same afternoon'
  return 'Received after noon → Act next morning 09:00'
}

export default async function SubCoordinatorApprovalsPage() {
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

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district')
    .eq('is_active', true)

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  // Substages submitted by supervisor — awaiting sub-coordinator review
  const { data: pendingSubstages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          trade_type, booking_ref, status, completion_pct,
          site_checklist, site_evidence_checklist, site_evidence_submitted,
          supervisor_submitted_at, subcoordinator_reviewed_at,
          substage_approved_at, is_critical_path, float_days,
          planned_day, planned_hours`)
        .in('booking_ref', bookingRefs)
        .not('supervisor_submitted_at', 'is', null)
        .is('subcoordinator_reviewed_at', null)
        .order('supervisor_submitted_at', { ascending: true })
    : { data: [] }

  // Already reviewed
  const { data: reviewedSubstages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          trade_type, booking_ref, status,
          supervisor_submitted_at, subcoordinator_reviewed_at,
          substage_approved_at, is_critical_path`)
        .in('booking_ref', bookingRefs)
        .not('subcoordinator_reviewed_at', 'is', null)
        .order('subcoordinator_reviewed_at', { ascending: false })
        .limit(10)
    : { data: [] }

  const jobMap = Object.fromEntries(
    (activeJobs ?? []).map(j => [j.booking_ref, j])
  )

  const overdue = (pendingSubstages ?? []).filter(s =>
    slaCountdown(s.supervisor_submitted_at) === 'OVERDUE'
  )
  const urgent = (pendingSubstages ?? []).filter(s =>
    slaUrgent(s.supervisor_submitted_at) &&
    slaCountdown(s.supervisor_submitted_at) !== 'OVERDUE'
  )
  const pending = (pendingSubstages ?? []).filter(s =>
    !slaUrgent(s.supervisor_submitted_at) &&
    slaCountdown(s.supervisor_submitted_at) !== 'OVERDUE'
  )

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Approvals</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className={`font-bold text-xl ${overdue.length > 0 ? 'text-red-400' : 'text-white'}`}>{overdue.length}</p>
              <p className="text-blue-300 text-xs">Overdue</p>
            </div>
            <div>
              <p className={`font-bold text-xl ${urgent.length > 0 ? 'text-orange-400' : 'text-white'}`}>{urgent.length}</p>
              <p className="text-blue-300 text-xs">Urgent</p>
            </div>
            <div>
              <p className="text-white font-bold text-xl">{pending.length}</p>
              <p className="text-blue-300 text-xs">Pending</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-xl">{(reviewedSubstages ?? []).length}</p>
              <p className="text-blue-300 text-xs">Reviewed</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30 text-center">
            <p className="text-blue-200 text-xs">
              Payment Chain: Site Head ✓ → Supervisor ✓ → <span className="text-white font-bold">[Sub-Coord ←YOU]</span> → Finance
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
                async function sendBackAction(formData: FormData) {
                  'use server'
                  await sendBackSubstage(s.id, (formData.get('remarks') as string) || '')
                }
                async function approveAction() {
                  'use server'
                  await approveSubstageToCoordinator(s.id)
                }
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
                      <p className="text-xs text-gray-500">{job?.job_title} · {[job?.zone, job?.district].filter(Boolean).join(', ')}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-gray-400">Trade</p><p className="font-semibold">{s.trade_type}</p></div>
                        <div><p className="text-gray-400">Progress</p><p className="font-semibold">{s.completion_pct ?? 0}%</p></div>
                        <div><p className="text-gray-400">Checklist</p><p className="font-semibold">{checked}/{checklist.length}</p></div>
                        <div><p className="text-gray-400">Evidence</p><p className="font-semibold">{evidenceDone}/{evidence.length}</p></div>
                        <div><p className="text-gray-400">Float</p><p className={`font-semibold ${Number(s.float_days) === 0 ? 'text-red-600' : ''}`}>{s.float_days ?? 0}d</p></div>
                        <div><p className="text-gray-400">SLA Rule</p><p className="font-semibold text-xs">{slaBlock(s.supervisor_submitted_at).split('→')[0].trim()}</p></div>
                      </div>
                      <div className="flex gap-2">
                        <form action={sendBackAction} className="flex-1 flex flex-col gap-2">
                          <input type="hidden" name="substage_id" value={s.id} />
                          <textarea name="remarks" rows={2} placeholder="Remarks (optional)" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 resize-none" />
                          <button type="submit" className="w-full border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                            Send Back to Supervisor
                          </button>
                        </form>
                        <form action={approveAction} className="flex-1">
                          <input type="hidden" name="substage_id" value={s.id} />
                          <button type="submit" className="w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl">
                            Approve → Finance
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
                async function sendBackAction(formData: FormData) {
                  'use server'
                  await sendBackSubstage(s.id, (formData.get('remarks') as string) || '')
                }
                async function approveAction() {
                  'use server'
                  await approveSubstageToCoordinator(s.id)
                }
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-orange-300 shadow-sm overflow-hidden">
                    <div className="bg-orange-50 px-5 py-3 border-b border-orange-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-400">{s.substage_code} · {s.booking_ref} · {s.milestone_code}</p>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">{s.substage_name}</p>
                          <p className="text-xs text-gray-500">{job?.job_title} · {s.trade_type}</p>
                        </div>
                        <span className="shrink-0 bg-orange-100 text-orange-700 border border-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                          {slaCountdown(s.supervisor_submitted_at)}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-gray-400">Progress</p><p className="font-semibold">{s.completion_pct ?? 0}%</p></div>
                        <div><p className="text-gray-400">Float</p><p className={`font-semibold ${Number(s.float_days) === 0 ? 'text-red-600' : ''}`}>{s.float_days ?? 0}d</p></div>
                        <div><p className="text-gray-400">Checklist</p><p className="font-semibold">{checked}/{checklist.length}</p></div>
                        <div><p className="text-gray-400">Evidence</p><p className="font-semibold">{evidenceDone}/{evidence.length}</p></div>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-4 py-2 text-xs">
                        <p className="text-gray-500">
                          Site Head ✓ → Supervisor ✓ → <span className="font-bold text-[#1F3864]">[Sub-Coord ←YOU]</span> → Finance
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <form action={sendBackAction} className="flex-1 flex flex-col gap-2">
                          <input type="hidden" name="substage_id" value={s.id} />
                          <textarea name="remarks" rows={2} placeholder="Remarks (optional)" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 resize-none" />
                          <button type="submit" className="w-full border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                            Send Back
                          </button>
                        </form>
                        <form action={approveAction} className="flex-1">
                          <input type="hidden" name="substage_id" value={s.id} />
                          <button type="submit" className="w-full bg-orange-600 text-white text-xs font-bold py-2.5 rounded-xl">
                            Approve → Finance
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
                async function sendBackAction(formData: FormData) {
                  'use server'
                  await sendBackSubstage(s.id, (formData.get('remarks') as string) || '')
                }
                async function approveAction() {
                  'use server'
                  await approveSubstageToCoordinator(s.id)
                }
                return (
                  <div key={s.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        {s.is_critical_path && <p className="text-xs font-bold text-red-500 mb-0.5">🔴 Critical Path</p>}
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
                      <div><p className="text-gray-400">Float</p><p className={`font-semibold ${Number(s.float_days) === 0 ? 'text-red-600' : ''}`}>{s.float_days ?? 0}d</p></div>
                      <div><p className="text-gray-400">Checklist</p><p className="font-semibold">{checked}/{checklist.length}</p></div>
                      <div><p className="text-gray-400">Evidence</p><p className="font-semibold">{evidenceDone}/{evidence.length}</p></div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                      <div className="bg-[#2E74B5] h-1.5 rounded-full" style={{ width: `${s.completion_pct ?? 0}%` }} />
                    </div>
                    <div className="bg-gray-50 rounded-xl px-4 py-2 mb-3 text-xs text-gray-500">
                      {slaBlock(s.supervisor_submitted_at)}
                    </div>
                    <div className="flex gap-2">
                      <form action={sendBackAction} className="flex-1 flex flex-col gap-2">
                        <input type="hidden" name="substage_id" value={s.id} />
                        <textarea name="remarks" rows={2} placeholder="Remarks (optional)" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 resize-none" />
                        <button type="submit" className="w-full border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                          Send Back
                        </button>
                      </form>
                      <form action={approveAction} className="flex-1">
                        <input type="hidden" name="substage_id" value={s.id} />
                        <button type="submit" className="w-full bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl">
                          Approve → Finance
                        </button>
                      </form>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* REVIEWED */}
        {(reviewedSubstages ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Recently Reviewed
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(reviewedSubstages ?? []).map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{s.substage_code} · {s.booking_ref}</p>
                    <p className="text-sm font-semibold text-gray-700">{s.substage_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Reviewed: {s.subcoordinator_reviewed_at
                        ? new Date(s.subcoordinator_reviewed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    s.substage_approved_at
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-blue-100 text-blue-700 border-blue-300'
                  }`}>
                    {s.substage_approved_at ? '✓ Coord Approved' : '→ Finance'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EMPTY */}
        {overdue.length === 0 && urgent.length === 0 && pending.length === 0 && (reviewedSubstages ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-10 text-center">
            <p className="text-gray-500 font-semibold text-sm">No approvals pending</p>
            <p className="text-gray-400 text-xs mt-1">All substages are up to date</p>
            <Link href="/sub-coordinator/dashboard" className="inline-block mt-4 bg-[#1F3864] text-white text-xs font-bold px-5 py-2.5 rounded-xl">
              Back to Dashboard
            </Link>
          </div>
        )}

      </main>
    </div>
  )
}