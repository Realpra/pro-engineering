'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Info, FileText, Shield } from 'lucide-react'
import { saveBooking, getBooking } from '@/lib/booking'
import { cn, formatDate } from '@/lib/utils'

interface ScopeItem {
  code: string
  description: string
  unit: string
  qty: number
  status: 'included' | 'provisional' | 'excluded'
}

interface RiskFlag {
  id: string
  type: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
}

const SCOPE_DATA: Record<string, ScopeItem[]> = {
  'home-renovation': [
    { code: 'A01', description: 'Demolition & stripping of existing finishes', unit: 'sqft', qty: 1200, status: 'included' },
    { code: 'A02', description: 'Vitrified tile flooring 600×600 (including adhesive & grouting)', unit: 'sqft', qty: 1100, status: 'included' },
    { code: 'A03', description: 'Wall finish — putty + 2 coats premium emulsion paint', unit: 'sqft', qty: 2800, status: 'included' },
    { code: 'A04', description: 'POP false ceiling with concealed lighting', unit: 'sqft', qty: 600, status: 'provisional' },
    { code: 'A05', description: 'Electrical — new wiring + 45 points (modular switches)', unit: 'nos', qty: 45, status: 'included' },
    { code: 'A06', description: 'Plumbing — CP fittings & wash basins (3 bathrooms)', unit: 'lot', qty: 1, status: 'included' },
    { code: 'A07', description: 'Modular wardrobes — 3 bedrooms (floor to ceiling)', unit: 'rft', qty: 36, status: 'included' },
    { code: 'A08', description: 'Modular kitchen with countertop & hardware', unit: 'rft', qty: 12, status: 'included' },
    { code: 'A09', description: 'Waterproofing — bathroom floors & walls', unit: 'sqft', qty: 180, status: 'included' },
    { code: 'A10', description: 'External facade painting', unit: 'sqft', qty: 800, status: 'excluded' },
  ],
  'construction': [
    { code: 'B01', description: 'Site clearance, levelling & earthwork excavation', unit: 'cum', qty: 450, status: 'included' },
    { code: 'B02', description: 'PCC (M15) — lean concrete bed', unit: 'cum', qty: 45, status: 'included' },
    { code: 'B03', description: 'RCC foundation — raft / isolated footings (M25)', unit: 'cum', qty: 180, status: 'included' },
    { code: 'B04', description: 'RCC columns, beams & slabs (M25, Fe500)', unit: 'cum', qty: 320, status: 'included' },
    { code: 'B05', description: 'Brick masonry — 230mm external walls', unit: 'cum', qty: 240, status: 'included' },
    { code: 'B06', description: 'Internal plastering (cement sand 1:4, 12mm)', unit: 'sqft', qty: 4500, status: 'included' },
    { code: 'B07', description: 'External plaster + texture finish', unit: 'sqft', qty: 2200, status: 'included' },
    { code: 'B08', description: 'Roofing — RCC slab + waterproofing treatment', unit: 'sqft', qty: 1800, status: 'included' },
    { code: 'B09', description: 'UPVC windows and door frames', unit: 'nos', qty: 24, status: 'included' },
    { code: 'B10', description: 'MEP services — rough-in only', unit: 'lot', qty: 1, status: 'provisional' },
  ],
  'leak-proofing': [
    { code: 'C01', description: 'Thermal imaging survey — identify leak sources', unit: 'lot', qty: 1, status: 'included' },
    { code: 'C02', description: 'Concrete crack investigation & mapping', unit: 'sqft', qty: 1500, status: 'included' },
    { code: 'C03', description: 'Surface preparation — chipping, cleaning & priming', unit: 'sqft', qty: 1200, status: 'included' },
    { code: 'C04', description: 'Crystalline waterproofing membrane application', unit: 'sqft', qty: 1000, status: 'included' },
    { code: 'C05', description: 'Epoxy injection grouting — structural cracks', unit: 'nos', qty: 18, status: 'included' },
    { code: 'C06', description: 'Drainage channel installation & watertest', unit: 'lot', qty: 1, status: 'included' },
    { code: 'C07', description: 'Protective screed over membrane', unit: 'sqft', qty: 800, status: 'provisional' },
    { code: 'C08', description: 'Reinstatement of removed floor/wall finishes', unit: 'sqft', qty: 400, status: 'excluded' },
  ],
}

