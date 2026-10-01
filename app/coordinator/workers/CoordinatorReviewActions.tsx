'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveWorkerToAdmin, returnWorkerToSubCoordinator, markWorkerDeployableAdhoc } from './actions'
import { WORKER_RETURN_REASONS } from '@/lib/workerReturnReasons'

export default function CoordinatorReviewActions({
  workerId,
  currentUserId,
  deployableAdhocAt,
}: {
  workerId: string
  currentUserId: string
  deployableAdhocAt?: string | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<null | 'approve' | 'return' | 'adhoc'>(null)
  const [text, setText] = useState('')
  const [reasonIdx, setReasonIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOtherReason = reasonIdx >= 0 && WORKER_RETURN_REASONS[reasonIdx].label === 'Other'

  function pickReason(idx: number) {
    setReasonIdx(idx)
    setText(idx >= 0 && WORKER_RETURN_REASONS[idx].label !== 'Other' ? WORKER_RETURN_REASONS[idx].action : '')
  }

  async function submit() {
    setBusy(true)
    setError(null)
    const res =
      mode === 'approve' ? await approveWorkerToAdmin(workerId, text.trim())
      : mode === 'adhoc' ? await markWorkerDeployableAdhoc(workerId, text.trim(), currentUserId)
      : await returnWorkerToSubCoordinator(workerId, text.trim())
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setMode(null)
    setText('')
    setReasonIdx(-1)
    router.refresh()
  }

  if (mode) {
    return (
      <div className="space-y-2">
        {mode === 'return' && (
          <select
            value={reasonIdx}
            onChange={(e) => pickReason(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg p-2 text-xs"
          >
            <option value={-1}>Select a reason…</option>
            {WORKER_RETURN_REASONS.map((r, i) => (
              <option key={r.label} value={i}>{r.label}</option>
            ))}
          </select>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={
            mode === 'approve' ? 'Remark forwarded with this worker to Admin (optional)…'
            : mode === 'adhoc' ? 'Remark on skill/field values set for this adhoc deployment (optional)…'
            : isOtherReason ? 'Describe what needs correcting…' : 'What needs correcting?'
          }
          className="w-full border border-gray-300 rounded-lg p-2 text-xs resize-none"
        />
        {mode === 'adhoc' && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
            This makes the worker immediately deployable with the fields on file now. Those
            fields are provisional ("adhoc") until Admin's final approval.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy || (mode === 'return' && !text.trim())}
            className={`flex-1 text-xs font-bold py-2.5 rounded-xl disabled:opacity-50 ${mode === 'return' ? 'bg-red-600 text-white' : mode === 'adhoc' ? 'bg-amber-600 text-white' : 'bg-green-600 text-white'}`}
          >
            {busy ? 'Saving…' : mode === 'approve' ? 'Confirm Approve → Admin' : mode === 'adhoc' ? 'Confirm Mark Deployable' : 'Confirm Return'}
          </button>
          <button type="button" onClick={() => setMode(null)} disabled={busy} className="px-3 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('return')} className="flex-1 border border-red-300 text-red-600 text-xs font-bold py-2.5 rounded-xl">
          Return to Sub-Coord
        </button>
        <button type="button" onClick={() => setMode('approve')} className="flex-1 bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl">
          ✓ Approve → Admin
        </button>
      </div>
      <button type="button" onClick={() => setMode('adhoc')} className="w-full border border-amber-400 text-amber-700 text-xs font-bold py-2.5 rounded-xl">
        {deployableAdhocAt ? '↻ Re-confirm Deployable (Adhoc)' : '⚡ Mark Deployable (Adhoc) — independent of Approve above'}
      </button>
    </div>
  )
}
