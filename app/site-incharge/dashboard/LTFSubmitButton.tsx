'use client'

import { useState } from 'react'
import { submitLTF } from './actions'

// Real writer for the LTF-ready signal PROCESS FLOW (CLAUDE.md) names as
// one of the two triggers for tomorrow's supervisor route -- ltf_feeds had
// no writer anywhere until this. Feeds this Site Incharge's own submission
// into the app/api/cron/ltf-route-compile cron, which auto-builds tomorrow's
// supervisor_daily_routes slot overnight.
export default function LTFSubmitButton({
  bookingRef,
  siteId,
  siteInchargeUserId,
}: {
  bookingRef: string
  siteId: string
  siteInchargeUserId: string
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
    const result = await submitLTF({
      siteId,
      siteInchargeUserId,
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
        className="w-full bg-white border border-[#1F3864]/20 rounded-2xl shadow-sm px-5 py-4 flex items-center justify-between active:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-[#2E74B5]/10 flex items-center justify-center shrink-0 text-base">🌙</span>
          <span className="text-sm font-semibold text-gray-800">Submit LTF — Ready for Tomorrow?</span>
        </span>
        <span className="text-gray-300 text-lg">›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 flex items-end justify-center px-4 pb-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            {status === 'sent' ? (
              <>
                <p className="text-green-600 font-bold text-sm mb-2">✓ LTF submitted</p>
                <p className="text-xs text-gray-500 mb-3">
                  {ready
                    ? "Tomorrow's route will be compiled automatically at 20:00."
                    : 'Recorded as not ready. No route slot will be auto-scheduled.'}
                </p>
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
                <p className="text-xs text-gray-500 mb-3">Site Head's day-end submission for {bookingRef}.</p>

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
                  placeholder="Notes for supervisor (optional)…"
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
