'use client'

import { useState } from 'react'
import { submitReport } from './actions'

type Props = {
  reportId: string
  bookingRef: string
  supervisorId: string
  allScreenData: object
  onComplete: () => void
  onBack?: (screenNumber?: number) => void
}

const REVIEW_SCREENS = [
  { n: 1, name: 'Job Details' },
  { n: 2, name: 'Scope Intent' },
  { n: 3, name: 'Ceiling' },
  { n: 4, name: 'Walls' },
  { n: 5, name: 'Floors' },
  { n: 6, name: 'Plumbing' },
  { n: 7, name: 'Electrical' },
  { n: 8, name: 'Waterproofing' },
  { n: 9, name: 'Structural' },
  { n: 10, name: 'Tiles' },
  { n: 11, name: 'Fixtures' },
  { n: 12, name: 'Logistics' },
  { n: 13, name: 'Compliance' },
  { n: 14, name: 'Measurements' },
  { n: 15, name: 'Labour' },
  { n: 16, name: 'Client Scope Confirmation' },
  { n: 17, name: 'Risk Decisions' },
  { n: 18, name: 'Timeline' },
  { n: 19, name: 'Materials' },
]

export default function Screen20_Submit({ reportId, bookingRef, allScreenData, onComplete, onBack }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (allScreenData as any) ?? {}
  const scope = data.scopeIntent ?? {}
  const meas = data.measurements ?? {}
  const labour = data.labourData ?? {}

  const [declared, setDeclared] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function fmt(val: string) {
    return val ? val.replace(/-/g, ' ') : '—'
  }

  const summaryItems = [
    { label: 'Job Reference', value: bookingRef },
    { label: 'Renovation Type', value: fmt(scope.renovationType) },
    { label: 'Tiles Scope', value: fmt(scope.tilesScope) },
    { label: 'Plumbing Scope', value: fmt(scope.plumbingScope) },
    { label: 'Electrical Scope', value: fmt(scope.electricalScope) },
    { label: 'Geyser Scope', value: fmt(scope.geyserScope) },
    ...(meas.floorArea ? [{ label: 'Floor Area', value: `${meas.floorArea} sq ft` }] : []),
    ...(meas.totalWallArea ? [{ label: 'Total Wall Area', value: `${meas.totalWallArea} sq ft` }] : []),
    ...(labour.totalWorkingDays ? [{ label: 'Working Days', value: `${labour.totalWorkingDays} days` }] : []),
    ...(labour.totalCalendarDays ? [{ label: 'Calendar Duration', value: `${labour.totalCalendarDays} days` }] : []),
  ]

  async function handleSubmit() {
    if (!declared) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitReport(reportId)
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
      {onBack && (
        <button
          type="button"
          onClick={() => onBack()}
          className="flex items-center gap-1 text-sm font-semibold text-[#1F3864] mb-4 active:opacity-70"
        >
          ← Review Screens
        </button>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">20</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Submit Report</h2>
      </div>

      {/* Review checklist */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Review All Screens</p>
          <p className="text-xs text-gray-400 mt-0.5">Tap any screen to go back and edit</p>
        </div>
        <div className="divide-y divide-gray-100">
          {REVIEW_SCREENS.map(({ n, name }) => (
            <button
              key={n}
              type="button"
              onClick={() => onBack?.(n)}
              className="flex items-center justify-between w-full px-5 py-3 text-left active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-gray-500">{n}</span>
                </div>
                <span className="text-sm font-medium text-[#1F3864]">{name}</span>
              </div>
              <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {/* Summary */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Report Summary</p>
          <div className="space-y-2.5">
            {summaryItems.map(({ label, value }) => (
              <div key={label} className="flex justify-between items-start gap-4">
                <p className="text-xs text-gray-500 shrink-0">{label}</p>
                <p className="text-sm font-semibold text-[#1F3864] text-right capitalize">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Screens completed indicator */}
        <div className="px-5 py-3 bg-green-50">
          <p className="text-xs font-bold text-green-700">All 20 screens completed — ready to submit</p>
        </div>

        {/* Declaration */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Supervisor Declaration</p>
          <button
            type="button"
            onClick={() => setDeclared((d) => !d)}
            className="flex items-start gap-3 w-full text-left"
          >
            <div
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                declared ? 'bg-[#1F3864] border-[#1F3864]' : 'bg-white border-gray-300'
              }`}
            >
              {declared && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <p className="text-sm text-gray-700 leading-snug">
              I confirm that I have personally conducted this site visit, all information recorded is accurate to the best of my knowledge, and this scope report is ready for coordinator review.
            </p>
          </button>
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
            disabled={!declared || submitting}
            onClick={handleSubmit}
            className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
              declared && !submitting
                ? 'bg-[#1F3864] text-white active:bg-[#162950]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting
              ? 'Submitting Report…'
              : declared
              ? 'Submit Scope Report'
              : 'Confirm declaration above'}
          </button>
        </div>
      </div>
    </div>
  )
}
