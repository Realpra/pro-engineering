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
      className={`flex-1 py-4 rounded-xl text-sm font-bold border-2 transition-colors ${
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

export default function Screen09_Demolition({ reportId, onComplete, isReview, onBack }: Props) {
  const [floorStatus, setFloorStatus] = useState<'tile-over-tile' | 'full-demolition' | ''>('')
  const [demolitionArea, setDemolitionArea] = useState('')
  const [wallSubstrate, setWallSubstrate] = useState<'plumb' | 'uneven' | ''>('')
  const [existingWallTileHeight, setExistingWallTileHeight] = useState('')
  const [targetWallTileHeight, setTargetWallTileHeight] = useState('')
  const [wallRemoval, setWallRemoval] = useState<boolean | null>(null)
  const [loadBearing, setLoadBearing] = useState<'yes' | 'no' | 'unsure' | ''>('')
  const [structuralCracks, setStructuralCracks] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const riskFlags: string[] = []
  if (loadBearing === 'yes' || loadBearing === 'unsure') {
    riskFlags.push('Structural risk — civil engineer assessment required')
  }
  if (structuralCracks === true) {
    riskFlags.push('Structural cracks found — assessment required')
  }

  const canSubmit =
    !!floorStatus && !!wallSubstrate && wallRemoval !== null && photos.length >= 2

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const supabase = createClient()
      const photoUrls = await Promise.all(
        photos.map(async (photo, i) => {
          const ext = photo.name.split('.').pop() ?? 'jpg'
          const path = `${reportId}/screen09/${Date.now()}-${i}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('site-log-photos')
            .upload(path, photo, { upsert: true })
          if (upErr) throw new Error(upErr.message)
          return path
        })
      )
      const result = await saveScreen(reportId, 9, 'screen09_demolition', {
        floorStatus,
        demolitionArea: demolitionArea || null,
        wallSubstrate,
        existingWallTileHeight: existingWallTileHeight || null,
        targetWallTileHeight: targetWallTileHeight || null,
        wallRemoval,
        loadBearing: wallRemoval ? loadBearing || null : null,
        structuralCracks,
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
          <span className="text-white text-xs font-bold">09</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Demolition & Substrate</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Floor slab */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Floor Slab Status</p>
          <div className="flex gap-3">
            <TapBtn value="tile-over-tile" current={floorStatus} onClick={(v) => setFloorStatus(v as typeof floorStatus)} label="TILE-OVER-TILE" />
            <TapBtn value="full-demolition" current={floorStatus} onClick={(v) => setFloorStatus(v as typeof floorStatus)} label="FULL DEMOLITION" />
          </div>
          {floorStatus === 'full-demolition' && (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-500 mb-2">Demolition Area (sq ft)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDemolitionArea((v) => String(Math.max(0, parseFloat(v || '0') - 1)))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={demolitionArea}
                  onChange={(e) => setDemolitionArea(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                />
                <button
                  type="button"
                  onClick={() => setDemolitionArea((v) => String(parseFloat(v || '0') + 1))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Wall substrate */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Wall Substrate</p>
          <div className="flex gap-3">
            <TapBtn value="plumb" current={wallSubstrate} onClick={(v) => setWallSubstrate(v as typeof wallSubstrate)} label="PLUMB" />
            <TapBtn value="uneven" current={wallSubstrate} onClick={(v) => setWallSubstrate(v as typeof wallSubstrate)} label="UNEVEN" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Existing Wall Tile Height (ft)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExistingWallTileHeight((v) => String(Math.max(0, parseFloat(v || '0') - 1)))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={existingWallTileHeight}
                  onChange={(e) => setExistingWallTileHeight(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                />
                <button
                  type="button"
                  onClick={() => setExistingWallTileHeight((v) => String(parseFloat(v || '0') + 1))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Target Wall Tile Height (ft)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetWallTileHeight((v) => String(Math.max(0, parseFloat(v || '0') - 1)))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={targetWallTileHeight}
                  onChange={(e) => setTargetWallTileHeight(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                />
                <button
                  type="button"
                  onClick={() => setTargetWallTileHeight((v) => String(parseFloat(v || '0') + 1))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Wall removal */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Wall Removal Required</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={wallRemoval === true ? 'yes' : wallRemoval === false ? 'no' : ''} onClick={(v) => setWallRemoval(v === 'yes')} label="YES" />
            <TapBtn value="no" current={wallRemoval === true ? 'yes' : wallRemoval === false ? 'no' : ''} onClick={(v) => setWallRemoval(v === 'yes')} label="NO" />
          </div>

          {wallRemoval === true && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Load Bearing Wall?</p>
              <div className="flex gap-2">
                <TapBtn value="yes" current={loadBearing} onClick={(v) => setLoadBearing(v as typeof loadBearing)} label="YES" color="amber" />
                <TapBtn value="no" current={loadBearing} onClick={(v) => setLoadBearing(v as typeof loadBearing)} label="NO" />
                <TapBtn value="unsure" current={loadBearing} onClick={(v) => setLoadBearing(v as typeof loadBearing)} label="NOT SURE" color="amber" />
              </div>
              {(loadBearing === 'yes' || loadBearing === 'unsure') && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-bold text-amber-700">Structural risk — civil engineer assessment required</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Structural cracks */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Structural Cracks Visible</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={structuralCracks === true ? 'yes' : structuralCracks === false ? 'no' : ''} onClick={(v) => setStructuralCracks(v === 'yes')} label="YES" color="amber" />
            <TapBtn value="no" current={structuralCracks === true ? 'yes' : structuralCracks === false ? 'no' : ''} onClick={(v) => setStructuralCracks(v === 'yes')} label="NO" />
          </div>
          {structuralCracks === true && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">Structural cracks found — assessment required</p>
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
          {photos.length >= 2 && (
            <p className="text-xs text-green-600 mt-1">✓ {photos.length} photos ready</p>
          )}
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
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Complete all fields + 2 photos'}
          </button>
        </div>
      </div>
    </div>
  )
}
