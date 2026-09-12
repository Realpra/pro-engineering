'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingDown, Info, CheckSquare, Square, BarChart3 } from 'lucide-react'
import { saveBooking, getBooking } from '@/lib/booking'
import { cn, formatINR } from '@/lib/utils'

interface Element {
  code: string
  element: string
  amount: number
}

interface VEOption {
  id: string
  label: string
  saving: number
  description: string
}

const ELEMENTS_DATA: Record<string, Element[]> = {
  'home-renovation': [
    { code: '1A', element: 'Demolition & Site Preparation',     amount: 85_000  },
    { code: '1B', element: 'Flooring (Vitrified Tiles)',        amount: 360_000 },
    { code: '1C', element: 'Wall Finishes (Paint & Putty)',     amount: 220_000 },
    { code: '1D', element: 'Ceilings (POP False Ceiling)',      amount: 145_000 },
    { code: '1E', element: 'Electrical Works',                  amount: 195_000 },
    { code: '1F', element: 'Plumbing & Sanitary',               amount: 130_000 },
    { code: '1G', element: 'Joinery (Wardrobes & Kitchen)',     amount: 420_000 },
  ],
  'construction': [
    { code: '2A', element: 'Earthwork & Site Clearance',        amount: 120_000 },
    { code: '2B', element: 'Foundation (RCC Raft/Isolated)',    amount: 680_000 },
    { code: '2C', element: 'Superstructure (Columns/Beams)',    amount: 1_250_000 },
    { code: '2D', element: 'Masonry & Plastering',              amount: 480_000 },
    { code: '2E', element: 'Roofing & Waterproofing',           amount: 290_000 },
    { code: '2F', element: 'Doors, Windows & Glazing',          amount: 320_000 },
    { code: '2G', element: 'MEP Services (Rough-in)',           amount: 380_000 },
  ],
  'leak-proofing': [
    { code: '3A', element: 'Investigation & Survey',            amount: 45_000  },
    { code: '3B', element: 'Surface Preparation',               amount: 60_000  },
    { code: '3C', element: 'Crystalline Membrane Treatment',    amount: 180_000 },
    { code: '3D', element: 'Crack Injection (Epoxy)',           amount: 90_000  },
    { code: '3E', element: 'Drainage System',                   amount: 55_000  },
    { code: '3F', element: 'Protective Screed',                 amount: 40_000  },
    { code: '3G', element: 'Testing & Commissioning',           amount: 25_000  },
  ],
}

const VE_OPTIONS: Record<string, VEOption[]> = {
  'home-renovation': [
    { id: 've1', label: 'Standard tiles instead of premium vitrified', saving: 80_000,  description: 'Use 600×600 standard grade vs. imported premium' },
    { id: 've2', label: 'Remove POP false ceiling (1 room only)',      saving: 45_000,  description: 'Retain POP in living room only, remove from bedrooms' },
    { id: 've3', label: 'Semi-modular kitchen (instead of modular)',   saving: 95_000,  description: 'Custom carpenter kitchen vs. branded modular system' },
    { id: 've4', label: 'Phase wardrobes to Year 2',                   saving: 120_000, description: 'Defer modular wardrobes; install basic shutters now' },
  ],
  'construction': [
    { id: 've1', label: 'Clay bricks instead of AAC blocks',          saving: 75_000,  description: 'Traditional clay brick masonry; slower but proven' },
    { id: 've2', label: 'MS windows instead of UPVC',                 saving: 90_000,  description: 'Steel-framed windows with enamel paint finish' },
    { id: 've3', label: 'Limit basement to partial (50%)',             saving: 210_000, description: 'Reduce basement footprint to cut excavation cost' },
    { id: 've4', label: 'Defer external texture finish',              saving: 55_000,  description: 'Plain cement plaster now; texture coat in Year 2' },
  ],
  'leak-proofing': [
    { id: 've1', label: 'Skip protective screed (risk)',               saving: 40_000,  description: 'No screed over membrane — membrane exposed to light foot traffic only' },
    { id: 've2', label: 'Targeted crack repair only (no full membrane)', saving: 85_000, description: 'Inject identified cracks only; full membrane excluded' },
    { id: 've3', label: 'Phase 2: reinstatement finishes deferred',    saving: 35_000,  description: 'Do not reinstate floor tiles now; defer to future phase' },
  ],
}

function getElements(jobType: string): Element[] {
  return ELEMENTS_DATA[jobType] || ELEMENTS_DATA['home-renovation']
}

function getVEOptions(jobType: string): VEOption[] {
  return VE_OPTIONS[jobType] || VE_OPTIONS['home-renovation']
}

const ZONE_FACTOR: Record<string, number> = {
  'South': 1.05, 'Central': 1.08, 'West': 1.0, 'North': 0.97,
  'East': 0.95, 'Northeast': 0.93,
}

