'use client'

import { useState } from 'react'
import { verifyPayment, rejectPayment } from '@/app/client/payment/actions'

type PaymentRow = {
  id: string
  booking_ref: string
  utr_number: string
  amount: number | null
  status: string
  created_at: string
  jobTitle: string | null
}

type Props = {
  payments: PaymentRow[]
  coordinatorId: string
}

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtDatetime(s: string) {
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function PendingPaymentsPanel({ payments, coordinatorId }: Props) {
  const [rows, setRows] = useState(payments)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msgMap, setMsgMap] = useState<Record<string, { text: string; ok: boolean }>>({})

  async function handleVerify(row: PaymentRow) {
    setBusy(row.id)
    const res = await verifyPayment(row.booking_ref, row.id, coordinatorId)
    setBusy(null)
    if (res.success) {
      setRows(prev => prev.filter(r => r.id !== row.id))
    } else {
      setMsgMap(prev => ({ ...prev, [row.id]: { text: res.error ?? 'Error', ok: false } }))
    }
  }

  async function handleReject(row: PaymentRow) {
    const reason = rejectReasonMap[row.id] ?? ''
    if (!reason.trim()) {
      setMsgMap(prev => ({ ...prev, [row.id]: { text: 'Enter rejection reason first', ok: false } }))
      return
    }
    setBusy(row.id)
    const res = await rejectPayment(row.booking_ref, row.id, reason)
    setBusy(null)
    if (res.success) {
      setRows(prev => prev.filter(r => r.id !== row.id))
      setRejectingId(null)
    } else {
      setMsgMap(prev => ({ ...prev, [row.id]: { text: res.error ?? 'Error', ok: false } }))
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#1F3864] mb-2">No pending payments</h3>
          <p className="text-sm text-gray-500">All payment confirmations have been processed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rows.map(row => {
        const isRejecting = rejectingId === row.id
        const msg = msgMap[row.id]
        return (
          <div key={row.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold text-[#2E74B5] bg-[#2E74B5]/10 px-2 py-0.5 rounded-md">
                    {row.booking_ref}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {row.status === 'verification_pending' ? 'Verification Pending' : 'Pending Verification'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#1F3864] truncate">
                  {row.jobTitle ?? 'Untitled Job'}
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600">
                  <div>
                    <span className="text-gray-400 uppercase tracking-wide text-[10px]">Amount</span>
                    <p className="font-bold text-gray-800 text-sm">₹ {fmtInr(row.amount ?? 0)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase tracking-wide text-[10px]">UTR Number</span>
                    <p className="font-bold text-gray-800">{row.utr_number}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase tracking-wide text-[10px]">Submitted</span>
                    <p className="font-semibold text-gray-700">{fmtDatetime(row.created_at)}</p>
                  </div>
                </div>

                {isRejecting && (
                  <div className="mt-3">
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Rejection reason <span className="text-red-500">*</span></label>
                    <textarea rows={2} value={rejectReasonMap[row.id] ?? ''}
                      onChange={e => setRejectReasonMap(prev => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Describe why this payment is rejected…"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-400/40" />
                  </div>
                )}

                {msg && (
                  <p className={`mt-2 text-xs font-semibold ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:items-end shrink-0 min-w-[140px]">
                {!isRejecting ? (
                  <>
                    <button type="button" disabled={busy === row.id}
                      onClick={() => handleVerify(row)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors disabled:opacity-50">
                      {busy === row.id ? 'Processing…' : '✓ VERIFY PAYMENT'}
                    </button>
                    <button type="button" disabled={busy === row.id}
                      onClick={() => setRejectingId(row.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border-2 border-red-500 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                      ✗ REJECT
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={busy === row.id}
                      onClick={() => handleReject(row)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
                      {busy === row.id ? 'Processing…' : 'CONFIRM REJECT'}
                    </button>
                    <button type="button" onClick={() => setRejectingId(null)}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-colors">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
