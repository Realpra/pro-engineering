'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Info, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { saveBooking, getBooking } from '@/lib/booking'
import { cn, formatINR } from '@/lib/utils'

interface Benchmark {
  min: number
  max: number
  unit: string
  note: string
  isPercentage?: boolean
}

const BENCHMARKS: Record<string, Benchmark> = {
  'home-renovation':     { min: 800,     max: 2500,   unit: '/ sqft',        note: 'Typical range for 1,000–3,000 sqft residential renovation, Delhi NCR · DSR 2024' },
  'leak-proofing':       { min: 80,      max: 350,    unit: '/ sqft',        note: 'Waterproofing treatment area; includes membrane + finishing coat · MH-CSR 2023' },
  'construction':        { min: 1800,    max: 4500,   unit: '/ sqft',        note: 'Ground-up construction including RCC structure, brick, plaster & basic finishes' },
  'it-project':          { min: 500000,  max: 5000000,unit: '/ project',     note: 'Highly variable by complexity; includes design, dev, testing & deployment' },
  'clean-energy':        { min: 40000,   max: 85000,  unit: '/ kW',          note: 'Grid-tied rooftop solar; includes panels, inverter, mounting & net-metering' },
  'life-sciences':       { min: 3000,    max: 12000,  unit: '/ sqft',        note: 'Lab or cleanroom fit-out including HVAC, flooring, benching & services' },
  'geo-technical':       { min: 75000,   max: 750000, unit: '/ project',     note: 'Site investigation with boreholes, SPT, lab testing & geotechnical report' },
  'project-management':  { min: 2,       max: 5,      unit: '% of cost',     note: 'Monthly retainer or percentage of total project cost', isPercentage: true },
  'manufacturing':       { min: 2500,    max: 8000,   unit: '/ sqft',        note: 'Factory or industrial plant setup including structure, MEP & equipment plinths' },
}

const PRESETS = [250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000]

function budgetStatus(budget: number, bench: Benchmark): 'low' | 'match' | 'high' | null {
  if (bench.isPercentage || !budget) return null
  // Estimate rough project size (1000 sqft for per-sqft types)
  const estimateMid = ((bench.min + bench.max) / 2) * 1000
  if (budget < estimateMid * 0.5) return 'low'
  if (budget > estimateMid * 2)   return 'high'
  return 'match'
}

export default function BudgetPage() {
  const router = useRouter()
  const [raw, setRaw] = useState('')
  const [jobType, setJobType]   = useState('')
  const [jobTitle, setJobTitle] = useState('')

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType) { router.replace('/book'); return }
    setJobType(b.jobType)
    setJobTitle(b.jobTitle || '')
    if (b.budget) setRaw(String(b.budget))
  }, [router])

  const budget = Number(raw) || 0
  const bench  = BENCHMARKS[jobType]
  const status = bench ? budgetStatus(budget, bench) : null

  function handleContinue() {
    if (budget < 10_000) return
    saveBooking({ budget })
    router.push('/book/schedule')
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">What's your budget?</h1>
        <p className="text-slate-500 text-sm mt-1">Enter your total project budget — we'll scope accordingly</p>
      </div>

      {/* Input */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 shadow-sm">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
          Total Budget (INR)
        </label>
        <div className="flex items-baseline gap-2 border-b-2 border-blue-700 pb-2">
          <span className="text-3xl font-bold text-slate-300">₹</span>
          <input
            type="number"
            min={0}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder="0"
            className="flex-1 text-3xl font-bold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        {budget > 0 && (
          <p className="text-sm font-medium text-slate-500 mt-2">{formatINR(budget)}</p>
        )}

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 mt-4">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setRaw(String(p))}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                budget === p
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400',
              )}
            >
              {formatINR(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Zone Benchmark */}
      {bench && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-800">Zone Benchmark · Delhi NCR</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 mb-0.5 font-medium">Typical Low</p>
              <p className="text-base font-bold text-slate-900">
                {bench.isPercentage ? `${bench.min}%` : formatINR(bench.min)}
                <span className="text-xs font-normal text-slate-500 ml-1">{bench.unit}</span>
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 mb-0.5 font-medium">Typical High</p>
              <p className="text-base font-bold text-slate-900">
                {bench.isPercentage ? `${bench.max}%` : formatINR(bench.max)}
                <span className="text-xs font-normal text-slate-500 ml-1">{bench.unit}</span>
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-3 py-2">{bench.note}</p>

          {/* Budget status banner */}
          {status && (
            <div className={cn(
              'flex items-start gap-2 mt-3 rounded-xl px-3 py-2.5 text-xs font-medium',
              status === 'low'   && 'bg-amber-50 text-amber-800',
              status === 'match' && 'bg-blue-50 text-blue-800',
              status === 'high'  && 'bg-green-50 text-green-800',
            )}>
              {status === 'low'   && <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />}
              {status === 'match' && <Minus className="w-4 h-4 shrink-0 mt-0.5" />}
              {status === 'high'  && <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>
                {status === 'low'   && "Budget may be below typical range. Our engineer will recommend a phased approach."}
                {status === 'match' && "Budget aligns well with typical project costs for this job type."}
                {status === 'high'  && "Budget is above average — good scope for premium materials and finishes."}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto pt-4">
        <button
          onClick={handleContinue}
          disabled={budget < 10_000}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-base transition-all',
            budget >= 10_000
              ? 'bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          Continue →
        </button>
        {budget > 0 && budget < 10_000 && (
          <p className="text-center text-xs text-red-500 mt-2">Minimum budget is ₹10,000</p>
        )}
      </div>
    </div>
  )
}
