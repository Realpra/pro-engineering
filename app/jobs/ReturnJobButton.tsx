'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { returnJobToAdmin } from './routingActions'

// Coordinator / Sub-Coordinator: return a job routed to you back to Admin, with a reason.
export default function ReturnJobButton({ bookingRef }: { bookingRef: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-xs font-semibold text-red-700 hover:underline">
        Return this job to Admin
      </button>
    )
  }
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
        placeholder="Why (wrong zone, no capacity, …) — required"
        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={pending}
          onClick={() => start(async () => {
            setMsg(null)
            const res = await returnJobToAdmin(bookingRef, reason)
            if (res.error) setMsg(res.error)
            else router.refresh()
          })}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {pending ? 'Returning…' : 'Return to Admin'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-600">Cancel</button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-700">{msg}</p>}
    </div>
  )
}
