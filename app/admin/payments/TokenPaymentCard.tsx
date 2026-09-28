'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { verifyPayment, rejectPayment } from '@/app/client/payment/actions'

export type TokenPayment = {
  id: string
  booking_ref: string
  milestone_code: string | null
  utr_number: string | null
  screenshot_base64: string | null
  amount: number | string | null
  created_at: string | null
}

function money(v: unknown): string {
  const n = Number(v)
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : '—'
}

function fmtDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TokenPaymentCard({
  payment,
  clientName,
  adminUserId,
}: {
  payment: TokenPayment
  clientName: string
  adminUserId: string
}) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify() {
    setBusy(true)
    setError(null)
    const res = await verifyPayment(payment.booking_ref, payment.id, adminUserId)
    setBusy(false)
    if (!res.success) {
      setError(res.error ?? 'Verification failed.')
      return
    }
    router.refresh()
  }

  async function handleReject() {
    if (!reason.trim()) return
    setBusy(true)
    setError(null)
    const res = await rejectPayment(payment.booking_ref, payment.id, reason.trim())
    setBusy(false)
    if (!res.success) {
      setError(res.error ?? 'Rejection failed.')
      return
    }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight">{payment.booking_ref}</p>
          <p className="text-blue-200 text-xs mt-0.5">Token Payment ({payment.milestone_code ?? 'M0'})</p>
        </div>
        <p className="text-white font-bold text-lg">{money(payment.amount)}</p>
      </div>

      <div className="px-4 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Client</p>
          <p className="text-sm text-gray-800">{clientName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Submitted</p>
          <p className="text-sm text-gray-800">{fmtDate(payment.created_at)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">UTR / Transaction ID</p>
          <p className="text-sm text-gray-800 font-mono">{payment.utr_number ?? '—'}</p>
        </div>
        {payment.screenshot_base64 && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Payment Screenshot</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/*;base64,${payment.screenshot_base64}`}
              alt="Payment screenshot"
              className="max-h-48 rounded-lg border border-gray-200"
            />
          </div>
        )}
      </div>

      <div className="px-4 pb-4 space-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleVerify}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40"
        >
          {busy ? 'Working…' : 'VERIFY PAYMENT'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => setRejecting((v) => !v)}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40"
        >
          REJECT
        </button>
        {rejecting && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864] resize-none"
              placeholder="Rejection reason…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={handleReject}
              className="w-full py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50"
            >
              {busy ? 'Working…' : 'CONFIRM REJECT'}
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
