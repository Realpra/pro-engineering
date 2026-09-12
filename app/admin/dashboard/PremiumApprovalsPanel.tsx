'use client'

import { useState } from 'react'
import { approvePremiumRequestAsAdmin, rejectPremiumRequestAsAdmin } from './premium-approval-actions'

type ApprovalRow = {
  id: string
  booking_ref: string
  requested_pct: number
  policy_pct: number
  boq_total: number | null
  reason: string | null
  status: string
  created_at: string
  jobTitle: string | null
}

function fmtInr(n: number | null) {
  if (n == null) return '—'
  return '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function PremiumApprovalsPanel({ approvals }: { approvals: ApprovalRow[] }) {
  const [rows, setRows] = useState<ApprovalRow[]>(approvals)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msgMap, setMsgMap] = useState<Record<string, { text: string; ok: boolean }>>({})

  async function handleApprove(id: string) {
    setBusy(true)
    const res = await approvePremiumRequestAsAdmin(id)
    if (res.success) {
      setRows(prev => prev.filter(r => r.id !== id))
    } else {
      setMsgMap(prev => ({ ...prev, [id]: { text: res.error ?? 'Error', ok: false } }))
    }
    setBusy(false)
  }

  async function handleReject(id: string) {
    const reason = rejectReasonMap[id] ?? ''
    if (!reason.trim()) return
    setBusy(true)
    const res = await rejectPremiumRequestAsAdmin(id, reason)
    if (res.success) {
      setRows(prev => prev.filter(r => r.id !== id))
      setRejectingId(null)
    } else {
      setMsgMap(prev => ({ ...prev, [id]: { text: res.error ?? 'Error', ok: false } }))
    }
    setBusy(false)
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
          <h3 className="text-lg font-semibold text-[#1F3864] mb-2">No pending premium approvals</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Premium override requests for jobs under ₹1,00,000 will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rows.map(row => (
        <div key={row.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold text-[#2E74B5] bg-[#2E74B5]/10 px-2 py-0.5 rounded-md">
                  {row.booking_ref}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {row.requested_pct}% requested
                </span>
                <span className="text-xs text-gray-500">
                  policy: {row.policy_pct}%
                </span>
              </div>

              {row.jobTitle && (
                <p className="text-sm font-semibold text-[#1F3864] mb-1 truncate">{row.jobTitle}</p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                <span><span className="font-semibold">BOQ Total:</span> {fmtInr(row.boq_total)}</span>
                <span><span className="font-semibold">Submitted:</span> {fmtDate(row.created_at)}</span>
              </div>

              {row.reason && (
                <p className="text-xs text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2">
                  &ldquo;{row.reason}&rdquo;
                </p>
              )}

              {msgMap[row.id] && (
                <p className={`text-xs font-semibold mt-2 ${msgMap[row.id].ok ? 'text-green-700' : 'text-red-600'}`}>
                  {msgMap[row.id].text}
                </p>
              )}

              {rejectingId === row.id && (
                <div className="mt-3">
                  <textarea
                    value={rejectReasonMap[row.id] ?? ''}
                    onChange={e => setRejectReasonMap(prev => ({ ...prev, [row.id]: e.target.value }))}
                    rows={2}
                    placeholder="Rejection reason…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      disabled={busy || !(rejectReasonMap[row.id] ?? '').trim()}
                      onClick={() => handleReject(row.id)}
                      className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(null)}
                      className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {rejectingId !== row.id && (
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleApprove(row.id)}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingId(row.id)}
                  className="px-4 py-2 rounded-lg border-2 border-red-500 text-red-600 text-xs font-bold hover:bg-red-50"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
