'use client'

import { useState, useTransition } from 'react'
import { decideJobRequest } from './actions'

// Admin: keep a stalled job request live to pursue, or reject it (owner, 31 Oct 2026).
export default function RequestDecisionPanel({
  bookingRef,
  current,
}: {
  bookingRef: string
  current: { decision: string | null; reason: string | null; decidedAt: string | null }
}) {
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const run = (decision: 'pursue' | 'rejected') => {
    setMsg(null)
    start(async () => {
      const res = await decideJobRequest(bookingRef, decision, reason)
      if (res.error) setMsg(res.error)
      else { setMsg(decision === 'rejected' ? 'Request rejected and kept on record.' : 'Kept live to pursue.'); setReason('') }
    })
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-bold text-gray-700">Admin decision on this request</p>
      {current.decision && (
        <p className="mt-1 text-xs text-gray-600">
          Last decision: <b>{current.decision === 'rejected' ? 'Rejected' : 'Keep live to pursue'}</b>
          {current.reason ? ` — ${current.reason}` : ''}
          {current.decidedAt ? ` (${new Date(current.decidedAt).toLocaleDateString('en-IN')})` : ''}
        </p>
      )}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button" disabled={pending} onClick={() => run('pursue')}
          className="rounded-lg bg-[#1F3864] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Keep live to pursue
        </button>
        <button
          type="button" disabled={pending} onClick={() => run('rejected')}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Reject request
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-gray-700">{msg}</p>}
    </div>
  )
}
