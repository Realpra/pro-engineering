'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acknowledgeInstruction } from './actions'

export default function AcknowledgeButton({ instructionId }: { instructionId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setBusy(true)
    setError(null)
    const result = await acknowledgeInstruction(instructionId)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div>
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className="w-full bg-[#1F3864] text-white text-xs font-bold py-3 rounded-xl disabled:opacity-60"
      >
        {busy ? 'Acknowledging...' : 'Acknowledge Directive'}
      </button>
    </div>
  )
}
