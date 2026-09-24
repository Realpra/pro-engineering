'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Calendar, MapPin, Wrench, FileText, Shield } from 'lucide-react'
import { getBooking } from '@/lib/booking'
import { cn, formatINR, formatDate, addWeeks } from '@/lib/utils'

interface Milestone {
  label: string
  percent: number
  description: string
}

const MILESTONES: Milestone[] = [
  { label: 'Mobilisation',  percent: 10, description: 'Site setup, material delivery, contractor onboarding' },
  { label: 'Structural',    percent: 20, description: 'Foundation, frame, and structural elements completed' },
  { label: 'MEP',           percent: 15, description: 'Mechanical, electrical and plumbing rough-in works' },
  { label: 'Finishes',      percent: 30, description: 'Flooring, wall finishes, ceiling, joinery and fixtures' },
  { label: 'Handover',      percent: 15, description: 'Commissioning, snag clearance and client walkthrough' },
  { label: 'Retention',     percent: 10, description: 'Released after 12-week defect liability period ends' },
]

const TERMS = [
  'The estimate is indicative. Final contract price will be confirmed after a site survey and detailed BOQ.',
  'GST and BOCW cess are statutory and non-negotiable.',
  'Variations from scope will be priced via approved Variation Orders.',
  'No payment is required to submit this enquiry. Payment is milestone-linked and begins only after you review and approve the final scope and price.',
  'Pro Engineering\'s standard terms and defects liability provisions apply.',
]

export default function ConfirmationPage() {
  const router = useRouter()
  const [jobTitle, setJobTitle]         = useState('')
  const [serviceModelTitle, setSMT]     = useState('')
  const [district, setDistrict]         = useState('')
  const [zone, setZone]                 = useState('')
  const [startDate, setStartDate]       = useState('')
  const [durationWeeks, setDuration]    = useState(8)
  const [estimateTotal, setTotal]       = useState(0)
  const [termsAccepted, setTerms]       = useState(false)

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType || !b.estimateTotal) { router.replace('/book'); return }
    setJobTitle(b.jobTitle || '')
    setSMT(b.serviceModelTitle || '')
    setDistrict(b.district || '')
    setZone(b.zone || '')
    setStartDate(b.startDate || '')
    setDuration(b.durationWeeks || 8)
    setTotal(b.estimateTotal || 0)
  }, [router])

  const endDate = startDate ? addWeeks(startDate, durationWeeks) : ''
  let cumulativePercent = 0

  function handleProceed() {
    if (!termsAccepted) return
    router.push('/book/submit')
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">Order Confirmation</h1>
        <p className="text-slate-500 text-sm mt-1">Review your enquiry before submitting — no payment required</p>
      </div>

      {/* Booking summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Booking Summary</h2>
        </div>

        <div className="divide-y divide-slate-50">
          <div className="px-5 py-3 flex items-center gap-3">
            <Wrench className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 w-28 shrink-0">Service Model</span>
            <span className="text-sm font-semibold text-slate-900">{serviceModelTitle}</span>
          </div>
          <div className="px-5 py-3 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 w-28 shrink-0">Site Location</span>
            <span className="text-sm font-semibold text-slate-900">{district}{zone ? ` · ${zone} Zone` : ''}</span>
          </div>
          <div className="px-5 py-3 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 w-28 shrink-0">Project Dates</span>
            <span className="text-sm font-semibold text-slate-900">
              {startDate ? formatDate(startDate) : '—'}
              {endDate ? ` → ${formatDate(endDate)}` : ''}
            </span>
          </div>
          <div className="px-5 py-3 flex items-center gap-3">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 w-28 shrink-0">Estimate Total</span>
            <span className="text-sm font-bold text-slate-900">{formatINR(estimateTotal)}</span>
          </div>
        </div>
      </div>

      {/* Milestone schedule */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Indicative Payment Milestone Schedule</h2>
        </div>
        <div className="px-5 pt-3">
          <p className="text-xs text-slate-500 mb-3">
            No payment now — this previews how payment is structured once you approve the final estimate after survey.
          </p>
        </div>

        <div className="px-5 pt-1 pb-2">
          {MILESTONES.map((m, i) => {
            cumulativePercent += m.percent
            const amount = Math.round(estimateTotal * m.percent / 100)
            const cumDate = startDate ? addWeeks(startDate, Math.round(durationWeeks * cumulativePercent / 100)) : ''
            return (
              <div key={i} className="flex items-start gap-3 mb-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                    i === MILESTONES.length - 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
                  )}>
                    M{i + 1}
                  </div>
                  {i < MILESTONES.length - 1 && <div className="w-0.5 h-4 bg-slate-100 mt-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{m.label}</p>
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{formatINR(amount)}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-400">{m.percent}% of contract</span>
                    {cumDate && <span className="text-[10px] text-slate-300">· est. {formatDate(cumDate)}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* T&Cs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Shield className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900">Terms & Conditions</h2>
        </div>
        <div className="px-5 py-4 space-y-2">
          {TERMS.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-slate-400 mt-0.5 shrink-0">{i + 1}.</span>
              <p className="text-xs text-slate-600 leading-relaxed">{t}</p>
            </div>
          ))}
        </div>

        <div className="px-5 pb-4">
          <button
            onClick={() => setTerms(t => !t)}
            className="flex items-center gap-3 w-full text-left"
          >
            <div className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
              termsAccepted ? 'bg-blue-700 border-blue-700' : 'border-slate-300',
            )}>
              {termsAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-sm text-slate-700">I have read and agree to the terms above</span>
          </button>
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={handleProceed}
          disabled={!termsAccepted}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-base transition-all',
            termsAccepted
              ? 'bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          Submit Enquiry →
        </button>
        {!termsAccepted && (
          <p className="text-center text-xs text-slate-400 mt-2">Please accept the terms to continue</p>
        )}
      </div>
    </div>
  )
}
