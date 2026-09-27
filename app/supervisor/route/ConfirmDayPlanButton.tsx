'use client'

import { useState } from 'react'
import { confirmDayPlan } from './actions'

export default function ConfirmDayPlanButton({ supervisorId, date, alreadyConfirmed }: { supervisorId: string; date: string; alreadyConfirmed: boolean }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(alreadyConfirmed ? 'done' : 'idle')

  async function handleClick() {
    setStatus('loading')
    const result = await confirmDayPlan(supervisorId, date)
    setStatus(result.error ? 'error' : 'done')
  }

  if (status === 'done') {
    return (
      <div className="w-full bg-green-50 border border-green-300 text-green-700 font-bold py-3 rounded-2xl text-sm text-center">
        ✓ Day Plan Locked
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-60"
    >
      {status === 'loading' ? 'Locking…' : status === 'error' ? 'Failed — Retry' : '🔒 Confirm Day Plan'}
    </button>
  )
}
