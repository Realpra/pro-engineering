'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CreditCard, Smartphone, Building2, Loader2, Copy } from 'lucide-react'
import { getBooking, saveBooking, clearBooking, JOB_TYPE_DB_MAP, ZONE_DB_MAP } from '@/lib/booking'
import { createClient } from '@/lib/supabase-client'
import { cn, formatINR, formatDate } from '@/lib/utils'

type PayMethod = 'upi' | 'card' | 'netbanking'
type Stage = 'select' | 'processing' | 'success' | 'error'

function generateRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'PE'
  for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

export default function PaymentPage() {
  const router = useRouter()
  const [tokenAmount, setToken]     = useState(0)
  const [jobTitle, setJobTitle]     = useState('')
  const [district, setDistrict]     = useState('')
  const [startDate, setStartDate]   = useState('')
  const [payMethod, setPayMethod]   = useState<PayMethod>('upi')
  const [upiId, setUpiId]           = useState('')
  const [stage, setStage]           = useState<Stage>('select')
  const [bookingRef, setRef]        = useState('')
  const [error, setError]           = useState('')
  const [copied, setCopied]         = useState(false)

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType || !b.estimateTotal) { router.replace('/book'); return }
    setToken(b.tokenAmount || 25_000)
    setJobTitle(b.jobTitle || '')
    setDistrict(b.district || '')
    setStartDate(b.startDate || '')
  }, [router])

  async function handlePay() {
    setStage('processing')
    setError('')

    const ref = generateRef()

    const supabase = createClient()
    const b = getBooking()

    const { data: sessionData } = await supabase.auth.getSession()
    const insertPayload = {
      booking_ref: ref,
      job_title: b.jobTitle || 'Construction Project',
      job_type: JOB_TYPE_DB_MAP[b.jobType || ''] || 'other',
      zone: ZONE_DB_MAP[b.zone || ''] || 'west',
      district: b.district || null,
      budget_min: b.budget ? Math.round(b.budget * 0.8) : null,
      budget_max: b.budget || null,
      preferred_start_date: b.startDate || null,
      duration_weeks: b.durationWeeks || null,
      service_model: b.serviceModel || null,
      estimate_total: b.estimateTotal || null,
      token_amount: tokenAmount,
      payment_method: payMethod,
      payment_status: 'paid',
      status: 'enquiry',
    }
    console.log('[payment] auth session:', sessionData?.session ?? 'no session (anon)')
    console.log('[payment] insert payload:', insertPayload)

    const { error: insertErr } = await supabase.from('guest_enquiries').insert(insertPayload)

    if (insertErr) {
      const msg = [
        `message: ${insertErr.message}`,
        `code: ${insertErr.code ?? 'n/a'}`,
        `details: ${insertErr.details ?? 'n/a'}`,
        `hint: ${insertErr.hint ?? 'n/a'}`,
      ].join('\n')
      console.error('[payment] insert error:', insertErr)
      setError(msg)
      setStage('select')
      return
    }

    saveBooking({ jobId: ref })
    setRef(ref)
    setStage('success')
  }

  function copyRef() {
    navigator.clipboard.writeText(bookingRef).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDone() {
    clearBooking()
    router.replace('/')
  }

  if (stage === 'success') {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1 items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Booking Confirmed!</h1>
        <p className="text-slate-500 text-sm text-center mb-8">
          Your project has been registered with Pro Engineering
        </p>

        {/* Booking reference */}
        <div className="w-full bg-slate-900 rounded-2xl p-5 mb-6 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Booking Reference</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-black text-white font-mono tracking-widest">{bookingRef}</span>
            <button onClick={copyRef} className="text-slate-400 hover:text-white transition-colors">
              {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Save this reference for all future correspondence</p>
        </div>

        {/* Summary */}
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="divide-y divide-slate-50">
            <div className="px-5 py-3 flex justify-between">
              <span className="text-sm text-slate-500">Project</span>
              <span className="text-sm font-semibold text-slate-900">{jobTitle}</span>
            </div>
            <div className="px-5 py-3 flex justify-between">
              <span className="text-sm text-slate-500">Site Location</span>
              <span className="text-sm font-semibold text-slate-900">{district}</span>
            </div>
            {startDate && (
              <div className="px-5 py-3 flex justify-between">
                <span className="text-sm text-slate-500">Planned Start</span>
                <span className="text-sm font-semibold text-slate-900">{formatDate(startDate)}</span>
              </div>
            )}
            <div className="px-5 py-3 flex justify-between">
              <span className="text-sm text-slate-500">Token Paid</span>
              <span className="text-sm font-bold text-green-700">{formatINR(tokenAmount)}</span>
            </div>
          </div>
        </div>

        <div className="w-full space-y-3">
          <div className="flex items-start gap-3 bg-blue-50 rounded-2xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">Our project coordinator will call you within 24 hours</p>
          </div>
          <div className="flex items-start gap-3 bg-blue-50 rounded-2xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">Detailed contract sent to your email within 48 hours</p>
          </div>
          <div className="flex items-start gap-3 bg-blue-50 rounded-2xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">Site engineer assigned and mobilisation plan shared in 5 business days</p>
          </div>
        </div>

        <div className="mt-8 w-full">
          <button
            onClick={handleDone}
            className="w-full py-4 rounded-2xl font-semibold text-base bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'processing') {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1 items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-6" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Processing Payment</h2>
        <p className="text-slate-500 text-sm text-center">Please do not close this window…</p>
      </div>
    )
  }

  const PAY_METHODS = [
    { id: 'upi' as PayMethod,        label: 'UPI',          icon: Smartphone,  desc: 'PhonePe, GPay, Paytm, BHIM' },
    { id: 'card' as PayMethod,       label: 'Card',         icon: CreditCard,  desc: 'Debit or Credit Card'        },
    { id: 'netbanking' as PayMethod, label: 'Net Banking',  icon: Building2,   desc: 'All major Indian banks'      },
  ]

  const isValid = payMethod === 'upi' ? upiId.includes('@') : true

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">Advance Token Payment</h1>
        <p className="text-slate-500 text-sm mt-1">Pay the token to confirm your booking</p>
      </div>

      {/* Amount */}
      <div className="bg-slate-900 rounded-2xl p-5 mb-4 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Token Amount</p>
        <p className="text-4xl font-black text-white">{formatINR(tokenAmount)}</p>
        <p className="text-xs text-slate-500 mt-1">Adjustable against Milestone 1 · Refundable within 7 days</p>
      </div>

      {/* Payment method */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Payment Method</h2>
        </div>

        <div className="p-4 grid grid-cols-3 gap-2 border-b border-slate-100">
          {PAY_METHODS.map(m => {
            const Icon = m.icon
            const active = payMethod === m.id
            return (
              <button
                key={m.id}
                onClick={() => setPayMethod(m.id)}
                className={cn(
                  'flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all',
                  active ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-blue-300',
                )}
              >
                <Icon className={cn('w-5 h-5 mb-1', active ? 'text-blue-700' : 'text-slate-500')} />
                <span className={cn('text-xs font-bold', active ? 'text-blue-700' : 'text-slate-700')}>
                  {m.label}
                </span>
                <span className={cn('text-[10px] text-center mt-0.5', active ? 'text-blue-500' : 'text-slate-400')}>
                  {m.desc}
                </span>
              </button>
            )
          })}
        </div>

        {/* UPI input */}
        {payMethod === 'upi' && (
          <div className="px-5 py-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              UPI ID
            </label>
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Card placeholder */}
        {payMethod === 'card' && (
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Card Number</label>
              <input type="text" placeholder="•••• •••• •••• ••••" maxLength={19}
                className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Expiry</label>
                <input type="text" placeholder="MM / YY" maxLength={7}
                  className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">CVV</label>
                <input type="password" placeholder="•••" maxLength={4}
                  className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Net banking placeholder */}
        {payMethod === 'netbanking' && (
          <div className="px-5 py-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Select Bank</label>
            <select className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Choose your bank…</option>
              {['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Bank of Baroda', 'Punjab National Bank', 'Canara Bank'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="w-3.5 h-3.5 text-green-600" />
        <p className="text-xs text-slate-400">256-bit SSL encrypted · PCI DSS compliant · Powered by Razorpay</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 whitespace-pre-wrap font-mono">
          <p className="font-bold mb-1 font-sans">Supabase insert failed:</p>
          {error}
        </div>
      )}

      <div className="mt-auto">
        <button
          onClick={handlePay}
          disabled={!isValid}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-base transition-all',
            isValid
              ? 'bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          Pay {formatINR(tokenAmount)} Now →
        </button>
        <p className="text-center text-xs text-slate-400 mt-2">
          Refundable within 7 days of booking confirmation
        </p>
      </div>
    </div>
  )
}
