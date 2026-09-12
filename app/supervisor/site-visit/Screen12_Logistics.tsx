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

export default function Screen12_Logistics({ reportId, onComplete, isReview, onBack }: Props) {
  const [buildingFloor, setBuildingFloor] = useState<'ground' | '1' | '2' | '3' | '4' | '5+' | ''>('')
  const [liftAvailable, setLiftAvailable] = useState<boolean | null>(null)
  const [liftPermitted, setLiftPermitted] = useState<boolean | null>(null)
  const [staircaseWidth, setStaircaseWidth] = useState<'less-than-3ft' | '3-4ft' | 'more-than-4ft' | ''>('')
  const [rubbleDisposalPoint, setRubbleDisposalPoint] = useState<'within-50m' | '50-100m' | 'more-than-100m' | ''>('')
  const [societyWorkingHours, setSocietyWorkingHours] = useState<'7am-7pm' | '9am-6pm' | 'other' | ''>('')
  const [noiseRestriction, setNoiseRestriction] = useState<boolean | null>(null)
  const [parkingForMaterials, setParkingForMaterials] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boolCurrent = (val: boolean | null) => val === true ? 'yes' : val === false ? 'no' : ''

  const highFloorNoLift =
    (buildingFloor === '4' || buildingFloor === '5+') && liftAvailable === false

  const riskFlags: string[] = []
  if (highFloorNoLift) {
    riskFlags.push('High floor no lift: vertical shifting surcharge applies. Add Rs 1500 per floor above 3rd')
  }

  const canSubmit =
    !!buildingFloor &&
    !!staircaseWidth &&
    !!rubbleDisposalPoint &&
    !!societyWorkingHours

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await saveScreen(reportId, 12, 'screen12_logistics', {
        buildingFloor,
        liftAvailable,
        liftPermitted: liftAvailable === true ? liftPermitted : null,
        staircaseWidth,
        rubbleDisposalPoint,
        societyWorkingHours,
        noiseRestriction,
        parkingForMaterials,
        notes: notes || null,
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
          <span className="text-white text-xs font-bold">12</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Site Access and Vertical Logistics</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Building floor */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Building Floor</p>
          <div className="grid grid-cols-3 gap-2">
            {(['ground', '1', '2', '3', '4', '5+'] as const).map((v) => (
              <TapBtn
                key={v}
                value={v}
                current={buildingFloor}
                onClick={(val) => setBuildingFloor(val as typeof buildingFloor)}
                label={v === 'ground' ? 'GROUND' : `FLOOR ${v}`}
              />
            ))}
          </div>
        </div>

        {/* Lift available */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Lift Available</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(liftAvailable)} onClick={(v) => setLiftAvailable(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(liftAvailable)} onClick={(v) => setLiftAvailable(v === 'yes')} label="NO" />
          </div>
          {liftAvailable === true && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Lift Permitted for Materials</p>
              <div className="flex gap-3">
                <TapBtn value="yes" current={boolCurrent(liftPermitted)} onClick={(v) => setLiftPermitted(v === 'yes')} label="YES" />
                <TapBtn value="no" current={boolCurrent(liftPermitted)} onClick={(v) => setLiftPermitted(v === 'yes')} label="NO" />
              </div>
            </div>
          )}
          {highFloorNoLift && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700">High floor no lift: vertical shifting surcharge applies. Add Rs 1500 per floor above 3rd</p>
            </div>
          )}
        </div>

        {/* Staircase width */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Staircase Width</p>
          <div className="flex gap-2">
            {([
              ['less-than-3ft', '< 3 FT'],
              ['3-4ft', '3–4 FT'],
              ['more-than-4ft', '> 4 FT'],
            ] as const).map(([val, lbl]) => (
              <TapBtn key={val} value={val} current={staircaseWidth} onClick={(v) => setStaircaseWidth(v as typeof staircaseWidth)} label={lbl} />
            ))}
          </div>
        </div>

        {/* Rubble disposal */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Rubble Disposal Point</p>
          <div className="flex gap-2">
            {([
              ['within-50m', '< 50 M'],
              ['50-100m', '50–100 M'],
              ['more-than-100m', '> 100 M'],
            ] as const).map(([val, lbl]) => (
              <TapBtn key={val} value={val} current={rubbleDisposalPoint} onClick={(v) => setRubbleDisposalPoint(v as typeof rubbleDisposalPoint)} label={lbl} />
            ))}
          </div>
        </div>

        {/* Society working hours */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Society Working Hours</p>
          <div className="flex gap-2">
            {([
              ['7am-7pm', '7AM–7PM'],
              ['9am-6pm', '9AM–6PM'],
              ['other', 'OTHER'],
            ] as const).map(([val, lbl]) => (
              <TapBtn key={val} value={val} current={societyWorkingHours} onClick={(v) => setSocietyWorkingHours(v as typeof societyWorkingHours)} label={lbl} />
            ))}
          </div>
        </div>

        {/* Noise restriction */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Noise Restriction (drilling limits)</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(noiseRestriction)} onClick={(v) => setNoiseRestriction(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(noiseRestriction)} onClick={(v) => setNoiseRestriction(v === 'yes')} label="NO" />
          </div>
        </div>

        {/* Parking */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Parking for Materials Vehicle</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(parkingForMaterials)} onClick={(v) => setParkingForMaterials(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(parkingForMaterials)} onClick={(v) => setParkingForMaterials(v === 'yes')} label="NO" />
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
            {submitting ? 'Saving...' : canSubmit ? 'Save & Continue' : 'Complete all required fields'}
          </button>
        </div>
      </div>
    </div>
  )
}
