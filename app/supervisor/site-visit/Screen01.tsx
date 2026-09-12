'use client'

import { useEffect, useState } from 'react'
import { initReport, saveScreen } from './actions'

type Props = {
  supervisorId: string
  bookingRef: string
  jobTitle: string
  jobType: string
  zone: string
  district: string
  clientName: string
  reportId: string | null
  onComplete: (reportId: string) => void
  isReview?: boolean
  onBack?: () => void
}

export default function Screen01({
  supervisorId,
  bookingRef,
  jobTitle,
  jobType,
  zone,
  district,
  clientName,
  reportId,
  onComplete,
  isReview,
  onBack,
}: Props) {
  const [localReportId, setLocalReportId] = useState<string | null>(reportId)
  const [initializing, setInitializing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (localReportId) return
    setInitializing(true)
    initReport(supervisorId, bookingRef, jobTitle).then(({ reportId: rid, error: err }) => {
      if (err) setError(err)
      else if (rid) setLocalReportId(rid)
      setInitializing(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleStart() {
    if (!localReportId) return
    setSubmitting(true)
    setError(null)
    const result = await saveScreen(localReportId, 1, 'screen01_job_details', {
      jobTitle,
      jobType,
      zone,
      district,
      bookingRef,
      visitStartedAt: new Date().toISOString(),
    })
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    onComplete(localReportId)
  }

  const detail = (label: string, value: string) => (
    <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold text-gray-800">{value || '—'}</p>
    </div>
  )

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
          <span className="text-white text-xs font-bold">01</span>
        </div>
        <h2 className="text-lg font-bold text-[#1F3864]">Job Details</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-6">
        {detail('Job Title', jobTitle)}
        {detail('Job Type', jobType)}
        {detail('Zone', zone)}
        {detail('District', district)}
        {clientName ? detail('Client Name', clientName) : null}
        {detail('Booking Reference', bookingRef)}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={!localReportId || initializing || submitting}
        onClick={handleStart}
        className={`w-full py-5 rounded-xl text-base font-bold transition-colors ${
          localReportId && !initializing && !submitting
            ? 'bg-[#1F3864] text-white active:bg-[#162950]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {initializing ? 'Preparing...' : submitting ? 'Starting...' : 'Start Site Visit'}
      </button>
    </div>
  )
}