const RISK_DATA: Record<string, RiskFlag[]> = {
  'home-renovation': [
    { id: 'r1', type: 'quality', severity: 'medium', title: 'Hidden Structural Cracks', description: 'Walls may conceal existing RCC cracks behind plaster; extent unknown until demolition. Provisional allowance included.' },
    { id: 'r2', type: 'delay', severity: 'low', title: 'Material Lead Times', description: 'Selected tile and sanitary ranges have 3–4 week delivery lead time from suppliers.' },
    { id: 'r3', type: 'cost_overrun', severity: 'medium', title: 'Electrical Rewiring', description: 'Existing wiring appears older than 15 years and may not comply with IE Rules — full rewiring likely required.' },
    { id: 'r4', type: 'regulatory', severity: 'low', title: 'Society NOC Required', description: 'RWA / housing society NOC needed before commencement of works in this residential complex.' },
  ],
  'construction': [
    { id: 'r1', type: 'safety', severity: 'high', title: 'Unknown Ground Conditions', description: 'No previous geotechnical data available. Recommend soil testing before finalising foundation design.' },
    { id: 'r2', type: 'delay', severity: 'medium', title: 'Monsoon Season Impact', description: 'Project start coincides with monsoon. Earthwork and concrete pours will be weather-dependent.' },
    { id: 'r3', type: 'cost_overrun', severity: 'medium', title: 'Steel & Cement Escalation', description: 'Material prices are volatile — contract should include price escalation clause for steel (Fe500).' },
    { id: 'r4', type: 'regulatory', severity: 'low', title: 'Building Plan Sanction', description: 'Confirm building plan sanction from MCD/DDA is in place before mobilisation.' },
  ],
  'leak-proofing': [
    { id: 'r1', type: 'quality', severity: 'high', title: 'Extent of Water Damage Uncertain', description: 'Full extent of damage to RCC members and masonry will only be clear after opening up works.' },
    { id: 'r2', type: 'cost_overrun', severity: 'medium', title: 'Structural Remediation May Be Required', description: 'If rebars are corroded, structural repair (rebar replacement + patching) adds significant cost.' },
    { id: 'r3', type: 'delay', severity: 'low', title: 'Curing Period', description: 'Crystalline membrane requires 28-day curing before reinstatement of finishes.' },
  ],
}

function getDefaultScope(jobType: string): ScopeItem[] {
  return SCOPE_DATA[jobType] || SCOPE_DATA['home-renovation']
}

function getDefaultRisks(jobType: string): RiskFlag[] {
  return RISK_DATA[jobType] || RISK_DATA['home-renovation']
}

const SEVERITY_CONFIG = {
  high:   { label: 'High',   color: 'bg-red-100 text-red-700',    dot: 'bg-red-500'    },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  low:    { label: 'Low',    color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
}

const STATUS_CONFIG = {
  included:    { label: 'Included',    color: 'bg-green-100 text-green-700'  },
  provisional: { label: 'Provisional', color: 'bg-amber-100 text-amber-700'  },
  excluded:    { label: 'Excluded',    color: 'bg-slate-100 text-slate-600'  },
}

export default function ScopeReportPage() {
  const router = useRouter()
  const [jobTitle, setJobTitle]     = useState('')
  const [jobType, setJobType]       = useState('')
  const [district, setDistrict]     = useState('')
  const [visitDate, setVisitDate]   = useState('')
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([])
  const [risks, setRisks]           = useState<RiskFlag[]>([])
  const [approved, setApproved]     = useState(false)

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType) { router.replace('/book'); return }
    setJobTitle(b.jobTitle || '')
    setJobType(b.jobType)
    setDistrict(b.district || '')
    setVisitDate(b.siteVisitDate || '')
    setScopeItems(getDefaultScope(b.jobType))
    setRisks(getDefaultRisks(b.jobType))
    if (b.scopeApproved) setApproved(true)
  }, [router])

  function handleApprove() {
    saveBooking({ scopeApproved: true })
    router.push('/book/estimate')
  }

  const highRisks = risks.filter(r => r.severity === 'high').length

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">Scope Report</h1>
        <p className="text-slate-500 text-sm mt-1">
          {district} · Site visit {visitDate ? formatDate(visitDate) : '—'} · Prepared by Pro Engineering
        </p>
      </div>

      {/* Risk alert */}
      {highRisks > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{highRisks} high-severity risk{highRisks > 1 ? 's' : ''} identified</p>
            <p className="text-xs text-red-600 mt-0.5">Review risk flags below before approving scope</p>
          </div>
        </div>
      )}

      {/* Scope of Works */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <FileText className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Scope of Works</h2>
          <span className="ml-auto text-xs text-slate-400">{scopeItems.length} items</span>
        </div>

        <div className="divide-y divide-slate-50">
          {scopeItems.map((item, i) => {
            const sc = STATUS_CONFIG[item.status]
            return (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <span className="text-[10px] font-mono text-slate-400 mt-0.5 shrink-0 w-8">{item.code}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">{item.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.qty.toLocaleString('en-IN')} {item.unit}</p>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', sc.color)}>
                  {sc.label}
                </span>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Included in base scope</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Provisional (TBC on site)</span>
          </div>
        </div>
      </div>

      {/* Risk Flags */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Shield className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-bold text-slate-900">Risk Flags</h2>
          <span className="ml-auto text-xs text-slate-400">{risks.length} flags</span>
        </div>

        <div className="divide-y divide-slate-50">
          {risks.map(r => {
            const sev = SEVERITY_CONFIG[r.severity]
            return (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', sev.dot)} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', sev.color)}>
                        {sev.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{r.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Engineer's note */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          This scope report is based on a visual site assessment. Provisional items and risk flags will be confirmed after opening-up works. The detailed estimate accounts for contingencies.
        </p>
      </div>

      <div className="mt-auto">
        {!approved ? (
          <button
            onClick={handleApprove}
            className="w-full py-4 rounded-2xl font-semibold text-base bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Approve Scope & View Estimate →
          </button>
        ) : (
          <button
            onClick={() => router.push('/book/estimate')}
            className="w-full py-4 rounded-2xl font-semibold text-base bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Scope Approved — View Estimate →
          </button>
        )}
        <p className="text-center text-xs text-slate-400 mt-2">
          By approving, you confirm the scope items are understood and agreed
        </p>
      </div>
    </div>
  )
}
