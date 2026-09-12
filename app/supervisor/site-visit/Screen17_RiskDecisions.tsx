'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  allScreenData: object
  onComplete: () => void
  isReview?: boolean
  onBack?: () => void
}

type RiskFlag = { id: number; description: string; source: string; manual: boolean }

type FlagDecision = {
  remedyIndex: number | null
  clientNote: string
}

let _nextId = 100

const SCREEN_SOURCES: Record<string, string> = {
  screen03_ceiling: 'Screen 3: Ceiling',
  screen04_walls: 'Screen 4: Walls',
  screen05_floors: 'Screen 5: Floors',
  screen06_plumbing: 'Screen 6: Plumbing',
  screen07_electrical: 'Screen 7: Electrical',
  screen08_waterproofing: 'Screen 8: Waterproofing',
  screen09_demolition: 'Screen 9: Demolition',
  screen10_tiles: 'Screen 10: Tiles',
  screen11_fixtures: 'Screen 11: Fixtures',
  screen12_logistics: 'Screen 12: Logistics',
  screen13_compliance: 'Screen 13: Compliance',
}

const SCREEN_COLUMNS = Object.keys(SCREEN_SOURCES)

function getRemedies(flag: RiskFlag): string[] {
  const desc = flag.description.toLowerCase()
  if (desc.includes('waterproofing failure') || desc.includes('additional treatment')) {
    return [
      'Break plaster + epoxy + replaster (Rs 4500 + 2 days)',
      'Epoxy seal surface only (Rs 1800 + 1 day)',
      'No treatment - client accepts risk',
    ]
  }
  if (desc.includes('aged supply pipe') || desc.includes('replacement recommended') || desc.includes('aged pipe')) {
    return [
      'Full pipe replacement (Rs 8500 + 1 day)',
      'Replace visible section only (Rs 3500)',
      'No replacement - client accepts risk',
    ]
  }
  if (desc.includes('drain blockage') || desc.includes('jetting')) {
    return [
      'Jet cleaning (Rs 800)',
      'No treatment - client accepts risk',
    ]
  }
  if (desc.includes('structural crack') || desc.includes('structural risk') || desc.includes('civil engineer')) {
    return [
      'Engineer assessment required (Rs 3500 + 3 days)',
      'Surface seal only (Rs 1200)',
      'No treatment - client accepts risk',
    ]
  }
  if (desc.includes('non-compliant') || desc.includes('ip44') || desc.includes('non-ip')) {
    return [
      'Replace to IP44 (Rs 1200)',
      'No replacement - client accepts risk',
    ]
  }
  if (desc.includes('elcb') || desc.includes('earth leakage')) {
    return [
      'Install ELCB (Rs 800)',
      'No installation - client accepts risk',
    ]
  }
  if (desc.includes('core cutting')) {
    return [
      'Proceed with core cutting (adds 1 day)',
      'Redesign plumbing to avoid core cutting',
    ]
  }
  return [
    'Proceed and include in scope',
    'Client accepts risk - exclude from scope',
  ]
}

function isAcceptsRisk(remedy: string): boolean {
  return remedy.toLowerCase().includes('accepts risk')
}

