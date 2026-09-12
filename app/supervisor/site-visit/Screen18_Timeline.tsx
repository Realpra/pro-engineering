'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { saveScreen } from './actions'

type Props = {
  reportId: string
  measurements: object
  scopeIntent: object
  labourData: object
  onComplete: () => void
  isReview?: boolean
  onBack?: () => void
}

type LabourRateConfig = {
  activity: string
  output_per_mason_per_day: number | null
  curing_days_after: number | null
  is_curing_locked: boolean
  sequence_order: number | null
  notes: string | null
}

type TimelineEntry = {
  activity: string
  activityName: string
  yardstickDays: number
  supervisorDays: number
  curingDays: number
  isCuringLocked: boolean
  isOverridden: boolean
  overrideReason: string
  notes: string
}

const ACTIVITY_NAMES: Record<string, string> = {
  'demolition-floor': 'Demolition — Floor',
  'demolition-wall': 'Demolition — Walls',
  'plumbing-reroute': 'Plumbing Reroute',
  'electrical-points': 'Electrical Points',
  'waterproofing': 'Waterproofing',
  'plastering-wall': 'Wall Plastering',
  'floor-screed': 'Floor Screed',
  'floor-tiling': 'Floor Tiling',
  'wall-tiling': 'Wall Tiling',
  'grouting': 'Grouting',
  'fixture-fitting': 'Fixture Fitting',
}

const OVERRIDE_REASONS = [
  'Experienced crew',
  'Complex scope',
  'Site access difficulty',
  'Material delay risk',
  'Other',
]

function calcYardstickDays(
  activity: string,
  meas: Record<string, unknown>,
  scope: Record<string, unknown>
): number {
  const fa = parseFloat(String(meas.floorArea ?? '0')) || 0
  const wa = parseFloat(String(meas.totalWallArea ?? '0')) || 0
  switch (activity) {
    case 'demolition-floor': return Math.ceil(fa / 100)
    case 'demolition-wall': return Math.ceil(wa / 80)
    case 'plumbing-reroute': return scope.plumbingScope === 'reroute' ? 2 : 0
    case 'electrical-points': return scope.electricalScope === 'add-change' ? 1 : 0
    case 'waterproofing': return 2
    case 'plastering-wall': return Math.ceil(wa / 120)
    case 'floor-screed': return 1
    case 'floor-tiling': return scope.tilesScope !== 'retain-all' ? Math.ceil(fa / 50) : 0
    case 'wall-tiling': return scope.tilesScope !== 'retain-all' ? Math.ceil(wa / 40) : 0
    case 'grouting': return scope.tilesScope !== 'retain-all' ? 1 : 0
    case 'fixture-fitting': return scope.fixturesScope !== 'retain-all' ? 1 : 0
    default: return 0
  }
}

function defaultStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.toISOString().split('T')[0]
}

function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function dayLabel(start: number, count: number): string {
  if (count === 1) return `Day ${start}`
  return `Days ${start}–${start + count - 1}`
}

