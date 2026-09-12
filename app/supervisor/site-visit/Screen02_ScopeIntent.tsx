'use client'

import { useState } from 'react'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  onComplete: (scopeIntent: object) => void
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

export default function Screen02_ScopeIntent({ reportId, onComplete, isReview, onBack }: Props) {
  const [renovationType, setRenovationType] = useState<'full' | 'partial' | ''>('')
  const [tilesScope, setTilesScope] = useState<'replace-all' | 'replace-floor-only' | 'replace-walls-only' | 'retain-all' | ''>('')
  const [fixturesScope, setFixturesScope] = useState<'replace-all' | 'replace-selected' | 'retain-all' | ''>('')
  const [plumbingScope, setPlumbingScope] = useState<'reroute' | 'retain' | ''>('')
  const [electricalScope, setElectricalScope] = useState<'add-change' | 'retain' | ''>('')
  const [ceilingScope, setCeilingScope] = useState<'renovate' | 'retain' | ''>('')
  const [geyserScope, setGeyserScope] = useState<'replace' | 'retain' | 'new-point-only' | ''>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    !!renovationType &&
    !!tilesScope &&
    !!fixturesScope &&
    !!plumbingScope &&
    !!electricalScope &&
    !!ceilingScope &&
    !!geyserScope

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const scopeIntent = {
        renovationType,
        tilesScope,
        fixturesScope,
        plumbingScope,
        electricalScope,
        ceilingScope,
        geyserScope,
        notes: notes || null,
      }
      const result = await saveScreen(reportId, 2, 'screen02_scope_intent', scopeIntent)
      if (result.error) throw new Error(result.error)
      onComplete(scopeIntent)
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

      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">02</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Scope Intent</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Confirm with client what is being renovated and what is being retained. This drives all subsequent screens.
      </p>

      <div className="space-y-3">

        {/* Renovation type */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Renovation Type</p>
          <div className="flex gap-2">
            <TapBtn value="full" current={renovationType} onClick={(v) => setRenovationType(v as typeof renovationType)} label="FULL RENOVATION" />
            <TapBtn value="partial" current={renovationType} onClick={(v) => setRenovationType(v as typeof renovationType)} label="PARTIAL RENOVATION" />
          </div>
        </div>

        {/* Tiles */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Tiles</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['replace-all', 'REPLACE ALL'],
              ['replace-floor-only', 'FLOOR ONLY'],
              ['replace-walls-only', 'WALLS ONLY'],
              ['retain-all', 'RETAIN ALL'],
            ] as const).map(([val, lbl]) => (
              <TapBtn
                key={val}
                value={val}
                current={tilesScope}
                onClick={(v) => setTilesScope(v as typeof tilesScope)}
                label={lbl}
              />
            ))}
          </div>
        </div>

        {/* Fixtures */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Fixtures (WC, basin, shower)</p>
          <div className="flex gap-2">
            <TapBtn value="replace-all" current={fixturesScope} onClick={(v) => setFixturesScope(v as typeof fixturesScope)} label="REPLACE ALL" />
            <TapBtn value="replace-selected" current={fixturesScope} onClick={(v) => setFixturesScope(v as typeof fixturesScope)} label="REPLACE SELECTED" />
            <TapBtn value="retain-all" current={fixturesScope} onClick={(v) => setFixturesScope(v as typeof fixturesScope)} label="RETAIN ALL" />
          </div>
        </div>

        {/* Plumbing lines */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Plumbing Lines</p>
          <div className="flex gap-2">
            <TapBtn value="reroute" current={plumbingScope} onClick={(v) => setPlumbingScope(v as typeof plumbingScope)} label="REROUTE REQUIRED" />
            <TapBtn value="retain" current={plumbingScope} onClick={(v) => setPlumbingScope(v as typeof plumbingScope)} label="RETAIN EXISTING" />
          </div>
        </div>

        {/* Electrical */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Electrical</p>
          <div className="flex gap-2">
            <TapBtn value="add-change" current={electricalScope} onClick={(v) => setElectricalScope(v as typeof electricalScope)} label="ADD OR CHANGE POINTS" />
            <TapBtn value="retain" current={electricalScope} onClick={(v) => setElectricalScope(v as typeof electricalScope)} label="RETAIN EXISTING" />
          </div>
        </div>

        {/* Ceiling */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Ceiling</p>
          <div className="flex gap-2">
            <TapBtn value="renovate" current={ceilingScope} onClick={(v) => setCeilingScope(v as typeof ceilingScope)} label="RENOVATE CEILING" />
            <TapBtn value="retain" current={ceilingScope} onClick={(v) => setCeilingScope(v as typeof ceilingScope)} label="RETAIN CEILING" />
          </div>
        </div>

        {/* Geyser */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Geyser</p>
          <div className="flex gap-2">
            <TapBtn value="replace" current={geyserScope} onClick={(v) => setGeyserScope(v as typeof geyserScope)} label="REPLACE UNIT" />
            <TapBtn value="retain" current={geyserScope} onClick={(v) => setGeyserScope(v as typeof geyserScope)} label="RETAIN" />
            <TapBtn value="new-point-only" current={geyserScope} onClick={(v) => setGeyserScope(v as typeof geyserScope)} label="NEW POINT ONLY" />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
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
            placeholder="Additional scope notes…"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
          />
        </div>

        {/* Submit */}
        <div className="pt-1 pb-2">
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
            {submitting ? 'Saving...' : canSubmit ? 'Confirm Scope & Continue' : 'Answer all questions to continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
