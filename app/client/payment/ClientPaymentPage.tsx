'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { confirmTokenPayment } from './actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  boq: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  milestone: any | null
}

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

export default function ClientPaymentPage({ booking, milestone }: Props) {
  const amount = Number(milestone?.payment_amount ?? 0)
  const bookingRef = booking?.booking_ref ?? ''
  const jobTitle = booking?.job_title ?? 'Renovation Project'
  const milestoneCode = milestone?.milestone_code ?? 'M0'
  const referenceNumber = `${bookingRef}-${milestoneCode}`

  const [utr, setUtr] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [success, setSuccess] = useState<{ utr: string; amount: number; submittedAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isReady = utr.length >= 12 && confirmed

  async function handleCopy() {
    await navigator.clipboard.writeText('proengineering@ybl')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSubmit() {
    if (!isReady || submitting) return
    setSubmitting(true)
    setError(null)

    let base64: string | null = null
    if (screenshotFile) {
      base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(screenshotFile)
      })
    }

    const result = await confirmTokenPayment(bookingRef, utr, base64, milestoneCode)

    if (!result.success) {
      setSubmitting(false)
      setError(result.error ?? 'Submission failed. Please try again.')
      return
    }

    // submitting stays true — success screen replaces the form
    setSuccess({ utr, amount, submittedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) })
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-600 px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-bold text-lg">Payment confirmation submitted successfully</p>
          </div>
          <div className="px-6 py-6 space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">UTR Number</span>
                <span className="font-bold text-gray-800">{success.utr}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-gray-800">₹ {fmtInr(success.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Submitted at</span>
                <span className="font-bold text-gray-800">{success.submittedAt}</span>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-800 leading-relaxed">
                Our coordinator will verify your payment within 2 hours. You will receive SMS confirmation on your registered mobile.
              </p>
            </div>
            <Link href="/client/dashboard"
              className="block w-full py-3.5 rounded-xl bg-[#1F3864] text-white text-sm font-bold text-center hover:bg-[#162950] transition-colors">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1F3864] text-white px-4 py-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2E74B5] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Pro Engineering</p>
            <p className="text-blue-300 text-xs">{milestoneCode === 'M0' ? 'Token Payment' : `${milestoneCode} Milestone Payment`}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-16">

        {/* ── SECTION A — Payment Summary ──────────────────────────────────── */}
        <div className="bg-[#1F3864] rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-5">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-0.5">Payment Summary</p>
            <p className="text-white font-bold text-base">{jobTitle}</p>
            <p className="text-blue-200 text-xs mt-0.5">{bookingRef}</p>
          </div>
          <div className="bg-white/10 px-5 py-4 space-y-3">
            <div>
              <p className="text-blue-200 text-[10px] uppercase tracking-wide">Payment Type</p>
              <p className="text-white font-bold text-sm">
                {milestoneCode === 'M0' ? 'Token Advance Payment — Mobilisation' : `${milestoneCode} — ${milestone?.milestone_name ?? 'Milestone Payment'}`}
              </p>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-blue-200 text-[10px] uppercase tracking-wide">Amount Due</p>
                <p className="text-white font-black text-2xl">₹ {fmtInr(amount)}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-200 text-[10px] uppercase tracking-wide">Reference</p>
                <p className="text-white font-bold text-sm">{referenceNumber}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <p className="text-blue-200 text-xs">
                <span className="font-semibold text-white">Valid for:</span> 48 hours from estimate acceptance
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION B — UPI Payment Instructions ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">UPI Payment Instructions</p>
          </div>
          <div className="px-5 py-5 space-y-5">
            {/* QR placeholder */}
            <div className="flex justify-center">
              <div className="w-[200px] h-[200px] bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <p className="text-gray-400 text-xs font-semibold">Scan to Pay</p>
                <p className="text-gray-300 text-[10px]">UPI</p>
              </div>
            </div>

            {/* UPI ID copy */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">UPI ID</p>
              <div className="flex items-center gap-3">
                <p className="text-[#1F3864] font-bold text-lg flex-1">proengineering@ybl</p>
                <button type="button" onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-[#1F3864] text-white hover:bg-[#162950]'}`}>
                  {copied ? 'Copied!' : 'COPY'}
                </button>
              </div>
            </div>

            {/* Steps */}
            <ol className="space-y-3">
              {[
                'Open any UPI app (GPay, PhonePe, Paytm, BHIM)',
                'Scan QR code or enter UPI ID: proengineering@ybl',
                `Enter exact amount: ₹ ${fmtInr(amount)}`,
                `In remarks enter: ${referenceNumber}`,
                'Complete payment and note the UTR number from your UPI app',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#1F3864] text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-700">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* ── SECTION C — Payment Confirmation Form ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payment Confirmation</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            {/* UTR input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                UPI Transaction ID / UTR Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={utr}
                onChange={e => setUtr(e.target.value.replace(/\D/g, ''))}
                maxLength={22}
                placeholder="Enter 12-digit UTR number"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
              />
              {utr.length > 0 && utr.length < 12 && (
                <p className="text-xs text-red-500 mt-1">UTR must be at least 12 digits</p>
              )}
            </div>

            {/* Screenshot */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Upload payment screenshot <span className="text-gray-400">(optional)</span>
              </label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-4 text-center cursor-pointer hover:border-[#2E74B5] transition-colors"
                onClick={() => fileInputRef.current?.click()}>
                {screenshotFile ? (
                  <p className="text-sm font-semibold text-[#1F3864]">{screenshotFile.name}</p>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-gray-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-gray-400">Tap to upload screenshot</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => setScreenshotFile(e.target.files?.[0] ?? null)} />
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#1F3864]" />
              <p className="text-xs text-gray-700 leading-relaxed">
                I confirm I have made the payment of{' '}
                <span className="font-bold">₹ {fmtInr(amount)}</span> to{' '}
                <span className="font-bold">proengineering@ybl</span> with reference{' '}
                <span className="font-bold">{referenceNumber}</span>
              </p>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs text-red-700 font-semibold">{error}</p>
              </div>
            )}

            <button type="button" onClick={handleSubmit} disabled={!isReady || submitting}
              className="w-full py-4 rounded-xl bg-[#1F3864] text-white text-sm font-bold hover:bg-[#162950] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {submitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {submitting ? 'Processing…' : 'CONFIRM PAYMENT'}
            </button>

            {/* Simulation notice */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mt-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Simulation Mode</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                In production this will show a real QR code linked to your UPI ID. For testing, enter any 12-digit number as UTR.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
