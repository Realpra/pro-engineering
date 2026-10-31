import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAwaitingAdmin } from '@/lib/workerApprovalStatus'
import Link from 'next/link'
import CoordinatorReviewActions from './CoordinatorReviewActions'

export default async function CoordinatorWorkersPage() {
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

  const { data: allWorkers } = await supabase
    .from('workers')
    .select(`id, full_name, trade, district, is_available, is_active,
      skill_level, daily_wage_inr, phone, average_rating,
      total_deployments, approval_status, created_at, coordinator_deployable_at,
      credential_type, credential_other_detail, credential_valid_upto`)
    .order('approval_status', { ascending: true })
    .order('trade', { ascending: true })

  // 'subcoordinator_approved' and bare 'approved' were never written against
  // workers.approval_status (Worker Onboarding freeze, Session 65) -- confirmed dead filters,
  // both queues were always empty. 'sub_coordinator_reviewed' is the real value.
  const pendingCoordinator = (allWorkers ?? []).filter(w => w.approval_status === 'sub_coordinator_reviewed')
  const activeWorkers = (allWorkers ?? []).filter(w => isAwaitingAdmin(w.approval_status))
  const approaching120 = (allWorkers ?? []).filter(w => (w.total_deployments ?? 0) >= 100 && w.is_active)
  const bocwPending = (allWorkers ?? []).filter(w => w.is_active && w.approval_status !== 'approved')

  // E5 (WorkersTable_Review workbook, 1 Oct 2026): credential type + valid-upto date,
  // captured on the onboarding form, flows upward unchanged to every review role.
  const credentialLabel = (w: { credential_type: string | null; credential_other_detail: string | null; credential_valid_upto: string | null }) => {
    if (!w.credential_type || w.credential_type === 'not_applicable') return null
    const kind = w.credential_type === 'other' ? (w.credential_other_detail || 'Other') : w.credential_type === 'permit_license' ? 'Permit/License' : 'Registration'
    return w.credential_valid_upto ? `${kind} — valid upto ${w.credential_valid_upto}` : kind
  }

  const skillBadge = (level: string) => {
    if (level === 'highly_skilled') return 'bg-green-100 text-green-700 border-green-300'
    if (level === 'skilled') return 'bg-blue-100 text-blue-700 border-blue-300'
    if (level === 'semi_skilled') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-gray-100 text-gray-500 border-gray-200'
  }

  const competencyLevels = [
    { code: 'L0', label: 'L0 — No knowledge', desc: 'Cannot demonstrate the skill', color: 'bg-red-100 text-red-700' },
    { code: 'L1', label: 'L1 — Basic awareness', desc: 'Knows concept but cannot execute alone', color: 'bg-orange-100 text-orange-700' },
    { code: 'L2', label: 'L2 — Skilled', desc: 'Can execute with supervision', color: 'bg-blue-100 text-blue-700' },
    { code: 'L3', label: 'L3 — Master', desc: 'Executes independently, can train others', color: 'bg-green-100 text-green-700' },
  ]

  const modules = [
    { code: 'M1', label: 'Tile Works & Grouting' },
    { code: 'M2', label: 'Plastering & Patch Repair' },
    { code: 'M3', label: 'Brickwork & Masonry' },
    { code: 'M4', label: 'Flooring & Levelling' },
    { code: 'M5', label: 'Kitchen & Countertop' },
    { code: 'M6', label: 'Emergency Leakage & Damage' },
  ]

  const specialistTracks = [
    { code: 'A', label: 'Marble Stone', gate: 'Heavy single-disc grinding machine photo' },
    { code: 'B', label: 'Structural Brickwork', gate: 'Demolition breaker photo' },
    { code: 'C', label: 'Heavy Waterproofing', gate: 'Chemical injection pump photo' },
    { code: 'D', label: 'Premium Tiling', gate: 'Bridge saw or suction lifter photo' },
  ]

  const trades = [...new Set((allWorkers ?? []).map(w => w.trade))].sort()

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Workers</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-white font-bold text-2xl">{(allWorkers ?? []).length}</p>
              <p className="text-blue-300 text-xs">Total</p>
            </div>
            <div>
              <p className={`font-bold text-2xl ${pendingCoordinator.length > 0 ? 'text-orange-400' : 'text-white'}`}>{pendingCoordinator.length}</p>
              <p className="text-blue-300 text-xs">Pending</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{activeWorkers.length}</p>
              <p className="text-blue-300 text-xs">With Admin</p>
            </div>
            <div>
              <p className={`font-bold text-2xl ${approaching120.length > 0 ? 'text-red-400' : 'text-white'}`}>{approaching120.length}</p>
              <p className="text-blue-300 text-xs">120-Day</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30 text-center">
            <p className="text-blue-200 text-xs">
              Onboarding: Sub-Coord reviews → <span className="text-white font-bold">[Coordinator ←YOU]</span> → Admin approves
            </p>
          </div>
        </div>

        {/* 120-DAY ALERTS */}
        {approaching120.length > 0 && (
          <section>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">🔴 120-Day Threshold Alerts</p>
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm divide-y divide-red-100 overflow-hidden">
              {approaching120.map(w => (
                <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{w.full_name}</p>
                    <p className="text-xs text-gray-400">{w.trade} · {w.total_deployments ?? 0} days deployed</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-red-600">{120 - (w.total_deployments ?? 0)} days remaining</p>
                    <p className="text-xs text-gray-400">FTE threshold</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs text-red-600">At 120 days continuous deployment — FTE obligations apply. Action required: extend contract or rotate worker.</p>
            </div>
          </section>
        )}

        {/* PENDING COORDINATOR APPROVAL */}
        {pendingCoordinator.length > 0 && (
          <section>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">⚡ Awaiting Coordinator Approval</p>
            <div className="space-y-3">
              {pendingCoordinator.map(w => (
                <div key={w.id} className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
                  <div className="bg-orange-50 px-5 py-3 border-b border-orange-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{w.full_name}</p>
                        <p className="text-xs text-gray-500">{w.trade} · {w.district}</p>
                        {w.phone && <p className="text-xs text-gray-400 mt-0.5">📞 {w.phone}</p>}
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${skillBadge(w.skill_level)}`}>
                        {w.skill_level?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {w.daily_wage_inr && (
                        <div><p className="text-gray-400">Daily Rate</p><p className="font-semibold">₹{w.daily_wage_inr}/day</p></div>
                      )}
                      <div><p className="text-gray-400">Deployments</p><p className="font-semibold">{w.total_deployments ?? 0} jobs</p></div>
                      {w.average_rating && (
                        <div><p className="text-gray-400">Rating</p><p className="font-semibold">⭐ {Number(w.average_rating).toFixed(1)}</p></div>
                      )}
                    </div>
                    {credentialLabel(w) && (
                      <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2 py-1.5">
                        🪪 {credentialLabel(w)}
                      </p>
                    )}

                    {/* COMPETENCY ASSESSMENT PANEL */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-3">
                      <p className="text-xs font-bold text-gray-600">Competency Assessment (15–20 min)</p>
                      <p className="text-xs text-gray-400">Coordinator asks, observes, rates. Worker does NOT self-rate.</p>
                      <div className="space-y-2">
                        {modules.map(m => (
                          <div key={m.code} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-[#2E74B5] w-6 shrink-0">{m.code}</span>
                            <span className="text-xs text-gray-600 flex-1">{m.label}</span>
                            <div className="flex gap-1 shrink-0">
                              {['L0','L1','L2','L3'].map(l => (
                                <button key={l} className="w-8 h-7 rounded-lg border border-gray-200 bg-white text-xs text-gray-500 font-bold hover:bg-[#1F3864] hover:text-white hover:border-[#1F3864] transition-colors">
                                  {l}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs font-bold text-gray-600 pt-1">Specialist Tracks</p>
                      <div className="space-y-1.5">
                        {specialistTracks.map(t => (
                          <div key={t.code} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-green-600 w-4 shrink-0">{t.code}</span>
                            <span className="text-xs text-gray-500 flex-1">{t.label}</span>
                            <span className="text-xs text-gray-300">Camera gate: 3 jobs</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <CoordinatorReviewActions workerId={w.id} currentUserId={user.id} deployableAdhocAt={w.coordinator_deployable_at} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ACTIVE WORKERS */}
        {activeWorkers.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sent to Admin — Waiting for Final Approval — {activeWorkers.length}</p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {activeWorkers.map(w => (
                <div key={w.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800">{w.full_name}</p>
                    <p className="text-xs text-gray-400">{w.trade} · {w.district}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {w.total_deployments ?? 0} deployments
                      {(w.total_deployments ?? 0) >= 100 && <span className="text-red-500 font-bold"> · ⚠️ {w.total_deployments}d</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${skillBadge(w.skill_level)}`}>
                      {w.skill_level?.replace('_', ' ')}
                    </span>
                    <p className={`text-xs font-semibold ${w.is_available ? 'text-green-600' : 'text-red-500'}`}>
                      {w.is_available ? 'Available' : 'Deployed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* COMPETENCY LEVEL REFERENCE */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Competency Level Reference</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {competencyLevels.map(l => (
              <div key={l.code} className="px-5 py-3 flex items-start gap-3">
                <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${l.color}`}>{l.code}</span>
                <div>
                  <p className="text-sm font-bold text-gray-800">{l.label}</p>
                  <p className="text-xs text-gray-400">{l.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-600">MCQ validation triggered after first job in each module scope. If MCQ contradicts coordinator rating → flag for review, not automatic downgrade.</p>
          </div>
        </section>

        {/* TRADE BREAKDOWN */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Trade Breakdown</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {trades.map(trade => {
              const tradeWorkers = (allWorkers ?? []).filter(w => w.trade === trade && w.is_active)
              const available = tradeWorkers.filter(w => w.is_available).length
              const pct = tradeWorkers.length > 0 ? Math.round((available / tradeWorkers.length) * 100) : 0
              return (
                <div key={trade} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-gray-700">{trade}</p>
                    <p className="text-xs text-gray-400">{available}/{tradeWorkers.length} available</p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* EMPTY */}
        {(allWorkers ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-gray-400 text-sm">No workers in registry</p>
          </div>
        )}

      </main>
    </div>
  )
}