'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { allocateWorker, removeAllocation, escalateAllocation } from './actions'

export type Substage = {
  id: string
  substage_code: string
  substage_name: string
  milestone_code: string
  trade_type: string | null
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  planned_day: number | null
  early_start_date: string | null
  early_finish_date: string | null
  status: string
}

export type WorkerOption = {
  id: string
  full_name: string | null
  trade: string | null
  skill_level: string | null
  zones: string[] | null
  daily_wage_inr: number | null
  is_available: boolean | null
  coordinator_deployable_at?: string | null
}

export type ExistingSlot = { worker_id: string; slot_date: string; substage_code: string; status: string }
export type Escalation = { id: string; substage_id: string; trade: string; skill_level_needed: string | null; remark: string | null; status: string; raised_at: string }

function SubstageRow({
  bookingRef,
  zone,
  substage,
  workers,
  assignedWorkerIds,
  workerNameById,
  pendingEscalation,
}: {
  bookingRef: string
  zone: string | null
  substage: Substage
  workers: WorkerOption[]
  assignedWorkerIds: string[]
  workerNameById: Record<string, string | null>
  pendingEscalation: Escalation | undefined
}) {
  const router = useRouter()
  const [workerId, setWorkerId] = useState('')
  const [slotDate, setSlotDate] = useState(substage.early_start_date ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEscalate, setShowEscalate] = useState(false)
  const [remark, setRemark] = useState('')

  const trade = substage.trade_type
  const candidates = workers.filter(w => w.trade === trade)
  const inZone = candidates.filter(w => zone && (w.zones ?? []).includes(zone))
  const otherZones = candidates.filter(w => !inZone.includes(w))
  const needed = (substage.skilled_workers_per_day ?? 0) + (substage.unskilled_workers_per_day ?? 0)

  async function assign() {
    if (!workerId || !slotDate) { setError('Pick a worker and a date.'); return }
    setBusy(true)
    setError(null)
    const res = await allocateWorker({ bookingRef, substageCode: substage.substage_code, workerId, slotDate })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setWorkerId('')
    router.refresh()
  }

  async function remove(wId: string) {
    setBusy(true)
    await removeAllocation({ bookingRef, substageCode: substage.substage_code, workerId: wId })
    setBusy(false)
    router.refresh()
  }

  async function escalate() {
    if (!remark.trim()) { setError('Add a remark explaining the shortfall.'); return }
    setBusy(true)
    setError(null)
    const res = await escalateAllocation({
      bookingRef,
      substageId: substage.id,
      trade: trade ?? 'Unknown',
      skillLevelNeeded: null,
      remark: remark.trim(),
    })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setShowEscalate(false)
    setRemark('')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400">{substage.milestone_code} · {substage.substage_code}</p>
          <p className="text-sm font-bold text-gray-800">{substage.substage_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {trade ?? 'Trade TBC'} · needs {needed || '—'} worker{needed === 1 ? '' : 's'}
            {substage.skilled_workers_per_day ? ` (${substage.skilled_workers_per_day} skilled` : ''}
            {substage.unskilled_workers_per_day ? `${substage.skilled_workers_per_day ? ', ' : ' ('}${substage.unskilled_workers_per_day} unskilled)` : (substage.skilled_workers_per_day ? ')' : '')}
            {substage.early_start_date && ` · ${substage.early_start_date} → ${substage.early_finish_date ?? '?'}`}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-300 capitalize">
          {substage.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {assignedWorkerIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assignedWorkerIds.map(wId => (
            <span key={wId} className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full pl-2.5 pr-1 py-1">
              {workerNameById[wId] ?? 'Worker'}
              <button type="button" onClick={() => remove(wId)} disabled={busy} className="text-green-700/60 hover:text-green-900 font-bold px-1">×</button>
            </span>
          ))}
        </div>
      )}

      {pendingEscalation && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs text-orange-800">
          Escalated to Admin — "{pendingEscalation.remark}"
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!pendingEscalation && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={workerId}
            onChange={e => setWorkerId(e.target.value)}
            className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50"
          >
            <option value="">Add worker…</option>
            {inZone.length > 0 && (
              <optgroup label={zone ? `In ${zone}` : 'Zone match'}>
                {inZone.map(w => (
                  <option key={w.id} value={w.id}>{w.full_name} — {w.skill_level} — ₹{w.daily_wage_inr ?? '—'}/day{w.coordinator_deployable_at ? ' · ADHOC' : ''}</option>
                ))}
              </optgroup>
            )}
            {otherZones.length > 0 && (
              <optgroup label="Other zones">
                {otherZones.map(w => (
                  <option key={w.id} value={w.id}>{w.full_name} — {w.skill_level} — ₹{w.daily_wage_inr ?? '—'}/day{w.coordinator_deployable_at ? ' · ADHOC' : ''}</option>
                ))}
              </optgroup>
            )}
          </select>
          <input
            type="date"
            value={slotDate}
            onChange={e => setSlotDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50"
          />
          <button
            type="button"
            onClick={assign}
            disabled={busy || !workerId}
            className="bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
          >
            Assign
          </button>
          {candidates.length === 0 && !showEscalate && (
            <button
              type="button"
              onClick={() => setShowEscalate(true)}
              className="text-xs font-semibold text-orange-700 border border-orange-300 px-3 py-2 rounded-xl"
            >
              Nobody available — Escalate to Admin
            </button>
          )}
        </div>
      )}

      {showEscalate && !pendingEscalation && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
          <textarea
            value={remark}
            onChange={e => setRemark(e.target.value)}
            placeholder="Why is nobody available in this zone? (e.g. all Masons on other jobs this week)"
            className="w-full border border-orange-200 rounded-lg px-3 py-2 text-xs bg-white"
            rows={2}
          />
          <div className="flex gap-2">
            <button type="button" onClick={escalate} disabled={busy} className="bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">
              Send to Admin
            </button>
            <button type="button" onClick={() => setShowEscalate(false)} className="text-xs text-gray-500 px-3 py-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AllocationPanel({
  bookingRef,
  zone,
  substages,
  workers,
  existingSlots,
  escalations,
  workerNameById,
}: {
  bookingRef: string
  zone: string | null
  substages: Substage[]
  workers: WorkerOption[]
  existingSlots: ExistingSlot[]
  escalations: Escalation[]
  workerNameById: Record<string, string | null>
}) {
  if (substages.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
        <p className="text-sm text-gray-400">No sub-stages found for this booking yet — generate/save the milestone plan first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {substages.map(s => (
        <SubstageRow
          key={s.id}
          bookingRef={bookingRef}
          zone={zone}
          substage={s}
          workers={workers}
          assignedWorkerIds={[...new Set(existingSlots.filter(slot => slot.substage_code === s.substage_code).map(slot => slot.worker_id))]}
          workerNameById={workerNameById}
          pendingEscalation={escalations.find(e => e.substage_id === s.id)}
        />
      ))}
    </div>
  )
}
