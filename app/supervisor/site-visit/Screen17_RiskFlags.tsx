'use client'

import { useMemo, useState } from 'react'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  allScreenData: object
  onComplete: () => void
  isReview?: boolean
  onBack?: () => void
}

type RiskFlag = { id: number; description: string; source: string; manual: boolean }

type DecisionEntry = {
  additionalDays: number
  additionalCost: number
  decision: '' | 'proceed' | 'exclude' | 'defer'
}

let _nextId = 100

function getDefaults(flag: RiskFlag): { days: number; cost: number } {
  const desc = flag.description.toLowerCase()
  if (desc.includes('core cutting')) return { days: 1, cost: 0 }
  if (desc.includes('aged supply pipe') || desc.includes('replacement recommended')) return { days: 1, cost: 3500 }
  if (desc.includes('drain blockage') || desc.includes('jetting')) return { days: 1, cost: 800 }
  if (desc.includes('non-compliant') || desc.includes('ip44')) return { days: 0, cost: 1200 }
  if (desc.includes('elcb') || desc.includes('earth leakage')) return { days: 0, cost: 800 }
  if (desc.includes('waterproofing failure') || desc.includes('additional treatment')) return { days: 2, cost: 2800 }
  if (desc.includes('efflorescence')) return { days: 1, cost: 0 }
  if (desc.includes('hollow tiles')) return { days: 1, cost: 0 }
  if (desc.includes('structural risk') || desc.includes('civil engineer') || desc.includes('structural crack')) return { days: 3, cost: 0 }
  if (desc.includes('extended timeline') || desc.includes('plumbing reroute')) return { days: 2, cost: 0 }
  if (desc.includes('electrical modification') || desc.includes('new points')) return { days: 1, cost: 0 }
  if (desc.includes('geyser replacement')) return { days: 1, cost: 0 }
  if (desc.includes('false ceiling')) return { days: 2, cost: 0 }
  if (desc.includes('floor area') || desc.includes('wall area')) return { days: 1, cost: 0 }
  return { days: 0, cost: 0 }
}

