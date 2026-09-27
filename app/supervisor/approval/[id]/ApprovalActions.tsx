'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supervisorApproveSubstage, supervisorSendBackSubstage } from './actions'

export default function ApprovalActions({ substageId, supervisorUserId }: { substageId: string; supervisorUserId: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'sendback'>('idle')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setStatus('loading')
    setError(null)
    const result = await supervisorApproveSubstage(substageId, supervisorUserId)
    if (result.error) { setError(result.error); setStatus('error') } else { router.push('/supervisor/approvals') }
  }

  async function handleSendBack() {
    if (!reason.trim()) { setError('A reason is required to send this back.'); return }
    setStatus('loading')
    setError(null)
    const result = await supervisorSendBackSubstage(substageId, supervisorUserId, reason)
    if (result.error) { setError(result.error); setStatus('error') } else { router.push('/supervisor/approvals') }
  }

  if (mode === 'sendback') {
    return (
      <div className="space-y-3">
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Why is this being sent back? (required)"
          rows={3}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
        />
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setMode('idle')} className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-3 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSendBack}
            disabled={status === 'loading'}
            className="flex-1 bg-gray-700 text-white text-xs font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {status === 'loading' ? 'Sending…' : 'Confirm Send Back'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('sendback')}
          className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-3 rounded-xl"
        >
          Send Back
        </button>
        <button
          onClick={handleApprove}
          disabled={status === 'loading'}
          className="flex-1 bg-green-600 text-white text-xs font-bold py-3 rounded-xl disabled:opacity-60"
        >
          {status === 'loading' ? 'Approving…' : 'Approve → Sub-Coord'}
        </button>
      </div>
    </div>
  )
}
