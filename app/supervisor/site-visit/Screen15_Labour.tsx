'use client'

import { useState } from 'react'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  scopeIntent: object
  measurements: object
  onComplete: (labourData: object) => void
  isReview?: boolean
  onBack?: () => void
}

export default function Screen15_Labour({ reportId, scopeIntent, measurements, onComplete, isReview, onBack }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope = (scopeIntent as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meas = (measurements as any) ?? {}

  const floorArea = Number(meas.floorArea) || 0
  const totalWallArea = Number(meas.totalWallArea) || 0

  const [demolitionDays, setDemolitionDays] = useState(() =>
    scope.tilesScope !== 'retain-all'
      ? Math.max(1, Math.ceil(floorArea / 100) + Math.ceil(totalWallArea / 100))
      : 0
  )
  const [plumbingDays, setPlumbingDays] = useState(() =>
    scope.plumbingScope === 'reroute' ? 2 : 1
  )
  const [electricalDays, setElectricalDays] = useState(() =>
    scope.electricalScope === 'add-change' ? 1 : 0
  )
  const [waterproofingDays, setWaterproofingDays] = useState(2)
  const [floorScreedDays, setFloorScreedDays] = useState(1)
  const [tilingFloorDays, setTilingFloorDays] = useState(() =>
    Math.max(1, Math.ceil(floorArea / 50))
  )
  const [tilingWallsDays, setTilingWallsDays] = useState(() =>
    Math.max(1, Math.ceil(totalWallArea / 40))
  )
  const [groutingDays, setGroutingDays] = useState(1)
  const [fixtureFittingDays, setFixtureFittingDays] = useState(1)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalWorkingDays =
    demolitionDays + plumbingDays + electricalDays + waterproofingDays +
    floorScreedDays + tilingFloorDays + tilingWallsDays + groutingDays + fixtureFittingDays
  const totalCalendarDays = totalWorkingDays + 6

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const labourData = {
        demolitionDays,
        plumbingDays,
        electricalDays,
        waterproofingDays,
        floorScreedDays,
        tilingFloorDays,
        tilingWallsDays,
        groutingDays,
        fixtureFittingDays,
        totalWorkingDays,
        totalCalendarDays,
        notes: notes || null,
      }
      const result = await saveScreen(reportId, 15, 'screen15_labour', labourData as Record<string, unknown>)
      if (result.error) throw new Error(result.error)
      onComplete(labourData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const rows: [string, number, (v: number) => void][] = [
    ['Demolition', demolitionDays, setDemolitionDays],
    ['Plumbing', plumbingDays, setPlumbingDays],
    ['Electrical', electricalDays, setElectricalDays],
    ['Waterproofing', waterproofingDays, setWaterproofingDays],
    ['Floor Screed', floorScreedDays, setFloorScreedDays],
    ['Floor Tiling', tilingFloorDays, setTilingFloorDays],
    ['Wall Tiling', tilingWallsDays, setTilingWallsDays],
    ['Grouting', groutingDays, setGroutingDays],
    ['Fixture Fitting', fixtureFittingDays, setFixtureFittingDays],
  ]

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
          <span className="text-white text-xs font-bold">15</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Labour Schedule</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50">
          <p className="text-xs text-gray-500">Pre-filled from scope and measurements. Adjust if needed.</p>
        </div>

        {rows.map(([label, val, set]) => (
          <div key={label} className="px-5 py-3 flex items-center gap-4">
            <p className="flex-1 text-sm font-semibold text-gray-700">{label}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => set(Math.max(0, val - 1))}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-base active:bg-gray-200"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-bold text-[#1F3864]">{val}</span>
              <button
                type="button"
                onClick={() => set(val + 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-base active:bg-gray-200"
              >
                +
              </button>
              <span className="text-xs text-gray-400 w-7">days</span>
            </div>
          </div>
        ))}

        <div className="px-5 py-3 bg-blue-50">
          <p className="text-xs text-blue-700 font-semibold">+ 6 curing days (3 after waterproofing, 3 after screed)</p>
        </div>

        <div className="px-5 py-4 bg-[#1F3864]">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm font-bold text-white">Total Working Days</p>
            <p className="text-lg font-bold text-white">{totalWorkingDays}</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-blue-200">Total Calendar Days (incl. curing)</p>
            <p className="text-sm font-bold text-blue-200">{totalCalendarDays}</p>
          </div>
        </div>

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
            placeholder="Labour schedule notes…"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
          />
        </div>

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
            className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
              !submitting
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Saving...' : 'Confirm Labour Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
