'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  onComplete: () => void
  isReview?: boolean
  onBack?: () => void
  showFullPlumbing?: boolean
}

type TapProps = {
  value: string
  current: string
  onClick: (v: string) => void
  label: string
  color?: 'default' | 'amber'
}

function TapBtn({ value, current, onClick, label, color = 'default' }: TapProps) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
        active
          ? color === 'amber'
            ? 'bg-amber-500 border-amber-500 text-white'
            : 'bg-[#1F3864] border-[#1F3864] text-white'
          : 'bg-white border-gray-200 text-gray-600'
      }`}
    >
      {label}
    </button>
  )
}

export default function Screen06_Plumbing({ reportId, onComplete, isReview, onBack, showFullPlumbing = true }: Props) {
  const [wcRelocation, setWcRelocation] = useState<'no' | 'yes' | ''>('')
  const [wcDistance, setWcDistance] = useState('')
  const [slabIntervention, setSlabIntervention] = useState<'core-cutting' | 'floor-bed' | ''>('')
  const [showerRelocation, setShowerRelocation] = useState<'no' | 'yes' | ''>('')
  const [showerDistance, setShowerDistance] = useState('')
  const [wallChasing, setWallChasing] = useState<boolean | null>(null)
  const [pipeType, setPipeType] = useState<'gi' | 'copper' | 'cpvc' | 'upvc' | 'not-visible' | ''>('')
  const [pipeAge, setPipeAge] = useState<'under-10' | '10-20' | 'over-20' | ''>('')
  const [drainCondition, setDrainCondition] = useState<'good' | 'slow' | 'blocked' | ''>('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const riskFlags: string[] = []
  if (slabIntervention === 'core-cutting') {
    riskFlags.push('Core cutting required — adds 1 day')
  }
  if (pipeAge === 'over-20') {
    riskFlags.push('Aged supply pipe — replacement recommended. Cost allowance Rs 3500')
  }
  if (drainCondition === 'slow' || drainCondition === 'blocked') {
    riskFlags.push('Drain blockage — jetting required. Cost allowance Rs 800')
  }

  const missingFields: string[] = []
  if (!wcRelocation) missingFields.push('WC Relocation')
  if (!drainCondition) missingFields.push('Drain Condition')
  if (photos.length < 2) missingFields.push(`Photos (${Math.max(0, 2 - photos.length)} more needed)`)

  const canSubmit = missingFields.length === 0
  const validationError = submitAttempted && missingFields.length > 0
    ? `Required: ${missingFields.join(' · ')}`
    : null

  async function handleSubmit() {
    setSubmitAttempted(true)
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const supabase = createClient()
      const photoUrls = await Promise.all(
        photos.map(async (photo, i) => {
          const ext = photo.name.split('.').pop() ?? 'jpg'
          const path = `${reportId}/screen06/${Date.now()}-${i}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('site-log-photos')
            .upload(path, photo, { upsert: true })
          if (upErr) throw new Error(upErr.message)
          return path
        })
      )
      const result = await saveScreen(reportId, 6, 'screen06_plumbing', {
        wcRelocation,
        wcDistance: wcRelocation === 'yes' ? wcDistance || null : null,
        slabIntervention: wcRelocation === 'yes' ? slabIntervention || null : null,
        showerRelocation,
        showerDistance: showerRelocation === 'yes' ? showerDistance || null : null,
        wallChasing: showerRelocation === 'yes' ? wallChasing : null,
        pipeType: pipeType || null,
        pipeAge: (pipeType === 'gi' || pipeType === 'copper') ? pipeAge || null : null,
        drainCondition,
        notes: notes || null,
        photoUrls,
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
      {!showFullPlumbing && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs font-bold text-blue-700">Scope: Retaining existing plumbing — documentation only</p>
        </div>
      )}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">06</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Plumbing & Drainage</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* WC relocation */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">WC Relocation</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={wcRelocation} onClick={(v) => setWcRelocation(v as typeof wcRelocation)} label="YES" />
            <TapBtn value="no" current={wcRelocation} onClick={(v) => setWcRelocation(v as typeof wcRelocation)} label="NO" />
          </div>
          {wcRelocation === 'yes' && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Distance to Move (ft)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWcDistance((v) => String(Math.max(0, parseFloat(v || '0') - 1)))}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={wcDistance}
                    onChange={(e) => setWcDistance(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setWcDistance((v) => String(parseFloat(v || '0') + 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Slab Intervention</p>
                <div className="flex gap-3">
                  <TapBtn value="core-cutting" current={slabIntervention} onClick={(v) => setSlabIntervention(v as typeof slabIntervention)} label="CORE CUTTING" color="amber" />
                  <TapBtn value="floor-bed" current={slabIntervention} onClick={(v) => setSlabIntervention(v as typeof slabIntervention)} label="FLOOR BED ONLY" />
                </div>
                {slabIntervention === 'core-cutting' && (
                  <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-xs font-bold text-amber-700">Core cutting required — adds 1 day to schedule</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Shower relocation */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Shower Relocation</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={showerRelocation} onClick={(v) => setShowerRelocation(v as typeof showerRelocation)} label="YES" />
            <TapBtn value="no" current={showerRelocation} onClick={(v) => setShowerRelocation(v as typeof showerRelocation)} label="NO" />
          </div>
          {showerRelocation === 'yes' && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Distance to Move (ft)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowerDistance((v) => String(Math.max(0, parseFloat(v || '0') - 1)))}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={showerDistance}
                    onChange={(e) => setShowerDistance(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowerDistance((v) => String(parseFloat(v || '0') + 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Wall Chasing Required</p>
                <div className="flex gap-3">
                  <TapBtn value="yes" current={wallChasing === true ? 'yes' : wallChasing === false ? 'no' : ''} onClick={(v) => setWallChasing(v === 'yes')} label="YES" />
                  <TapBtn value="no" current={wallChasing === true ? 'yes' : wallChasing === false ? 'no' : ''} onClick={(v) => setWallChasing(v === 'yes')} label="NO" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pipe material */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Supply Pipe Material</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['gi', 'GI'],
              ['copper', 'COPPER'],
              ['cpvc', 'CPVC'],
              ['upvc', 'UPVC'],
              ['not-visible', 'NOT VISIBLE'],
            ] as const).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => { setPipeType(val); if (val !== 'gi' && val !== 'copper') setPipeAge('') }}
                className={`px-4 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                  pipeType === val
                    ? 'bg-[#1F3864] border-[#1F3864] text-white'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {(pipeType === 'gi' || pipeType === 'copper') && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Pipe Age</p>
              <div className="flex gap-3">
                <TapBtn value="under-10" current={pipeAge} onClick={(v) => setPipeAge(v as typeof pipeAge)} label="Under 10 yrs" />
                <TapBtn value="10-20" current={pipeAge} onClick={(v) => setPipeAge(v as typeof pipeAge)} label="10–20 yrs" />
                <TapBtn value="over-20" current={pipeAge} onClick={(v) => setPipeAge(v as typeof pipeAge)} label="Over 20 yrs" color="amber" />
              </div>
              {pipeAge === 'over-20' && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-bold text-amber-700">Aged supply pipe — replacement recommended. Cost allowance Rs 3500</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drain condition */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Drain Condition</p>
          <div className="flex gap-3">
            <TapBtn value="good" current={drainCondition} onClick={(v) => setDrainCondition(v as typeof drainCondition)} label="GOOD" />
            <TapBtn value="slow" current={drainCondition} onClick={(v) => setDrainCondition(v as typeof drainCondition)} label="SLOW" color="amber" />
            <TapBtn value="blocked" current={drainCondition} onClick={(v) => setDrainCondition(v as typeof drainCondition)} label="BLOCKED" color="amber" />
          </div>
          {(drainCondition === 'slow' || drainCondition === 'blocked') && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">Drain blockage — jetting required. Cost allowance Rs 800</p>
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
            rows={3}
            placeholder="Additional observations…"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
          />
        </div>

        {/* Photos */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Site Photos <span className="normal-case font-normal text-red-400">(minimum 2 required)</span>
          </p>
          <label className="flex items-center justify-center gap-2 w-full py-4 bg-[#1F3864] text-white rounded-xl text-sm font-bold cursor-pointer">
            📷 {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''} selected` : 'Add Photos'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
            />
          </label>
          {photos.length > 0 && photos.length < 2 && (
            <p className="text-xs text-red-500 mt-1">Add at least {2 - photos.length} more photo{2 - photos.length > 1 ? 's' : ''}</p>
          )}
          {photos.length >= 2 && <p className="text-xs text-green-600 mt-1">✓ {photos.length} photos ready</p>}
        </div>

        {/* Risk flags summary */}
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
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Complete required fields + 2 photos'}
          </button>
        </div>
      </div>
    </div>
  )
}
