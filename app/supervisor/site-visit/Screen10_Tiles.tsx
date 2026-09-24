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
  badge,
}: {
  value: string
  current: string
  onClick: (v: string) => void
  label: string
  badge?: string
}) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors relative ${
        active
          ? 'bg-[#1F3864] border-[#1F3864] text-white'
          : 'bg-white border-gray-200 text-gray-600'
      }`}
    >
      {label}
      {badge && (
        <span className="absolute -top-2 -right-1 text-[9px] bg-green-500 text-white px-1 py-0.5 rounded font-bold">
          {badge}
        </span>
      )}
    </button>
  )
}

export default function Screen10_Tiles({ reportId, onComplete, isReview, onBack }: Props) {
  const [floorTileFormat, setFloorTileFormat] = useState<'600x600' | '600x1200' | '300x300' | 'other' | ''>('')
  const [floorTileType, setFloorTileType] = useState<'matt-vitrified' | 'glossy-vitrified' | 'matt-ceramic' | 'anti-skid' | ''>('')
  const [floorTileTier, setFloorTileTier] = useState<'premium' | 'value' | 'budget' | ''>('')
  const [wallTileFormat, setWallTileFormat] = useState<'600x600' | '300x600' | '300x300' | 'other' | ''>('')
  const [wallTileType, setWallTileType] = useState<'glossy-ceramic' | 'matt-ceramic' | 'glossy-vitrified' | 'digital-print' | ''>('')
  const [wallTileTier, setWallTileTier] = useState<'premium' | 'value' | 'budget' | ''>('')
  const [skirting, setSkirting] = useState<'integrated' | 'none' | 'separate' | ''>('')
  const [featureWall, setFeatureWall] = useState<boolean | null>(null)
  const [adhesiveType, setAdhesiveType] = useState<'standard' | 'high-flex' | 'rapid-set' | ''>('')
  const [groutType, setGroutType] = useState<'standard' | 'epoxy' | ''>('')
  const [clientSuppliesTiles, setClientSuppliesTiles] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boolCurrent = (val: boolean | null) => val === true ? 'yes' : val === false ? 'no' : ''

  const canSubmit =
    !!floorTileFormat &&
    !!floorTileType &&
    !!floorTileTier &&
    !!wallTileFormat &&
    !!wallTileType &&
    !!wallTileTier &&
    !!adhesiveType &&
    !!groutType &&
    clientSuppliesTiles !== null

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await saveScreen(reportId, 10, 'screen10_tiles', {
        floorTileFormat,
        floorTileType,
        floorTileTier,
        wallTileFormat,
        wallTileType,
        wallTileTier,
        skirting: skirting || null,
        featureWall,
        adhesiveType,
        groutType,
        clientSuppliesTiles,
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
          <span className="text-white text-xs font-bold">10</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Tile Specification and Material Selection</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Floor tile format */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Floor Tile Format</p>
          <div className="grid grid-cols-2 gap-2">
            {(['600x600', '600x1200', '300x300', 'other'] as const).map((v) => (
              <TapBtn key={v} value={v} current={floorTileFormat} onClick={(val) => setFloorTileFormat(val as typeof floorTileFormat)} label={v.toUpperCase()} />
            ))}
          </div>
        </div>

        {/* Floor tile type */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Floor Tile Type</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['matt-vitrified', 'MATT VITRIFIED'],
              ['glossy-vitrified', 'GLOSSY VITRIFIED'],
              ['matt-ceramic', 'MATT CERAMIC'],
              ['anti-skid', 'ANTI-SKID'],
            ] as const).map(([val, lbl]) => (
              <TapBtn key={val} value={val} current={floorTileType} onClick={(v) => setFloorTileType(v as typeof floorTileType)} label={lbl} />
            ))}
          </div>
        </div>

        {/* Floor tile tier */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Floor Tile Tier</p>
          <div className="flex gap-2">
            {(['premium', 'value', 'budget'] as const).map((v) => (
              <TapBtn key={v} value={v} current={floorTileTier} onClick={(val) => setFloorTileTier(val as typeof floorTileTier)} label={v.toUpperCase()} />
            ))}
          </div>
        </div>

        {/* Wall tile format */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Wall Tile Format</p>
          <div className="grid grid-cols-2 gap-2">
            {(['600x600', '300x600', '300x300', 'other'] as const).map((v) => (
              <TapBtn key={v} value={v} current={wallTileFormat} onClick={(val) => setWallTileFormat(val as typeof wallTileFormat)} label={v.toUpperCase()} />
            ))}
          </div>
        </div>

        {/* Wall tile type */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Wall Tile Type</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['glossy-ceramic', 'GLOSSY CERAMIC'],
              ['matt-ceramic', 'MATT CERAMIC'],
              ['glossy-vitrified', 'GLOSSY VITRIFIED'],
              ['digital-print', 'DIGITAL PRINT'],
            ] as const).map(([val, lbl]) => (
              <TapBtn key={val} value={val} current={wallTileType} onClick={(v) => setWallTileType(v as typeof wallTileType)} label={lbl} />
            ))}
          </div>
        </div>

        {/* Wall tile tier */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Wall Tile Tier</p>
          <div className="flex gap-2">
            {(['premium', 'value', 'budget'] as const).map((v) => (
              <TapBtn key={v} value={v} current={wallTileTier} onClick={(val) => setWallTileTier(val as typeof wallTileTier)} label={v.toUpperCase()} />
            ))}
          </div>
        </div>

        {/* Skirting */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Skirting</p>
          <div className="flex gap-2">
            {(['integrated', 'separate', 'none'] as const).map((v) => (
              <TapBtn key={v} value={v} current={skirting} onClick={(val) => setSkirting(val as typeof skirting)} label={v.toUpperCase()} />
            ))}
          </div>
        </div>

        {/* Feature wall */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Feature Wall</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(featureWall)} onClick={(v) => setFeatureWall(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(featureWall)} onClick={(v) => setFeatureWall(v === 'yes')} label="NO" />
          </div>
        </div>

        {/* Adhesive type */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Adhesive Type</p>
          <div className="flex gap-2">
            {([
              ['standard', 'STANDARD'],
              ['high-flex', 'HIGH FLEX'],
              ['rapid-set', 'RAPID SET'],
            ] as const).map(([val, lbl]) => (
              <TapBtn key={val} value={val} current={adhesiveType} onClick={(v) => setAdhesiveType(v as typeof adhesiveType)} label={lbl} />
            ))}
          </div>
        </div>

        {/* Grout type */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Grout Type</p>
          <div className="flex gap-3">
            <TapBtn value="standard" current={groutType} onClick={(v) => setGroutType(v as typeof groutType)} label="STANDARD" />
            <TapBtn value="epoxy" current={groutType} onClick={(v) => setGroutType(v as typeof groutType)} label="EPOXY" badge="WET ZONE" />
          </div>
        </div>

        {/* Client supplies tiles */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Client Supplies Tiles</p>
          <div className="flex gap-3">
            <TapBtn value="yes" current={boolCurrent(clientSuppliesTiles)} onClick={(v) => setClientSuppliesTiles(v === 'yes')} label="YES" />
            <TapBtn value="no" current={boolCurrent(clientSuppliesTiles)} onClick={(v) => setClientSuppliesTiles(v === 'yes')} label="NO" />
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
