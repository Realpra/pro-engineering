'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { submitEveningLog } from './actions'

type Props = {
  supervisorId: string
  onComplete: () => void
}

async function uploadPhoto(supervisorId: string, file: File, prefix: string): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${supervisorId}/${prefix}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('site-log-photos').upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  return path
}

export default function EveningForm({ supervisorId, onComplete }: Props) {
  const [scopeCompleted, setScopeCompleted] = useState('')
  const [deviationFound, setDeviationFound] = useState(false)
  const [deviationDescription, setDeviationDescription] = useState('')
  const [deviationReason, setDeviationReason] = useState('')
  const [issueReported, setIssueReported] = useState(false)
  const [issueDescription, setIssueDescription] = useState('')
  const [eveningPhotoFile, setEveningPhotoFile] = useState<File | null>(null)
  const [eveningPhotoPreview, setEveningPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEveningPhotoFile(file)
    setEveningPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      let eveningPhotoUrl: string | null = null
      if (eveningPhotoFile) {
        eveningPhotoUrl = await uploadPhoto(supervisorId, eveningPhotoFile, 'evening')
      }

      const result = await submitEveningLog({
        supervisorId,
        scopeCompleted,
        deviationFromPlan: deviationFound,
        deviationDescription: deviationFound ? deviationDescription || null : null,
        deviationReason: deviationFound ? deviationReason || null : null,
        eveningPhotoUrl,
        issueReported,
        issueDescription: issueReported ? issueDescription || null : null,
        ltfReadyTomorrow: false,
        ltfTargetSlot: null,
        ltfDelayReason: null,
        ltfNotes: null,
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
        <div className="w-8 h-8 rounded-lg bg-[#2E74B5] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Evening Report</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Scope completed */}
        <div className="px-5 py-4">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
            Scope Completed Today
          </label>
          <textarea
            value={scopeCompleted}
            onChange={(e) => setScopeCompleted(e.target.value)}
            rows={4}
            placeholder="Describe what was actually completed today…"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
          />
        </div>

        {/* Deviation from plan */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Deviation from Plan</p>
          <div className="flex gap-3">
            {(['Yes', 'No'] as const).map((opt) => {
              const val = opt === 'Yes'
              const active = deviationFound === val
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDeviationFound(val)}
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
          {deviationFound && (
            <div className="mt-4 space-y-3">
              <textarea
                value={deviationDescription}
                onChange={(e) => setDeviationDescription(e.target.value)}
                rows={2}
                placeholder="What deviated from the plan?"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
              />
              <textarea
                value={deviationReason}
                onChange={(e) => setDeviationReason(e.target.value)}
                rows={2}
                placeholder="Why did it deviate?"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
              />
            </div>
          )}
        </div>

        {/* Issue reported */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Issue Reported</p>
          <div className="flex gap-3">
            {(['Yes', 'No'] as const).map((opt) => {
              const val = opt === 'Yes'
              const active = issueReported === val
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIssueReported(val)}
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
          {issueReported && (
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={2}
              placeholder="Describe the issue…"
              className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
            />
          )}
        </div>

        {/* End-of-day photo */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            End-of-Day Photo <span className="normal-case font-normal text-gray-400">(optional)</span>
          </p>
          {eveningPhotoPreview ? (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <img src={eveningPhotoPreview} alt="End of day" className="w-full h-40 object-cover" />
              <button
                type="button"
                onClick={() => { setEveningPhotoFile(null); setEveningPhotoPreview(null) }}
                className="w-full py-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Remove photo
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-[#2E74B5] transition-colors">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-gray-500">Tap to add photo</span>
              <input type="file" accept="image/*" className="sr-only" onChange={handlePhoto} />
            </label>
          )}
        </div>

        {/* Submit */}
        <div className="px-5 py-4">
          {error && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className={`w-full min-h-[56px] rounded-xl font-bold text-sm transition-colors ${
              !submitting
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
            ) : 'Submit Evening Report'}
          </button>
        </div>
      </div>
    </section>
  )
}
