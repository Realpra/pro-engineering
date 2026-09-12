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

export default function Screen11_Fixtures({ reportId, onComplete, isReview, onBack }: Props) {
  const [wc, setWc] = useState<'replace' | 'retain' | 'not-in-scope' | ''>('')
  const [wcType, setWcType] = useState<'wall-hung' | 'floor-mounted' | ''>('')
  const [wcTier, setWcTier] = useState<'premium' | 'value' | 'budget' | ''>('')
  const [washBasin, setWashBasin] = useState<'replace' | 'retain' | 'not-in-scope' | ''>('')
  const [washBasinType, setWashBasinType] = useState<'counter-top' | 'pedestal' | 'wall-hung' | 'under-counter' | ''>('')
  const [shower, setShower] = useState<'replace' | 'retain' | 'upgrade-concealed' | ''>('')
  const [showerType, setShowerType] = useState<'exposed-rose' | 'thermostatic-concealed' | ''>('')
  const [geyser, setGeyser] = useState<'new-point' | 'replace-unit' | 'retain' | ''>('')
  const [accessories, setAccessories] = useState<boolean | null>(null)
  const [taps, setTaps] = useState<'replace-all' | 'replace-damaged' | 'retain-all' | ''>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boolCurrent = (val: boolean | null) => val === true ? 'yes' : val === false ? 'no' : ''

  const canSubmit = !!wc && !!washBasin && !!shower && !!geyser && !!taps

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await saveScreen(reportId, 11, 'screen09_fixtures', {
        wc,
        wcType: wc === 'replace' ? wcType || null : null,
        wcTier: wc === 'replace' ? wcTier || null : null,
        washBasin,
        washBasinType: washBasin === 'replace' ? washBasinType || null : null,
        shower,
        showerType: shower === 'upgrade-concealed' ? showerType || null : null,
        geyser,
        accessories,
        taps,
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
          <span className="text-white text-xs font-bold">11</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Fixture and Sanitaryware Scope</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* WC */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">WC</p>
          <div className="flex gap-2">
            <TapBtn value="replace" current={wc} onClick={(v) => setWc(v as typeof wc)} label="REPLACE" />
            <TapBtn value="retain" current={wc} onClick={(v) => setWc(v as typeof wc)} label="RETAIN" />
            <TapBtn value="not-in-scope" current={wc} onClick={(v) => setWc(v as typeof wc)} label="NOT IN SCOPE" />
          </div>
          {wc === 'replace' && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">WC Type</p>
                <div className="flex gap-2">
                  <TapBtn value="wall-hung" current={wcType} onClick={(v) => setWcType(v as typeof wcType)} label="WALL HUNG" />
                  <TapBtn value="floor-mounted" current={wcType} onClick={(v) => setWcType(v as typeof wcType)} label="FLOOR MOUNTED" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">WC Tier</p>
                <div className="flex gap-2">
                  {(['premium', 'value', 'budget'] as const).map((v) => (
                    <TapBtn key={v} value={v} current={wcTier} onClick={(val) => setWcTier(val as typeof wcTier)} label={v.toUpperCase()} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wash basin */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Wash Basin</p>
          <div className="flex gap-2">
            <TapBtn value="replace" current={washBasin} onClick={(v) => setWashBasin(v as typeof washBasin)} label="REPLACE" />
            <TapBtn value="retain" current={washBasin} onClick={(v) => setWashBasin(v as typeof washBasin)} label="RETAIN" />
            <TapBtn value="not-in-scope" current={washBasin} onClick={(v) => setWashBasin(v as typeof washBasin)} label="NOT IN SCOPE" />
          </div>
          {washBasin === 'replace' && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Basin Type</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['counter-top', 'COUNTER TOP'],
                  ['pedestal', 'PEDESTAL'],
                  ['wall-hung', 'WALL HUNG'],
                  ['under-counter', 'UNDER COUNTER'],
                ] as const).map(([val, lbl]) => (
                  <TapBtn key={val} value={val} current={washBasinType} onClick={(v) => setWashBasinType(v as typeof washBasinType)} label={lbl} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shower */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Shower</p>
          <div className="flex gap-2">
            <TapBtn value="replace" current={shower} onClick={(v) => setShower(v as typeof shower)} label="REPLACE" />
            <TapBtn value="retain" current={shower} onClick={(v) => setShower(v as typeof shower)} label="RETAIN" />
            <TapBtn value="upgrade-concealed" current={shower} onClick={(v) => setShower(v as typeof shower)} label="UPGRADE CONCEALED" />
          </div>
          {shower === 'upgrade-concealed' && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Shower Type</p>
              <div className="flex gap-2">
                <TapBtn value="exposed-rose" current={showerType} onClick={(v) => setShowerType(v as typeof showerType)} label="EXPOSED ROSE" />
                <TapBtn value="thermostatic-concealed" current={showerType} onClick={(v) => setShowerType(v as typeof showerType)} label="THERMOSTATIC" />
              </div>
            </div>
          )}
        </div>

        {/* Geyser */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Geyser</p>
          <div className="flex gap-2">
            <TapBtn value="new-point" current={geyser} onClick={(v) => setGeyser(v as typeof geyser)} label="NEW POINT" />
            <TapBtn value="replace-unit" current={geyser} onClick={(v) => setGeyser(v as typeof geyser)} label="REPLACE UNIT" />
            <TapBtn value="retain" current={geyser} onClick={(v) => setGeyser(v as typeof geyser)} label="RETAIN" />
          </div>
        </div>

        {/* Accessories */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Accessories (towel bar, hook, soap dish)</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(accessories)} onClick={(v) => setAccessories(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(accessories)} onClick={(v) => setAccessories(v === 'yes')} label="NO" />
          </div>
        </div>

        {/* Taps */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Taps</p>
          <div className="flex gap-2">
            <TapBtn value="replace-all" current={taps} onClick={(v) => setTaps(v as typeof taps)} label="REPLACE ALL" />
            <TapBtn value="replace-damaged" current={taps} onClick={(v) => setTaps(v as typeof taps)} label="REPLACE DAMAGED" />
            <TapBtn value="retain-all" current={taps} onClick={(v) => setTaps(v as typeof taps)} label="RETAIN ALL" />
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
