'use client'

import { useState } from 'react'
import { requestResources } from './actions'

// PENDING #17: Site Incharge's outbound counterpart to the read-only
// Instructions section above it on this same dashboard. Routes to
// Coordinator (not Sub-Coordinator) per the project owner's explicit
// decision, 29 Sep 2026 -- Sub-Coordinator's own build is deferred.
export default function RequestResourcesButton({
  siteInchargeUserId,
  bookingRef,
}: {
  siteInchargeUserId: string
  bookingRef: string | null
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setStatus('loading')
    setError(null)
    const result = await requestResources({ siteInchargeUserId, bookingRef, note })
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
        className="w-full bg-white border border-[#1F3864]/20 rounded-2xl shadow-sm px-5 py-4 flex items-center justify-between active:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-[#2E74B5]/10 flex items-center justify-center shrink-0 text-base">📦</span>
          <span className="text-sm font-semibold text-gray-800">Request More Resources</span>
        </span>
        <span className="text-gray-300 text-lg">›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 flex items-end justify-center px-4 pb-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            {status === 'sent' ? (
              <>
                <p className="text-green-600 font-bold text-sm mb-2">✓ Request sent to Coordinator</p>
                <button
                  onClick={() => { setOpen(false); setStatus('idle'); setNote('') }}
                  className="w-full bg-gray-100 text-gray-700 text-xs font-semibold py-2.5 rounded-xl"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="text-[#1F3864] font-bold text-sm mb-1">📦 Request More Resources</p>
                <p className="text-xs text-gray-500 mb-3">
                  Tell Coordinator what you need more of at this site — workers, material, tools.
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. 2 more masons needed tomorrow, cement stock running short…"
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
                    disabled={status === 'loading' || !note.trim()}
                    className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-60"
                  >
                    {status === 'loading' ? 'Sending…' : 'Send Request'}
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