export default function Screen17_RiskFlags({ reportId, allScreenData, onComplete, isReview, onBack }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (allScreenData as any) ?? {}
  const scope = data.scopeIntent ?? {}
  const meas = data.measurements ?? {}

  const derivedFlags = useMemo<RiskFlag[]>(() => {
    const flags: RiskFlag[] = []
    let id = 1

    if (scope.plumbingScope === 'reroute') {
      flags.push({ id: id++, description: 'Plumbing reroute required — extended timeline and additional cost', source: 'Scope Intent', manual: false })
    }
    if (scope.electricalScope === 'add-change') {
      flags.push({ id: id++, description: 'Electrical modifications required — new points to be added', source: 'Scope Intent', manual: false })
    }
    if (scope.geyserScope === 'replace') {
      flags.push({ id: id++, description: 'Geyser replacement in scope — plumbing and electrical coordination required', source: 'Scope Intent', manual: false })
    }
    if (scope.ceilingScope === 'false-ceiling') {
      flags.push({ id: id++, description: 'False ceiling in scope — adds 1–2 days and specialist labour', source: 'Scope Intent', manual: false })
    }

    const fa = Number(meas.floorArea) || 0
    const wa = Number(meas.totalWallArea) || 0
    if (fa > 60) {
      flags.push({ id: id++, description: `Large floor area (${fa} sq ft) — additional material delivery and tiling time`, source: 'Measurements', manual: false })
    }
    if (wa > 200) {
      flags.push({ id: id++, description: `Large wall area (${wa} sq ft) — additional waterproofing and tiling time`, source: 'Measurements', manual: false })
    }

    return flags
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [manualFlags, setManualFlags] = useState<RiskFlag[]>([])
  const [newFlagText, setNewFlagText] = useState('')
  const [notes, setNotes] = useState('')
  const [decisions, setDecisions] = useState<Record<number, DecisionEntry>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allFlags = [...derivedFlags, ...manualFlags]

  function getDecisionEntry(flagId: number, flag: RiskFlag): DecisionEntry {
    if (decisions[flagId]) return decisions[flagId]
    const { days, cost } = getDefaults(flag)
    return { additionalDays: days, additionalCost: cost, decision: '' }
  }

  function updateDecision(flagId: number, updates: Partial<DecisionEntry>, flag: RiskFlag) {
    const current = getDecisionEntry(flagId, flag)
    setDecisions((prev) => ({ ...prev, [flagId]: { ...current, ...updates } }))
  }

  function addFlag() {
    const text = newFlagText.trim()
    if (!text) return
    setManualFlags((prev) => [
      ...prev,
      { id: _nextId++, description: text, source: 'Manual (supervisor)', manual: true },
    ])
    setNewFlagText('')
  }

  function removeManual(id: number) {
    setManualFlags((prev) => prev.filter((f) => f.id !== id))
    setDecisions((prev) => { const d = { ...prev }; delete d[id]; return d })
  }

  const proceedAdditionalDays = allFlags.reduce((sum, flag) => {
    const entry = getDecisionEntry(flag.id, flag)
    return entry.decision === 'proceed' ? sum + entry.additionalDays : sum
  }, 0)

  const proceedAdditionalCost = allFlags.reduce((sum, flag) => {
    const entry = getDecisionEntry(flag.id, flag)
    return entry.decision === 'proceed' ? sum + entry.additionalCost : sum
  }, 0)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const clientDecisions = allFlags.map((flag) => {
        const entry = getDecisionEntry(flag.id, flag)
        return {
          flagDescription: flag.description,
          additionalDays: entry.additionalDays,
          additionalCost: entry.additionalCost,
          clientDecision: entry.decision,
          excludeWarningAcknowledged: entry.decision === 'exclude',
        }
      })
      const result = await saveScreen(reportId, 17, 'screen17_risk_flags', {
        flags: allFlags.map(({ description, source, manual }) => ({ description, source, manual })),
        flagCount: allFlags.length,
        notes: notes || null,
        clientDecisions,
        proceedAdditionalDays,
        proceedAdditionalCost,
      })
      if (result.error) throw new Error(result.error)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function FlagWithDecision({ flag }: { flag: RiskFlag }) {
    const entry = getDecisionEntry(flag.id, flag)
    const isAmber = !flag.manual
    return (
      <div className="space-y-2">
        {/* Flag card */}
        <div className={`flex gap-3 px-4 py-3 rounded-xl border ${isAmber ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <span className={`mt-0.5 shrink-0 ${isAmber ? 'text-amber-500' : 'text-red-500'}`}>⚠</span>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isAmber ? 'text-amber-800' : 'text-red-800'}`}>{flag.description}</p>
            <p className={`text-xs mt-0.5 ${isAmber ? 'text-amber-500' : 'text-red-400'}`}>{flag.source}</p>
          </div>
          {flag.manual && (
            <button
              type="button"
              onClick={() => removeManual(flag.id)}
              className="text-red-400 text-xs font-bold shrink-0 active:text-red-600"
            >
              Remove
            </button>
          )}
        </div>

        {/* Client decision */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Client Decision</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Additional Days</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateDecision(flag.id, { additionalDays: Math.max(0, entry.additionalDays - 1) }, flag)}
                  className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg active:bg-gray-200 shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={entry.additionalDays}
                  onChange={(e) => updateDecision(flag.id, { additionalDays: Math.max(0, parseInt(e.target.value) || 0) }, flag)}
                  min="0"
                  className="w-full border border-gray-200 rounded-xl p-3 text-base text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                />
                <button
                  type="button"
                  onClick={() => updateDecision(flag.id, { additionalDays: entry.additionalDays + 1 }, flag)}
                  className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg active:bg-gray-200 shrink-0"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Cost Allowance (Rs)</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateDecision(flag.id, { additionalCost: Math.max(0, entry.additionalCost - 100) }, flag)}
                  className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg active:bg-gray-200 shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={entry.additionalCost}
                  onChange={(e) => updateDecision(flag.id, { additionalCost: Math.max(0, parseInt(e.target.value) || 0) }, flag)}
                  min="0"
                  className="w-full border border-gray-200 rounded-xl p-3 text-base text-center focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                />
                <button
                  type="button"
                  onClick={() => updateDecision(flag.id, { additionalCost: entry.additionalCost + 100 }, flag)}
                  className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg active:bg-gray-200 shrink-0"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: 'proceed', line1: 'PROCEED', line2: 'INCLUDE IN SCOPE', active: 'bg-green-600 border-green-600 text-white' },
                { value: 'exclude', line1: 'EXCLUDE', line2: 'CLIENT ACCEPTS RISK', active: 'bg-red-600 border-red-600 text-white' },
                { value: 'defer', line1: 'DEFER', line2: 'DECIDE LATER', active: 'bg-amber-500 border-amber-500 text-white' },
              ] as { value: DecisionEntry['decision']; line1: string; line2: string; active: string }[]
            ).map(({ value, line1, line2, active }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateDecision(flag.id, { decision: value }, flag)}
                className={`py-3 rounded-xl text-center border-2 transition-colors ${
                  entry.decision === value ? active : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                <p className="text-xs font-bold leading-tight">{line1}</p>
                <p className="text-[10px] mt-0.5 font-medium opacity-80 leading-tight">{line2}</p>
              </button>
            ))}
          </div>

          {entry.decision === 'exclude' && (
            <div className="px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <p className="text-xs font-bold text-red-700">
                Client has accepted this risk. Supervisor must get written confirmation.
              </p>
            </div>
          )}
        </div>
      </div>
    )
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
          <span className="text-white text-xs font-bold">17</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Risk Flags</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Derived flags */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Identified Risks{' '}
            <span className="normal-case font-normal text-gray-400">({derivedFlags.length} from scope assessment)</span>
          </p>
          {derivedFlags.length === 0 ? (
            <p className="text-sm text-gray-400">No risks identified from scope data.</p>
          ) : (
            <div className="space-y-4">
              {derivedFlags.map((flag) => (
                <FlagWithDecision key={flag.id} flag={flag} />
              ))}
            </div>
          )}
        </div>

        {/* Manual flags */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Add Risk Flags</p>
          {manualFlags.length > 0 && (
            <div className="space-y-4 mb-4">
              {manualFlags.map((flag) => (
                <FlagWithDecision key={flag.id} flag={flag} />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newFlagText}
              onChange={(e) => setNewFlagText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFlag()}
              placeholder="Describe risk or concern…"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
            />
            <button
              type="button"
              onClick={addFlag}
              disabled={!newFlagText.trim()}
              className="px-5 py-3 rounded-xl bg-[#1F3864] text-white text-sm font-bold disabled:opacity-40 active:bg-[#162950]"
            >
              Add
            </button>
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
            rows={2}
            placeholder="Risk assessment notes…"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
          />
        </div>

        {/* Count + proceed totals */}
        <div className="px-5 py-3 bg-gray-50 space-y-1">
          <p className="text-sm font-semibold text-[#1F3864]">
            Total risk flags: <span className="font-bold">{allFlags.length}</span>
          </p>
          {proceedAdditionalDays > 0 || proceedAdditionalCost > 0 ? (
            <div className="pt-1 border-t border-gray-200 mt-1">
              <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-1">PROCEED Flags — Added to Estimate</p>
              <div className="flex gap-6">
                <p className="text-sm font-semibold text-gray-800">
                  +{proceedAdditionalDays} day{proceedAdditionalDays !== 1 ? 's' : ''}
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  +Rs {proceedAdditionalCost.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          ) : null}
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
            disabled={submitting}
            onClick={handleSubmit}
            className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
              !submitting
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Saving…' : 'Submit with Client Decisions'}
          </button>
        </div>
      </div>
    </div>
  )
}
