'use client'

import { useState } from 'react'
import { submitMilestoneEvidence } from './actions'

type Milestone = {
  id: string
  milestone_code: string
  milestone_name: string
  milestone_number: number
  payment_percent: number
  payment_amount: number
  trigger_condition: string
  evidence_required: string[]
  evidence_submitted: Record<string, string> | null
  supervisor_submitted_at: string | null
  status: string
}

type Props = {
  booking: Record<string, string> | null
  milestones: Milestone[]
  worker: Record<string, string> | null
  bookingRef: string
}

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

export default function MilestoneEvidencePage({ booking, milestones, worker, bookingRef }: Props) {
  const [sel, setSel] = useState<Milestone | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pending = milestones.filter(m => m.status === 'pending')
  const done = milestones.filter(m => m.status === 'coordinator_approved' || m.status === 'payment_released')

  async function handleSubmit() {
    if (!sel || submitting) return
    setSubmitting(true)
    setError(null)
    const res = await submitMilestoneEvidence({
      bookingRef,
      milestoneId: sel.id,
      milestoneCode: sel.milestone_code,
      notes,
      workerId: worker?.id ?? '',
    })
    if (res.error) {
      setError(res.error)
      setSubmitting(false)
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Evidence Submitted</h2>
          <p className="text-gray-600">Coordinator will review and approve payment.</p>
          <a href="/supervisor/dashboard" className="mt-6 block text-sm text-blue-600">
            Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1F3864] text-white rounded-2xl p-6 mb-6">
          <h1 className="text-xl font-bold">Milestone Sign-Off</h1>
          <p className="text-blue-200 text-sm mt-1">{booking?.job_title} — {bookingRef}</p>
        </div>

        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-500">
            No pending milestones
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow p-6 mb-4">
              <h2 className="font-semibold text-gray-800 mb-4">Select Milestone</h2>
              {pending.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSel(m)}
                  className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition ${
                    sel?.id === m.id ? 'border-[#1F3864] bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{m.milestone_code} — {m.milestone_name}</p>
                      <p className="text-sm text-gray-500 mt-1">{m.trigger_condition}</p>
                    </div>
                    <span className="text-sm font-bold text-[#1F3864] shrink-0">
                      ₹ {fmtInr(m.payment_amount)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {sel && (
              <div className="bg-white rounded-2xl shadow p-6 mb-4">
                <h2 className="font-semibold text-gray-800 mb-3">Evidence Required</h2>
                {(sel.evidence_required ?? []).map((e, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-start">
                    <svg className="w-4 h-4 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">{e}</span>
                  </div>
                ))}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Supervisor Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Confirm all evidence complete."
                  />
                </div>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !notes.trim()}
                  className="mt-4 w-full bg-[#1F3864] text-white py-3 rounded-xl font-semibold disabled:opacity-40"
                >
                  {submitting ? 'Submitting...' : 'Submit for Coordinator Approval'}
                </button>
              </div>
            )}
          </>
        )}

        {done.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-6 mt-4">
            <h2 className="font-semibold text-gray-800 mb-3">Completed</h2>
            {done.map(m => (
              <div key={m.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{m.milestone_code} — {m.milestone_name}</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{m.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