export default function Screen18_Timeline({
  reportId,
  measurements,
  scopeIntent,
  labourData: _labourData,
  onComplete,
  isReview,
  onBack,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meas = measurements as Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope = scopeIntent as Record<string, unknown>

  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('labour_rate_config')
        .select('activity, output_per_mason_per_day, curing_days_after, is_curing_locked, sequence_order, notes')
        .order('sequence_order', { ascending: true, nullsFirst: false })

      if (err) {
        setFetchError(err.message)
        setLoading(false)
        return
      }

      const configs = (data ?? []) as LabourRateConfig[]
      const built: TimelineEntry[] = []

      for (const cfg of configs) {
        const yd = calcYardstickDays(cfg.activity, meas, scope)
        if (yd === 0) continue
        built.push({
          activity: cfg.activity,
          activityName: ACTIVITY_NAMES[cfg.activity] ?? cfg.activity,
          yardstickDays: yd,
          supervisorDays: yd,
          curingDays: cfg.curing_days_after ?? 0,
          isCuringLocked: cfg.is_curing_locked ?? true,
          isOverridden: false,
          overrideReason: '',
          notes: cfg.notes ?? '',
        })
      }

      setEntries(built)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateEntry(idx: number, patch: Partial<TimelineEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  }

  function changeSupervisorDays(idx: number, delta: number) {
    const entry = entries[idx]
    const next = Math.max(1, entry.supervisorDays + delta)
    const isOverridden = next !== entry.yardstickDays
    updateEntry(idx, {
      supervisorDays: next,
      isOverridden,
      overrideReason: isOverridden ? entry.overrideReason : '',
    })
  }

  const totalWorkingDays = entries.reduce((s, e) => s + e.supervisorDays, 0)
  const totalCuringDays = entries.reduce((s, e) => s + e.curingDays, 0)
  const totalCalendarDays = totalWorkingDays + totalCuringDays
  const estimatedCompletion = startDate && totalCalendarDays > 0
    ? addCalendarDays(startDate, totalCalendarDays - 1)
    : null
  const overrideCount = entries.filter((e) => e.isOverridden).length

  let runningDay = 1
  const dayStarts = entries.map((e) => {
    const start = runningDay
    runningDay += e.supervisorDays + e.curingDays
    return start
  })

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await saveScreen(reportId, 18, 'screen18_timeline', {
        proposedStartDate: startDate,
        estimatedCompletionDate: estimatedCompletion,
        totalWorkingDays,
        totalCuringDays,
        totalCalendarDays,
        overrideCount,
        entries: entries.map((e) => ({
          activity: e.activity,
          activityName: e.activityName,
          yardstickDays: e.yardstickDays,
          supervisorDays: e.supervisorDays,
          curingDays: e.curingDays,
          isCuringLocked: e.isCuringLocked,
          isOverridden: e.isOverridden,
          overrideReason: e.overrideReason || null,
          notes: e.notes || null,
        })),
      })
      if (result.error) throw new Error(result.error)
      onComplete()
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

      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">18</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Project Timeline</h2>
      </div>

      {/* Proposed start date */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-4">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
          Proposed Start Date
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
        />
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-8 text-center mb-4">
          <p className="text-sm text-gray-400">Loading activity schedule…</p>
        </div>
      )}

      {fetchError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 mb-4">
          <p className="text-sm text-red-700">{fetchError}</p>
        </div>
      )}

      {/* Activity accordion cards */}
      {!loading && !fetchError && (
        <div className="space-y-3 mb-4">
          {entries.map((entry, idx) => {
            const startDay = dayStarts[idx]
            return (
              <div
                key={entry.activity}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
                  entry.isOverridden ? 'border-amber-400' : 'border-gray-200'
                }`}
              >
                {/* Main row */}
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 pt-0.5">
                    <div className="bg-[#1F3864] rounded-lg px-2 py-1 text-center min-w-[60px]">
                      <span className="text-white text-xs font-bold leading-none">
                        {dayLabel(startDay, entry.supervisorDays)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 leading-tight">{entry.activityName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Yardstick: {entry.yardstickDays} {entry.yardstickDays === 1 ? 'day' : 'days'}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeSupervisorDays(idx, -1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-base active:bg-gray-200"
                    >
                      −
                    </button>
                    <span
                      className={`w-7 text-center text-sm font-bold ${
                        entry.isOverridden ? 'text-amber-600' : 'text-[#1F3864]'
                      }`}
                    >
                      {entry.supervisorDays}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeSupervisorDays(idx, 1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-base active:bg-gray-200"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Override reason */}
                {entry.isOverridden && (
                  <div className="px-4 pb-3 pt-2 border-t border-amber-100 bg-amber-50">
                    <label className="block text-xs font-bold text-amber-700 mb-1.5">Override reason</label>
                    <select
                      value={entry.overrideReason}
                      onChange={(e) => updateEntry(idx, { overrideReason: e.target.value })}
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    >
                      <option value="">Select reason…</option>
                      {OVERRIDE_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Curing row — locked */}
                {entry.curingDays > 0 && (
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
                    <svg
                      className="w-3.5 h-3.5 text-gray-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <p className="text-xs text-gray-500 flex-1">
                      Curing — {entry.curingDays} {entry.curingDays === 1 ? 'day' : 'days'} (no wet work)
                    </p>
                    <span className="text-xs font-semibold text-gray-400">Locked</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {!loading && entries.length > 0 && (
        <div className="bg-[#1F3864] rounded-2xl overflow-hidden mb-4 px-5 py-4 space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm text-blue-200">Working days</p>
            <p className="text-sm font-bold text-white">{totalWorkingDays}</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-blue-200">Curing days (locked)</p>
            <p className="text-sm font-bold text-white">{totalCuringDays}</p>
          </div>
          <div className="flex justify-between items-center border-t border-white/20 pt-2">
            <p className="text-sm font-bold text-white">Total calendar days</p>
            <p className="text-lg font-bold text-white">{totalCalendarDays}</p>
          </div>
          {startDate && (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-blue-200">Proposed start</p>
                <p className="text-sm font-bold text-white">{formatDate(startDate)}</p>
              </div>
              {estimatedCompletion && (
                <div className="flex justify-between items-center">
                  <p className="text-sm text-blue-200">Estimated completion</p>
                  <p className="text-sm font-bold text-white">{formatDate(estimatedCompletion)}</p>
                </div>
              )}
            </>
          )}
          {overrideCount > 0 && (
            <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/30 mt-1">
              <p className="text-sm text-amber-300">
                {overrideCount} {overrideCount === 1 ? 'override' : 'overrides'} from yardstick
              </p>
              <span className="text-amber-300 text-sm font-bold">⚠</span>
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      {!loading && !fetchError && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          {error && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <button
            type="button"
            disabled={!startDate || submitting || entries.length === 0}
            onClick={handleSubmit}
            className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
              startDate && !submitting && entries.length > 0
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Saving…' : 'CONFIRM TIMELINE'}
          </button>
        </div>
      )}
    </div>
  )
}
