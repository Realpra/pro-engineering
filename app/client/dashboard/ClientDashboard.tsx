'use client'

import { Fragment, useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitClientResponse } from './actions'
import type { LineItemResponse } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type Booking = {
  booking_ref: string
  job_title: string | null
  job_type: string | null
  zone: string | null
  district: string | null
  status: string
  service_model?: string | null
  created_at: string
  preferred_start_date: string | null
  contact_email: string | null
  contact_name: string | null
}

type BOQLineItem = {
  skuCode: string
  skuName: string
  description: string | null
  client_description?: string | null
  category: 'labour' | 'material'
  unit: string
  quantity: number
  rate: number
  amount: number
  isRiskFlag: boolean
  missingRate: boolean
}

type BOQ = {
  id: string
  tier: string
  job_card_type: string
  status: string
  line_items: BOQLineItem[]
  risk_flag_items: BOQLineItem[]
  subtotal_labour: number
  subtotal_material: number
  subtotal_risk_flags: number
  platform_premium_pct: number
  platform_premium_amount: number
  bocw_cess_percent: number
  bocw_cess_amount: number
  gst_percent: number
  gst_amount: number
  contingency_percent: number
  contingency_amount: number
  total_amount: number
  coordinator_notes: string | null
  valid_until: string | null
  estimate_version?: number | null
  estimate_version_label: string | null
  created_at: string
}

type ResponseRecord = {
  id: string
  response_type: string
  overall_remarks: string | null
  responded_at: string
}

