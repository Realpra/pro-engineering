'use client'

import { useState, useEffect } from 'react'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  onComplete: (measurements: object) => void
  isReview?: boolean
  onBack?: () => void
}

export default function Screen14_Measurements({ reportId, onComplete, isReview, onBack }: Props) {
  const [bathroomLength, setBathroomLength] = useState('')
  const [bathroomWidth, setBathroomWidth] = useState('')
  const [bathroomHeight, setBathroomHeight] = useState('')
  const [wallAreaNorth, setWallAreaNorth] = useState('')
  const [wallAreaSouth, setWallAreaSouth] = useState('')
  const [wallAreaEast, setWallAreaEast] = useState('')
  const [wallAreaWest, setWallAreaWest] = useState('')
  const [floorArea, setFloorArea] = useState('')
  const [totalWallArea, setTotalWallArea] = useState('')
  const [ceilingArea, setCeilingArea] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  useEffect(() => {
    setFloorArea((parseFloat(bathroomLength || '0') * parseFloat(bathroomWidth || '0')).toFixed(1))
  }, [bathroomLength, bathroomWidth])

  useEffect(() => {
    const vals = [wallAreaNorth, wallAreaSouth, wallAreaEast, wallAreaWest].map((v) => parseFloat(v || '0'))
    setTotalWallArea(vals.reduce((a, b) => a + b, 0).toFixed(1))
  }, [wallAreaNorth, wallAreaSouth, wallAreaEast, wallAreaWest])

  useEffect(() => {
    setCeilingArea(floorArea)
  }, [floorArea])

  const missingFields: string[] = []
  if (!bathroomLength || parseFloat(bathroomLength) <= 0) missingFields.push('Length')
  if (!bathroomWidth || parseFloat(bathroomWidth) <= 0) missingFields.push('Width')
  if (!bathroomHeight || parseFloat(bathroomHeight) <= 0) missingFields.push('Ceiling Height')
  if (!wallAreaNorth || parseFloat(wallAreaNorth) <= 0) missingFields.push('North Wall')
  if (!wallAreaSouth || parseFloat(wallAreaSouth) <= 0) missingFields.push('South Wall')
  if (!wallAreaEast || parseFloat(wallAreaEast) <= 0) missingFields.push('East Wall')
  if (!wallAreaWest || parseFloat(wallAreaWest) <= 0) missingFields.push('West Wall')

  const canSubmit = missingFields.length === 0 && parseFloat(floorArea) > 0 && parseFloat(totalWallArea) > 0
  const validationError = submitAttempted && missingFields.length > 0
    ? `Required: ${missingFields.join(' · ')}`
    : null

  async function handleSubmit() {
    setSubmitAttempted(true)
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const measurements = {
        bathroomLength: parseFloat(bathroomLength),
        bathroomWidth: parseFloat(bathroomWidth),
        bathroomHeight: parseFloat(bathroomHeight),
        floorArea: parseFloat(floorArea),
        wallAreaNorth: parseFloat(wallAreaNorth),
        wallAreaSouth: parseFloat(wallAreaSouth),
        wallAreaEast: parseFloat(wallAreaEast),
        wallAreaWest: parseFloat(wallAreaWest),
        totalWallArea: parseFloat(totalWallArea),
        ceilingArea: parseFloat(ceilingArea),
        notes: notes || null,
      }
      const result = await saveScreen(reportId, 14, 'screen14_measurements', measurements as Record<string, unknown>)
      if (result.error) throw new Error(result.error)
      onComplete(measurements)
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
          <span className="text-white text-xs font-bold">14</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Measurements</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Bathroom dimensions */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Bathroom Dimensions (ft)</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Length</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBathroomLength((v) => String(Math.max(0, parseFloat(v || '0') - 1)))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  value={bathroomLength}
                  onChange={(e) => setBathroomLength(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                />
                <button
                  type="button"
                  onClick={() => setBathroomLength((v) => String(parseFloat(v || '0') + 1))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Width</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBathroomWidth((v) => String(Math.max(0, parseFloat(v || '0') - 1)))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  value={bathroomWidth}
                  onChange={(e) => setBathroomWidth(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                />
                <button
                  type="button"
                  onClick={() => setBathroomWidth((v) => String(parseFloat(v || '0') + 1))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Ceiling Height</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBathroomHeight((v) => String(Math.max(0, parseFloat(v || '0') - 1)))}
                className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
              >
                −
              </button>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={bathroomHeight}
                onChange={(e) => setBathroomHeight(e.target.value)}
                placeholder="0.0"
                min="0"
                className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
              />
              <button
                type="button"
                onClick={() => setBathroomHeight((v) => String(parseFloat(v || '0') + 1))}
                className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
              >
                +
              </button>
            </div>
          </div>
          {parseFloat(floorArea) > 0 && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs font-bold text-[#1F3864]">
                Floor Area: {floorArea} sq ft{' '}
                <span className="font-normal text-gray-500">(Length × Width)</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Ceiling Area: {ceilingArea} sq ft <span className="text-gray-400">(same as floor)</span>
              </p>
            </div>
          )}
        </div>

        {/* Wall areas */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Wall Areas (sq ft)</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['North Wall', wallAreaNorth, setWallAreaNorth],
              ['South Wall', wallAreaSouth, setWallAreaSouth],
              ['East Wall', wallAreaEast, setWallAreaEast],
              ['West Wall', wallAreaWest, setWallAreaWest],
            ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-gray-500 mb-2">{label}</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setter(String(Math.max(0, parseFloat(val || '0') - 1)))}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    placeholder="0.0"
                    min="0"
                    className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setter(String(parseFloat(val || '0') + 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          {parseFloat(totalWallArea) > 0 && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs font-bold text-[#1F3864]">Total Wall Area: {totalWallArea} sq ft</p>
            </div>
          )}
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
            rows={2}
            placeholder="Additional measurements or observations…"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
          />
        </div>

        {/* Submit */}
        <div className="px-5 py-4">
          {validationError && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{validationError}</p>
            </div>
          )}
          {error && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
              canSubmit && !submitting
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Enter all measurements'}
          </button>
        </div>
      </div>
    </div>
  )
}
