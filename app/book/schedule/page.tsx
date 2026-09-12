'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, MapPin } from 'lucide-react'
import { saveBooking, getBooking } from '@/lib/booking'
import { cn } from '@/lib/utils'

const ZONES = ['North', 'South', 'East', 'West', 'Central', 'Northeast']

const DELHI_DISTRICTS = [
  'Central Delhi',
  'East Delhi',
  'New Delhi',
  'North Delhi',
  'North East Delhi',
  'North West Delhi',
  'Shahdara',
  'South Delhi',
  'South East Delhi',
  'South West Delhi',
  'West Delhi',
]

const DURATION_OPTIONS = [
  { label: '1 week',   weeks: 1  },
  { label: '2 weeks',  weeks: 2  },
  { label: '4 weeks',  weeks: 4  },
  { label: '8 weeks',  weeks: 8  },
  { label: '3 months', weeks: 12 },
  { label: '6 months', weeks: 26 },
  { label: '12 months',weeks: 52 },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function SchedulePage() {
  const router = useRouter()
  const [jobTitle, setJobTitle]         = useState('')
  const [startDate, setStartDate]       = useState('')
  const [durationWeeks, setDuration]    = useState<number | null>(null)
  const [zone, setZone]                 = useState('')
  const [district, setDistrict]         = useState('')

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType) { router.replace('/book'); return }
    setJobTitle(b.jobTitle || '')
    if (b.startDate)     setStartDate(b.startDate)
    if (b.durationWeeks) setDuration(b.durationWeeks)
    if (b.zone)          setZone(b.zone)
    if (b.district)      setDistrict(b.district)
  }, [router])

  const isValid = startDate && durationWeeks && zone && district

  function handleContinue() {
    if (!isValid) return
    saveBooking({ startDate, durationWeeks: durationWeeks!, zone, district })
    router.push('/book/service-model')
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">When & where?</h1>
        <p className="text-slate-500 text-sm mt-1">Set your project timeline and site location</p>
      </div>

      <div className="space-y-4">
        {/* Start Date */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            <Calendar className="w-3.5 h-3.5" />
            Planned Start Date
          </label>
          <input
            type="date"
            min={todayStr()}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full text-base font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Duration */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Project Duration
          </label>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.weeks}
                onClick={() => setDuration(opt.weeks)}
                className={cn(
                  'py-2 px-1 rounded-xl text-xs font-semibold border transition-all',
                  durationWeeks === opt.weeks
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zone */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            <MapPin className="w-3.5 h-3.5" />
            Service Zone
          </label>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {ZONES.map(z => (
              <button
                key={z}
                onClick={() => setZone(z)}
                className={cn(
                  'py-2 px-3 rounded-xl text-xs font-semibold border transition-all',
                  zone === z
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400',
                )}
              >
                {z}
              </button>
            ))}
          </div>

          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Delhi District
          </label>
          <select
            value={district}
            onChange={e => setDistrict(e.target.value)}
            className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select district…</option>
            {DELHI_DISTRICTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-auto pt-6">
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
          Continue →
        </button>
      </div>
    </div>
  )
}
