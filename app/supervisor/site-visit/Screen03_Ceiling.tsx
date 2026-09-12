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

function TapBtn({
  value,
  current,
  onClick,
  label,
  color = 'default',
}: {
  value: string
  current: string
  onClick: (v: string) => void
  label: string
  color?: 'default' | 'amber'
}) {
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

export default function Screen03_Ceiling({ reportId, onComplete, isReview, onBack }: Props) {
  const [ceilingCondition, setCeilingCondition] = useState<'good' | 'damp-stains' | 'cracks' | 'poor' | ''>('')
  const [ceilingScope, setCeilingScope] = useState<'paint-only' | 'plaster-repair' | 'false-ceiling' | 'no-work' | ''>('')
  const [falseCeilingMaterial, setFalseCeilingMaterial] = useState<'gypsum' | 'pvc' | ''>('')
  const [exhaustDuct, setExhaustDuct] = useState<'existing-functional' | 'new-required' | 'not-applicable' | ''>('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const riskFlags: string[] = []
  if (ceilingCondition === 'damp-stains') {
    riskFlags.push('Ceiling damp stains: waterproofing from above required. Coordinator review needed')
  }

  const canSubmit = !!ceilingCondition && !!ceilingScope && !!exhaustDuct && photos.length >= 1

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const supabase = createClient()
      const photoUrls = await Promise.all(
        photos.map(async (photo, i) => {
          const ext = photo.name.split('.').pop() ?? 'jpg'
          const path = `${reportId}/screen03/${Date.now()}-${i}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('site-log-photos')
            .upload(path, photo, { upsert: true })
          if (upErr) throw new Error(upErr.message)
          return path
        })
      )
      const result = await saveScreen(reportId, 3, 'screen03_ceiling', {
        ceilingCondition,
        ceilingScope,
        falseCeilingMaterial: ceilingScope === 'false-ceiling' ? falseCeilingMaterial || null : null,
        exhaustDuct,
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
          <span className="text-white text-xs font-bold">03</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Ceiling Scope</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Ceiling condition */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Ceiling Condition</p>
          <div className="grid grid-cols-2 gap-2">
            <TapBtn value="good" current={ceilingCondition} onClick={(v) => setCeilingCondition(v as typeof ceilingCondition)} label="GOOD" />
            <TapBtn value="damp-stains" current={ceilingCondition} onClick={(v) => setCeilingCondition(v as typeof ceilingCondition)} label="DAMP STAINS" color="amber" />
            <TapBtn value="cracks" current={ceilingCondition} onClick={(v) => setCeilingCondition(v as typeof ceilingCondition)} label="CRACKS" color="amber" />
            <TapBtn value="poor" current={ceilingCondition} onClick={(v) => setCeilingCondition(v as typeof ceilingCondition)} label="POOR" color="amber" />
          </div>
          {ceilingCondition === 'damp-stains' && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">Ceiling damp stains: waterproofing from above required. Coordinator review needed</p>
            </div>
          )}
        </div>

        {/* Ceiling scope */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Ceiling Scope</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['paint-only', 'PAINT ONLY'],
              ['plaster-repair', 'PLASTER REPAIR'],
              ['false-ceiling', 'FALSE CEILING'],
              ['no-work', 'NO WORK'],
            ] as const).map(([val, lbl]) => (
              <TapBtn key={val} value={val} current={ceilingScope} onClick={(v) => setCeilingScope(v as typeof ceilingScope)} label={lbl} />
            ))}
          </div>
          {ceilingScope === 'false-ceiling' && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">False Ceiling Material</p>
              <div className="flex gap-2">
                <TapBtn value="gypsum" current={falseCeilingMaterial} onClick={(v) => setFalseCeilingMaterial(v as typeof falseCeilingMaterial)} label="GYPSUM" />
                <TapBtn value="pvc" current={falseCeilingMaterial} onClick={(v) => setFalseCeilingMaterial(v as typeof falseCeilingMaterial)} label="PVC" />
              </div>
            </div>
          )}
        </div>

        {/* Exhaust duct */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Exhaust Duct</p>
          <div className="flex gap-2">
            {([
              ['existing-functional', 'EXISTING OK'],
              ['new-required', 'NEW REQUIRED'],
              ['not-applicable', 'N/A'],
            ] as const).map(([val, lbl]) => (
              <TapBtn key={val} value={val} current={exhaustDuct} onClick={(v) => setExhaustDuct(v as typeof exhaustDuct)} label={lbl} />
            ))}
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
            Ceiling Photos <span className="normal-case font-normal text-red-400">(minimum 1 required)</span>
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
          {photos.length >= 1 && <p className="text-xs text-green-600 mt-1">✓ {photos.length} photos ready</p>}
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
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Complete required fields + 1 photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
