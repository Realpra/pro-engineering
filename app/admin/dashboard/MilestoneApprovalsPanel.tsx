'use client'

import { useState } from 'react'
import { coordinatorApproveMilestone, releaseMilestonePayment } from '@/app/supervisor/milestone/[bookingRef]/actions'

type MilestoneRow = {
  id: string
  booking_ref: string
  milestone_code: string
  milestone_name: string
  payment_amount: number
  evidence_submitted: Record<string, string> | null
  supervisor_submitted_at: string | null
  status: string
  trigger_condition: string
  evidence_required: string[]
  jobTitle: string | null
}

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function MilestoneApprovalsPanel({
  pendingMilestones,
}: {
  pendingMilestones: MilestoneRow[]
}) {
  const [rows, setRows] = useState(pendingMilestones)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msgMap, setMsgMap] = useState<Record<string, { text: string; ok: boolean }>>({})

  async function approve(m: MilestoneRow) {
    setProcessing(m.id)
    const res1 = await coordinatorApproveMilestone({ milestoneId: m.id, bookingRef: m.booking_ref })
    if (res1.error) {
      setMsgMap(prev => ({ ...prev, [m.id]: { text: res1.error ?? 'Error', ok: false } }))
      setProcessing(null)
      return
    }
    const res2 = await releaseMilestonePayment({ milestoneId: m.id, bookingRef: m.booking_ref })
    if (res2.error) {
      setMsgMap(prev => ({ ...prev, [m.id]: { text: res2.error ?? 'Error', ok: false } }))
      setProcessing(null)
      return
    }
    setRows(prev => prev.filter(r => r.id !== m.id))
    setProcessing(null)
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#1F3864] mb-2">No pending milestone approvals</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Supervisor-submitted milestone evidence will appear here for review
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rows.map(m => (
        <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold text-[#2E74B5] bg-[#2E74B5]/10 px-2 py-0.5 rounded-md">
                  {m.booking_ref}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-sm font-bold text-gray-900">{m.milestone_code} — {m.milestone_name}</span>
              </div>
              {m.jobTitle && <p className="text-sm text-gray-600">{m.jobTitle}</p>}
              <p className="text-xs text-gray-500 mt-1">{m.trigger_condition}</p>
            </div>
            <span className="text-lg font-bold text-[#1F3864] shrink-0">₹ {fmtInr(m.payment_amount)}</span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">SUPERVISOR NOTES</p>
            {m.evidence_submitted ? (
              <>
                <p className="text-sm text-gray-700">{m.evidence_submitted.notes}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Submitted: {m.supervisor_submitted_at ? fmtDate(m.supervisor_submitted_at) : 'pending'}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">No submission</p>
            )}
          </div>

          {msgMap[m.id] && (
            <p className={`text-xs font-semibold mb-2 ${msgMap[m.id].ok ? 'text-green-700' : 'text-red-600'}`}>
              {msgMap[m.id].text}
            </p>
          )}

          <button
            type="button"
            onClick={() => approve(m)}
            disabled={processing === m.id}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            {processing === m.id ? 'Processing...' : 'APPROVE AND RELEASE PAYMENT'}
          </button>
        </div>
      ))}
    </div>
  )
}