type MilestoneScheduleRow = {
  milestone_code: string
  milestone_name: string
  payment_percent: number
  payment_amount: number
  trigger_condition: string
  evidence_required: string[]
  status: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SiteReport = Record<string, any> | null

type Props = {
  booking: Booking | null
  boq: BOQ | null
  responseHistory: ResponseRecord[]
  clientName: string
  milestoneSchedule: MilestoneScheduleRow[] | null
}

type LineAction = 'accepted' | 'review_requested' | 'rejected'
type LineState = { action: LineAction; remarks: string; suggestedRate: string; suggestedQty: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { key: 'booked',        label: 'Booked' },
  { key: 'site_visit',   label: 'Site Visit Done' },
  { key: 'estimate_sent', label: 'Estimate Sent' },
  { key: 'accepted',     label: 'Accepted' },
  { key: 'work_started', label: 'Work Started' },
  { key: 'handover',     label: 'Handover' },
]

const STATUS_STEP: Record<string, number> = {
  confirmed: 0, scope_report_submitted: 1, admin_review: 1,
  estimate_sent: 2, client_review_requested: 2, estimate_rejected: 2,
  estimate_accepted: 3, work_started: 4, handover: 5,
}

const STATUS_LABEL: Record<string, string> = {
  estimate_sent: 'Estimate Sent', estimate_accepted: 'Accepted',
  estimate_rejected: 'Rejected', client_review_requested: 'Under Review',
  work_started: 'Work in Progress', handover: 'Handover',
}

const STATUS_COLOR: Record<string, string> = {
  estimate_sent: 'bg-blue-100 text-blue-800',
  estimate_accepted: 'bg-green-100 text-green-800',
  estimate_rejected: 'bg-red-100 text-red-800',
  client_review_requested: 'bg-amber-100 text-amber-800',
  work_started: 'bg-purple-100 text-purple-800',
  handover: 'bg-teal-100 text-teal-800',
}

function getJobCardTypeInfo(type: string): { label: string; description: string } {
  if (type === 'M') return { label: 'Material Supply', description: 'Material supply scope — hardware, fixtures, tiles, and related materials only. Installation not included.' }
  if (type === 'LM') return { label: 'Turnkey Renovation', description: 'Full turnkey scope — site labour plus all material supply and installation.' }
  return { label: 'Labour Only', description: 'Workmanship scope — site labour, tiling, waterproofing, and related installation activities.' }
}

const MILESTONE_DATA_M = [
  {
    code: 'M0', name: 'Order Confirmation', pct: 30,
    trigger: 'Client accepts estimate. Advance payment confirms material order.',
    evidence: ['Signed estimate', 'Advance payment receipt', 'Order confirmation from supplier'],
    subStages: [] as string[],
  },
  {
    code: 'M1', name: 'Material Dispatched', pct: 40,
    trigger: 'All materials dispatched from supplier warehouse. Dispatch note and tracking details shared with client.',
    evidence: ['Dispatch note from supplier', 'Tracking/lorry receipt', 'Material photos at dispatch'],
    subStages: [] as string[],
  },
  {
    code: 'M2', name: 'Delivery Confirmed', pct: 30,
    trigger: 'All materials delivered to site and verified by client. Client signs delivery confirmation.',
    evidence: ['Delivery receipt signed by client', 'Photos of materials at site', 'Any damage or shortage noted and resolved'],
    subStages: [] as string[],
  },
]

const MILESTONE_DATA = [
  {
    code: 'M0', name: 'Mobilisation', pct: 20,
    trigger: 'Client accepts estimate. Token payment confirms booking.',
    evidence: ['Signed estimate', 'Token payment receipt'],
    subStages: ['Services isolation complete', 'Material procurement initiated'],
  },
  {
    code: 'M1', name: 'First Fix', pct: 30,
    trigger: 'Pond test passed — no seepage in 24 hours. Hydraulic pressure test at 10 bar passed for 30 minutes.',
    evidence: ['Pond test start photo', 'Pond test end photo after 24 hours', 'Ceiling below dry — inspection photo', 'Hydraulic pressure gauge photo at 10 bar', 'Supervisor sign-off on platform'],
    subStages: [
      'M1-A: Demolition complete — debris removed, bare base exposed',
      'M1-B: Wall chasing complete — pipes and conduits routed',
      'M1-C: Concealed plumbing complete — CPVC pipes in walls',
      'M1-D: Hydraulic pressure test passed at 10 bar',
      'M1-E: Electrical conduit and wiring complete',
      'M1-F: Waterproofing coat 1 and coat 2 applied',
      'M1-G: Pond test initiated — 24-hour water hold',
      'M1-H: Pond test passed — no seepage confirmed',
    ],
  },
  {
    code: 'M2', name: 'Tiling Complete', pct: 30,
    trigger: 'All wall and floor tiles laid. Grouting complete. No hollow tiles confirmed by tap test.',
    evidence: ['Wall tiling completion photo all four walls', 'Floor tiling completion photo', 'Grouting completion photo', 'Tap test confirmation no hollow tiles', 'Supervisor sign-off on platform'],
    subStages: [
      'M2-A: Plastering complete and cured',
      'M2-B: Floor screed complete and cured (minimum 3 days)',
      'M2-C: Wall tiling complete — all surfaces',
      'M2-D: Floor tiling complete with correct slope to drain',
      'M2-E: Grouting complete — epoxy grout all joints',
      'M2-F: Tap test — no hollow tiles confirmed',
    ],
  },
  {
    code: 'M3', name: 'Final Handover', pct: 20,
    trigger: 'All fixtures installed and functional. Client inspects and signs handover checklist. Zero pending snag items.',
    evidence: ['WC flush test video', 'Basin tap water flow test video', 'Shower and diverter functional test video', 'Geyser and exhaust fan functional photo', 'Client signed handover checklist on platform'],
    subStages: [
      'M3-A: WC installed — bowl, cistern and flush functional',
      'M3-B: Basin installed — water flow and drainage confirmed',
      'M3-C: Shower, diverter and health faucet functional',
      'M3-D: Geyser point connected and exhaust fan installed',
      'M3-E: Ceiling painted — anti-fungal two coats',
      'M3-F: Silicone sealing complete at all junctions',
      'M3-G: Acid wash and deep cleaning complete',
      'M3-H: Snag list raised and all items cleared',
      'M3-I: Client signs handover checklist — DLP period begins',
    ],
  },
]

const TERMS = [
  { heading: 'Workmanship Warranty', body: 'Pro Engineering provides a 12-month workmanship warranty from the date of handover (M3 completion). This warranty covers defects in workmanship only and does not cover material failures, client-caused damage, or risks explicitly declined by the client.' },
  { heading: 'Defect Liability Period (DLP)', body: 'A 12-month DLP begins on the date of client sign-off at handover. During this period Pro Engineering will attend to workmanship defects at no charge.' },
  { heading: 'Scope Changes', body: 'Any change to the agreed scope after estimate acceptance requires a formal scope change request. Cost and timeline impact will be assessed and a revised estimate issued. Work on the changed scope begins only after client acceptance of the revised estimate.' },
  { heading: 'Client Obligations', body: 'Client must ensure site access by 8:00 AM daily on working days. Society NOC must be obtained before work begins. Adequate space for material storage must be provided within the flat. Client-supplied materials must be available on site before the relevant milestone begins.' },
  { heading: 'Payment Terms', body: 'Each milestone payment is due within 48 hours of coordinator approval on the platform. Delay beyond 48 hours will result in work suspension until payment is received.' },
  { heading: 'Escalation', body: 'This estimate is a fixed price valid for 30 days from preparation date. For jobs with a contracted duration exceeding 12 months, an escalation clause linked to the CPI Construction Index will apply from month 13 onwards.' },
  { heading: 'Dispute Resolution', body: 'Any dispute arising from this contract will first be referred to Pro Engineering platform mediation. If unresolved within 14 days, the matter may be referred to the appropriate civil court in Noida, Uttar Pradesh.' },
]

const GENERIC_TIMELINE = [
  { dayRange: 'Day 1–2',  activity: 'Demolition and site clearance',             curing: false },
  { dayRange: 'Day 3–4',  activity: 'Plumbing and electrical first fix',           curing: false },
  { dayRange: 'Day 5–6',  activity: 'Waterproofing application',                   curing: false },
  { dayRange: 'Day 7',    activity: 'Pond test (site sealed — 24 hours)',           curing: true  },
  { dayRange: 'Day 8',    activity: 'Plastering and floor screed',                  curing: false },
  { dayRange: 'Day 9–11', activity: 'Mandatory curing (no wet work)',               curing: true  },
  { dayRange: 'Day 12–13',activity: 'Wall tiling',                                  curing: false },
  { dayRange: 'Day 14',   activity: 'Floor tiling and grouting',                    curing: false },
  { dayRange: 'Day 15',   activity: 'Fixtures, finishing and handover',             curing: false },
]

// ISSUE 1 — human-readable labels for raw JSONB condition values
const LABEL_MAP: Record<string, string> = {
  'damp-stains': 'Damp stains observed',
  'good':        'Good condition',
  'fair':        'Fair condition',
  'poor':        'Poor condition',
  'hollow':      'Hollow tiles found',
  'intact':      'Intact',
  'blocked':     'Blocked',
  'slow':        'Slow drainage',
  'clear':       'Clear',
  'crystalline': 'Crystalline waterproofing',
  'bituminous':  'Bituminous waterproofing',
  'none':        'None found',
  'unknown':     'Not determined',
  'true':        'Yes',
  'false':       'No',
  'absent':      'Absent — not installed',
  'present':     'Present',
  'non-ip':      'Non-IP rated fittings',
  'ip44':        'IP44 rated',
  'bare-concrete': 'Bare concrete exposed',
}

function humanLabel(raw: string): string {
  const key = raw.trim().toLowerCase()
  return LABEL_MAP[key] ?? raw.replace(/-/g, ' ')
}

const RISK_CONSEQUENCES = [
  'Tiles may lift or debond within 6–18 months due to moisture under the adhesive bed.',
  'Water seepage to the floor below is likely within 12–24 months.',
  'Mould and efflorescence may appear on walls within 6 months.',
]

const SECTION_ORDER = ['Demolition','Civil Preparation','Waterproofing','Tiling','Plumbing','Electrical','Fixtures','Finishing','Supervision','Materials','Uncategorised']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function displayLabel(item: BOQLineItem) {
  return item.client_description || item.description || item.skuName || item.skuCode
}

function groupLineItems(items: BOQLineItem[]): [string, BOQLineItem[]][] {
  const groups: Record<string, BOQLineItem[]> = Object.fromEntries(SECTION_ORDER.map(k => [k, []]))
  for (const item of items) {
    const d = (item.description ?? item.skuName ?? '').toLowerCase()
    const c = item.skuCode ?? ''
    // Finishing before Tiling so 'silic' is not caught by 'til'
    // Plumbing uses specific terms so 'drain' in tile descriptions doesn't match
    if      (d.includes('demol')||d.includes('chip')||d.includes('muck')||d.includes('clear')||d.includes('isolation')) groups['Demolition'].push(item)
    else if (d.includes('plaster')||d.includes('screed')||d.includes('chas'))                    groups['Civil Preparation'].push(item)
    else if (d.includes('waterproof')||d.includes('pond'))                                        groups['Waterproofing'].push(item)
    else if (d.includes('pip')||d.includes('plumb')||d.includes('drain trap')||d.includes('pressure test')||d.includes('cpvc')||d.includes('upvc')) groups['Plumbing'].push(item)
    else if (d.includes('conduit')||d.includes('electr')||d.includes('wire'))                    groups['Electrical'].push(item)
    else if (d.includes('wc')||d.includes('basin')||d.includes('shower')||d.includes('geyser')||d.includes('exhaust')||d.includes('divert')||d.includes('sanit')) groups['Fixtures'].push(item)
    else if (d.includes('paint')||d.includes('silic')||d.includes('clean')||d.includes('acid'))  groups['Finishing'].push(item)
    else if (d.includes('floor til')||d.includes('til')||d.includes('grout')||d.includes('profile')) groups['Tiling'].push(item)
    else if (d.includes('superv')||d.includes('visit')||d.includes('verif'))                     groups['Supervision'].push(item)
    else if (c.startsWith('MAT-'))                                                                groups['Materials'].push(item)
    else                                                                                          groups['Uncategorised'].push(item)
  }
  return SECTION_ORDER.map(k => [k, groups[k]] as [string, BOQLineItem[]]).filter(([, g]) => g.length > 0)
}

function conditionColor(val: unknown) {
  if (!val || typeof val !== 'string') return 'bg-gray-100 text-gray-500'
  const v = val.toLowerCase()
  if (v.includes('good')||v.includes('ok')||v.includes('pass')||v.includes('no damp')||v.includes('dry')||v.includes('clear')||v.includes('functional')) return 'bg-green-100 text-green-800'
  if (v.includes('fair')||v.includes('minor')||v.includes('some')||v.includes('partial')||v.includes('slow')) return 'bg-amber-100 text-amber-800'
  if (v.includes('poor')||v.includes('bad')||v.includes('fail')||v.includes('damage')||v.includes('blocked')||v.includes('absent')) return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-500'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray<T = any>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : []
}

function toConditionString(val: unknown): string | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'string') return val.trim() || null
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return null
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientDashboard({ booking, boq, responseHistory, clientName, milestoneSchedule }: Props) {

  const router = useRouter()

  // ── Fetched state ──────────────────────────────────────────────────────────
  const [siteReport, setSiteReport] = useState<SiteReport>(null)
  const [supervisorName, setSupervisorName] = useState<string | null>(null)

  useEffect(() => {
    if (!booking?.booking_ref) return
    const supabase = createClient()
    ;(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: report } = await (supabase as any)
        .from('site_visit_reports')
        .select('*')
        .eq('booking_ref', booking.booking_ref)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setSiteReport(report)
      if (report?.supervisor_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sup } = await (supabase as any)
          .from('users')
          .select('full_name')
          .eq('id', report.supervisor_id)
          .maybeSingle()
        setSupervisorName(sup?.full_name ?? null)
      }
    })()
  }, [booking?.booking_ref])

  // ── Response state ─────────────────────────────────────────────────────────
  const [lineStates, setLineStates] = useState<Record<string, LineState>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [overallAction, setOverallAction] = useState<LineAction | null>(null)
  const [overallRemarks, setOverallRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [riskDeclinePending, setRiskDeclinePending] = useState<BOQLineItem | null>(null)

  // ── UI state ───────────────────────────────────────────────────────────────
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTION_ORDER)
  )
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null)
  const [termsOpen, setTermsOpen] = useState(false)

  // ── Derived values ─────────────────────────────────────────────────────────
  const lineItems = useMemo(() => safeArray<BOQLineItem>(boq?.line_items).filter(i => !i.isRiskFlag), [boq])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const riskItems = useMemo<any[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rf = safeArray<any>(boq?.risk_flag_items)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rf.length > 0 ? rf : safeArray<any>(boq?.line_items).filter((i: any) => i.isRiskFlag)
  }, [boq])
  const groupedSections = useMemo(() => groupLineItems(lineItems), [lineItems])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtotalRisk = useMemo(() => riskItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || Number(item.rate) || 0), 0), [riskItems])
  const subtotalLabour = Number(boq?.subtotal_labour) || 0
  console.log('boq subtotals:', boq?.subtotal_labour, boq?.subtotal_material, boq?.subtotal_risk_flags, boq?.total_amount) // TODO: remove console.logs before production
  console.log('riskItems:', riskItems, 'subtotalRisk:', subtotalRisk) // TODO: remove console.logs before production
  const declinedRiskItems = useMemo(
    () => riskItems.filter(i => lineStates[i.skuCode]?.action === 'rejected'),
    [riskItems, lineStates]
  )
  const hasReviewItems = Object.values(lineStates).some(s => s.action === 'review_requested')
  const hasRejectItems = Object.values(lineStates).some(s => s.action === 'rejected')

  // Site report fields
  const ceiling      = siteReport?.screen03_ceiling
  const walls        = siteReport?.screen04_walls
  const floors       = siteReport?.screen05_floors
  const plumbing     = siteReport?.screen06_plumbing
  const electrical   = siteReport?.screen07_electrical
  const waterproof   = siteReport?.screen08_waterproofing
  const demolition   = siteReport?.screen09_demolition
  const timeline     = siteReport?.screen16_timeline
  const rawDecisions = siteReport?.screen17_risk_decisions
  const riskDecisions: { description?: string; selectedRemedy?: string; clientAcceptsRisk?: boolean; source?: string; clientNote?: string | null }[] =
    Array.isArray(rawDecisions)
      ? rawDecisions
      : Array.isArray(rawDecisions?.flags)
        ? rawDecisions.flags
        : []
  const clientScope  = siteReport?.screen18_client_scope

  const versionLabel = boq?.estimate_version
    ? `Revised Estimate ${boq.estimate_version}`
    : boq?.estimate_version_label ?? null

  const currentStepIdx = STATUS_STEP[booking?.status ?? ''] ?? 0
  const canShowEstimate = !!boq && ['estimate_sent','client_review_requested','estimate_accepted','estimate_rejected','work_started','handover'].includes(booking?.status ?? '')

  // ── Handlers ───────────────────────────────────────────────────────────────
  function setLineAction(id: string, action: LineAction, item: BOQLineItem) {
    if (action === 'rejected' && item.isRiskFlag) {
      setRiskDeclinePending(item)
      return
    }
    setLineStates(prev => ({
      ...prev,
      [id]: { action, remarks: prev[id]?.remarks ?? '', suggestedRate: prev[id]?.suggestedRate ?? '', suggestedQty: prev[id]?.suggestedQty ?? '' },
    }))
    if (action === 'review_requested' || action === 'rejected') setExpandedId(id)
    else if (expandedId === id) setExpandedId(null)
  }

  function confirmRiskDecline() {
    if (!riskDeclinePending) return
    const id = riskDeclinePending.skuCode
    setLineStates(prev => ({
      ...prev,
      [id]: { action: 'rejected', remarks: prev[id]?.remarks ?? '', suggestedRate: prev[id]?.suggestedRate ?? '', suggestedQty: prev[id]?.suggestedQty ?? '' },
    }))
    setExpandedId(id)
    setRiskDeclinePending(null)
  }

  function updateLineField(id: string, field: 'remarks'|'suggestedRate'|'suggestedQty', val: string) {
    setLineStates(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }))
  }

  async function handleSubmit(type: 'accepted'|'review_requested'|'rejected') {
    if (!booking || !boq) return
    if (type === 'rejected' && !overallRemarks.trim()) {
      setSubmitMsg({ text: 'Please enter your reason for rejection.', ok: false })
      return
    }
    setSubmitting(true)
    setSubmitMsg(null)
    const allBOQItems = [
      ...((boq.line_items ?? []) as BOQLineItem[]),
      ...((boq.risk_flag_items ?? []) as BOQLineItem[]),
    ]
    const lir: LineItemResponse[] = Object.entries(lineStates).map(([skuCode, s]) => {
      const original = allBOQItems.find(i => i.skuCode === skuCode)
      return {
        skuCode, action: s.action, remarks: s.remarks,
        suggestedRate: s.suggestedRate ? Number(s.suggestedRate) : null,
        suggestedQty: s.suggestedQty ? Number(s.suggestedQty) : null,
        skuName: original?.skuName ?? null,
        description: original?.description ?? null,
        unit: original?.unit ?? null,
        originalQty: original?.quantity ?? null,
        originalRate: original?.rate ?? null,
        originalAmount: original?.amount ?? null,
      }
    })
    const res = await submitClientResponse(booking.booking_ref, boq.id, 1, type, overallRemarks, lir)
    setSubmitting(false)
    if (!res.error && type === 'accepted') {
      router.push(`/client/payment?booking_ref=${booking.booking_ref}`)
      return
    }
    setSubmitMsg(res.error
      ? { text: res.error, ok: false }
      : { text: type === 'rejected'  ? 'Your rejection has been recorded. Our coordinator will contact you shortly.'
             :                        'Your review remarks have been submitted. Our coordinator will review and revert.', ok: true })
  }

  function toggleSection(name: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function toggleMilestone(code: string) {
    setExpandedMilestone(prev => prev === code ? null : code)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-[#1F3864] text-white px-4 py-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2E74B5] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm">Pro Engineering</p>
              <p className="text-blue-300 text-xs">{clientName}</p>
            </div>
          </div>
          <button type="button" onClick={async () => { await createClient().auth.signOut(); window.location.href = '/client/login' }}
            className="text-xs text-blue-300 hover:text-white transition-colors">Sign out</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-16">

        {/* ═══ SECTION 1 — PROPOSAL HEADER ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-[#1F3864] px-5 py-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-white font-bold text-lg">Renovation Proposal</p>
                  {versionLabel && (
                    <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">{versionLabel}</span>
                  )}
                  {boq?.job_card_type && (
                    <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{getJobCardTypeInfo(boq.job_card_type).label}</span>
                  )}
                </div>
                {booking && (
                  <>
                    <p className="text-blue-300 text-xs font-semibold">{booking.booking_ref}</p>
                    {booking.job_title && <p className="text-blue-100 text-sm mt-0.5">{booking.job_title}</p>}
                    {(booking.zone || booking.district) && (
                      <p className="text-blue-200 text-xs mt-0.5">{[booking.zone, booking.district].filter(Boolean).join(', ')}</p>
                    )}
                  </>
                )}
              </div>
              {booking && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${STATUS_COLOR[booking.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABEL[booking.status] ?? booking.status}
                </span>
              )}
            </div>
            {boq && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-white/10 flex-wrap">
                <div><p className="text-blue-300 text-[10px] uppercase tracking-wide">Prepared</p><p className="text-white text-xs font-semibold">{fmtDate(boq.created_at)}</p></div>
                <div><p className="text-blue-300 text-[10px] uppercase tracking-wide">Valid Until</p><p className="text-white text-xs font-semibold">{fmtDate(boq.valid_until)}</p></div>
                <div><p className="text-blue-300 text-[10px] uppercase tracking-wide">Tier</p><p className="text-white text-xs font-semibold capitalize">{boq.tier}</p></div>
              </div>
            )}
          </div>

          {/* Progress steps */}
          <div className="px-5 py-4">
            <div className="flex items-center">
              {PROGRESS_STEPS.map((step, idx) => {
                const done = idx < currentStepIdx
                const active = idx === currentStepIdx
                const last = idx === PROGRESS_STEPS.length - 1
                return (
                  <Fragment key={step.key}>
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${done ? 'bg-[#1F3864] border-[#1F3864]' : active ? 'bg-white border-[#1F3864]' : 'bg-white border-gray-200'}`}>
                        {done
                          ? <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                          : <span className={`text-[10px] font-bold ${active ? 'text-[#1F3864]' : 'text-gray-300'}`}>{idx+1}</span>}
                      </div>
                      <p className={`text-[9px] font-semibold mt-1 text-center leading-tight max-w-[44px] ${active ? 'text-[#1F3864]' : done ? 'text-gray-500' : 'text-gray-300'}`}>{step.label}</p>
                    </div>
                    {!last && <div className={`flex-1 h-0.5 mx-1 mb-3 ${idx < currentStepIdx ? 'bg-[#1F3864]' : 'bg-gray-200'}`}/>}
                  </Fragment>
                )
              })}
            </div>
          </div>
        </div>

        {/* No booking */}
        {!booking && (
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-12 text-center">
            <p className="text-gray-600 font-semibold text-sm">No active booking found</p>
            <p className="text-gray-400 text-xs mt-1">Your estimate will appear here once sent by our team.</p>
          </div>
        )}

        {canShowEstimate && boq && booking && (<>

        {/* ═══ SECTION 2 — PROJECT SUMMARY ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Project Summary</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { label: 'Job Type',      value: booking.job_type },
                { label: 'Zone',          value: [booking.zone, booking.district].filter(Boolean).join(', ') || null },
                { label: 'Service Model', value: booking.service_model },
                { label: 'Site Visit',    value: siteReport ? fmtDate(siteReport.created_at) : null },
                { label: 'Supervisor',    value: supervisorName },
                { label: 'Valid Until',   value: fmtDate(boq.valid_until) },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {boq.coordinator_notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mt-1">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Coordinator Note</p>
                <p className="text-xs text-amber-800 italic">{boq.coordinator_notes}</p>
              </div>
            )}

            {safeArray<string>(clientScope?.confirmedItems).length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-600 mb-1.5">What is included</p>
                <ul className="space-y-1">
                  {safeArray<string>(clientScope?.confirmedItems).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5 text-xs shrink-0">✓</span>
                      <span className="text-xs text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {safeArray<string>(clientScope?.deferredItems).length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-600 mb-1.5">What is excluded / deferred</p>
                <ul className="space-y-1">
                  {safeArray<string>(clientScope?.deferredItems).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5 text-xs shrink-0">–</span>
                      <span className="text-xs text-gray-500">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECTION 3 — SITE CONDITIONS ════════════════════════════════════ */}
        {siteReport && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Site Conditions Observed During Visit</p>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { label: 'Ceiling',       value: toConditionString(ceiling?.ceilingCondition) },
                { label: 'North Wall',    value: toConditionString(walls?.northWall) },
                { label: 'South Wall',    value: toConditionString(walls?.southWall) },
                { label: 'East Wall',     value: toConditionString(walls?.eastWall) },
                { label: 'West Wall',     value: toConditionString(walls?.westWall) },
                { label: 'Floor',         value: toConditionString(floors?.floorCondition) },
                { label: 'Drain',         value: toConditionString(floors?.drainCondition) },
                { label: 'Damp Evidence', value: toConditionString(waterproof?.dampEvidence) },
                { label: 'Existing WP',   value: toConditionString(waterproof?.existingSystem) },
                { label: 'Plumbing',      value: toConditionString(plumbing?.mainFindings ?? plumbing?.condition) },
                { label: 'Electrical',    value: toConditionString(electrical?.mainFindings ?? electrical?.condition) },
                { label: 'Structural',    value: toConditionString(demolition?.mainFindings ?? demolition?.condition) },
              ].filter((r): r is { label: string; value: string } => r.value !== null).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <p className="text-xs font-semibold text-gray-600 w-28 shrink-0">{label}</p>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${conditionColor(value)}`}>{humanLabel(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SECTION 4 — RISK FLAGS ══════════════════════════════════════════ */}
        {(riskItems.length > 0 || riskDecisions.length > 0) && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-amber-600">
              <p className="text-white font-bold text-sm">Risk Assessment — Identified During Site Visit</p>
              <p className="text-amber-100 text-xs mt-0.5">{riskItems.length} risk item{riskItems.length !== 1 ? 's' : ''} identified</p>
            </div>
            <div className="divide-y divide-amber-100">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {riskItems.map((item: any) => {
                console.log('riskDecisions raw:', JSON.stringify(riskDecisions)) // TODO: remove console.logs before production
                console.log('first riskItem:', JSON.stringify(riskItems[0])) // TODO: remove console.logs before production
                const itemName = (item.skuName || item.sku_name || item.description || item.activityName || item.activity_name || '').toLowerCase()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const decision = riskDecisions.find((d: any) => {
                  const decDesc = (d.description || '').toLowerCase()
                  return decDesc.includes(itemName.slice(0, 20)) ||
                         itemName.includes(decDesc.slice(0, 20)) ||
                         (decDesc.length >= 15 && itemName.length >= 15 && decDesc.slice(0, 15) === itemName.slice(0, 15))
                })
                const badge: { label: string; cls: string } =
                  !decision
                    ? { label: 'PENDING', cls: 'bg-amber-100 text-amber-800' }
                    : decision.clientAcceptsRisk === true
                    ? { label: 'DECLINED', cls: 'bg-red-100 text-red-800' }
                    : { label: 'PROCEED', cls: 'bg-green-100 text-green-800' }
                return (
                  <div key={item.skuCode} className="px-5 py-4 bg-amber-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                        <p className="text-sm font-semibold text-amber-900">{displayLabel(item)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                        {decision && !decision.clientAcceptsRisk && (
                          <p className="text-xs text-green-700 mt-1">{decision.selectedRemedy}</p>
                        )}
                        {decision && decision.clientAcceptsRisk && (
                          <p className="text-xs text-red-700 mt-1">Client has accepted this risk</p>
                        )}
                      </div>
                    </div>
                    {item.description && (
                      <p className="text-xs text-amber-800 mb-2 pl-5">{item.description}</p>
                    )}
                    {item.amount > 0 && (
                      <p className="text-xs text-amber-700 pl-5">Recommended treatment: <span className="font-bold">₹ {fmtInr(item.amount)}</span></p>
                    )}
                    {decision?.clientAcceptsRisk && (
                      <div className="mt-2 pl-5">
                        <p className="text-[10px] text-red-700 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          Client has been informed of likely consequences. Platform warranty does not cover failures from this declined item.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ SECTION 5 — SCOPE OF WORK (BOQ) ════════════════════════════════ */}
        <div className="space-y-3">
          <div className="px-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Scope of Work — Bill of Quantities</p>
          </div>

          {groupedSections.map(([sectionName, items]) => {
            const sectionTotal = items.reduce((s, i) => s + i.amount, 0)
            const isOpen = expandedSections.has(sectionName)
            return (
              <div key={sectionName} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <button type="button" onClick={() => toggleSection(sectionName)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-[#1F3864] text-left">
                  <div>
                    <p className="text-white font-bold text-sm">{sectionName}</p>
                    <p className="text-blue-200 text-xs">{items.length} item{items.length !== 1 ? 's' : ''} · ₹ {fmtInr(sectionTotal)}</p>
                  </div>
                  <span className="text-blue-200 text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <BOQTable items={items} lineStates={lineStates} expandedId={expandedId}
                    onAction={setLineAction} onFieldChange={updateLineField}
                    onSaveRemark={() => setExpandedId(null)} onExpand={setExpandedId} />
                )}
              </div>
            )
          })}

          {/* Risk Remediation sub-section */}
          {riskItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
              <button type="button" onClick={() => toggleSection('__risk__')}
                className="w-full flex items-center justify-between px-5 py-3 bg-amber-600 text-left">
                <div>
                  <p className="text-white font-bold text-sm">Risk Remediation Items</p>
                  <p className="text-amber-100 text-xs">{riskItems.length} item{riskItems.length !== 1 ? 's' : ''} · ₹ {fmtInr(subtotalRisk)}</p>
                </div>
                <span className="text-amber-100 text-sm">{expandedSections.has('__risk__') ? '▲' : '▼'}</span>
              </button>
              {expandedSections.has('__risk__') && (
                <BOQTable items={riskItems} lineStates={lineStates} expandedId={expandedId}
                  onAction={setLineAction} onFieldChange={updateLineField}
                  onSaveRemark={() => setExpandedId(null)} onExpand={setExpandedId} />
              )}
            </div>
          )}
        </div>

        {/* ═══ SECTION 6 — ESTIMATE SUMMARY ═══════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[#1F3864]">
            <p className="text-white font-bold text-sm">Estimate Summary</p>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {[
              { label: 'Subtotal Labour',                                         value: subtotalLabour,              show: true,                      bold: true },
              { label: 'Subtotal Materials',                                      value: boq.subtotal_material,       show: boq.subtotal_material > 0, bold: true },
              { label: 'Risk Remediation',                                        value: subtotalRisk,                show: subtotalRisk > 0,          bold: true },
              { label: `Platform Premium (${boq.platform_premium_pct ?? 12}%)`,  value: boq.platform_premium_amount, show: true,                      bold: false },
              { label: `BOCW Cess (${boq.bocw_cess_percent ?? 1}%)`,             value: boq.bocw_cess_amount,        show: boq.bocw_cess_amount > 0,  bold: false },
              { label: `GST on Premium (${boq.gst_percent ?? 18}%)`,             value: boq.gst_amount,              show: true,                      bold: false },
              { label: `Contingency (${boq.contingency_percent}%)`,              value: boq.contingency_amount,      show: boq.contingency_amount > 0, bold: false },
            ].filter(r => r.show).map(({ label, value, bold }) => (
              <div key={label} className="flex items-center justify-between">
                <p className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{label}</p>
                <p className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>₹ {fmtInr(value)}</p>
              </div>
            ))}
            <div className="pt-3 border-t-2 border-[#1F3864] flex items-end justify-between">
              <p className="text-base font-bold text-[#1F3864] uppercase tracking-wide">Total Estimate</p>
              <p className="text-2xl font-bold text-[#1F3864]">₹ {fmtInr(boq.total_amount)}</p>
            </div>
            {/* Overall action buttons */}
            <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
              {([
                { action: 'accepted'         as const, label: '✓ Accept Total',  cls: overallAction==='accepted'         ? 'bg-green-600 text-white border-green-600' : 'border-green-500 text-green-700 hover:bg-green-50' },
                { action: 'review_requested' as const, label: '✎ Review Total',  cls: overallAction==='review_requested' ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-400 text-amber-700 hover:bg-amber-50' },
                { action: 'rejected'         as const, label: '✗ Reject Total',  cls: overallAction==='rejected'         ? 'bg-red-600 text-white border-red-600'   : 'border-red-400 text-red-700 hover:bg-red-50' },
              ]).map(({ action, label, cls }) => (
                <button key={action} type="button"
                  onClick={() => setOverallAction(prev => prev === action ? null : action)}
                  className={`py-2 rounded-xl text-xs font-bold border-2 transition-colors ${cls}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ SECTION 7 — PROJECT TIMELINE ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[#1F3864]">
            <p className="text-white font-bold text-sm">Project Timeline</p>
          </div>
          {timeline ? (
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Proposed Start',  value: fmtDate(timeline.proposedStart) !== '—' ? fmtDate(timeline.proposedStart) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN') },
                  { label: 'Est. Completion', value: fmtDate(timeline.estimatedCompletion) !== '—' ? fmtDate(timeline.estimatedCompletion) : new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN') },
                  { label: 'Working Days',    value: timeline.totalWorkingDays ? `${timeline.totalWorkingDays} days` : null },
                  { label: 'Calendar Days',   value: timeline.totalCalendarDays ? `${timeline.totalCalendarDays} days (incl. curing)` : null },
                ].filter(r => r.value).map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {safeArray(timeline.activities).length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden mt-2">
                  {safeArray<{dayRange:string;activity:string;duration?:number;curingDays?:number}>(timeline.activities).map((row, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100 last:border-0`}>
                      <span className="text-xs font-bold text-[#1F3864] w-16 shrink-0">{row.dayRange}</span>
                      <span className="text-xs text-gray-700 flex-1">{row.activity}</span>
                      {row.curingDays ? <span className="text-xs text-amber-600 font-semibold shrink-0">🔒 Curing</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 pb-5 pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Proposed Start</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Est. Completion</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
              {GENERIC_TIMELINE.map((row, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100 last:border-0`}>
                  <span className="text-xs font-bold text-[#1F3864] w-20 shrink-0">{row.dayRange}</span>
                  <span className="text-xs text-gray-700 flex-1">{row.activity}</span>
                  {row.curing ? <span className="text-xs text-amber-600 font-semibold shrink-0">🔒 Curing</span> : null}
                </div>
              ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ SECTION 8 — PAYMENT MILESTONES ═════════════════════════════════ */}
        <div className="space-y-3">
          <div className="px-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payment Milestone Schedule</p>
          </div>
          {(() => {
            // Sub-stages are frontend-only (not persisted). Keyed by milestone_code.
            const SUBSTAGES: Record<string, string[]> = {
              M1: MILESTONE_DATA.find(m => m.code === 'M1')?.subStages ?? [],
              M2: MILESTONE_DATA.find(m => m.code === 'M2')?.subStages ?? [],
              M3: MILESTONE_DATA.find(m => m.code === 'M3')?.subStages ?? [],
            }

            // Normalise: DB rows if present, fall back to JS constants.
            type RenderItem = { code: string; name: string; pct: number; amount: number; trigger: string; evidence: string[]; subStages: string[] }
            let items: RenderItem[]

            if (milestoneSchedule && milestoneSchedule.length > 0) {
              items = milestoneSchedule.map(row => ({
                code:      row.milestone_code,
                name:      row.milestone_name,
                pct:       Number(row.payment_percent),
                amount:    Number(row.payment_amount),
                trigger:   row.trigger_condition,
                evidence:  Array.isArray(row.evidence_required) ? row.evidence_required : [],
                subStages: SUBSTAGES[row.milestone_code] ?? [],
              }))
            } else {
              const fallback = boq?.job_card_type === 'M' ? MILESTONE_DATA_M : MILESTONE_DATA
              items = fallback.map(m => ({
                code:      m.code,
                name:      m.name,
                pct:       m.pct,
                amount:    boq ? boq.total_amount * m.pct / 100 : 0,
                trigger:   m.trigger,
                evidence:  m.evidence,
                subStages: m.subStages,
              }))
            }

            let cumulative = 0
            return items.map(m => {
              cumulative += m.amount
              const balance = boq ? boq.total_amount - cumulative : 0
              const open = expandedMilestone === m.code
              return (
                <div key={m.code} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <button type="button" onClick={() => toggleMilestone(m.code)}
                    className="w-full text-left px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#1F3864] flex items-center justify-center shrink-0">
                          <span className="text-white font-black text-xs">{m.code}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{m.name}</p>
                          <p className="text-xs text-gray-400">{m.pct}% of total</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#1F3864]">₹ {fmtInr(m.amount)}</p>
                        <p className="text-[10px] text-gray-400">{open ? '▲' : '▼'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Cumulative</p>
                        <p className="text-xs font-semibold text-gray-600">₹ {fmtInr(cumulative)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Balance</p>
                        <p className={`text-xs font-semibold ${balance <= 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          {balance <= 0 ? '₹ 0' : `₹ ${fmtInr(balance)}`}
                        </p>
                      </div>
                    </div>
                  </button>
                  {expandedMilestone === m.code && (
                    <div className="border-t-2 border-[#1F3864]/10 bg-gray-50 px-5 pb-5 pt-4 space-y-4">
                      {/* Payment Trigger */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <p className="text-[10px] font-bold text-blue-900 uppercase tracking-wide mb-1">Payment Trigger</p>
                        <p className="text-xs text-blue-800 leading-relaxed">{m.trigger}</p>
                      </div>
                      {/* Evidence Required */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Evidence Required</p>
                        <ul className="space-y-1.5">
                          {m.evidence.map((e, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-green-600 text-xs font-bold shrink-0 mt-0.5">✓</span>
                              <span className="text-xs text-gray-700">{e}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Sub-stages (frontend-only, sourced from constants) */}
                      {m.subStages.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Sub-stages</p>
                          <ul className="space-y-1.5">
                            {m.subStages.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-5 h-5 rounded-md bg-blue-900 text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <span className="text-xs text-gray-600">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>

        {/* ═══ SECTION 9 — RISK DECLINED NOTICES ══════════════════════════════ */}
        {declinedRiskItems.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-300 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
              <p className="text-sm font-bold text-amber-900">Formal Notice — Risks Declined by Client</p>
            </div>
            <div className="bg-amber-50 px-5 py-3 border-b border-amber-200">
              <p className="text-xs text-amber-800 leading-relaxed">
                The following risks were identified during site inspection and treatment was recommended by Pro Engineering.
                The client has chosen not to proceed with the recommended treatment. This is a formal record of that decision.
              </p>
            </div>
            <div className="divide-y divide-amber-100">
              {declinedRiskItems.map(item => (
                <div key={item.skuCode} className="px-5 py-4 bg-white">
                  <p className="text-sm font-bold text-red-700 mb-2">{displayLabel(item)}</p>
                  {item.description && <p className="text-xs text-gray-600 mb-2"><span className="font-semibold">Observed:</span> {item.description}</p>}
                  {item.amount > 0 && <p className="text-xs text-gray-600 mb-3"><span className="font-semibold">Recommended treatment:</span> ₹ {fmtInr(item.amount)}</p>}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold bg-red-100 text-red-800 px-2.5 py-1 rounded-full">DECLINED</span>
                    <span className="text-xs text-gray-400">Recorded on {fmtDate(new Date().toISOString())}</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Likely consequences if untreated</p>
                    {RISK_CONSEQUENCES.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-red-400 shrink-0 mt-0.5 text-xs">•</span>
                        <p className="text-xs text-red-800">{c}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 italic">
                    Platform warranty does <span className="font-bold text-red-600">NOT</span> cover failures arising from this declined treatment.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SECTION 10 — TERMS AND CONDITIONS ══════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button type="button" onClick={() => setTermsOpen(p => !p)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Terms and Conditions</p>
            <span className="text-gray-400 text-sm">{termsOpen ? '▲' : '▼'}</span>
          </button>
          {termsOpen && (
            <div className="px-5 pb-5 pt-1 space-y-4 border-t border-gray-100">
              {TERMS.map((t, i) => (
                <div key={t.heading}>
                  <p className="text-xs font-bold text-gray-800 mb-1">{i + 1}. {t.heading}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{t.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ SECTION 11 — CLIENT RESPONSE ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Your Response</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {(hasReviewItems || hasRejectItems || overallAction === 'review_requested' || overallAction === 'rejected') && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Overall remarks {overallAction === 'rejected' ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
                </label>
                <textarea value={overallRemarks} onChange={e => setOverallRemarks(e.target.value)} rows={3}
                  placeholder="Share any specific concerns or questions for our team…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"/>
              </div>
            )}
            {submitMsg && (
              <div className={`px-4 py-3 rounded-xl border text-sm font-semibold ${submitMsg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {submitMsg.text}
              </div>
            )}
            <div className="space-y-2 pt-1">
              <button type="button"
                disabled={submitting || hasReviewItems || hasRejectItems || overallAction === 'rejected' || overallAction === 'review_requested'}
                onClick={() => handleSubmit('accepted')}
                className="w-full py-4 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Submitting…' : '✓  ACCEPT ESTIMATE'}
              </button>
              <button type="button"
                disabled={submitting || (!hasReviewItems && overallAction !== 'review_requested')}
                onClick={() => handleSubmit('review_requested')}
                className="w-full py-4 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Submitting…' : '✎  SUBMIT REVIEW REMARKS'}
              </button>
              <button type="button"
                disabled={submitting || (overallAction !== 'rejected' && !hasRejectItems)}
                onClick={() => handleSubmit('rejected')}
                className="w-full py-4 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? 'Submitting…' : '✗  REJECT ESTIMATE'}
              </button>
            </div>
          </div>
        </div>

        {/* Response history */}
        {responseHistory.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Response History</p>
            </div>
            <div className="divide-y divide-gray-100">
              {responseHistory.map(r => (
                <div key={r.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.response_type==='accepted' ? 'bg-green-100 text-green-800' : r.response_type==='rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {r.response_type==='accepted' ? 'Accepted' : r.response_type==='rejected' ? 'Rejected' : 'Review Requested'}
                    </span>
                    <p className="text-xs text-gray-400">{fmtDate(r.responded_at)}</p>
                  </div>
                  {r.overall_remarks && <p className="text-xs text-gray-500 mt-2 italic">&ldquo;{r.overall_remarks}&rdquo;</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        </>)}
      </div>

      {/* ── Risk Decline Modal ─────────────────────────────────────────────────── */}
      {riskDeclinePending && (
        <RiskDeclineModal
          item={riskDeclinePending}
          declinedOn={new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          onConfirm={confirmRiskDecline}
          onCancel={() => setRiskDeclinePending(null)}
        />
      )}
    </div>
  )
}

// ── BOQTable ──────────────────────────────────────────────────────────────────

type TableProps = {
  items: BOQLineItem[]
  lineStates: Record<string, LineState>
  expandedId: string | null
  onAction: (id: string, action: LineAction, item: BOQLineItem) => void
  onFieldChange: (id: string, field: 'remarks'|'suggestedRate'|'suggestedQty', val: string) => void
  onSaveRemark: (id: string) => void
  onExpand: (id: string | null) => void
}

function BOQTable({ items, lineStates, expandedId, onAction, onFieldChange, onSaveRemark, onExpand }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-[36%]">Activity</th>
            <th className="px-2 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide w-[9%]">Unit</th>
            <th className="px-2 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[9%]">Qty</th>
            <th className="px-2 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[12%]">Rate ₹</th>
            <th className="px-2 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[13%]">Amt ₹</th>
            <th className="px-2 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide w-[21%]">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(item => {
            const id = item.skuCode
            const state = lineStates[id]
            const action = state?.action ?? null
            const isExpanded = expandedId === id
            return (
              <Fragment key={id}>
                <tr className={item.isRiskFlag ? 'bg-amber-50' : 'bg-white'}>
                  <td className="px-4 py-3">
                    <p className={`text-xs font-medium leading-snug ${item.isRiskFlag ? 'text-amber-800' : 'text-gray-800'}`}>
                      {item.isRiskFlag && <span className="mr-1 text-amber-500">⚠</span>}
                      {displayLabel(item)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.skuCode?.startsWith('LAB-') && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-wide">Labour</span>
                      )}
                      {item.skuCode?.startsWith('MAT-') && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-400 uppercase tracking-wide">Material</span>
                      )}
                      {action && (
                        <span className={`text-[9px] font-bold ${action==='accepted' ? 'text-green-600' : action==='review_requested' ? 'text-amber-600' : 'text-red-600'}`}>
                          {action==='accepted' ? '✓ Accepted' : action==='review_requested' ? '✎ Review' : '✗ Rejected'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-xs text-gray-500">{item.unit}</td>
                  <td className="px-2 py-3 text-right text-xs text-gray-700">{item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}</td>
                  <td className="px-2 py-3 text-right text-xs text-gray-700">
                    {item.missingRate ? <span className="text-amber-500">TBD</span> : fmtInr(item.rate)}
                  </td>
                  <td className="px-2 py-3 text-right text-xs font-semibold text-gray-800">
                    {item.amount > 0 ? fmtInr(item.amount) : '—'}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {([
                        { a: 'accepted'         as const, sym: '✓', on: 'bg-green-500 border-green-500 text-white', off: 'border-green-400 text-green-600 hover:bg-green-50' },
                        { a: 'review_requested' as const, sym: '✎', on: 'bg-amber-500 border-amber-500 text-white', off: 'border-amber-400 text-amber-600 hover:bg-amber-50' },
                        { a: 'rejected'         as const, sym: '✗', on: 'bg-red-500 border-red-500 text-white',   off: 'border-red-400 text-red-600 hover:bg-red-50' },
                      ]).map(({ a, sym, on, off }) => (
                        <button key={a} type="button"
                          onClick={() => onAction(id, a, item)}
                          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-colors ${action === a ? on : off}`}>
                          {sym}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5">Remarks <span className="text-red-500">*</span></label>
                          <textarea value={state?.remarks ?? ''} onChange={e => onFieldChange(id, 'remarks', e.target.value)}
                            rows={2} placeholder="Explain your concern…"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">Suggested rate ₹ <span className="text-gray-400">(opt.)</span></label>
                            <input type="number" min={0} value={state?.suggestedRate ?? ''} onChange={e => onFieldChange(id, 'suggestedRate', e.target.value)}
                              placeholder="e.g. 150" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"/>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">Suggested qty <span className="text-gray-400">(opt.)</span></label>
                            <input type="number" min={0} value={state?.suggestedQty ?? ''} onChange={e => onFieldChange(id, 'suggestedQty', e.target.value)}
                              placeholder="e.g. 30" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"/>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => onSaveRemark(id)}
                            className="px-4 py-2 rounded-xl bg-[#1F3864] text-white text-xs font-bold">Save Remark</button>
                          <button type="button" onClick={() => onExpand(null)}
                            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">Close</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── RiskDeclineModal ──────────────────────────────────────────────────────────

function RiskDeclineModal({ item, declinedOn, onConfirm, onCancel }: { item: BOQLineItem; declinedOn: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-red-700 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600 border border-red-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">RISK DECLINED BY CLIENT</p>
            <p className="text-red-200 text-xs">Platform Notice — Please read carefully</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Risk Observed</p>
              <p className="text-sm font-semibold text-red-900 mt-0.5">{displayLabel(item)}</p>
            </div>
            {item.description && (
              <div>
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Platform Recommendation</p>
                <p className="text-sm text-red-800 mt-0.5">{item.description}{item.amount > 0 && <span className="font-bold"> — ₹ {fmtInr(item.amount)}</span>}</p>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-red-200">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Client Decision</p>
              <p className="text-xs font-bold text-red-700">DECLINED on {declinedOn}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Likely consequences if untreated</p>
            <ul className="space-y-2">
              {RISK_CONSEQUENCES.map(c => (
                <li key={c} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                    <span className="text-amber-600 text-[9px] font-black">!</span>
                  </span>
                  <p className="text-xs text-gray-700 leading-snug">{c}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-900 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Platform Warranty Notice</p>
            <p className="text-xs text-gray-300 leading-relaxed">
              Pro Engineering has identified this risk and recommended treatment. The client has chosen not to address this item.
              Platform warranty does <span className="text-white font-bold">NOT</span> cover failures arising from this declined treatment.
              This decision is recorded and acknowledged.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button type="button" onClick={onConfirm}
              className="w-full py-4 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 active:scale-[0.98] transition-all">
              I Understand — Decline Treatment
            </button>
            <button type="button" onClick={onCancel}
              className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors">
              Cancel — Keep Recommendation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
