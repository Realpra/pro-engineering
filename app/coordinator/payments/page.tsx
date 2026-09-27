import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function slaCountdown(reviewedAt: string | null): string {
  if (!reviewedAt) return '—'
  const reviewed = new Date(reviewedAt)
  const hour = reviewed.getHours()
  const deadline = new Date(reviewed)
  if (hour < 12) deadline.setHours(17, 0, 0, 0)
  else { deadline.setDate(deadline.getDate() + 1); deadline.setHours(9, 0, 0, 0) }
  const diff = deadline.getTime() - new Date().getTime()
  if (diff <= 0) return 'OVERDUE'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m left`
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`
}

function isOverdue(reviewedAt: string | null): boolean {
  if (!reviewedAt) return false
  const reviewed = new Date(reviewedAt)
  const hour = reviewed.getHours()
  const deadline = new Date(reviewed)
  if (hour < 12) deadline.setHours(17, 0, 0, 0)
  else { deadline.setDate(deadline.getDate() + 1); deadline.setHours(9, 0, 0, 0) }
  return new Date() > deadline
}

export default async function CoordinatorPaymentsPage() {
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

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district, estimate_total')
    .eq('is_active', true)

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  const { data: pendingSubstages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          booking_ref, trade_type, status, completion_pct,
          site_checklist, site_evidence_checklist, site_evidence_submitted,
          supervisor_submitted_at, subcoordinator_reviewed_at,
          substage_approved_at, is_critical_path, float_days,
          planned_day, planned_hours`)
        .in('booking_ref', bookingRefs)
        .not('subcoordinator_reviewed_at', 'is', null)
        .is('substage_approved_at', null)
        .order('subcoordinator_reviewed_at', { ascending: true })
    : { data: [] }

  const { data: approvedSubstages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          booking_ref, trade_type, substage_approved_at, status`)
        .in('booking_ref', bookingRefs)
        .not('substage_approved_at', 'is', null)
        .order('substage_approved_at', { ascending: false })
        .limit(10)
    : { data: [] }

  const jobMap = Object.fromEntries(
    (activeJobs ?? []).map(j => [j.booking_ref, j])
  )

  const overdue = (pendingSubstages ?? []).filter(s => isOverdue(s.subcoordinator_reviewed_at))
  const pending = (pendingSubstages ?? []).filter(s => !isOverdue(s.subcoordinator_reviewed_at))

  const decisions = [
    { num: 1, label: 'Full Release', pct: '100%', color: 'bg-green-600', desc: 'All evidence confirmed · Tests passed · No defects', condition: 'All checklist items confirmed · No outstanding items' },
    { num: 2, label: 'Partial — Rectification Pending', pct: '70–90%', color: 'bg-blue-600', desc: 'Work substantially complete but minor items need correction', condition: 'No demolition required · Balance held until rectification confirmed' },
    { num: 3, label: 'Partial — Redo Required', pct: '40–70%', color: 'bg-orange-500', desc: 'Portion defective — must redo that portion only', condition: 'Release % covers confirmed-good portion only · Coordinator specifies what must be redone' },
    { num: 4, label: 'Hold — Rework + Material Loss', pct: '0%', color: 'bg-red-600', desc: 'Demolition required · Material loss charged to contractor', condition: 'Specify affected substages · Material cost estimate · Revised timeline' },
    { num: 5, label: 'Reject — Complete Redo', pct: '0%', color: 'bg-red-900', desc: 'Fundamental defect or fraud · Previous payments reviewed', condition: 'Auto-escalated to Admin · No payment for this substage' },
  ]

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Payments</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className={`font-bold text-2xl ${overdue.length > 0 ? 'text-red-400' : 'text-white'}`}>{overdue.length}</p>
              <p className="text-blue-300 text-xs">Overdue</p>
            </div>
            <div>
              <p className={`font-bold text-2xl ${pending.length > 0 ? 'text-orange-400' : 'text-white'}`}>{pending.length}</p>
              <p className="text-blue-300 text-xs">Pending</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{(approvedSubstages ?? []).length}</p>
              <p className="text-blue-300 text-xs">Approved</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30">
            <p className="text-blue-200 text-xs text-center">
              Payment chain: Site Head ✓ → Supervisor ✓ → Sub-Coord ✓ → <span className="text-white font-bold">[Coordinator ←YOU]</span> → Finance
            </p>
          </div>
        </div>

        {/* SLA RULES */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">SLA Rules</p>
          <div className="space-y-1 text-xs text-blue-600">
            <p>• Received before noon → act same afternoon</p>
            <p>• Received after noon → act next morning by 09:00</p>
            <p>• Above ₹1L → mandatory coordinator approval gate</p>
            <p>• Below ₹25,000 → 75% same half day · 25% next half day</p>
          </div>
        </div>

        {/* OVERDUE */}
        {overdue.length > 0 && (
          <section>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">🔴 Overdue — SLA Breached</p>
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
                          {s.is_critical_path && <p className="text-red-200 text-xs mt-0.5">🔴 Critical Path · Float: {s.float_days ?? 0}d</p>}
                        </div>
                        <span className="shrink-0 bg-red-800 text-red-200 text-xs font-bold px-2 py-1 rounded-full">OVERDUE</span>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-xs text-gray-500">{job?.job_title} · {s.trade_type} · {[job?.zone, job?.district].filter(Boolean).join(', ')}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-gray-400">Progress</p><p className="font-semibold">{s.completion_pct ?? 0}%</p></div>
                        <div><p className="text-gray-400">Checklist</p><p className="font-semibold">{checked}/{checklist.length}</p></div>
                        <div><p className="text-gray-400">Evidence</p><p className="font-semibold">{evidenceDone}/{evidence.length}</p></div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${s.completion_pct ?? 0}%` }} />
                      </div>
                      <p className="text-xs font-bold text-gray-500">Commercial Gate</p>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex items-center gap-3">
                          <span className="text-gray-400 flex-1">Is completeness sufficient to release payment?</span>
                          <div className="flex gap-1.5">
                            <button className="px-2.5 py-1 rounded-lg bg-green-100 text-green-700 font-bold text-xs">Yes</button>
                            <button className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 font-bold text-xs">No</button>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex items-center gap-3">
                          <span className="text-gray-400 flex-1">Any pending items affecting next substage?</span>
                          <div className="flex gap-1.5">
                            <button className="px-2.5 py-1 rounded-lg bg-green-100 text-green-700 font-bold text-xs">Yes</button>
                            <button className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 font-bold text-xs">No</button>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-gray-500">Payment Decision</p>
                      <div className="space-y-2">
                        {decisions.map(d => (
                          <button key={d.num} className={`w-full text-left rounded-xl px-4 py-3 border-2 border-transparent hover:border-gray-300 bg-gray-50`}>
                            <div className="flex items-center gap-3">
                              <span className={`shrink-0 w-7 h-7 rounded-full ${d.color} text-white text-xs font-bold flex items-center justify-center`}>
                                {d.num}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800">{d.label} <span className="text-gray-400 font-normal">({d.pct})</span></p>
                                <p className="text-xs text-gray-400 leading-snug">{d.desc}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button className="w-full border border-blue-300 text-blue-600 text-xs font-bold py-2.5 rounded-xl">
                        Cannot Decide → Forward to Admin
                      </button>
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
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Pending — Awaiting Decision</p>
            <div className="space-y-3">
              {pending.map(s => {
                const job = jobMap[s.booking_ref]
                const checklist = (s.site_checklist as any[]) ?? []
                const evidence = (s.site_evidence_checklist as any[]) ?? []
                const evidenceSubmitted = (s.site_evidence_submitted as any[]) ?? []
                const checked = checklist.filter((c: any) => c.checked).length
                const evidenceDone = evidenceSubmitted.filter(Boolean).length
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-[#1F3864] px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-blue-300 text-xs">{s.substage_code} · {s.booking_ref} · {s.milestone_code}</p>
                          <p className="text-white font-bold text-sm mt-0.5">{s.substage_name}</p>
                          {s.is_critical_path && <p className="text-blue-300 text-xs mt-0.5">🔴 Critical Path · Float: {s.float_days ?? 0}d</p>}
                        </div>
                        <span className="shrink-0 bg-orange-100 text-orange-700 border border-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                          {slaCountdown(s.subcoordinator_reviewed_at)}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-xs text-gray-500">{job?.job_title} · {s.trade_type} · {[job?.zone, job?.district].filter(Boolean).join(', ')}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-gray-400">Progress</p><p className="font-semibold">{s.completion_pct ?? 0}%</p></div>
                        <div><p className="text-gray-400">Checklist</p><p className="font-semibold">{checked}/{checklist.length}</p></div>
                        <div><p className="text-gray-400">Evidence</p><p className="font-semibold">{evidenceDone}/{evidence.length}</p></div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-[#2E74B5] h-1.5 rounded-full" style={{ width: `${s.completion_pct ?? 0}%` }} />
                      </div>
                      <p className="text-xs font-bold text-gray-500">Commercial Gate</p>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex items-center gap-3">
                          <span className="text-gray-400 text-xs flex-1">Is completeness sufficient to release payment?</span>
                          <div className="flex gap-1.5">
                            <button className="px-2.5 py-1 rounded-lg bg-green-100 text-green-700 font-bold text-xs">Yes</button>
                            <button className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 font-bold text-xs">No</button>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex items-center gap-3">
                          <span className="text-gray-400 text-xs flex-1">Any pending items affecting next substage?</span>
                          <div className="flex gap-1.5">
                            <button className="px-2.5 py-1 rounded-lg bg-green-100 text-green-700 font-bold text-xs">Yes</button>
                            <button className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 font-bold text-xs">No</button>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-gray-500">Payment Decision</p>
                      <div className="space-y-2">
                        {decisions.map(d => (
                          <button key={d.num} className="w-full text-left rounded-xl px-4 py-3 border-2 border-transparent hover:border-gray-300 bg-gray-50">
                            <div className="flex items-center gap-3">
                              <span className={`shrink-0 w-7 h-7 rounded-full ${d.color} text-white text-xs font-bold flex items-center justify-center`}>
                                {d.num}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800">{d.label} <span className="text-gray-400 font-normal">({d.pct})</span></p>
                                <p className="text-xs text-gray-400 leading-snug">{d.desc}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button className="w-full border border-blue-300 text-blue-600 text-xs font-bold py-2.5 rounded-xl">
                        Cannot Decide → Forward to Admin
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* DECISION REFERENCE */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Decision Reference</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {decisions.map(d => (
              <div key={d.num} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 w-7 h-7 rounded-full ${d.color} text-white text-xs font-bold flex items-center justify-center mt-0.5`}>
                    {d.num}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{d.label} <span className="text-gray-400 font-normal text-xs">({d.pct})</span></p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5">{d.desc}</p>
                    <p className="text-xs text-blue-600 leading-snug mt-1">{d.condition}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RECENTLY APPROVED */}
        {(approvedSubstages ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recently Approved</p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(approvedSubstages ?? []).map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{s.substage_code} · {s.booking_ref}</p>
                    <p className="text-sm font-semibold text-gray-700">{s.substage_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.substage_approved_at
                        ? new Date(s.substage_approved_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    ✓ Approved
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EMPTY */}
        {overdue.length === 0 && pending.length === 0 && (approvedSubstages ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-gray-500 font-semibold text-sm">No payments pending</p>
            <p className="text-gray-400 text-xs mt-1">All substages are up to date</p>
          </div>
        )}

      </main>
    </div>
  )
}