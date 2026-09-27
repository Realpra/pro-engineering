'use client'

import { useState } from 'react'
import { markSiteHeadNotReady } from './actions'

export default function SiteHeadNotReadyButton({ slotId }: { slotId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleClick() {
    setStatus('loading')
    const result = await markSiteHeadNotReady(slotId)
    setStatus(result.error ? 'error' : 'done')
  }

  if (status === 'done') {
    return (
      <button disabled className="flex-1 border border-gray-300 text-gray-400 text-xs font-semibold py-2.5 rounded-xl">
        ✓ Flagged Not Ready
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl active:bg-gray-50 disabled:opacity-60"
    >
      {status === 'loading' ? 'Flagging…' : status === 'error' ? 'Failed — Retry' : 'Site Head Not Ready'}
    </button>
  )
}
