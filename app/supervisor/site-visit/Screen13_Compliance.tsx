'use client'

import { useState } from 'react'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  onComplete: () => void
  isReview?: boolean
  onBack?: () => void
}

function TapBtn({
  value,
  current,
  onClick,
  label,
}: {
  value: string
  current: string
  onClick: (v: string) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
        current === value
          ? 'bg-[#1F3864] border-[#1F3864] text-white'
          : 'bg-white border-gray-200 text-gray-600'
      }`}
    >
      {label}
    </button>
  )
}

export default function Screen13_Compliance({ reportId, onComplete, isReview, onBack }: Props) {
  const [societyNocRequired, setSocietyNocRequired] = useState<boolean | null>(null)
  const [nocObtained, setNocObtained] = useState<boolean | null>(null)
  const [workingHoursConfirmed, setWorkingHoursConfirmed] = useState<boolean | null>(null)
  const [rubbleRouteConfirmed, setRubbleRouteConfirmed] = useState<boolean | null>(null)
  const [commonAreaProtectionConfirmed, setCommonAreaProtectionConfirmed] = useState<boolean | null>(null)
  const [neighbourInformed, setNeighbourInformed] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boolCurrent = (val: boolean | null) => val === true ? 'yes' : val === false ? 'no' : ''

  const nocBlocked = societyNocRequired === true && nocObtained === false
  const riskFlags: string[] = []
  if (nocBlocked) {
    riskFlags.push('NOC required but not yet obtained: work cannot begin until NOC received')
  }

  const canSubmit =
    societyNocRequired !== null &&
    workingHoursConfirmed !== null &&
    rubbleRouteConfirmed !== null &&
    commonAreaProtectionConfirmed !== null

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await saveScreen(reportId, 13, 'screen13_compliance', {
        societyNocRequired,
        nocObtained: societyNocRequired === true ? nocObtained : null,
        workingHoursConfirmed,
        rubbleRouteConfirmed,
        commonAreaProtectionConfirmed,
        neighbourInformed,
        notes: notes || null,
        riskFlags,
      })
      if (result.error) throw new Error(result.error)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function startVoiceInput() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SR() as any
    recognition.lang = 'hi-IN'
    recognition.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setNotes((prev) => (prev ? prev + ' ' + transcript : transcript))
    }
    recognition.start()
  }

  return (
    <div>
      {isReview && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#1F3864] mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to current screen
        </button>
      )}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">13</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Community Compliance</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Society NOC required */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Society NOC Required</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(societyNocRequired)} onClick={(v) => setSocietyNocRequired(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(societyNocRequired)} onClick={(v) => setSocietyNocRequired(v === 'yes')} label="NO" />
          </div>
          {societyNocRequired === true && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">NOC Obtained</p>
              <div className="flex gap-3">
                <TapBtn value="yes" current={boolCurrent(nocObtained)} onClick={(v) => setNocObtained(v === 'yes')} label="YES" />
                <TapBtn value="no" current={boolCurrent(nocObtained)} onClick={(v) => setNocObtained(v === 'yes')} label="NO" />
              </div>
              {nocObtained === false && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-bold text-amber-700">NOC required but not yet obtained: work cannot begin until NOC received</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Working hours confirmed */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Working Hours Confirmed with Society</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(workingHoursConfirmed)} onClick={(v) => setWorkingHoursConfirmed(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(workingHoursConfirmed)} onClick={(v) => setWorkingHoursConfirmed(v === 'yes')} label="NO" />
          </div>
        </div>

        {/* Rubble route confirmed */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Rubble Removal Route Confirmed</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(rubbleRouteConfirmed)} onClick={(v) => setRubbleRouteConfirmed(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(rubbleRouteConfirmed)} onClick={(v) => setRubbleRouteConfirmed(v === 'yes')} label="NO" />
          </div>
        </div>

        {/* Common area protection */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Common Area Protection Confirmed</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(commonAreaProtectionConfirmed)} onClick={(v) => setCommonAreaProtectionConfirmed(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(commonAreaProtectionConfirmed)} onClick={(v) => setCommonAreaProtectionConfirmed(v === 'yes')} label="NO" />
          </div>
        </div>

        {/* Neighbour informed */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Neighbour Informed</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(neighbourInformed)} onClick={(v) => setNeighbourInformed(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(neighbourInformed)} onClick={(v) => setNeighbourInformed(v === 'yes')} label="NO" />
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Notes</label>
            <button
              type="button"
              onClick={startVoiceInput}
              className="flex items-center gap-1 text-xs font-semibold text-[#1F3864] active:opacity-60"
            >
              🎤 Voice
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional observations…"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
          />
        </div>

        {/* Risk flags */}
        {riskFlags.length > 0 && (
          <div className="px-5 py-4 bg-amber-50">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Risk Flags</p>
            {riskFlags.map((flag) => (
              <p key={flag} className="text-xs text-amber-700 mb-1">⚠ {flag}</p>
            ))}
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
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
              canSubmit && !submitting
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Complete all required fields'}
          </button>
        </div>
      </div>
    </div>
  )
}
