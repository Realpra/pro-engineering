'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { overrideDecline, confirmPending } from './actions'

export type DeclinedSlot = {
  id: string
  scheduled_date: string
  slot_start: string | null
  slot_end: string | null
  slot_type: string | null
  site_id: string | null
  decline_reason: string | null
  declined_at: string | null
  supervisor_id: string | null
}

function fmtDate(v: string): string {
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Project owner's rule (29 Sep 2026, corrected 30 Sep 2026): a supervisor's
// decline needs a real yes/no from a higher role. "Override" keeps the slot
// assigned as originally planned; "Confirm — Send to Pending" explicitly
// records agreement that it opens up for any supervisor to self-pick-up
// (app/supervisor/route/plan's own "Pending Visits — Pick Up" section reads
// the same rows either way -- confirming doesn't change WHEN a slot becomes
// pickup-eligible, only that a real decision got recorded instead of silence).
export default function DeclinedVisitsPanel({
  slots,
  bookingRefBySiteId,
  supervisorNameById,
  overriddenByUserId,
}: {
  slots: DeclinedSlot[]
  bookingRefBySiteId: Record<string, string>
  supervisorNameById: Record<string, string>
  overriddenByUserId: string
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleOverride(slotId: string) {
    setBusyId(slotId)
    setError(null)
    const res = await overrideDecline(slotId, overriddenByUserId)
    setBusyId(null)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  async function handleConfirmPending(slotId: string) {
    setBusyId(slotId)
    setError(null)
    const res = await confirmPending(slotId, overriddenByUserId)
    setBusyId(null)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  if (slots.length === 0) return null

  return (
    <section>
      <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">
        Declined Visits Needing a Decision ({slots.length})
      </p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">{error}</div>}
      <div className="space-y-3">
        {slots.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3">
              <p className="text-sm font-bold text-gray-800">{(s.site_id && bookingRefBySiteId[s.site_id]) ?? 'Site TBC'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {fmtDate(s.scheduled_date)} · {s.slot_start ?? '—'}–{s.slot_end ?? '—'} · {(s.slot_type ?? 'inspection').replace('_', ' ')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Declined by {(s.supervisor_id && supervisorNameById[s.supervisor_id]) ?? 'Supervisor'}
              </p>
              {s.decline_reason && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-2 italic">"{s.decline_reason}"</p>
              )}
            </div>
            <div className="px-5 pb-4 flex gap-2">
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => handleOverride(s.id)}
                className="flex-1 bg-[#1F3864] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {busyId === s.id ? 'Working…' : 'Yes — Override, Keep Assigned'}
              </button>
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => handleConfirmPending(s.id)}
                className="flex-1 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {busyId === s.id ? 'Working…' : 'No — Send to Pending'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
