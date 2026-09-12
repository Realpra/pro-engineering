'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  onComplete: () => void
  isReview?: boolean
  onBack?: () => void
  showFullElectrical?: boolean
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

export default function Screen07_Electrical({ reportId, onComplete, isReview, onBack, showFullElectrical = true }: Props) {
  const [exhaustFan, setExhaustFan] = useState<'present-working' | 'present-faulty' | 'absent' | ''>('')
  const [lightFittings, setLightFittings] = useState<'ip44' | 'non-ip' | 'absent' | ''>('')
  const [geyser, setGeyser] = useState<'present-working' | 'present-faulty' | 'absent' | ''>('')
  const [geyserCapacity, setGeyserCapacity] = useState<'6l' | '10l' | '15l' | '25l' | ''>('')
  const [switchboard, setSwitchboard] = useState<'inside' | 'outside' | ''>('')
  const [elcb, setElcb] = useState<'present' | 'absent' | 'unknown' | ''>('')
  const [newExhaustPoints, setNewExhaustPoints] = useState('')
  const [newSocketPoints, setNewSocketPoints] = useState('')
  const [newGeyserPoints, setNewGeyserPoints] = useState('')
  const [newLightPoints, setNewLightPoints] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const riskFlags: string[] = []
  if (lightFittings === 'non-ip') {
    riskFlags.push('Non-compliant wet zone fittings — replacement to IP44 mandatory. Cost allowance Rs 1200')
  }
  if (elcb === 'absent') {
    riskFlags.push('No earth leakage protection — ELCB installation recommended. Cost allowance Rs 800')
  }

  const missingFields: string[] = []
  if (!exhaustFan) missingFields.push('Exhaust Fan')
  if (!lightFittings) missingFields.push('Light Fittings')
  if (!geyser) missingFields.push('Geyser')
  if (!elcb) missingFields.push('ELCB')
  if (photos.length < 1) missingFields.push('Photo (at least 1 required)')

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
          const path = `${reportId}/screen07/${Date.now()}-${i}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('site-log-photos')
            .upload(path, photo, { upsert: true })
          if (upErr) throw new Error(upErr.message)
          return path
        })
      )
      const result = await saveScreen(reportId, 7, 'screen07_electrical', {
        exhaustFan,
        lightFittings,
        geyser,
        geyserCapacity: (geyser === 'present-working' || geyser === 'present-faulty') ? geyserCapacity || null : null,
        switchboard: switchboard || null,
        elcb,
        newPoints: {
          exhaust: newExhaustPoints ? parseInt(newExhaustPoints) : 0,
          socket: newSocketPoints ? parseInt(newSocketPoints) : 0,
          geyser: newGeyserPoints ? parseInt(newGeyserPoints) : 0,
          light: newLightPoints ? parseInt(newLightPoints) : 0,
        },
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

  const geyserPresent = geyser === 'present-working' || geyser === 'present-faulty'

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
      {!showFullElectrical && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs font-bold text-blue-700">Scope: Retaining existing electrical — documentation only</p>
        </div>
      )}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">07</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Electrical</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Exhaust fan */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Exhaust Fan</p>
          <div className="flex gap-2">
            <TapBtn value="present-working" current={exhaustFan} onClick={(v) => setExhaustFan(v as typeof exhaustFan)} label="WORKING" />
            <TapBtn value="present-faulty" current={exhaustFan} onClick={(v) => setExhaustFan(v as typeof exhaustFan)} label="FAULTY" color="amber" />
            <TapBtn value="absent" current={exhaustFan} onClick={(v) => setExhaustFan(v as typeof exhaustFan)} label="ABSENT" />
          </div>
        </div>

        {/* Light fittings */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Light Fittings</p>
          <div className="flex gap-2">
            <TapBtn value="ip44" current={lightFittings} onClick={(v) => setLightFittings(v as typeof lightFittings)} label="IP44" />
            <TapBtn value="non-ip" current={lightFittings} onClick={(v) => setLightFittings(v as typeof lightFittings)} label="NON-IP" color="amber" />
            <TapBtn value="absent" current={lightFittings} onClick={(v) => setLightFittings(v as typeof lightFittings)} label="ABSENT" />
          </div>
          {lightFittings === 'non-ip' && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">Non-compliant wet zone fittings — replacement to IP44 mandatory. Cost allowance Rs 1200</p>
            </div>
          )}
        </div>

        {/* Geyser */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Geyser</p>
          <div className="flex gap-2">
            <TapBtn value="present-working" current={geyser} onClick={(v) => { setGeyser(v as typeof geyser); if (v === 'absent') setGeyserCapacity('') }} label="WORKING" />
            <TapBtn value="present-faulty" current={geyser} onClick={(v) => { setGeyser(v as typeof geyser); if (v === 'absent') setGeyserCapacity('') }} label="FAULTY" color="amber" />
            <TapBtn value="absent" current={geyser} onClick={(v) => { setGeyser(v as typeof geyser); setGeyserCapacity('') }} label="ABSENT" />
          </div>
          {geyserPresent && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Geyser Capacity</p>
              <div className="flex gap-2">
                {(['6l', '10l', '15l', '25l'] as const).map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setGeyserCapacity(cap)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                      geyserCapacity === cap
                        ? 'bg-[#1F3864] border-[#1F3864] text-white'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {cap.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Switchboard location */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Switchboard Location</p>
          <div className="flex gap-3">
            <TapBtn value="inside" current={switchboard} onClick={(v) => setSwitchboard(v as typeof switchboard)} label="INSIDE" />
            <TapBtn value="outside" current={switchboard} onClick={(v) => setSwitchboard(v as typeof switchboard)} label="OUTSIDE" />
          </div>
        </div>

        {/* ELCB */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Earth Leakage Circuit Breaker (ELCB)</p>
          <div className="flex gap-2">
            <TapBtn value="present" current={elcb} onClick={(v) => setElcb(v as typeof elcb)} label="PRESENT" />
            <TapBtn value="absent" current={elcb} onClick={(v) => setElcb(v as typeof elcb)} label="ABSENT" color="amber" />
            <TapBtn value="unknown" current={elcb} onClick={(v) => setElcb(v as typeof elcb)} label="UNKNOWN" />
          </div>
          {elcb === 'absent' && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">No earth leakage protection — ELCB installation recommended. Cost allowance Rs 800</p>
            </div>
          )}
        </div>

        {/* New points */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">New Points Required</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['Exhaust points', newExhaustPoints, setNewExhaustPoints],
              ['Socket points', newSocketPoints, setNewSocketPoints],
              ['Geyser points', newGeyserPoints, setNewGeyserPoints],
              ['Light points', newLightPoints, setNewLightPoints],
            ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-gray-500 mb-2">{label}</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setter(String(Math.max(0, parseFloat(val || '0') - 1)))}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full border border-gray-200 rounded-xl p-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setter(String(parseFloat(val || '0') + 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xl active:bg-gray-200 shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>
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
            Site Photos <span className="normal-case font-normal text-red-400">(minimum 1 required)</span>
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
          {photos.length >= 1 && <p className="text-xs text-green-600 mt-1">✓ {photos.length} photo{photos.length > 1 ? 's' : ''} ready</p>}
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
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Complete required fields + 1 photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
