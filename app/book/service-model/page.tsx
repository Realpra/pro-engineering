'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle } from 'lucide-react'
import { saveBooking, getBooking, JOB_TYPE_DB_MAP } from '@/lib/booking'
import { cn } from '@/lib/utils'

interface ServiceModel {
  id: string
  title: string
  badge?: string
  badgeColor?: string
  description: string
  includes: string[]
  typical: string
}

const MODELS: Record<string, ServiceModel[]> = {
  'home-renovation': [
    { id: 'design-build', title: 'Design + Build', badge: 'Most Popular', badgeColor: 'bg-orange-100 text-orange-700',
      description: 'Turnkey service from design through handover. We handle everything.',
      includes: ['Interior design & drawings', 'Material procurement', 'Full execution', '1-year workmanship warranty'],
      typical: '10–16 weeks' },
    { id: 'reno-management', title: 'Renovation Management', badge: '',
      description: 'You procure materials; we manage labour, quality and schedule.',
      includes: ['Site management', 'Labour coordination', 'QA/QC checks', 'Weekly progress reports'],
      typical: '8–12 weeks' },
    { id: 'labour-only', title: 'Labour Only', badge: 'Budget', badgeColor: 'bg-slate-100 text-slate-600',
      description: 'Skilled trades deployed as and when needed on a daily rate.',
      includes: ['Skilled & semi-skilled workers', 'Tools & equipment', 'On-site supervision', 'Safety PPE'],
      typical: 'Flexible' },
  ],
  'leak-proofing': [
    { id: 'waterproof-specialist', title: 'Waterproofing Specialist', badge: 'Recommended', badgeColor: 'bg-blue-100 text-blue-700',
      description: 'Comprehensive diagnosis, treatment and guarantee for leak-free results.',
      includes: ['Root-cause investigation', 'Surface preparation', 'Membrane application', '5-year guarantee'],
      typical: '2–4 weeks' },
    { id: 'diagnose-repair', title: 'Diagnose & Repair',
      description: 'Targeted repair of identified leak sources with 12-month warranty.',
      includes: ['Thermal imaging survey', 'Spot treatment', 'Testing & reporting', '12-month warranty'],
      typical: '1–2 weeks' },
    { id: 'maintenance-contract', title: 'Maintenance Contract', badge: 'Best Value', badgeColor: 'bg-green-100 text-green-700',
      description: 'Annual preventive maintenance to avoid future leaks.',
      includes: ['Annual inspection', 'Preventive sealing', 'Priority response', 'Reporting'],
      typical: 'Annual AMC' },
  ],
  'construction': [
    { id: 'full-epc', title: 'Full EPC Contract', badge: 'Comprehensive', badgeColor: 'bg-indigo-100 text-indigo-700',
      description: 'Engineering, Procurement & Construction — complete turnkey delivery.',
      includes: ['Structural & architectural design', 'Procurement & logistics', 'Full construction', 'Handover & O&M manual'],
      typical: '8–24 months' },
    { id: 'structure-only', title: 'Structure Only',
      description: 'Foundation to roof slab; interiors by others.',
      includes: ['Foundation design', 'RCC frame & masonry', 'Roof slab', 'Structural certification'],
      typical: '4–10 months' },
    { id: 'pm-supervision', title: 'PM & Supervision', badge: 'Advisory', badgeColor: 'bg-slate-100 text-slate-600',
      description: "Owner's engineer — we manage your contractors on your behalf.",
      includes: ['Contractor tendering', 'Schedule & cost control', 'QA/QC inspection', 'Monthly reports'],
      typical: 'Project duration' },
  ],
  'it-project': [
    { id: 'full-stack-dev', title: 'Full Stack Development', badge: 'Turnkey', badgeColor: 'bg-violet-100 text-violet-700',
      description: 'End-to-end product delivery from architecture to deployment.',
      includes: ['System architecture', 'Frontend & backend', 'QA & testing', 'Deployment & DevOps'],
      typical: '8–24 weeks' },
    { id: 'pm-only-it', title: 'IT Project Management',
      description: 'We manage your existing dev team or vendors for delivery assurance.',
      includes: ['Sprint planning', 'Vendor management', 'Risk tracking', 'Stakeholder reporting'],
      typical: 'Project duration' },
    { id: 'consulting-it', title: 'Consulting & Advisory', badge: 'Strategy', badgeColor: 'bg-slate-100 text-slate-600',
      description: 'Technology strategy, vendor selection and architecture review.',
      includes: ['As-is assessment', 'Technology roadmap', 'Vendor shortlisting', 'Executive briefings'],
      typical: '4–8 weeks' },
  ],
  'clean-energy': [
    { id: 'solar-epc', title: 'Solar EPC', badge: 'Most Popular', badgeColor: 'bg-yellow-100 text-yellow-700',
      description: 'Complete solar installation from design to commissioning.',
      includes: ['Shadow analysis & design', 'Panel, inverter & BOS supply', 'Installation & testing', 'Net-metering assistance'],
      typical: '3–6 weeks' },
    { id: 'energy-audit', title: 'Energy Audit + Design',
      description: 'Detailed energy audit with recommendations and ROI analysis.',
      includes: ['Consumption analysis', 'Load profiling', 'System sizing', 'Financial modelling'],
      typical: '2–3 weeks' },
    { id: 'supply-only', title: 'Equipment Supply Only', badge: 'Budget', badgeColor: 'bg-slate-100 text-slate-600',
      description: 'Premium panel and inverter procurement at competitive rates.',
      includes: ['Tier-1 panels', 'String/hybrid inverter', 'BOS accessories', 'Delivery to site'],
      typical: '2–4 weeks lead' },
  ],
  'life-sciences': [
    { id: 'turnkey-lab', title: 'Turnkey Lab Setup', badge: 'Full Service', badgeColor: 'bg-green-100 text-green-700',
      description: 'Complete laboratory design, construction and validation.',
      includes: ['Layout & workflow design', 'Construction & HVAC', 'Equipment qualification', 'SOP documentation'],
      typical: '12–24 weeks' },
    { id: 'compliance-consulting', title: 'Compliance & Regulatory',
      description: 'GMP/ISO/NABL compliance gap assessment and remediation.',
      includes: ['Gap analysis', 'Regulatory dossier', 'Mock audit', 'CAPA plan'],
      typical: '4–8 weeks' },
    { id: 'equip-procurement', title: 'Equipment Procurement', badge: 'Advisory', badgeColor: 'bg-slate-100 text-slate-600',
      description: 'Vendor-neutral sourcing and validation of lab equipment.',
      includes: ['Specs & bidding', 'Vendor evaluation', 'URS/DQ support', 'FAT/SAT assistance'],
      typical: '6–16 weeks' },
  ],
  'geo-technical': [
    { id: 'site-investigation', title: 'Site Investigation', badge: 'Standard', badgeColor: 'bg-amber-100 text-amber-700',
      description: 'Borehole drilling, SPT, lab testing and geotechnical report.',
      includes: ['Borehole drilling (3–6 nos)', 'SPT & sampling', 'Lab testing', 'Geotechnical report'],
      typical: '3–5 weeks' },
    { id: 'foundation-design', title: 'Foundation Design',
      description: 'Detailed foundation design with structural recommendations.',
      includes: ['Soil bearing capacity analysis', 'Foundation type selection', 'Design drawings', 'BOQ'],
      typical: '2–4 weeks' },
    { id: 'slope-design', title: 'Slope & Retaining Wall',
      description: 'Slope stability analysis and retaining wall design.',
      includes: ['Slope stability modelling', 'Retaining wall design', 'Drainage recommendations', 'Report'],
      typical: '3–6 weeks' },
  ],
  'project-management': [
    { id: 'full-pm', title: 'Full Project Management', badge: 'Most Popular', badgeColor: 'bg-indigo-100 text-indigo-700',
      description: 'Dedicated PM team managing scope, schedule, cost and quality.',
      includes: ['Project planning & scheduling', 'Cost control & forecasting', 'Risk management', 'Stakeholder reporting'],
      typical: 'Project duration' },
    { id: 'advisory-pm', title: 'PM Advisory',
      description: 'Expert advisory to your in-house team with monthly interventions.',
      includes: ['Monthly health-check', 'Schedule review', 'Risk workshop', 'Recommendations report'],
      typical: 'Monthly retainer' },
    { id: 'cost-control', title: "Owner's Cost Control", badge: 'Specialist', badgeColor: 'bg-slate-100 text-slate-600',
      description: 'Quantity surveying, budget tracking and value engineering.',
      includes: ['BOQ preparation', 'Tender review', 'Variations management', 'Final account'],
      typical: 'Project duration' },
  ],
  'manufacturing': [
    { id: 'plant-turnkey', title: 'Plant Setup (Turnkey)', badge: 'Comprehensive', badgeColor: 'bg-rose-100 text-rose-700',
      description: 'End-to-end factory setup including civil, MEP and equipment.',
      includes: ['Factory layout design', 'Civil & structural', 'Utility services', 'Equipment installation & commissioning'],
      typical: '6–18 months' },
    { id: 'process-consulting', title: 'Process Engineering',
      description: 'Process flow design, equipment selection and plant layout optimisation.',
      includes: ['Process flow diagrams', 'Equipment sizing', 'Material handling design', 'Safety reviews'],
      typical: '8–12 weeks' },
    { id: 'equip-install', title: 'Equipment Installation', badge: 'Specialist', badgeColor: 'bg-slate-100 text-slate-600',
      description: 'Mechanical installation, alignment and commissioning of plant equipment.',
      includes: ['Unloading & rigging', 'Installation & alignment', 'Commissioning & trials', 'Operator training'],
      typical: '4–12 weeks' },
  ],
}