export default function Screen17_RiskDecisions({ reportId, onComplete, isReview, onBack }: Props) {
  const [dbFlags, setDbFlags] = useState<RiskFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [manualFlags, setManualFlags] = useState<RiskFlag[]>([])
  const [newFlagText, setNewFlagText] = useState('')
  const [notes, setNotes] = useState('')
  const [decisions, setDecisions] = useState<Record<number, FlagDecision>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFlags() {
      setLoading(true)
      setFetchError(null)
      try {
        const supabase = createClient()
        const { data, error: dbErr } = await supabase
          .from('site_visit_reports')
          .select(SCREEN_COLUMNS.join(', '))
          .eq('id', reportId)
          .single()

        if (dbErr) throw new Error(dbErr.message)
        if (!data) throw new Error('Report not found')

        const flags: RiskFlag[] = []
        let id = 1
        for (const col of SCREEN_COLUMNS) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const colData = (data as any)[col] as { riskFlags?: unknown } | null
          const riskFlags = colData?.riskFlags
          if (Array.isArray(riskFlags)) {
            for (const desc of riskFlags) {
              if (typeof desc === 'string' && desc.trim()) {
                flags.push({ id: id++, description: desc.trim(), source: SCREEN_SOURCES[col], manual: false })
              }
            }
          }
        }
        setDbFlags(flags)
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Failed to load risk flags')
      } finally {
        setLoading(false)
      }
    }
    loadFlags()
  }, [reportId])

  const allFlags = [...dbFlags, ...manualFlags]

  function getDecision(flagId: number): FlagDecision {
    return decisions[flagId] ?? { remedyIndex: null, clientNote: '' }
  }

  function updateDecision(flagId: number, patch: Partial<FlagDecision>) {
    setDecisions((prev) => ({ ...prev, [flagId]: { ...getDecision(flagId), ...patch } }))
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

  const decidedCount = allFlags.filter((f) => getDecision(f.id).remedyIndex !== null).length
  const allDecided = !loading && (allFlags.length === 0 || decidedCount === allFlags.length)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await saveScreen(reportId, 17, 'screen17_risk_decisions', {
        flags: allFlags.map((flag) => {
          const decision = getDecision(flag.id)
          const remedies = getRemedies(flag)
          const selectedRemedy = decision.remedyIndex != null ? remedies[decision.remedyIndex] : null
          return {
            description: flag.description,
            source: flag.source,
            manual: flag.manual,
            remedyOptions: remedies,
            selectedRemedyIndex: decision.remedyIndex,
            selectedRemedy,
            clientAcceptsRisk: selectedRemedy ? isAcceptsRisk(selectedRemedy) : false,
            clientNote: decision.clientNote || null,
          }
        }),
        flagCount: allFlags.length,
        decidedCount,
        acceptsRiskCount: allFlags.filter((f) => {
          const d = getDecision(f.id)
          if (d.remedyIndex == null) return false
          return isAcceptsRisk(getRemedies(f)[d.remedyIndex])
        }).length,
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

  function FlagWithDecision({ flag }: { flag: RiskFlag }) {
    const decision = getDecision(flag.id)
    const remedies = getRemedies(flag)
    const selectedRemedy = decision.remedyIndex != null ? remedies[decision.remedyIndex] : null
    const showRiskWarning = selectedRemedy ? isAcceptsRisk(selectedRemedy) : false

    return (
      <div className="space-y-2">
        <div className={`flex gap-3 px-4 py-3 rounded-xl border ${flag.manual ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
          <span className={`mt-0.5 shrink-0 ${flag.manual ? 'text-blue-500' : 'text-amber-500'}`}>⚠</span>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${flag.manual ? 'text-blue-800' : 'text-amber-800'}`}>{flag.description}</p>
            <p className={`text-xs mt-0.5 ${flag.manual ? 'text-blue-400' : 'text-amber-500'}`}>{flag.source}</p>
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

        <div className="border border-gray-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Client Decision</p>
          {remedies.map((remedy, idx) => {
            const selected = decision.remedyIndex === idx
            const riskOption = isAcceptsRisk(remedy)
            return (
              <button
                key={idx}
                type="button"
                onClick={() => updateDecision(flag.id, { remedyIndex: idx, clientNote: decision.clientNote })}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  selected
                    ? riskOption
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-[#1F3864] border-[#1F3864] text-white'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                {remedy}
              </button>
            )
          })}

          {showRiskWarning && (
            <div className="mt-3 space-y-2">
              <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-300">
                <p className="text-xs font-bold text-amber-700">
                  Supervisor must note client verbal confirmation
                </p>
              </div>
              <textarea
                value={decision.clientNote}
                onChange={(e) => updateDecision(flag.id, { clientNote: e.target.value })}
                rows={2}
                placeholder="Record client's exact words confirming acceptance of risk…"
                className="w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              />
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
        <h2 className="text-lg font-bold text-[#1F3864]">Risk Decisions</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Flags from screens 3–13 */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Identified Risks
            {!loading && (
              <span className="normal-case font-normal text-gray-400 ml-1">
                ({dbFlags.length} from site assessment)
              </span>
            )}
          </p>

          {loading ? (
            <div className="py-6 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[#1F3864] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading risk flags…</p>
            </div>
          ) : fetchError ? (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{fetchError}</p>
            </div>
          ) : dbFlags.length === 0 ? (
            <p className="text-sm text-gray-400">No risk flags raised during site assessment (Screens 3–13).</p>
          ) : (
            <div className="space-y-5">
              {dbFlags.map((flag) => (
                <FlagWithDecision key={flag.id} flag={flag} />
              ))}
            </div>
          )}
        </div>

        {/* Supervisor-added flags */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Add Risk Flag</p>
          {manualFlags.length > 0 && (
            <div className="space-y-5 mb-4">
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

        {/* Decision count */}
        <div className="px-5 py-3 bg-gray-50">
          <p className="text-sm font-semibold text-[#1F3864]">
            {loading
              ? 'Loading…'
              : allFlags.length === 0
              ? 'No risk flags to resolve'
              : `${decidedCount} of ${allFlags.length} ${allFlags.length === 1 ? 'flag has' : 'flags have'} a client decision`}
          </p>
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
            disabled={submitting || !allDecided}
            onClick={handleSubmit}
            className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
              !submitting && allDecided
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Saving…' : 'Confirm Risk Decisions'}
          </button>
        </div>
      </div>
    </div>
  )
}
