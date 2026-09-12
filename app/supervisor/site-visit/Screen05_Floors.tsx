'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  onComplete: () => void
  isReview?: boolean
  onBack?: () => void
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

export default function Screen05_Floors({ reportId, onComplete, isReview, onBack }: Props) {
  const [floorCondition, setFloorCondition] = useState<'intact' | 'hollow' | 'bare-concrete' | ''>('')
  const [floorFall, setFloorFall] = useState<'adequate' | 'inadequate' | 'unknown' | ''>('')
  const [drainType, setDrainType] = useState<'p-trap' | 'floor-trap' | 'unknown' | ''>('')
  const [drainCondition, setDrainCondition] = useState<'clear' | 'slow' | 'blocked' | ''>('')
  const [screedRequired, setScreedRequired] = useState<'full' | 'partial' | 'none' | ''>('')
  const [screedSpec, setScreedSpec] = useState<'standard' | 'waterproof' | 'self-levelling' | ''>('')
  const [fallDirection, setFallDirection] = useState<'centre' | 'corner' | 'door-threshold' | ''>('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const riskFlags: string[] = []
  if (drainCondition === 'slow' || drainCondition === 'blocked') {
    riskFlags.push('Drain issue found: clearing required before tiling')
  }
  if (floorFall === 'inadequate') {
    riskFlags.push('Poor floor fall: screed correction required')
  }

  const missingFields: string[] = []
  if (!floorCondition) missingFields.push('Floor Condition')
  if (!floorFall) missingFields.push('Floor Fall')
  if (!drainType) missingFields.push('Drain Type')
  if (!drainCondition) missingFields.push('Drain Condition')
  if (!screedRequired) missingFields.push('Screed Required')
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
          const path = `${reportId}/screen05/${Date.now()}-${i}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('site-log-photos')
            .upload(path, photo, { upsert: true })
          if (upErr) throw new Error(upErr.message)
          return path
        })
      )
      const result = await saveScreen(reportId, 5, 'screen05_floors', {
        floorCondition,
        floorFall,
        drainType,
        drainCondition,
        screedRequired,
        screedSpec: (screedRequired === 'full' || screedRequired === 'partial') ? screedSpec || null : null,
        fallDirection: fallDirection || null,
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
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">05</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Floor Condition & Screed</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Floor condition */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Floor Condition</p>
          <div className="flex gap-2">
            <TapBtn value="intact" current={floorCondition} onClick={(v) => setFloorCondition(v as typeof floorCondition)} label="INTACT" />
            <TapBtn value="hollow" current={floorCondition} onClick={(v) => setFloorCondition(v as typeof floorCondition)} label="HOLLOW" color="amber" />
            <TapBtn value="bare-concrete" current={floorCondition} onClick={(v) => setFloorCondition(v as typeof floorCondition)} label="BARE CONCRETE" />
          </div>
        </div>

        {/* Floor fall */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Floor Fall</p>
          <div className="flex gap-2">
            <TapBtn value="adequate" current={floorFall} onClick={(v) => setFloorFall(v as typeof floorFall)} label="ADEQUATE" />
            <TapBtn value="inadequate" current={floorFall} onClick={(v) => setFloorFall(v as typeof floorFall)} label="INADEQUATE" color="amber" />
            <TapBtn value="unknown" current={floorFall} onClick={(v) => setFloorFall(v as typeof floorFall)} label="UNKNOWN" />
          </div>
          {floorFall === 'inadequate' && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">Poor floor fall: screed correction required</p>
            </div>
          )}
        </div>

        {/* Drain type */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Drain Type</p>
          <div className="flex gap-2">
            <TapBtn value="p-trap" current={drainType} onClick={(v) => setDrainType(v as typeof drainType)} label="P-TRAP" />
            <TapBtn value="floor-trap" current={drainType} onClick={(v) => setDrainType(v as typeof drainType)} label="FLOOR TRAP" />
            <TapBtn value="unknown" current={drainType} onClick={(v) => setDrainType(v as typeof drainType)} label="UNKNOWN" />
          </div>
        </div>

        {/* Drain condition */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Drain Condition</p>
          <div className="flex gap-2">
            <TapBtn value="clear" current={drainCondition} onClick={(v) => setDrainCondition(v as typeof drainCondition)} label="CLEAR" />
            <TapBtn value="slow" current={drainCondition} onClick={(v) => setDrainCondition(v as typeof drainCondition)} label="SLOW" color="amber" />
            <TapBtn value="blocked" current={drainCondition} onClick={(v) => setDrainCondition(v as typeof drainCondition)} label="BLOCKED" color="amber" />
          </div>
          {(drainCondition === 'slow' || drainCondition === 'blocked') && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">Drain issue found: clearing required before tiling</p>
            </div>
          )}
        </div>

        {/* Screed required */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Screed Required</p>
          <div className="flex gap-2">
            <TapBtn value="full" current={screedRequired} onClick={(v) => { setScreedRequired(v as typeof screedRequired); if (v === 'none') setScreedSpec('') }} label="FULL" />
            <TapBtn value="partial" current={screedRequired} onClick={(v) => { setScreedRequired(v as typeof screedRequired); if (v === 'none') setScreedSpec('') }} label="PARTIAL" />
            <TapBtn value="none" current={screedRequired} onClick={(v) => { setScreedRequired(v as typeof screedRequired); setScreedSpec('') }} label="NONE" />
          </div>

          {(screedRequired === 'full' || screedRequired === 'partial') && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Screed Specification</p>
              <div className="flex gap-2">
                <TapBtn value="standard" current={screedSpec} onClick={(v) => setScreedSpec(v as typeof screedSpec)} label="STANDARD" />
                <TapBtn value="waterproof" current={screedSpec} onClick={(v) => setScreedSpec(v as typeof screedSpec)} label="WATERPROOF" />
                <TapBtn value="self-levelling" current={screedSpec} onClick={(v) => setScreedSpec(v as typeof screedSpec)} label="SELF-LEVEL" />
              </div>
            </div>
          )}
        </div>

        {/* Fall direction */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Fall Direction</p>
          <div className="flex gap-2">
            <TapBtn value="centre" current={fallDirection} onClick={(v) => setFallDirection(v as typeof fallDirection)} label="CENTRE" />
            <TapBtn value="corner" current={fallDirection} onClick={(v) => setFallDirection(v as typeof fallDirection)} label="CORNER" />
            <TapBtn value="door-threshold" current={fallDirection} onClick={(v) => setFallDirection(v as typeof fallDirection)} label="DOOR THRESHOLD" />
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

        {/* Photos */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Floor Photos <span className="normal-case font-normal text-red-400">(minimum 2 required)</span>
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
            <p className="text-xs text-red-500 mt-1">Add 1 more photo</p>
          )}
          {photos.length >= 2 && <p className="text-xs text-green-600 mt-1">✓ {photos.length} photos ready</p>}
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
