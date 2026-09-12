'use client'

import { useState } from 'react'
import { submitEveningLog } from './actions'

type Props = {
  supervisorId: string
  onComplete: () => void
}

export default function LTFForm({ supervisorId, onComplete }: Props) {
  const [ltfReady, setLtfReady] = useState<boolean | null>(null)
  const [ltfTargetSlot, setLtfTargetSlot] = useState('')
  const [ltfDelayReason, setLtfDelayReason] = useState('')
  const [ltfNotes, setLtfNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (ltfReady === null) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitEveningLog({
        supervisorId,
        scopeCompleted: '',
        deviationFromPlan: false,
        deviationDescription: null,
        deviationReason: null,
        eveningPhotoUrl: null,
        issueReported: false,
        issueDescription: null,
        ltfReadyTomorrow: ltfReady,
        ltfTargetSlot: ltfReady ? ltfTargetSlot || null : null,
        ltfDelayReason: !ltfReady ? ltfDelayReason || null : null,
        ltfNotes: ltfNotes || null,
      })
      if (result.error) throw new Error(result.error)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Look to the Future</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Ready tomorrow */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Ready to Start Tomorrow?</p>
          <div className="flex gap-3">
            {(['Yes', 'No'] as const).map((opt) => {
              const val = opt === 'Yes'
              const active = ltfReady === val
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLtfReady(val)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                    active
                      ? 'bg-[#1F3864] border-[#1F3864] text-white'
                      : 'bg-white border-gray-200 text-gray-500'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>

        {ltfReady === true && (
          <div className="px-5 py-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Target Start Slot
            </label>
            <input
              type="text"
              value={ltfTargetSlot}
              onChange={(e) => setLtfTargetSlot(e.target.value)}
              placeholder="e.g. 07:00 – 09:00"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
            />
          </div>
        )}

        {ltfReady === false && (
          <div className="px-5 py-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Reason for Delay
            </label>
            <textarea
              value={ltfDelayReason}
              onChange={(e) => setLtfDelayReason(e.target.value)}
              rows={3}
              placeholder="What is blocking start tomorrow?"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
            />
          </div>
        )}

        {ltfReady !== null && (
          <div className="px-5 py-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Additional Notes <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={ltfNotes}
              onChange={(e) => setLtfNotes(e.target.value)}
              rows={3}
              placeholder="Any other notes for tomorrow…"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
            />
          </div>
        )}

        {/* Submit */}
        <div className="px-5 py-4">
          {error && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <button
            type="button"
            disabled={ltfReady === null || submitting}
            onClick={handleSubmit}
            className={`w-full min-h-[56px] rounded-xl font-bold text-sm transition-colors ${
              ltfReady !== null && !submitting
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting…
              </span>
            ) : 'Complete Daily Log'}
          </button>
        </div>
      </div>
    </section>
  )
}
