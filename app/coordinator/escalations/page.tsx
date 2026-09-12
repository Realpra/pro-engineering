import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function CoordinatorEscalationsPage() {
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
    .select('booking_ref, job_title, job_type, zone, district, status')
    .eq('is_active', true)

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  // Substages forwarded to coordinator but not yet decided
  const { data: pendingEscalations } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          booking_ref, trade_type, status, completion_pct,
          is_critical_path, float_days,
          subcoordinator_reviewed_at, coordinator_approved_at,
          supervisor_submitted_at`)
        .in('booking_ref', bookingRefs)
        .not('subcoordinator_reviewed_at', 'is', null)
        .is('coordinator_approved_at', null)
        .order('subcoordinator_reviewed_at', { ascending: true })
    : { data: [] }

  const jobMap = Object.fromEntries((activeJobs ?? []).map(j => [j.booking_ref, j]))

  const escalationChain = [
    { role: 'Supervisor', action: 'Proposes sub-stage' },
    { role: 'Sub-Coordinator', action: 'Reviews · approves or forwards' },
    { role: 'Coordinator', action: 'Approves or modifies (within job scope)', current: true },
    { role: 'Admin', action: 'Reviews if Coordinator cannot decide' },
    { role: 'Super Admin', action: 'Final authority — cannot be overridden' },
  ]

  const escalationTypes = [
    {
      icon: '📊',
      label: 'Sub-stage Proposals',
      desc: 'Supervisor or sub-coordinator proposes a new sub-stage — coordinator approves, modifies, or forwards to Admin',
    },
    {
      icon: '💰',
      label: 'Payment Disputes',
      desc: 'Coordinator cannot decide on payment decision — escalated to Admin, then Super Admin if needed',
    },
    {
      icon: '⚠️',
      label: 'Accountability Flags',
      desc: 'Site head or supervisor not ready — auto-notified to coordinator for action',
    },
    {
      icon: '🔴',
      label: 'Critical Path Breaches',
      desc: 'Handover date is threatened — coordinator must act immediately or escalate',
    },
    {
      icon: '✗',
      label: 'Decision 5 Rejects',
      desc: 'Complete redo decision — auto-escalated to Admin · coordinator receives notification',
    },
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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Escalations</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className={`font-bold text-2xl ${(pendingEscalations ?? []).length > 0 ? 'text-orange-400' : 'text-white'}`}>
                {(pendingEscalations ?? []).length}
              </p>
              <p className="text-blue-300 text-xs">Pending at Coordinator</p>
            </div>
            <div>
              <p className="text-white font-bold text-2xl">
                {(pendingEscalations ?? []).filter(e => e.is_critical_path).length}
              </p>
              <p className="text-blue-300 text-xs">Critical Path</p>
            </div>
          </div>
        </div>

        {/* ESCALATION CHAIN */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Escalation Chain</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {escalationChain.map((step, i) => (
              <div key={step.role} className={`px-5 py-3 flex items-start gap-3 ${step.current ? 'bg-blue-50' : ''} ${i < escalationChain.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                  step.current ? 'bg-[#1F3864] text-white' : 'bg-gray-100 text-gray-500'
                }`}>{i + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${step.current ? 'text-[#1F3864]' : 'text-gray-700'}`}>{step.role}</p>
                    {step.current && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">← YOU</span>}
                  </div>
                  <p className="text-xs text-gray-400 leading-snug mt-0.5">{step.action}</p>
                </div>
                {i < escalationChain.length - 1 && (
                  <svg className="w-4 h-4 text-gray-300 shrink-0 mt-1.5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">Coordinator can approve or modify within job scope. If cannot decide → forwards to Admin. Super Admin = final authority, cannot be overridden.</p>
          </div>
        </section>

        {/* ESCALATION TYPES */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Escalation Types</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {escalationTypes.map(et => (
              <div key={et.label} className="px-5 py-3 flex items-start gap-3">
                <span className="text-xl shrink-0">{et.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-800">{et.label}</p>
                  <p className="text-xs text-gray-400 leading-snug mt-0.5">{et.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PENDING ESCALATIONS */}
        {(pendingEscalations ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
              Pending — Awaiting Coordinator Decision
            </p>
            <div className="space-y-3">
              {(pendingEscalations ?? []).map(e => {
                const job = jobMap[e.booking_ref]
                return (
                  <div key={e.id} className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
                    <div className="bg-orange-50 px-5 py-3 border-b border-orange-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-400">{e.substage_code} · {e.booking_ref} · {e.milestone_code}</p>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">{e.substage_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{job?.job_title} · {e.trade_type}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {e.is_critical_path && (
                            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full block mb-1">
                              🔴 Critical
                            </span>
                          )}
                          <span className="text-xs text-gray-400">Float: {e.float_days ?? 0}d</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-gray-400">Progress</p><p className="font-semibold">{e.completion_pct ?? 0}%</p></div>
                        <div><p className="text-gray-400">Status</p><p className="font-semibold capitalize">{e.status?.replace(/_/g, ' ')}</p></div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${e.completion_pct ?? 0}%` }} />
                      </div>
                      <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-500">
                        Forwarded by Sub-Coordinator ·{' '}
                        {e.subcoordinator_reviewed_at
                          ? new Date(e.subcoordinator_reviewed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                          Forward to Admin
                        </button>
                        <button className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl">
                          Decide →
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* EMPTY */}
        {(pendingEscalations ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-gray-500 font-semibold text-sm">No escalations pending</p>
            <p className="text-gray-400 text-xs mt-1">All items have been decided or are with Admin</p>
          </div>
        )}

      </main>
    </div>
  )
}