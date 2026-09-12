'use client'

import { useState } from 'react'

export default function CheckInButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null)

  async function handleCheckIn() {
    if (status !== 'idle') return
    setStatus('loading')
    // Small deliberate delay so the tap feels confirmed
    await new Promise(r => setTimeout(r, 600))
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    setCheckedInAt(now)
    setStatus('done')
  }

  if (status === 'done') {
    return (
      <div className="w-full rounded-2xl bg-green-600 px-6 py-6 flex flex-col items-center gap-2 shadow-lg">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-1">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-white font-bold text-xl tracking-wide">Checked In</p>
        <p className="text-green-100 text-sm">{checkedInAt} — attendance recorded</p>
      </div>
    )
  }

  return (
    <button
      onClick={handleCheckIn}
      disabled={status === 'loading'}
      className="w-full rounded-2xl bg-[#1F3864] hover:bg-[#162c50] active:scale-[0.98] transition-all disabled:opacity-70 px-6 py-6 flex flex-col items-center gap-2 shadow-lg min-h-[120px]"
    >
      {status === 'loading' ? (
        <>
          <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-blue-200 font-semibold text-base">Recording…</p>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full bg-[#2E74B5] flex items-center justify-center mb-1">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white font-bold text-2xl tracking-widest uppercase">Check In</p>
          <p className="text-blue-300 text-xs font-medium">Tap to record your attendance</p>
        </>
      )}
    </button>
  )
}
