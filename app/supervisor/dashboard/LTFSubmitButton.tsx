'use client'

import { useState } from 'react'
import { submitSupervisorLTF } from './actions'

// LTF sourcing correction (29 Sep 2026, project owner): this signal must be
// submittable by Site Head, Supervisor, AND via Site Visit Manager -- not
// Site Incharge alone (see app/site-incharge/dashboard/LTFSubmitButton.tsx
// for that one). This is Supervisor's own direct submission, e.g. after a
// phone update from Site Head without doing a full visit.
export default function LTFSubmitButton({
  bookingRef,
  siteId,
  supervisorUserId,
}: {
  bookingRef: string
  siteId: string | null
  supervisorUserId: string
}) {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState<boolean | null>(null)
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'evening'>('morning')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (ready === null) return
    setStatus('loading')
    setError(null)
    const result = await submitSupervisorLTF({
      bookingRef,
      siteId,
      supervisorUserId,
      isReadyTomorrow: ready,
      targetTimeSlot: ready ? slot : null,
      contractorNotes: notes.trim() || null,
    })
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
        className="shrink-0 bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg"
      >
        🌙 Submit LTF
      </button>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 flex items-end justify-center px-4 pb-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            {status === 'sent' ? (
              <>
                <p className="text-green-600 font-bold text-sm mb-2">✓ LTF submitted</p>
                <button
                  onClick={() => { setOpen(false); setStatus('idle'); setNotes(''); setReady(null) }}
                  className="w-full bg-gray-100 text-gray-700 text-xs font-semibold py-2.5 rounded-xl"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="text-[#1F3864] font-bold text-sm mb-1">🌙 LTF — Ready for Tomorrow?</p>
                <p className="text-xs text-gray-500 mb-3">Your own submission for {bookingRef}.</p>

                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setReady(true)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${ready === true ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600'}`}
                  >
                    ✓ Ready
                  </button>
                  <button
                    type="button"
                    onClick={() => setReady(false)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${ready === false ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600'}`}
                  >
                    ✗ Not Ready
                  </button>
                </div>

                {ready === true && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1.5">Preferred visit slot tomorrow</p>
                    <div className="flex gap-2">
                      {(['morning', 'afternoon', 'evening'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSlot(s)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize ${slot === s ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'border-gray-300 text-gray-600'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)…"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs mb-3"
                  rows={2}
                />
                {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)} className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={status === 'loading' || ready === null}
                    className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-60"
                  >
                    {status === 'loading' ? 'Sending…' : 'Submit LTF'}
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
