'use client'

import { useState } from 'react'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  measurements: object
  scopeIntent: object
  onComplete: () => void
  isReview?: boolean
  onBack?: () => void
}

export default function Screen19_Materials({ reportId, measurements, scopeIntent, onComplete, isReview, onBack }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meas = (measurements as any) ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope = (scopeIntent as any) ?? {}

  const floorArea = parseFloat(String(meas.floorArea || '0')) || 0
  const totalWallArea = parseFloat(String(meas.totalWallArea || '0')) || 0
  const needsFloorTiles = scope.tilesScope !== 'retain-all'
  const needsWallTiles = scope.tilesScope !== 'retain-all' && scope.tilesScope !== 'replace-floor-only'

  const [floorTiles, setFloorTiles] = useState(() =>
    needsFloorTiles ? Math.round(floorArea * 1.1 * 10) / 10 : 0
  )
  const [wallTiles, setWallTiles] = useState(() =>
    needsWallTiles ? Math.round(totalWallArea * 1.1 * 10) / 10 : 0
  )
  const [floorAdhesive, setFloorAdhesive] = useState(() => Math.max(1, Math.ceil(floorArea / 40)))
  const [wallAdhesive, setWallAdhesive] = useState(() => Math.max(1, Math.ceil(totalWallArea / 35)))
  const [grout, setGrout] = useState(() => Math.max(1, Math.ceil((floorArea + totalWallArea) / 50)))
  const [waterproofing, setWaterproofing] = useState(() => Math.max(2, Math.ceil(floorArea * 2 / 10)))
  const [cement, setCement] = useState(() => Math.max(1, Math.ceil((floorArea + totalWallArea) / 30)))
  const [sand, setSand] = useState(() => Math.max(1, Math.ceil((floorArea + totalWallArea) / 20)))
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await saveScreen(reportId, 19, 'screen19_materials', {
        floorTiles: needsFloorTiles ? floorTiles : 0,
        wallTiles: needsWallTiles ? wallTiles : 0,
        floorAdhesiveBags: floorAdhesive,
        wallAdhesiveBags: wallAdhesive,
        groutKg: grout,
        waterproofingKg: waterproofing,
        cementBags: cement,
        sandCft: sand,
        notes: notes || null,
      })
      if (result.error) throw new Error(result.error)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  type Row = { label: string; val: number; set: (v: number) => void; unit: string; note?: string }

  const rows: Row[] = [
    ...(needsFloorTiles ? [
      { label: 'Floor Tiles', val: floorTiles, set: setFloorTiles, unit: 'sq ft', note: '10% waste included' },
    ] : []),
    ...(needsWallTiles ? [
      { label: 'Wall Tiles', val: wallTiles, set: setWallTiles, unit: 'sq ft', note: '10% waste included' },
    ] : []),
    { label: 'Floor Adhesive', val: floorAdhesive, set: setFloorAdhesive, unit: 'bags' },
    { label: 'Wall Adhesive', val: wallAdhesive, set: setWallAdhesive, unit: 'bags' },
    { label: 'Grout', val: grout, set: setGrout, unit: 'kg' },
    { label: 'Waterproofing Compound', val: waterproofing, set: setWaterproofing, unit: 'kg' },
    { label: 'Cement', val: cement, set: setCement, unit: 'bags' },
    { label: 'Sand', val: sand, set: setSand, unit: 'cu ft' },
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

      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">19</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Material Estimation</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Quantities auto-calculated from confirmed measurements with 10% waste factor.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50">
          <p className="text-xs text-gray-500">Adjust quantities if site conditions require it.</p>
        </div>

        {rows.map(({ label, val, set, unit, note }) => (
          <div key={label} className="px-5 py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700">{label}</p>
                {note && <p className="text-xs text-gray-400">{note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => set(Math.max(0, Math.round((val - 1) * 10) / 10))}
                  className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold active:bg-gray-200"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-bold text-[#1F3864]">{val}</span>
                <button
                  type="button"
                  onClick={() => set(Math.round((val + 1) * 10) / 10)}
                  className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold active:bg-gray-200"
                >
                  +
                </button>
                <span className="text-xs text-gray-400 w-10">{unit}</span>
              </div>
            </div>
          </div>
        ))}

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
            placeholder="Material notes or substitutions…"
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
            {submitting ? 'Saving…' : 'Confirm Material List'}
          </button>
        </div>
      </div>
    </div>
  )
}