export default function ServiceModelPage() {
  const router = useRouter()
  const [jobTitle, setJobTitle]   = useState('')
  const [jobType, setJobType]     = useState('')
  const [selected, setSelected]   = useState<string | null>(null)

  useEffect(() => {
    const b = getBooking()
    if (!b.jobType) { router.replace('/book'); return }
    setJobType(b.jobType)
    setJobTitle(b.jobTitle || '')
    if (b.serviceModel) setSelected(b.serviceModel)
  }, [router])

  const models = MODELS[jobType] || MODELS['home-renovation']

  function handleContinue() {
    if (!selected) return
    const b = getBooking()
    const currentJobType = b.jobType || jobType
    const currentModels = MODELS[currentJobType] ?? MODELS['home-renovation']
    const model = currentModels.find(m => m.id === selected)
    if (!model) return
    saveBooking({ serviceModel: selected, serviceModelTitle: model.title })
    const dest = JOB_TYPE_DB_MAP[currentJobType] === 'civil' ? '/book/civil-site-visit' : '/book/site-visit'
    router.push(dest)
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-1">{jobTitle}</p>
        <h1 className="text-2xl font-bold text-slate-900">Choose your service model</h1>
        <p className="text-slate-500 text-sm mt-1">Select how you'd like to engage with Pro Engineering</p>
      </div>

      <div className="space-y-3 mb-6">
        {models.map(m => {
          const active = selected === m.id
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={cn(
                'w-full text-left rounded-2xl border-2 p-5 transition-all duration-150',
                active
                  ? 'border-blue-700 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-base font-bold', active ? 'text-blue-900' : 'text-slate-900')}>
                    {m.title}
                  </span>
                  {m.badge && (
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', m.badgeColor || 'bg-slate-100 text-slate-600')}>
                      {m.badge}
                    </span>
                  )}
                </div>
                {active
                  ? <CheckCircle2 className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                  : <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
              </div>

              <p className="text-sm text-slate-600 mb-3">{m.description}</p>

              <div className="grid grid-cols-1 gap-1 mb-3">
                {m.includes.map(inc => (
                  <div key={inc} className="flex items-center gap-2">
                    <div className={cn('w-1 h-1 rounded-full shrink-0', active ? 'bg-blue-600' : 'bg-slate-400')} />
                    <span className="text-xs text-slate-600">{inc}</span>
                  </div>
                ))}
              </div>

              <div className={cn(
                'inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full',
                active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600',
              )}>
                Typical: {m.typical}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-auto pt-2">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-base transition-all',
            selected
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
