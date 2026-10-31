'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendEstimateBack } from './actions'

// Owner, 31 Oct 2026: Admin sends an estimate under review back to the Coordinator, with a
// reason; the Coordinator sees the latest reason here. Not counted towards a "pending" job.
export default function EstimateSendBackPanel({
  bookingRef,
  canSendBack,
  lastSendBack,
}: {
  bookingRef: string
  canSendBack: boolean
  lastSendBack: { remarks: string | null; created_at: string } | null
}) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!canSendBack && !lastSendBack) return null

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4">
      {lastSendBack && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Sent back by Admin</b> on{' '}
          {new Date(lastSendBack.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}:{' '}
          {lastSendBack.remarks ?? '—'}
        </div>
      )}
      {canSendBack && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-bold text-[#1F3864]">Send estimate back to Coordinator</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="What needs correcting (required)"
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              setMsg(null)
              const res = await sendEstimateBack(bookingRef, reason)
              if (res.error) setMsg(res.error)
              else { setReason(''); setMsg('Sent back to Coordinator.'); router.refresh() }
            })}
            className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending ? 'Sending…' : 'SEND BACK FOR CORRECTION'}
          </button>
          {msg && <p className="mt-2 text-xs text-gray-700">{msg}</p>}
        </div>
      )}
    </div>
  )
}