export default function EstimatePage() {
  const router = useRouter()
  const [jobTitle, setJobTitle]       = useState('')
  const [jobType, setJobType]         = useState('')
  const [zone, setZone]               = useState('')
  const [budget, setBudget]           = useState(0)
  const [elements, setElements]       = useState<Element[]>([])
  const [veOptions, setVeOptions]     = useState<VEOption[]>([])
  const [selectedVE, setSelectedVE]   = useState<Set<string>>(new Set())

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType || !b.scopeApproved) { router.replace('/book'); return }
    setJobTitle(b.jobTitle || '')
    setJobType(b.jobType)
    setZone(b.zone || 'West')
    setBudget(b.budget || 0)
    setElements(getElements(b.jobType))
    setVeOptions(getVEOptions(b.jobType))
  }, [router])

  function toggleVE(id: string) {
    setSelectedVE(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const zoneFactor  = ZONE_FACTOR[zone] || 1.0
  const subtotal    = Math.round(elements.reduce((s, e) => s + e.amount, 0) * zoneFactor)
  const veSaving    = veOptions.filter(v => selectedVE.has(v.id)).reduce((s, v) => s + v.saving, 0)
  const adjustedSub = subtotal - veSaving
  const overhead    = Math.round(adjustedSub * 0.10)
  const profit      = Math.round(adjustedSub * 0.10)
  const gst         = Math.round((adjustedSub + overhead + profit) * 0.18)
  const bocw        = Math.round(adjustedSub * 0.01)
  const total       = adjustedSub + overhead + profit + gst + bocw
  const token       = Math.max(25_000, Math.round(total * 0.10))

  function handleContinue() {
    saveBooking({ estimateTotal: total, tokenAmount: token })
    router.push('/book/confirmation')
  }

  const zoneVariance = Math.round((zoneFactor - 1) * 100)

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">Elemental Cost Estimate</h1>
        <p className="text-slate-500 text-sm mt-1">Prepared by Pro Engineering · indicative basis</p>
      </div>

      {/* Elemental breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Elemental Breakdown</h2>
        </div>

        <div className="divide-y divide-slate-50">
          {elements.map((el, i) => {
            const adj = Math.round(el.amount * zoneFactor)
            return (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-400 shrink-0 w-6">{el.code}</span>
                <span className="flex-1 text-sm text-slate-800">{el.element}</span>
                <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatINR(adj)}</span>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between">
          <span className="text-sm font-semibold text-slate-700">Subtotal (Elements)</span>
          <span className="text-sm font-bold text-slate-900 tabular-nums">{formatINR(subtotal)}</span>
        </div>
      </div>

      {/* Zone benchmark */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-blue-900">
            {zone} Zone {zoneVariance > 0 ? `+${zoneVariance}%` : zoneVariance < 0 ? `${zoneVariance}%` : ''} market factor applied
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            Base cost adjusted for {zone} Delhi zone rates vs. Delhi NCR average
            {budget > 0 && ` · Your budget: ${formatINR(budget)}`}
          </p>
        </div>
      </div>

      {/* Value Engineering */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <TrendingDown className="w-4 h-4 text-green-600" />
          <h2 className="text-sm font-bold text-slate-900">Value Engineering Options</h2>
          <span className="ml-auto text-xs text-slate-400">Optional savings</span>
        </div>

        <div className="divide-y divide-slate-50">
          {veOptions.map(ve => {
            const active = selectedVE.has(ve.id)
            return (
              <button
                key={ve.id}
                onClick={() => toggleVE(ve.id)}
                className={cn(
                  'w-full text-left px-5 py-4 flex items-start gap-3 transition-colors',
                  active ? 'bg-green-50' : 'hover:bg-slate-50',
                )}
              >
                {active
                  ? <CheckSquare className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  : <Square className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', active ? 'text-green-900' : 'text-slate-800')}>{ve.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{ve.description}</p>
                </div>
                <span className={cn(
                  'text-xs font-bold shrink-0 ml-2',
                  active ? 'text-green-700' : 'text-slate-400',
                )}>
                  -{formatINR(ve.saving)}
                </span>
              </button>
            )
          })}
        </div>

        {selectedVE.size > 0 && (
          <div className="px-5 py-3 bg-green-50 border-t border-green-100 flex justify-between">
            <span className="text-sm font-semibold text-green-800">Total VE Savings</span>
            <span className="text-sm font-bold text-green-700">-{formatINR(veSaving)}</span>
          </div>
        )}
      </div>

      {/* Cost summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Cost Summary</h2>
        </div>
        <div className="divide-y divide-slate-50">
          <div className="px-5 py-3 flex justify-between">
            <span className="text-sm text-slate-600">Adjusted works cost</span>
            <span className="text-sm font-medium text-slate-900 tabular-nums">{formatINR(adjustedSub)}</span>
          </div>
          <div className="px-5 py-3 flex justify-between">
            <span className="text-sm text-slate-600">Overhead & preliminaries (10%)</span>
            <span className="text-sm text-slate-900 tabular-nums">{formatINR(overhead)}</span>
          </div>
          <div className="px-5 py-3 flex justify-between">
            <span className="text-sm text-slate-600">Contractor margin (10%)</span>
            <span className="text-sm text-slate-900 tabular-nums">{formatINR(profit)}</span>
          </div>
          <div className="px-5 py-3 flex justify-between">
            <span className="text-sm text-slate-600">GST @ 18%</span>
            <span className="text-sm text-slate-900 tabular-nums">{formatINR(gst)}</span>
          </div>
          <div className="px-5 py-3 flex justify-between">
            <span className="text-sm text-slate-600">BOCW Welfare Cess (1%)</span>
            <span className="text-sm text-slate-900 tabular-nums">{formatINR(bocw)}</span>
          </div>
        </div>
        <div className="px-5 py-4 bg-slate-900 flex justify-between items-baseline">
          <span className="text-sm font-bold text-white">Total Estimate</span>
          <span className="text-xl font-black text-white tabular-nums">{formatINR(total)}</span>
        </div>
      </div>

      {/* Token note */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          This is an indicative estimate based on scope report. Final contract price subject to detailed drawings and BOQ. Advance token: <strong>{formatINR(token)}</strong> (10% of estimate, min ₹25,000).
        </p>
      </div>

      <div className="mt-auto">
        <button
          onClick={handleContinue}
          className="w-full py-4 rounded-2xl font-semibold text-base bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
        >
          Proceed to Confirmation →
        </button>
      </div>
    </div>
  )
}
