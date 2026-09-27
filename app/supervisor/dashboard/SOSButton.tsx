'use client'

import { useState } from 'react'
import { raiseSOS } from './actions'

// SA-1 nav-bar spec: "SOS floating red button always visible during active
// job hours (06:00-20:00). Cannot be disabled by anyone." Rendered on the
// Dashboard for now (the natural home screen); making it truly persistent
// across every Supervisor page would mean lifting it into a shared layout,
// deferred and flagged rather than done silently.
export default function SOSButton({
  supervisorId,
  supervisorUserId,
  bookingRef,
}: {
  supervisorId: string
  supervisorUserId: string
  bookingRef: string | null
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setStatus('loading')
    setError(null)
    const result = await raiseSOS({ supervisorId, supervisorUserId, bookingRef, note })
    if (result.error) {
      setError(result.error)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-20 w-14 h-14 rounded-full bg-red-600 text-white font-bold text-xs shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="SOS"
      >
        SOS
      </button>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 flex items-end justify-center px-4 pb-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            {status === 'sent' ? (
              <>
                <p className="text-green-600 font-bold text-sm mb-2">✓ SOS sent to Admin</p>
                <button onClick={() => { setOpen(false); setStatus('idle'); setNote('') }} className="w-full bg-gray-100 text-gray-700 text-xs font-semibold py-2.5 rounded-xl">
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="text-red-600 font-bold text-sm mb-1">🔴 Raise SOS</p>
                <p className="text-xs text-gray-500 mb-3">This immediately alerts every Admin. Use only for a genuine on-site emergency or safety issue.</p>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="What's happening? (optional)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs mb-3"
                  rows={3}
                />
                {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)} className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={status === 'loading'}
                    className="flex-1 bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-60"
                  >
                    {status === 'loading' ? 'Sending…' : 'Send SOS'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
