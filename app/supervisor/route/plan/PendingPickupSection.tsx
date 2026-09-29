'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { claimPendingSlot } from '../actions'

export type PendingSlot = {
  id: string
  scheduled_date: string
  slot_start: string | null
  slot_end: string | null
  slot_type: string | null
  site_id: string | null
  decline_reason: string | null
}

function fmtDate(v: string): string {
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Project owner's rule (29 Sep 2026): the "balance of all pending" -- a
// decline no higher role has overridden -- is open for ANY supervisor to
// book into one of their own empty slots, not only the one who declined it.
export default function PendingPickupSection({
  slots,
  siteIdToBookingRef,
  supervisorId,
}: {
  slots: PendingSlot[]
  siteIdToBookingRef: Record<string, string>
  supervisorId: string
}) {
  const router = useRouter()
  const [claiming, setClaiming] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('12:00')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openClaim(slot: PendingSlot) {
    setClaiming(slot.id)
    setDate(slot.scheduled_date)
    setStart(slot.slot_start ?? '10:00')
    setEnd(slot.slot_end ?? '12:00')
    setError(null)
  }

  async function handleClaim(slotId: string) {
    if (!date) { setError('Pick a date.'); return }
    setBusy(true)
    setError(null)
    const res = await claimPendingSlot({ slotId, supervisorId, scheduledDate: date, slotStart: start, slotEnd: end })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setClaiming(null)
    router.refresh()
  }

  if (slots.length === 0) return null

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-gray-50'

  return (
    <section>
      <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
        Pending Visits — Pick Up ({slots.length})
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Declined by another supervisor, not yet overridden by a coordinator/admin. Anyone with an empty slot can claim one.
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-3">
        {slots.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3">
              <p className="text-sm font-bold text-gray-800">{(s.site_id && siteIdToBookingRef[s.site_id]) ?? 'Site TBC'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Originally {fmtDate(s.scheduled_date)} · {(s.slot_type ?? 'inspection').replace('_', ' ')}
              </p>
              {s.decline_reason && <p className="text-xs text-gray-400 italic mt-1">"{s.decline_reason}"</p>}
            </div>
            {claiming === s.id ? (
              <div className="px-5 pb-4 space-y-2 bg-gray-50 border-t border-gray-100 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
                  <input type="time" value={start} onChange={e => setStart(e.target.value)} className={inputClass} />
                  <input type="time" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setClaiming(null)} className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2 rounded-lg">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleClaim(s.id)}
                    disabled={busy}
                    className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-60"
                  >
                    {busy ? 'Working…' : 'Confirm Claim'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-4">
                <button
                  onClick={() => openClaim(s)}
                  className="w-full bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl"
                >
                  Claim This Slot
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
