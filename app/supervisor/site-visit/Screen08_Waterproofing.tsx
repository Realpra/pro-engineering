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

export default function Screen08_Waterproofing({ reportId, onComplete, isReview, onBack }: Props) {
  const [dampEvidence, setDampEvidence] = useState<boolean | null>(null)
  const [dampLocation, setDampLocation] = useState<'floor-wall' | 'wall-wall' | 'ceiling-below' | 'multiple' | ''>('')
  const [efflorescence, setEfflorescence] = useState<boolean | null>(null)
  const [hollowTiles, setHollowTiles] = useState<boolean | null>(null)
  const [existingSystem, setExistingSystem] = useState<'crystalline' | 'bituminous' | 'none' | 'unknown' | ''>('')
  const [sunkenToilet, setSunkenToilet] = useState<boolean | null>(null)
  const [proposedSystem, setProposedSystem] = useState<'elastomeric' | 'crystalline' | 'cementitious' | ''>('')
  const [waterproofingArea, setWaterproofingArea] = useState<'floor-only' | 'floor-300mm' | 'floor-full-wall' | ''>('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const riskFlags: string[] = []
  if (dampEvidence === true) riskFlags.push('Existing waterproofing failure: additional treatment required. Cost allowance Rs 2800')
  if (efflorescence === true) riskFlags.push('Efflorescence found: salt deposits indicate moisture ingress')
  if (hollowTiles === true) riskFlags.push('Hollow tiles found: debonding indicates waterproofing failure')

  const photoMin = dampEvidence === true ? 3 : 1

  const missingFields: string[] = []
  if (dampEvidence === null) missingFields.push('Damp Evidence')
  if (efflorescence === null) missingFields.push('Efflorescence')
  if (hollowTiles === null) missingFields.push('Hollow Tiles')
  if (!proposedSystem) missingFields.push('Proposed System')
  if (!waterproofingArea) missingFields.push('Waterproofing Area')
  if (photos.length < photoMin) missingFields.push(`Photos (${Math.max(0, photoMin - photos.length)} more needed)`)

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
          const path = `${reportId}/screen08/${Date.now()}-${i}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('site-log-photos')
            .upload(path, photo, { upsert: true })
          if (upErr) throw new Error(upErr.message)
          return path
        })
      )
      const result = await saveScreen(reportId, 8, 'screen08_waterproofing', {
        dampEvidence,
        dampLocation: dampEvidence ? dampLocation || null : null,
        efflorescence,
        hollowTiles,
        existingSystem: existingSystem || null,
        sunkenToilet,
        proposedSystem,
        waterproofingArea,
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

  const boolCurrent = (val: boolean | null) => val === true ? 'yes' : val === false ? 'no' : ''
  const boolSet = (setter: (v: boolean) => void) => (v: string) => setter(v === 'yes')

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
          <span className="text-white text-xs font-bold">08</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Waterproofing Assessment</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Damp evidence */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Damp Evidence</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(dampEvidence)} onClick={boolSet(setDampEvidence)} label="YES" color="amber" />
            <TapBtn value="no" current={boolCurrent(dampEvidence)} onClick={boolSet(setDampEvidence)} label="NO" />
          </div>
          {dampEvidence === true && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Damp Location</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['floor-wall', 'Floor–Wall Jn.'],
                  ['wall-wall', 'Wall–Wall Jn.'],
                  ['ceiling-below', 'Ceiling Below'],
                  ['multiple', 'Multiple Areas'],
                ] as const).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDampLocation(val)}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                      dampLocation === val
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-bold text-amber-700">Existing waterproofing failure: additional treatment required. Cost allowance Rs 2800</p>
              </div>
            </div>
          )}
        </div>

        {/* Efflorescence */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Efflorescence (Salt Deposits)</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(efflorescence)} onClick={boolSet(setEfflorescence)} label="YES" color="amber" />
            <TapBtn value="no" current={boolCurrent(efflorescence)} onClick={boolSet(setEfflorescence)} label="NO" />
          </div>
          {efflorescence === true && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">Efflorescence found: salt deposits indicate moisture ingress</p>
            </div>
          )}
        </div>

        {/* Hollow tiles */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Hollow Tiles</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(hollowTiles)} onClick={boolSet(setHollowTiles)} label="YES" color="amber" />
            <TapBtn value="no" current={boolCurrent(hollowTiles)} onClick={boolSet(setHollowTiles)} label="NO" />
          </div>
          {hollowTiles === true && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">Hollow tiles found: debonding indicates waterproofing failure</p>
            </div>
          )}
        </div>

        {/* Existing system */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Existing Waterproofing System</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['crystalline', 'Crystalline'],
              ['bituminous', 'Bituminous'],
              ['none', 'None'],
              ['unknown', 'Unknown'],
            ] as const).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setExistingSystem(val)}
                className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                  existingSystem === val
                    ? 'bg-[#1F3864] border-[#1F3864] text-white'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Sunken toilet */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Sunken Toilet</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(sunkenToilet)} onClick={boolSet(setSunkenToilet)} label="YES" />
            <TapBtn value="no" current={boolCurrent(sunkenToilet)} onClick={boolSet(setSunkenToilet)} label="NO" />
          </div>
        </div>

        {/* Proposed system */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Proposed Waterproofing System</p>
          <div className="flex gap-2">
            <TapBtn value="elastomeric" current={proposedSystem} onClick={(v) => setProposedSystem(v as typeof proposedSystem)} label="ELASTOMERIC" />
            <TapBtn value="crystalline" current={proposedSystem} onClick={(v) => setProposedSystem(v as typeof proposedSystem)} label="CRYSTALLINE" />
            <TapBtn value="cementitious" current={proposedSystem} onClick={(v) => setProposedSystem(v as typeof proposedSystem)} label="CEMENTITIOUS" />
          </div>
        </div>

        {/* Waterproofing area */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Waterproofing Area</p>
          <div className="flex flex-col gap-2">
            {([
              ['floor-only', 'Floor Only'],
              ['floor-300mm', 'Floor + 300mm Wall Upstand'],
              ['floor-full-wall', 'Floor + Full Wall Height'],
            ] as const).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setWaterproofingArea(val)}
                className={`w-full py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                  waterproofingArea === val
                    ? 'bg-[#1F3864] border-[#1F3864] text-white'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {lbl}
              </button>
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
            Site Photos{' '}
            <span className="normal-case font-normal text-red-400">
              (minimum {photoMin} required{dampEvidence === true ? ' — damp evidence found' : ''})
            </span>
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
          {photos.length > 0 && photos.length < photoMin && (
            <p className="text-xs text-red-500 mt-1">Add at least {photoMin - photos.length} more photo{photoMin - photos.length > 1 ? 's' : ''}</p>
          )}
          {photos.length >= photoMin && photos.length > 0 && (
            <p className="text-xs text-green-600 mt-1">✓ {photos.length} photos ready</p>
          )}
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
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Complete required fields + photos'}
          </button>
        </div>
      </div>
    </div>
  )
}
