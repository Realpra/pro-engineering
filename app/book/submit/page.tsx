'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Copy } from 'lucide-react'
import { getBooking, saveBooking, clearBooking, JOB_TYPE_DB_MAP } from '@/lib/booking'
import { createClient } from '@/lib/supabase-client'
import { createClientDevAuthAccount } from '@/app/book/actions'
import { cn, formatDate } from '@/lib/utils'

type Stage = 'select' | 'processing' | 'success' | 'error'

function generateRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'PE'
  for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

export default function SubmitPage() {
  const router = useRouter()
  const [jobTitle, setJobTitle]     = useState('')
  const [district, setDistrict]     = useState('')
  const [startDate, setStartDate]   = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [stage, setStage]           = useState<Stage>('select')
  const [bookingRef, setRef]        = useState('')
  const [error, setError]           = useState('')
  const [copied, setCopied]         = useState(false)
  const [devLoginEmail, setDevLoginEmail] = useState<string | null>(null)

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType || !b.estimateTotal) { router.replace('/book'); return }
    setJobTitle(b.jobTitle || '')
    setDistrict(b.district || '')
    setStartDate(b.startDate || '')
    setContactName(b.contactName || '')
    setContactPhone(b.contactPhone || '')
    setContactEmail(b.contactEmail || '')
  }, [router])

  async function handleSubmit() {
    setStage('processing')
    setError('')

    const ref = generateRef()

    const supabase = createClient()
    const b = getBooking()

    const { data: sessionData } = await supabase.auth.getSession()
    const insertPayload = {
      booking_ref: ref,
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim() || null,
      job_title: b.jobTitle || 'Construction Project',
      job_type: JOB_TYPE_DB_MAP[b.jobType || ''] || 'other',
      zone: b.zone || null,
      district: b.district || null,
      budget_min: b.budget ? Math.round(b.budget * 0.8) : null,
      budget_max: b.budget || null,
      preferred_start_date: b.startDate || null,
      duration_weeks: b.durationWeeks || null,
      service_model: b.serviceModel || null,
      service_model_title: b.serviceModelTitle || null,
      estimate_total: b.estimateTotal || null,
      status: 'enquiry',
    }
    console.log('[submit] auth session:', sessionData?.session ?? 'no session (anon)')
    console.log('[submit] insert payload:', insertPayload)

    const { error: insertErr } = await supabase.from('guest_enquiries').insert(insertPayload)

    if (insertErr) {
      const msg = [
        `message: ${insertErr.message}`,
        `code: ${insertErr.code ?? 'n/a'}`,
        `details: ${insertErr.details ?? 'n/a'}`,
        `hint: ${insertErr.hint ?? 'n/a'}`,
      ].join('\n')
      console.error('[submit] insert error:', insertErr)
      setError(msg)
      setStage('select')
      return
    }

    // The site-visit screen collects a requested date/slot but never wrote it
    // anywhere -- confirmed real gap (Client field inventory). Non-fatal if
    // this insert fails: the enquiry itself is already safely saved above.
    if (b.siteVisitDate && b.siteVisitSlot) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('site_visit_requests').insert({
        booking_ref: ref,
        visit_category: 'scope_survey',
        requested_date: b.siteVisitDate,
        requested_slot: b.siteVisitSlot,
        requested_by_role: 'client',
        source: 'book_form',
        status: 'pending',
      })
    }

    // Dev/beta convention (mirrors Worker Onboarding's createWorkerAuthAccount):
    // every booking gets its own real, distinct auth.users row immediately, so
    // local development/testing of the Client flow is never blocked on real
    // email/SMS delivery. Non-fatal if it fails -- the enquiry is already safely
    // saved above, and the real self-service login (Magic Link/Phone OTP) still
    // works independently of this.
    if (contactName.trim()) {
      const devAccount = await createClientDevAuthAccount(ref, contactName.trim())
      if (devAccount.loginEmail) setDevLoginEmail(devAccount.loginEmail)
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

        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Enquiry Submitted!</h1>
        <p className="text-slate-500 text-sm text-center mb-8">
          Your project has been registered with Pro Engineering — no payment was required
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

        {devLoginEmail && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Dev/Beta Login (for testing)</p>
            <p className="text-sm text-amber-900 font-mono">{devLoginEmail}</p>
            <p className="text-xs text-amber-700 mt-1">Password: Client2026 — use this at /client/login (Email Login tab) to view this project&apos;s dashboard during development.</p>
          </div>
        )}

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
          </div>
        </div>

        <div className="w-full space-y-3">
          <div className="flex items-start gap-3 bg-blue-50 rounded-2xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">Our project coordinator will call you within 24 hours</p>
          </div>
          <div className="flex items-start gap-3 bg-blue-50 rounded-2xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">A site engineer will visit for a free survey before any quote is finalised</p>
          </div>
          <div className="flex items-start gap-3 bg-blue-50 rounded-2xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">No payment is due until you review and approve the final scope and price</p>
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
        <h2 className="text-lg font-bold text-slate-900 mb-2">Submitting Your Enquiry</h2>
        <p className="text-slate-500 text-sm text-center">Please do not close this window…</p>
      </div>
    )
  }

  const isValid = contactName.trim().length > 0 && contactPhone.trim().length >= 10

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">Submit Your Enquiry</h1>
        <p className="text-slate-500 text-sm mt-1">No payment required — a coordinator will call you to arrange a free site survey</p>
      </div>

      {/* Contact details */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Contact Details</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={e => {
                setContactName(e.target.value)
                saveBooking({ contactName: e.target.value })
              }}
              placeholder="Full name"
              className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Mobile Number
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={e => {
                setContactPhone(e.target.value)
                saveBooking({ contactPhone: e.target.value })
              }}
              placeholder="10-digit mobile number"
              className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Your coordinator will call this number, and you'll use it to sign in to your project dashboard.</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Email <span className="text-slate-300 normal-case">(optional)</span>
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => {
                setContactEmail(e.target.value)
                saveBooking({ contactEmail: e.target.value })
              }}
              placeholder="you@example.com"
              className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 whitespace-pre-wrap font-mono">
          <p className="font-bold mb-1 font-sans">Supabase insert failed:</p>
          {error}
        </div>
      )}

      <div className="mt-auto">
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-base transition-all',
            isValid
              ? 'bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          Submit Enquiry →
        </button>
        <p className="text-center text-xs text-slate-400 mt-2">
          No payment is required to submit this enquiry
        </p>
      </div>
    </div>
  )
}
