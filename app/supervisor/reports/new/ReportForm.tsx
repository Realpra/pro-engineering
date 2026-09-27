'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { submitSupervisorReport } from '../actions'

type Job = { booking_ref: string; job_title: string | null }

export default function ReportForm({
  reportType,
  reportLabel,
  supervisorUserId,
  activeJobs,
}: {
  reportType: string
  reportLabel: string
  supervisorUserId: string
  activeJobs: Job[]
}) {
  const router = useRouter()
  const [bookingRef, setBookingRef] = useState('')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!text.trim()) { setError('Please describe the report.'); return }
    setSubmitting(true)
    setError(null)
    const result = await submitSupervisorReport({
      reportType, bookingRef: bookingRef || null, reportText: text, supervisorUserId,
    })
    setSubmitting(false)
    if (result.error) setError(result.error)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-2xl px-5 py-6 text-center">
        <p className="text-green-700 font-bold text-sm">✓ {reportLabel} Submitted</p>
        <button onClick={() => router.push('/supervisor/reports')} className="mt-3 text-xs text-[#2E74B5] font-semibold underline">
          Back to Reports
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Related Job (optional)</p>
        <select value={bookingRef} onChange={e => setBookingRef(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50">
          <option value="">None / General</option>
          {activeJobs.map(j => (<option key={j.booking_ref} value={j.booking_ref}>{j.booking_ref} — {j.job_title ?? 'Job'}</option>))}
        </select>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Report Details</p>
        <textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="Describe the issue, proposal, or finding in detail..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none" />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <button onClick={handleSubmit} disabled={submitting} className="w-full bg-[#1F3864] text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-60">
        {submitting ? 'Submitting…' : 'Submit Report →'}
      </button>
    </div>
  )
}
