'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, MapPin } from 'lucide-react'
import { saveBooking, getBooking } from '@/lib/booking'
import { getBookingGeoTree, type GeoNode } from '@/app/book/actions'
import { cn } from '@/lib/utils'

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

  const [geo, setGeo]                   = useState<GeoNode[]>([])
  const [districtId, setDistrictId]     = useState('')
  const [regionId, setRegionId]         = useState('')
  const [zoneId, setZoneId]             = useState('')
  const [sectorId, setSectorId]         = useState('')

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType) { router.replace('/book'); return }
    setJobTitle(b.jobTitle || '')
    if (b.startDate)     setStartDate(b.startDate)
    if (b.durationWeeks) setDuration(b.durationWeeks)
    getBookingGeoTree().then(setGeo)
  }, [router])

  const districts = geo.filter(g => g.level === 'district')
  const regions   = geo.filter(g => g.level === 'region' && g.parent_id === districtId)
  const zones     = geo.filter(g => g.level === 'zone' && g.parent_id === regionId)
  const sectors   = geo.filter(g => g.level === 'sector' && g.parent_id === zoneId)

  function selectDistrict(id: string) {
    setDistrictId(id)
    setRegionId('')
    setZoneId('')
    setSectorId('')
  }

  function selectRegion(id: string) {
    setRegionId(id)
    setZoneId('')
    setSectorId('')
  }

  function selectZone(id: string) {
    setZoneId(id)
    setSectorId('')
  }

  const districtName = districts.find(d => d.id === districtId)?.name ?? ''
  const sectorName   = sectors.find(s => s.id === sectorId)?.name ?? ''

  const isValid = startDate && durationWeeks && districtId && sectorId

  function handleContinue() {
    if (!isValid) return
    saveBooking({ startDate, durationWeeks: durationWeeks!, zone: sectorName, district: districtName })
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

        {/* Site Location -- real geo_hierarchy cascade */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            <MapPin className="w-3.5 h-3.5" />
            Site Location
          </label>

          {geo.length === 0 ? (
            <p className="text-sm text-slate-400">Loading service areas…</p>
          ) : (
            <div className="space-y-3">
              <select
                value={districtId}
                onChange={e => selectDistrict(e.target.value)}
                className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select district…</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              {districtId && (
                regions.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                    We don&apos;t serve this district yet. Choose another, or a coordinator will confirm coverage after you submit.
                  </p>
                ) : (
                  <select
                    value={regionId}
                    onChange={e => selectRegion(e.target.value)}
                    className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select region…</option>
                    {regions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )
              )}

              {regionId && zones.length > 0 && (
                <select
                  value={zoneId}
                  onChange={e => selectZone(e.target.value)}
                  className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select zone…</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              )}

              {zoneId && sectors.length > 0 && (
                <select
                  value={sectorId}
                  onChange={e => setSectorId(e.target.value)}
                  className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select sector / area…</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
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
