'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { declineSlot } from '../actions'

// Project owner's rule (29 Sep 2026): Supervisor proposing not to do a
// scheduled visit moves it to "pending" by default -- it stays assigned only
// if a higher role overrides the proposal
// (app/coordinator/visit-requests/DeclinedVisitsPanel.tsx). Anything left
// pending becomes available for any supervisor to pick up
// (PendingPickupSection on this same page).
export default function DeclineSlotButton({ slotId, supervisorUserId }: { slotId: string; supervisorUserId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setStatus('loading')
    setError(null)
    const result = await declineSlot(slotId, supervisorUserId, reason)
    if (result.error) {
      setError(result.error)
      setStatus('error')
      return
    }
    setOpen(false)
    setReason('')
    setStatus('idle')
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-red-500 font-semibold underline">
        Can't Do — Request Change
      </button>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
      <p className="text-xs text-red-700 font-semibold">Why can't you do this visit?</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. two other urgent visits today, site not accessible…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs"
        rows={2}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2 rounded-lg">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={status === 'loading' || !reason.trim()}
          className="flex-1 bg-red-600 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-60"
        >
          {status === 'loading' ? 'Sending…' : 'Send to Pending'}
        </button>
      </div>
    </div>
  )
}
