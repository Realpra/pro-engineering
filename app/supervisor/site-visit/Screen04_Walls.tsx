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

type WallCondition = 'good' | 'fair' | 'poor' | ''

function WallSelector({
  label,
  value,
  onChange,
}: {
  label: string
  value: WallCondition
  onChange: (v: WallCondition) => void
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{label} Wall</p>
      <div className="flex gap-2">
        {(['good', 'fair', 'poor'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors capitalize ${
              value === opt
                ? opt === 'poor'
                  ? 'bg-red-600 border-red-600 text-white'
                  : opt === 'fair'
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-green-600 border-green-600 text-white'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {opt.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
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

export default function Screen04_Walls({ reportId, onComplete, isReview, onBack }: Props) {
  const [northWall, setNorthWall] = useState<WallCondition>('')
  const [southWall, setSouthWall] = useState<WallCondition>('')
  const [eastWall, setEastWall] = useState<WallCondition>('')
  const [westWall, setWestWall] = useState<WallCondition>('')
  const [debondedPlaster, setDebondedPlaster] = useState<boolean | null>(null)
  const [replasteringSpec, setReplasteringSpec] = useState<'rough-base' | 'smooth-finish' | 'skim-coat' | ''>('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const anyPoor = northWall === 'poor' || southWall === 'poor' || eastWall === 'poor' || westWall === 'poor'
  const allWallsSelected = !!northWall && !!southWall && !!eastWall && !!westWall
  const canSubmit = allWallsSelected && photos.length >= 4

  async function handleSubmit() {
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
      const result = await saveScreen(reportId, 4, 'screen04_walls', {
        walls: { north: northWall, south: southWall, east: eastWall, west: westWall },
        debondedPlaster: anyPoor ? debondedPlaster : null,
        replasteringSpec: replasteringSpec || null,
        notes: notes || null,
        photoUrls,
      })
      if (result.error) throw new Error(result.error)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const boolCurrent = (val: boolean | null) => (val === true ? 'yes' : val === false ? 'no' : '')

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
          <span className="text-white text-xs font-bold">04</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Wall Condition & Plastering</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Wall conditions */}
        <div className="px-5 py-4 space-y-5">
          <WallSelector label="North" value={northWall} onChange={setNorthWall} />
          <WallSelector label="South" value={southWall} onChange={setSouthWall} />
          <WallSelector label="East" value={eastWall} onChange={setEastWall} />
          <WallSelector label="West" value={westWall} onChange={setWestWall} />
        </div>

        {/* Debonded plaster (shown if any wall is POOR) */}
        {anyPoor && (
          <div className="px-5 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Debonded Plaster Present</p>
            <div className="flex gap-3">
              <TapBtn value="yes" current={boolCurrent(debondedPlaster)} onClick={(v) => setDebondedPlaster(v === 'yes')} label="YES" />
              <TapBtn value="no" current={boolCurrent(debondedPlaster)} onClick={(v) => setDebondedPlaster(v === 'yes')} label="NO" />
            </div>
          </div>
        )}

        {/* Plastering spec */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Plastering Specification</p>
          <div className="flex gap-2">
            <TapBtn value="rough-base" current={replasteringSpec} onClick={(v) => setReplasteringSpec(v as typeof replasteringSpec)} label="ROUGH BASE" />
            <TapBtn value="smooth-finish" current={replasteringSpec} onClick={(v) => setReplasteringSpec(v as typeof replasteringSpec)} label="SMOOTH FINISH" />
            <TapBtn value="skim-coat" current={replasteringSpec} onClick={(v) => setReplasteringSpec(v as typeof replasteringSpec)} label="SKIM COAT" />
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
            Wall Photos <span className="normal-case font-normal text-red-400">(minimum 4 — one per wall)</span>
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
          {photos.length > 0 && photos.length < 4 && (
            <p className="text-xs text-red-500 mt-1">Add at least {4 - photos.length} more photo{4 - photos.length > 1 ? 's' : ''}</p>
          )}
          {photos.length >= 4 && <p className="text-xs text-green-600 mt-1">✓ {photos.length} photos ready</p>}
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
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Select all walls + 4 photos'}
          </button>
        </div>
      </div>
    </div>
  )
}
