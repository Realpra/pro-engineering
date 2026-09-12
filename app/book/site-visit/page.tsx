'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, MapPin, Shield, CheckCircle2 } from 'lucide-react'
import { saveBooking, getBooking } from '@/lib/booking'
import { cn, formatDate } from '@/lib/utils'

const SLOTS = [
  { id: 'morning',   label: 'Morning',   time: '9:00 AM – 12:00 PM' },
  { id: 'afternoon', label: 'Afternoon', time: '12:00 PM – 4:00 PM'  },
  { id: 'evening',   label: 'Evening',   time: '4:00 PM – 7:00 PM'   },
]

function minVisitDate() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return d.toISOString().split('T')[0]
}

export default function SiteVisitPage() {
  const router = useRouter()
  const [jobTitle, setJobTitle]           = useState('')
  const [serviceModelTitle, setSMT]       = useState('')
  const [district, setDistrict]           = useState('')
  const [visitDate, setVisitDate]         = useState('')
  const [visitSlot, setVisitSlot]         = useState<string | null>(null)

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType) { router.replace('/book'); return }
    setJobTitle(b.jobTitle || '')
    setSMT(b.serviceModelTitle || '')
    setDistrict(b.district || '')
    if (b.siteVisitDate) setVisitDate(b.siteVisitDate)
    if (b.siteVisitSlot) setVisitSlot(b.siteVisitSlot)
  }, [router])

  const isValid = visitDate && visitSlot

  function handleContinue() {
    if (!isValid) return
    saveBooking({ siteVisitDate: visitDate, siteVisitSlot: visitSlot! })
    router.push('/book/scope-report')
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">Book your site visit</h1>
        <p className="text-slate-500 text-sm mt-1">Our engineer will visit the site to assess scope and prepare a report</p>
      </div>

      {/* What to expect */}
      <div className="bg-blue-700 rounded-2xl p-5 mb-4 text-white">
        <p className="text-xs font-bold uppercase tracking-widest mb-3 text-blue-200">What happens at the site visit</p>
        {[
          'Site measurement and condition assessment',
          'Photograph and document existing conditions',
          'Discuss scope, material preferences and timeline',
          'Identify risks and access constraints',
          'Scope report delivered within 48 hours',
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 mb-2 last:mb-0">
            <CheckCircle2 className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-100">{item}</p>
          </div>
        ))}
      </div>

      {/* Booking details */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 shadow-sm space-y-4">
        {/* Location summary */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Site Location</p>
            <p className="text-sm font-semibold text-slate-900">{district || 'Delhi NCR'}</p>
            <p className="text-xs text-slate-500">{serviceModelTitle}</p>
          </div>
        </div>

        {/* Date picker */}
        <div>
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            <Calendar className="w-3.5 h-3.5" />
            Preferred Date (min 2 days notice)
          </label>
          <input
            type="date"
            min={minVisitDate()}
            value={visitDate}
            onChange={e => setVisitDate(e.target.value)}
            className="w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Time slot */}
        <div>
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            <Clock className="w-3.5 h-3.5" />
            Preferred Time Slot
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map(s => (
              <button
                key={s.id}
                onClick={() => setVisitSlot(s.id)}
                className={cn(
                  'flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all',
                  visitSlot === s.id
                    ? 'border-blue-700 bg-blue-50'
                    : 'border-slate-200 bg-slate-50 hover:border-blue-300',
                )}
              >
                <span className={cn('text-xs font-bold', visitSlot === s.id ? 'text-blue-700' : 'text-slate-700')}>
                  {s.label}
                </span>
                <span className={cn('text-[10px] mt-0.5', visitSlot === s.id ? 'text-blue-500' : 'text-slate-400')}>
                  {s.time}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation summary */}
      {visitDate && visitSlot && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">Site visit confirmed</p>
            <p className="text-xs text-green-700 mt-0.5">
              {formatDate(visitDate)} · {SLOTS.find(s => s.id === visitSlot)?.time}
            </p>
            <p className="text-xs text-green-600 mt-1">You'll receive a WhatsApp confirmation with engineer details</p>
          </div>
        </div>
      )}

      <div className="mt-auto pt-2">
        <button
          onClick={handleContinue}
          disabled={!isValid}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-base transition-all',
            isValid
              ? 'bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          Confirm Site Visit →
        </button>
        <p className="text-center text-xs text-slate-400 mt-2">No payment required to book the site visit</p>
      </div>
    </div>
  )
}
