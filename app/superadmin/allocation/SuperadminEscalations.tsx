'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { superadminResolveEscalation, acceptAllocationGap } from './actions'
import { TIER_LABEL } from '@/lib/allocationPriority'

export type SuperadminEscalation = {
  id: string
  booking_ref: string
  substage_id: string
  trade: string
  remark: string | null
  escalated_to_superadmin_remark: string | null
  escalated_to_superadmin_at: string | null
}
export type WorkerOption = { id: string; full_name: string | null; trade: string | null; skill_level: string | null; zones: string[] | null; daily_wage_inr: number | null }

function Row({
  escalation,
  substageCode,
  allWorkers,
  tier,
}: {
  escalation: SuperadminEscalation
  substageCode: string
  allWorkers: WorkerOption[]
  tier: string
}) {
  const router = useRouter()
  const candidates = allWorkers.filter((w) => w.trade === escalation.trade).sort((a, b) => (a.daily_wage_inr ?? 0) - (b.daily_wage_inr ?? 0))
  const [workerId, setWorkerId] = useState('')
  const [slotDate, setSlotDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolve() {
    if (!workerId || !slotDate) { setError('Pick a worker and a date.'); return }
    setBusy(true); setError(null)
    const res = await superadminResolveEscalation(escalation.id, escalation.booking_ref, substageCode, workerId, slotDate)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  async function acceptGap() {
    setBusy(true); setError(null)
    const res = await acceptAllocationGap(escalation.id)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-800">{escalation.booking_ref} — {escalation.trade}</p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-300">{TIER_LABEL[tier] ?? tier}</span>
        </div>
        {escalation.remark && <p className="text-xs text-gray-500 mt-1 italic">Coordinator: "{escalation.remark}"</p>}
        {escalation.escalated_to_superadmin_remark && (
          <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-2 italic">Admin: "{escalation.escalated_to_superadmin_remark}"</p>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50">
          <option value="">Pick any {escalation.trade} platform-wide…</option>
          {candidates.map((w) => (
            <option key={w.id} value={w.id}>{w.full_name} — {w.skill_level} — {(w.zones ?? []).join(', ') || 'no zone'} — ₹{w.daily_wage_inr ?? '—'}/day</option>
          ))}
        </select>
        <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50" />
        <button type="button" onClick={resolve} disabled={busy || !workerId} className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">
          {busy ? 'Resolving…' : 'Resolve'}
        </button>
        <button type="button" onClick={acceptGap} disabled={busy} className="text-xs font-semibold text-gray-600 border border-gray-300 px-3 py-2 rounded-xl">
          Accept Gap — No Worker Available
        </button>
      </div>
    </div>
  )
}

export default function SuperadminEscalations({
  escalations,
  substageById,
  allWorkers,
  tiers,
}: {
  escalations: SuperadminEscalation[]
  substageById: Record<string, { substage_code: string }>
  allWorkers: WorkerOption[]
  tiers: Record<string, string>
}) {
  if (escalations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center">
        <p className="text-sm text-gray-400">No escalations waiting on Superadmin.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {escalations.map((e) => (
        <Row
          key={e.id}
          escalation={e}
          substageCode={substageById[e.substage_id]?.substage_code ?? ''}
          allWorkers={allWorkers}
          tier={tiers[e.booking_ref] ?? 'budget'}
        />
      ))}
    </div>
  )
}
