'use client'

import { useState } from 'react'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  scopeIntent: object
  onComplete: (clientScopeData: object) => void
  isReview?: boolean
  onBack?: () => void
}

type ItemStatus = 'confirmed' | 'changed' | 'deferred' | null

type ItemState = {
  status: ItemStatus
  changedValue: string
}

type ScopeItemDef = {
  key: string
  label: string
  options: { value: string; label: string }[]
}

const SCOPE_ITEMS: ScopeItemDef[] = [
  {
    key: 'renovationType',
    label: 'Renovation Type',
    options: [
      { value: 'full', label: 'FULL RENOVATION' },
      { value: 'partial', label: 'PARTIAL RENOVATION' },
    ],
  },
  {
    key: 'tilesScope',
    label: 'Tiles Scope',
    options: [
      { value: 'replace-all', label: 'REPLACE ALL' },
      { value: 'replace-floor-only', label: 'FLOOR ONLY' },
      { value: 'replace-walls-only', label: 'WALLS ONLY' },
      { value: 'retain-all', label: 'RETAIN ALL' },
    ],
  },
  {
    key: 'fixturesScope',
    label: 'Fixtures Scope',
    options: [
      { value: 'replace-all', label: 'REPLACE ALL' },
      { value: 'replace-selected', label: 'REPLACE SELECTED' },
      { value: 'retain-all', label: 'RETAIN ALL' },
    ],
  },
  {
    key: 'plumbingScope',
    label: 'Plumbing Scope',
    options: [
      { value: 'reroute', label: 'REROUTE REQUIRED' },
      { value: 'retain', label: 'RETAIN EXISTING' },
    ],
  },
  {
    key: 'electricalScope',
    label: 'Electrical Scope',
    options: [
      { value: 'add-change', label: 'ADD OR CHANGE POINTS' },
      { value: 'retain', label: 'RETAIN EXISTING' },
    ],
  },
  {
    key: 'ceilingScope',
    label: 'Ceiling Scope',
    options: [
      { value: 'renovate', label: 'RENOVATE CEILING' },
      { value: 'retain', label: 'RETAIN CEILING' },
    ],
  },
  {
    key: 'geyserScope',
    label: 'Geyser Scope',
    options: [
      { value: 'replace', label: 'REPLACE UNIT' },
      { value: 'retain', label: 'RETAIN' },
      { value: 'new-point-only', label: 'NEW POINT ONLY' },
    ],
  },
]

function getOptionLabel(item: ScopeItemDef, value: string): string {
  return item.options.find((o) => o.value === value)?.label ?? value.replace(/-/g, ' ').toUpperCase()
}

export default function Screen18_ClientScope({ reportId, scopeIntent, onComplete, isReview, onBack }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope = (scopeIntent as any) ?? {}

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
    const init: Record<string, ItemState> = {}
    for (const item of SCOPE_ITEMS) {
      init[item.key] = { status: null, changedValue: '' }
    }
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setStatus(key: string, status: ItemStatus) {
    setItemStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], status, changedValue: status !== 'changed' ? '' : prev[key].changedValue },
    }))
  }

  function setChangedValue(key: string, value: string) {
    setItemStates((prev) => ({
      ...prev,
      [key]: { status: 'changed', changedValue: value },
    }))
  }

  const confirmedCount = Object.values(itemStates).filter((s) => s.status === 'confirmed').length
  const changedCount = Object.values(itemStates).filter((s) => s.status === 'changed').length
  const deferredCount = Object.values(itemStates).filter((s) => s.status === 'deferred').length
  const allDecided = confirmedCount + changedCount + deferredCount === SCOPE_ITEMS.length

  function getConfirmedValue(key: string, state: ItemState): string | null {
    if (state.status === 'confirmed') return scope[key] ?? null
    if (state.status === 'changed') return state.changedValue || null
    return null
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const decisions = SCOPE_ITEMS.map((item) => {
        const state = itemStates[item.key]
        return {
          key: item.key,
          label: item.label,
          originalValue: scope[item.key] ?? null,
          clientDecision: state.status,
          confirmedValue: getConfirmedValue(item.key, state),
        }
      })
      const payload = { decisions, confirmedCount, changedCount, deferredCount }
      const result = await saveScreen(reportId, 18, 'screen18_client_scope', payload)
      if (result.error) throw new Error(result.error)
      onComplete(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
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

      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">18</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Client Scope Confirmation</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Review all scope decisions with client. Client confirms or changes each item before report is submitted.
      </p>

      <div className="space-y-3">
        {SCOPE_ITEMS.map((item) => {
          const state = itemStates[item.key]
          const originalValue = scope[item.key] ?? null
          const originalLabel = originalValue ? getOptionLabel(item, originalValue) : '—'

          return (
            <div
              key={item.key}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
                state.status === 'confirmed'
                  ? 'border-green-400'
                  : state.status === 'changed'
                  ? 'border-blue-400'
                  : state.status === 'deferred'
                  ? 'border-amber-400'
                  : 'border-gray-200'
              }`}
            >
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{item.label}</p>
                  {state.status && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        state.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : state.status === 'changed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {state.status === 'confirmed' ? 'Confirmed' : state.status === 'changed' ? 'Changed' : 'Deferred'}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-[#1F3864] mb-3">{originalLabel}</p>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'confirmed' as ItemStatus, label: 'CONFIRM\nAS PLANNED', activeClass: 'bg-green-600 border-green-600 text-white' },
                      { value: 'changed' as ItemStatus, label: 'CHANGE', activeClass: 'bg-blue-600 border-blue-600 text-white' },
                      { value: 'deferred' as ItemStatus, label: 'DEFER\nDECISION', activeClass: 'bg-amber-500 border-amber-500 text-white' },
                    ]
                  ).map(({ value, label, activeClass }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(item.key, value)}
                      className={`py-3 rounded-xl text-center border-2 transition-colors ${
                        state.status === value ? activeClass : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {label.split('\n').map((line, i) => (
                        <p key={i} className="text-xs font-bold leading-tight">{line}</p>
                      ))}
                    </button>
                  ))}
                </div>

                {state.status === 'changed' && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-gray-500 mb-2">Select new value:</p>
                    <div className="flex flex-wrap gap-2">
                      {item.options
                        .filter((opt) => opt.value !== originalValue)
                        .map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setChangedValue(item.key, opt.value)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
                              state.changedValue === opt.value
                                ? 'bg-[#1F3864] border-[#1F3864] text-white'
                                : 'bg-white border-gray-200 text-gray-600'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Summary</p>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{confirmedCount}</p>
              <p className="text-xs text-gray-500">Confirmed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{changedCount}</p>
              <p className="text-xs text-gray-500">Changed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{deferredCount}</p>
              <p className="text-xs text-gray-500">Deferred</p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pb-2">
          {error && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <button
            type="button"
            disabled={!allDecided || submitting}
            onClick={handleSubmit}
            className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
              allDecided && !submitting
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Saving…' : allDecided ? 'CONFIRM CLIENT DECISIONS' : 'Review all items above'}
          </button>
        </div>
      </div>
    </div>
  )
}
