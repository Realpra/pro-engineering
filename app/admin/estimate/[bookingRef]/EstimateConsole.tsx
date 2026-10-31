'use client'

import { Fragment, useMemo, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveEstimate, sendForAdminApproval, sendToClient, generateBOQ, getPolicyRate, requestPremiumApproval } from './actions'
import { approveBoqField } from './actions'
import type { BOQLineItem } from './actions'
import ClientRemarksPanel from './ClientRemarksPanel'
import MilestonePlanTab from './MilestonePlanTab'
import ConfirmExecutionPanel, { type SupervisorOption, type CoordinatorOption } from './ConfirmExecutionPanel'
import TaskLedgerTab from './TaskLedgerTab'

// ── Types ─────────────────────────────────────────────────────────────────────

type Report = Record<string, unknown>

type Job = {
  booking_ref: string
  job_title: string | null
  zone: string | null
  district: string | null
  job_type: string | null
  status?: string | null
  driving_role?: 'coordinator' | 'sub_coordinator' | null
  driving_user_id?: string | null
  confirmed_for_execution_at?: string | null
}

type LabourConfig = {
  activity: string
  activity_name: string | null
  unit: string | null
  sequence_order: number | null
  rate_card_code: string | null
}

type RateCard = {
  activity_code: string
  base_rate: number
  geo_id: string
}

type ExistingEstimate = {
  id: string
  version: number
  status: string
  line_items: unknown
  subtotal_labour: number
  contingency_pct: number
  discount_pct: number
  coordinator_notes: string | null
}

export type GeneratedBOQ = {
  id: string
  tier: string
  job_card_type: string
  status: string
  line_items: BOQLineItem[]
  subtotal_labour: number
  subtotal_material: number
  platform_premium_pct: number
  platform_premium_amount: number
  bocw_cess_percent: number
  bocw_cess_amount: number
  gst_amount: number
  total_amount: number
  estimate_version: number | null
  estimate_version_label: string | null
  deferred_value: number
  deferred_pct: number
  contingency_percent: number | null
  platform_premium_status: string | null
  contingency_status: string | null
}

// Internal line item shape used by the editor
type LineItem = {
  id: string
  activityCode: string
  activityName: string
  description: string | null
  unit: string
  quantity: number
  rate: number
  amount: number
  isRiskFlag: boolean
  isSupervision: boolean
  missingRate: boolean
  editReason: string
}

type Tier = 'budget' | 'premium' | 'luxury'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function getJobCardTypeInfo(type: string): { label: string; description: string } {
  if (type === 'M') return { label: 'Material Supply', description: 'Material supply scope — hardware, fixtures, tiles, and related materials only. Installation not included.' }
  if (type === 'LM') return { label: 'Turnkey Renovation', description: 'Full turnkey scope — site labour plus all material supply and installation.' }
  return { label: 'Labour Only', description: 'Workmanship scope — site labour, tiling, waterproofing, and related installation activities.' }
}

function fromBOQLine(b: BOQLineItem): LineItem {
  return {
    id: b.skuCode,
    activityCode: b.skuCode,
    activityName: b.skuName || b.skuCode,
    description: b.description ?? null,
    unit: b.unit,
    quantity: b.quantity,
    rate: b.rate,
    amount: b.amount,
    isRiskFlag: b.isRiskFlag,
    isSupervision: b.skuCode === 'supervision',
    missingRate: b.missingRate,
    editReason: '',
  }
}

// ── Scope extraction (fallback if no generatedBOQ) ───────────────────────────

type RiskFlagRecord = {
  description: string
  selectedRemedy: string | null
  clientAcceptsRisk: boolean
}

function getActiveScope(report: Report): Record<string, string> {
  const scopeIntent = (report.screen02_scope_intent as Record<string, string> | null) ?? {}
  const clientScope = (report.screen18_client_scope as {
    decisions?: Array<{ key: string; clientDecision: string; confirmedValue: string | null }>
  } | null) ?? {}

  const active: Record<string, string> = { ...scopeIntent }
  for (const d of clientScope.decisions ?? []) {
    if ((d.clientDecision === 'confirmed' || d.clientDecision === 'changed') && d.confirmedValue) {
      active[d.key] = d.confirmedValue
    }
  }
  return active
}

const FALLBACK_NAMES: Record<string, string> = {
  'demolition-floor':  'Demolition – Floor Tiles',
  'demolition-wall':   'Demolition – Wall Tiles',
  'waterproofing':     'Waterproofing Treatment',
  'floor-screed':      'Floor Screed',
  'floor-tiling':      'Floor Tiling',
  'wall-tiling':       'Wall Tiling',
  'plastering-wall':   'Wall Plastering',
  'grouting':          'Tile Grouting',
  'plumbing-reroute':  'Plumbing Reroute',
  'electrical-points': 'Electrical New Points',
  'fixture-fitting':   'Fixture & Sanitary Fitting',
  'supervision':       'Site Supervision',
}

const FALLBACK_UNITS: Record<string, string> = {
  'demolition-floor':  'sq ft',
  'demolition-wall':   'sq ft',
  'waterproofing':     'sq ft',
  'floor-screed':      'sq ft',
  'floor-tiling':      'sq ft',
  'wall-tiling':       'sq ft',
  'plastering-wall':   'sq ft',
  'grouting':          'sq ft',
  'plumbing-reroute':  'job',
  'electrical-points': 'point',
  'fixture-fitting':   'job',
  'supervision':       'day',
}

function computeLineItems(
  report: Report,
  labourConfig: LabourConfig[],
  rateCards: RateCard[],
): LineItem[] {
  const scope = getActiveScope(report)
  const meas = (report.screen14_measurements as Record<string, number> | null) ?? {}
  const labour = (report.screen15_labour as Record<string, number> | null) ?? {}
  const timeline = (report.screen16_timeline as Record<string, number> | null) ?? {}
  const elec = (report.screen07_electrical as { newPoints?: Record<string, number> } | null) ?? {}
  const risks = (report.screen17_risk_decisions as { flags?: RiskFlagRecord[] } | null) ?? {}

  const floorArea = Number(meas.floorArea) || 0
  const totalWallArea = Number(meas.totalWallArea) || 0

  const rateMap: Record<string, number> = {}
  for (const rc of rateCards) rateMap[rc.activity_code] = Number(rc.base_rate) || 0

  const items: LineItem[] = []

  for (const cfg of labourConfig) {
    const code = cfg.activity
    let qty = 0
    let include = true

    switch (code) {
      case 'demolition-floor':
        include = scope.tilesScope !== 'retain-all'
        qty = floorArea
        break
      case 'demolition-wall':
        include = scope.tilesScope !== 'retain-all'
        qty = totalWallArea
        break
      case 'waterproofing':
        qty = floorArea
        break
      case 'floor-screed':
        qty = floorArea
        break
      case 'floor-tiling':
        include = ['replace-all', 'replace-floor-only'].includes(scope.tilesScope)
        qty = floorArea
        break
      case 'wall-tiling':
        include = ['replace-all', 'replace-walls-only'].includes(scope.tilesScope)
        qty = totalWallArea
        break
      case 'plastering-wall':
        qty = totalWallArea
        break
      case 'grouting':
        include = scope.tilesScope !== 'retain-all'
        qty = floorArea + totalWallArea
        break
      case 'plumbing-reroute':
        include = scope.plumbingScope === 'reroute'
        qty = 1
        break
      case 'electrical-points': {
        include = scope.electricalScope === 'add-change'
        const pts = elec.newPoints ?? {}
        qty = Object.values(pts).reduce((s, v) => s + (Number(v) || 0), 0)
        break
      }
      case 'fixture-fitting':
        include = scope.fixturesScope !== 'retain-all'
        qty = 1
        break
      case 'supervision':
        qty = Number(timeline.totalCalendarDays) || Number(labour.totalCalendarDays) || 0
        break
      default:
        include = false
    }

    if (!include) continue

    const rateCode = cfg.rate_card_code ?? ''
    const rate = rateCode ? (rateMap[rateCode] ?? 0) : 0
    const missingRate = !rateCode || !(rateCode in rateMap)
    items.push({
      id: code,
      activityCode: code,
      activityName: cfg.activity_name ?? FALLBACK_NAMES[code] ?? code,
      description: null,
      unit: cfg.unit ?? FALLBACK_UNITS[code] ?? 'unit',
      quantity: qty,
      rate,
      amount: qty * rate,
      isRiskFlag: false,
      isSupervision: code === 'supervision',
      missingRate,
      editReason: '',
    })
  }

  ;(risks.flags ?? []).forEach((flag, idx) => {
    if (flag.clientAcceptsRisk || !flag.selectedRemedy) return
    const match = flag.selectedRemedy.match(/Rs\s*([\d,]+)/)
    if (!match) return
    const cost = parseFloat(match[1].replace(/,/g, ''))
    if (!cost || isNaN(cost)) return
    items.push({
      id: `RISK-${idx}`,
      activityCode: `RISK-${idx}`,
      activityName: flag.description,
      description: null,
      unit: 'lumpsum',
      quantity: 1,
      rate: cost,
      amount: cost,
      isRiskFlag: true,
      isSupervision: false,
      missingRate: false,
      editReason: '',
    })
  })

  return items
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  bookingRef: string
  report: Report | null
  job: Job
  rateCards: RateCard[]
  labourConfig: LabourConfig[]
  existingEstimate: ExistingEstimate | null
  generatedBOQ: GeneratedBOQ | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  latestClientResponse: any
  platformRole: string
  adminUserId: string
  supervisors: SupervisorOption[]
  coordinators: CoordinatorOption[]
  matchingCoordinatorIds: string[]
  // Lets /coordinator/dynamic-scheduler deep-link straight into this job's
  // Task Ledger tab instead of landing on Estimate every time -- read from
  // the URL server-side (page.tsx's own searchParams) rather than
  // useSearchParams() here, which would need a Suspense boundary this page
  // doesn't otherwise have any reason to add.
  initialTab?: 'estimate' | 'milestone-plan' | 'task-ledger'
}

export default function EstimateConsole({
  bookingRef,
  report,
  job,
  rateCards,
  labourConfig,
  existingEstimate,
  generatedBOQ,
  latestClientResponse,
  platformRole,
  adminUserId,
  supervisors,
  coordinators,
  matchingCoordinatorIds,
  initialTab,
}: Props) {
  const router = useRouter()

  const hasClientRemarks =
    generatedBOQ?.status === 'client_review' && latestClientResponse != null
  const [showRemarksPanel, setShowRemarksPanel] = useState(hasClientRemarks)
  const [activeTab, setActiveTab] = useState<'estimate' | 'milestone-plan' | 'task-ledger'>(
    initialTab && generatedBOQ ? initialTab : 'estimate'
  )

  // Initialise line items: prefer generatedBOQ → then existingEstimate → then compute
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialItems = useMemo<LineItem[]>(() => {
    if (generatedBOQ?.line_items?.length) {
      return generatedBOQ.line_items.map(fromBOQLine)
    }
    if (existingEstimate?.line_items) return existingEstimate.line_items as LineItem[]
    if (!report) return []
    return computeLineItems(report, labourConfig, rateCards)
  }, [])

  const [tier, setTier] = useState<Tier>((generatedBOQ?.tier as Tier) ?? 'budget')
  const [lineItems, setLineItems] = useState<LineItem[]>(initialItems)
  const [contingencyPct, setContingencyPct] = useState<number>(generatedBOQ?.contingency_percent ?? 0)
  const [discountPct, setDiscountPct] = useState<number>(existingEstimate?.discount_pct ?? 0)
  const [notes, setNotes] = useState<string>(existingEstimate?.coordinator_notes ?? '')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editRate, setEditRate] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set())
  const [boqId, setBoqId] = useState<string | null>(generatedBOQ?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Policy state
  const [policyPremiumPct, setPolicyPremiumPct] = useState<number | null>(null)
  const [policyAllowedMin, setPolicyAllowedMin] = useState<number | null>(null)
  const [policyAllowedMax, setPolicyAllowedMax] = useState<number | null>(null)
  const [policyContingencyMax, setPolicyContingencyMax] = useState<number | null>(null)
  const [adminContingencyLimit, setAdminContingencyLimit] = useState<number | null>(null)
  const [policyJobType, setPolicyJobType] = useState<string | null>(null)
  const [contingencyRepoMsg, setContingencyRepoMsg] = useState<string | null>(null)
  const [platformPremiumPct, setPlatformPremiumPct] = useState<number>(generatedBOQ?.platform_premium_pct ?? 12)
  const [approvalReason, setApprovalReason] = useState('')
  const [approvalSubmitting, setApprovalSubmitting] = useState(false)
  const [approvalMsg, setApprovalMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [approvalRequestSent, setApprovalRequestSent] = useState(false)

  // Within band = policy_rate + min_deviation_pct <= proposed <= policy_rate + max_deviation_pct
  const withinBand =
    policyAllowedMin == null || policyAllowedMax == null
      ? true
      : platformPremiumPct >= policyAllowedMin && platformPremiumPct <= policyAllowedMax

  useEffect(() => {
    if (!generatedBOQ) return
    // Owner, 31 Oct 2026: policy values come from Admin's repository, resolved server-side
    // from this estimate's job type / category / tier and the job's region.
    getPolicyRate(bookingRef).then(res => {
      setPolicyPremiumPct(res.premiumPct)
      setPolicyAllowedMin(res.allowedMin)
      setPolicyAllowedMax(res.allowedMax)
      setPolicyContingencyMax(res.repoContingencyPct)
      setAdminContingencyLimit(res.adminContingencyLimitPct)
      setPolicyJobType(res.policyJobType)
      setContingencyRepoMsg(res.contingencyMessage)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRequestApproval() {
    if (!boqId || !approvalReason.trim() || policyPremiumPct == null) return
    setApprovalSubmitting(true)
    setApprovalMsg(null)
    const res = await requestPremiumApproval(
      bookingRef,
      boqId,
      platformPremiumPct,
      policyPremiumPct,
      totals.totalAmount,
      approvalReason,
    )
    if (res.error) {
      setApprovalMsg({ text: res.error, ok: false })
    } else {
      setApprovalMsg({ text: 'Approval request submitted. Admin will review shortly.', ok: true })
      setApprovalReason('')
    }
    setApprovalSubmitting(false)
  }

  const totals = useMemo(() => {
    const bocwCessPct = generatedBOQ?.bocw_cess_percent ?? 1
    const subtotalLabour = lineItems
      .filter(i => !i.isRiskFlag && String(i.activityCode ?? '').startsWith('LAB-'))
      .reduce((s, i) => s + i.amount, 0)
    const subtotalMaterial = lineItems
      .filter(i => !i.isRiskFlag && String(i.activityCode ?? '').startsWith('MAT-'))
      .reduce((s, i) => s + i.amount, 0)
    const subtotalRiskFlags = lineItems
      .filter(i => i.isRiskFlag)
      .reduce((s, i) => s + i.amount, 0)
    const platformFee = (subtotalLabour + subtotalMaterial) * (platformPremiumPct / 100)
    const bocwCess = subtotalLabour * (bocwCessPct / 100)
    const gstAmount = platformFee * 0.18
    const contingencyAmount = (subtotalLabour + subtotalMaterial) * (contingencyPct / 100)
    const discountAmount = subtotalLabour * (discountPct / 100)
    const totalAmount = subtotalLabour + subtotalMaterial + subtotalRiskFlags + platformFee + bocwCess + gstAmount + contingencyAmount - discountAmount
    return { subtotalLabour, subtotalMaterial, subtotalRiskFlags, platformFee, platformPremiumPct, bocwCess, gstAmount, contingencyAmount, discountAmount, totalAmount }
  }, [lineItems, contingencyPct, discountPct, generatedBOQ, platformPremiumPct])

  const hasEdits = editedIds.size > 0 || discountPct > 0
  const noRates = rateCards.length === 0 && !generatedBOQ

  function startEdit(item: LineItem) {
    setEditingId(item.id)
    setEditQty(String(item.quantity))
    setEditRate(String(item.rate))
    setEditReason(item.editReason)
  }

  function applyEdit() {
    if (!editingId) return
    const qty = parseFloat(editQty) || 0
    const rate = parseFloat(editRate) || 0
    setLineItems(prev =>
      prev.map(item =>
        item.id === editingId
          ? { ...item, quantity: qty, rate, amount: qty * rate, editReason }
          : item
      )
    )
    setEditedIds(prev => new Set([...prev, editingId]))
    setEditingId(null)
    setEditReason('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditReason('')
  }

  // ── Tier regeneration ──────────────────────────────────────────────────────

  async function handleRegenerate(newTier: Tier) {
    setRegenerating(true)
    setSaveMsg(null)
    try {
      const res = await generateBOQ(bookingRef, newTier, generatedBOQ?.job_card_type ?? 'LM')
      if (res.error) throw new Error(res.error)
      if (res.lineItems) {
        setLineItems(res.lineItems.map(fromBOQLine))
        setEditedIds(new Set())
      }
      setTier(newTier)
      setSaveMsg({ text: `BOQ regenerated — ${newTier.toUpperCase()} tier.`, ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Regeneration failed', ok: false })
    } finally {
      setRegenerating(false)
    }
  }

  // ── Save / send ────────────────────────────────────────────────────────────

  const buildTotalsPayload = useCallback(() => ({
    subtotalLabour: totals.subtotalLabour,
    subtotalMaterial: totals.subtotalMaterial,
    subtotalRiskFlags: totals.subtotalRiskFlags,
    platformPremiumPct: totals.platformPremiumPct,
    platformFee: totals.platformFee,
    bocwCess: totals.bocwCess,
    gstAmount: totals.gstAmount,
    contingencyPct,
    contingencyAmount: totals.contingencyAmount,
    discountPct,
    discountAmount: totals.discountAmount,
    totalAmount: totals.totalAmount,
  }), [totals, contingencyPct, discountPct])

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await saveEstimate(
        bookingRef,
        tier,
        generatedBOQ?.job_card_type ?? 'L',
        lineItems as Parameters<typeof saveEstimate>[3],
        buildTotalsPayload(),
        notes,
      )
      if (res.error) throw new Error(res.error)
      if (res.boqId) setBoqId(res.boqId)
      setSaveMsg({ text: 'Draft saved.', ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally {
      setSaving(false)
    }
  }

  async function handleSendForAdminApproval() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await sendForAdminApproval(bookingRef)
      if (res.error) throw new Error(res.error)
      setSaveMsg({ text: 'Sent for admin approval.', ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Failed to send for approval', ok: false })
    } finally {
      setSaving(false)
    }
  }

  async function handleSendToClient() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await sendToClient(bookingRef)
      if (res.error) throw new Error(res.error)
      setSaveMsg({ text: 'Estimate sent to client. Booking status updated to estimate_sent.', ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Failed to send', ok: false })
    } finally {
      setSaving(false)
    }
  }

  async function handleRequestApprovalFromSendButton() {
    if (!boqId || policyPremiumPct == null) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await requestPremiumApproval(
        bookingRef,
        boqId,
        platformPremiumPct,
        policyPremiumPct,
        totals.totalAmount,
        'Coordinator override',
      )
      if (res.error) throw new Error(res.error)
      setApprovalRequestSent(true)
      setSaveMsg({ text: 'Approval request submitted. Estimate will be sent to client after Super Admin approval.', ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Failed to submit approval request', ok: false })
    } finally {
      setSaving(false)
    }
  }

  // ── Measurements for job card ──────────────────────────────────────────────
  const meas = report
    ? (report.screen14_measurements as Record<string, number> | null) ?? {}
    : {}

  const regularItems = lineItems.filter(i => !i.isRiskFlag)
  const riskItems = lineItems.filter(i => i.isRiskFlag)

  return (
    <>
      {job.status === 'estimate_accepted' && !job.confirmed_for_execution_at && (
        <ConfirmExecutionPanel
          bookingRef={bookingRef}
          zone={job.zone}
          drivingRole={job.driving_role}
          supervisors={supervisors}
          coordinators={coordinators}
          matchingCoordinatorIds={matchingCoordinatorIds}
        />
      )}
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

      {/* ── Tab Switcher ── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('estimate')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
            activeTab === 'estimate'
              ? 'bg-[#1F3864] border-[#1F3864] text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-[#1F3864]/40 hover:text-[#1F3864]'
          }`}
        >
          Estimate
        </button>
        <button
          type="button"
          disabled={!generatedBOQ}
          title={!generatedBOQ ? 'Generate BOQ first' : undefined}
          onClick={() => setActiveTab('milestone-plan')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === 'milestone-plan'
              ? 'bg-[#1F3864] border-[#1F3864] text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-[#1F3864]/40 hover:text-[#1F3864]'
          }`}
        >
          Milestone Plan
        </button>
        <button
          type="button"
          disabled={!generatedBOQ}
          title={!generatedBOQ ? 'Generate BOQ first' : undefined}
          onClick={() => setActiveTab('task-ledger')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === 'task-ledger'
              ? 'bg-[#1F3864] border-[#1F3864] text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-[#1F3864]/40 hover:text-[#1F3864]'
          }`}
        >
          Task Ledger
        </button>
      </div>

      {activeTab === 'milestone-plan' && generatedBOQ && (
        <MilestonePlanTab bookingRef={bookingRef} jobCardType={generatedBOQ.job_card_type} />
      )}

      {activeTab === 'task-ledger' && generatedBOQ && (
        <TaskLedgerTab bookingRef={bookingRef} />
      )}

      {activeTab === 'estimate' && (
      <>

      {/* ── Client Remarks Banner ── */}
      {hasClientRemarks && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-amber-800">
                Client has submitted remarks — Review Now
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {(latestClientResponse?.line_item_responses ?? []).filter(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (r: any) => r.action !== 'accepted'
                ).length} item(s) require a coordinator decision before the estimate can be resent.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRemarksPanel((v) => !v)}
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors"
            >
              {showRemarksPanel ? 'Hide Panel' : 'Review Now'}
            </button>
          </div>

          {showRemarksPanel && (
            <div className="border-t border-amber-200 px-5 py-4 bg-white">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">
                Client Remarks — Coordinator Review
              </p>
              <ClientRemarksPanel
                bookingRef={bookingRef}
                boqId={boqId ?? generatedBOQ?.id ?? ''}
                lineItems={generatedBOQ?.line_items ?? []}
                latestResponse={latestClientResponse}
                onProcessed={() => router.refresh()}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Version badge (after coordinator processes remarks) ── */}
      {generatedBOQ?.estimate_version_label && (
        <div className="px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
          <span className="text-xs font-bold text-blue-700">
            Estimate {generatedBOQ.estimate_version_label}
          </span>
          {(generatedBOQ.deferred_pct ?? 0) > 0 && (
            <span className="text-xs text-blue-600">
              · {generatedBOQ.deferred_pct.toFixed(1)}% deferred (₹
              {new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
                Math.round(generatedBOQ.deferred_value ?? 0)
              )}{' '}
              moved to deferred list)
            </span>
          )}
        </div>
      )}

      {/* Job Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-[#1F3864] text-white">
          <p className="font-bold text-sm">Job Details</p>
        </div>
        {generatedBOQ?.job_card_type && (() => {
          const info = getJobCardTypeInfo(generatedBOQ.job_card_type)
          return (
            <div className="px-5 py-3 border-b border-gray-100 bg-blue-50">
              <p className="text-xs font-bold text-[#1F3864]">{info.label}</p>
              <p className="text-xs text-gray-600 mt-0.5">{info.description}</p>
            </div>
          )
        })()}
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
          {[
            { label: 'Booking Ref',  value: bookingRef },
            { label: 'Job Type',     value: job.job_type ?? '—' },
            { label: 'Zone',         value: job.zone ?? '—' },
            { label: 'District',     value: job.district ?? '—' },
            { label: 'Floor Area',   value: meas.floorArea ? `${meas.floorArea} sq ft` : '—' },
            { label: 'Total Wall',   value: meas.totalWallArea ? `${meas.totalWallArea} sq ft` : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tier Selector ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">BOQ Tier</p>
        <div className="flex gap-2 mb-3">
          {(['budget', 'premium', 'luxury'] as const).map(t => (
            <button
              key={t}
              type="button"
              disabled={regenerating || saving}
              onClick={() => { if (tier !== t) handleRegenerate(t) }}
              className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors disabled:opacity-50 ${
                tier === t
                  ? 'bg-[#1F3864] border-[#1F3864] text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-[#1F3864]/40 hover:text-[#1F3864]'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={regenerating || saving}
          onClick={() => handleRegenerate(tier)}
          className="w-full py-2.5 rounded-xl border border-[#1F3864]/30 text-[#1F3864] text-xs font-bold hover:bg-[#1F3864]/5 transition-colors disabled:opacity-50"
        >
          {regenerating ? 'Regenerating BOQ…' : '↺  REGENERATE BOQ'}
        </button>
      </div>

      {/* No rates warning (only when no BOQ and no rate cards) */}
      {noRates && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs font-bold text-amber-700">
            No rate card found for zone &ldquo;{job.zone ?? '—'}&rdquo;.
            Rates are set to ₹0 — edit each line item to enter the correct rate.
          </p>
        </div>
      )}

      {/* Existing estimate badge */}
      {existingEstimate && (
        <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs font-semibold text-blue-700">
            Loaded saved estimate v{existingEstimate.version}
            &nbsp;·&nbsp;status: <span className="font-bold">{existingEstimate.status}</span>
          </p>
        </div>
      )}

      {/* ── Labour Line Items ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-[#1F3864] text-white flex items-center justify-between">
          <p className="font-bold text-sm">Labour Activities</p>
          {regularItems.length > 0 && (
            <span className="text-xs text-blue-200">{regularItems.length} activities</span>
          )}
        </div>

        {regularItems.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-gray-500">No labour activities computed.</p>
            <p className="text-xs text-gray-400 mt-1">
              {!report
                ? 'No submitted scope report found for this booking.'
                : 'Ensure scope intent, measurements, and labour schedule screens are completed, then regenerate.'}
            </p>
          </div>
        ) : (
          <LineItemTable
            items={regularItems}
            editingId={editingId}
            editQty={editQty}
            editRate={editRate}
            editReason={editReason}
            editedIds={editedIds}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onApplyEdit={applyEdit}
            onEditQtyChange={setEditQty}
            onEditRateChange={setEditRate}
            onEditReasonChange={setEditReason}
          />
        )}
      </div>

      {/* ── Risk Flag Line Items ── */}
      {riskItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-600 text-white flex items-center justify-between">
            <p className="font-bold text-sm">Risk Remediation Items</p>
            <span className="text-xs text-amber-100">{riskItems.length} items</span>
          </div>
          <LineItemTable
            items={riskItems}
            editingId={editingId}
            editQty={editQty}
            editRate={editRate}
            editReason={editReason}
            editedIds={editedIds}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onApplyEdit={applyEdit}
            onEditQtyChange={setEditQty}
            onEditRateChange={setEditRate}
            onEditReasonChange={setEditReason}
          />
        </div>
      )}

      {/* ── Estimate Summary ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-[#1F3864] text-white">
          <p className="font-bold text-sm">Estimate Summary</p>
        </div>
        <div className="px-5 py-5 space-y-3">

          <div className="space-y-2">
            {[
              ...(totals.subtotalLabour > 0 ? [{ label: 'Subtotal Labour', value: totals.subtotalLabour, bold: true }] : []),
              ...(totals.subtotalMaterial > 0 ? [
                { label: 'Subtotal Materials',     value: totals.subtotalMaterial, bold: true },
              ] : []),
              { label: `Platform Premium (${totals.platformPremiumPct}%)`, value: totals.platformFee, bold: false },
              { label: 'BOCW Cess (1%)',                                  value: totals.bocwCess,    bold: false },
              { label: 'GST on Platform Premium (18%)',                   value: totals.gstAmount,   bold: false },
            ].map(({ label, value, bold }) => (
              <div key={label} className="flex items-center justify-between">
                <p className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</p>
                <p className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                  ₹ {fmtInr(value)}
                </p>
              </div>
            ))}
          </div>

          {platformRole === 'admin' && generatedBOQ?.platform_premium_status === 'proposed' && (
            <form action={async () => { await approveBoqField(generatedBOQ.id, 'platform_premium', adminUserId) }}>
              <button type="submit" className="mt-1 text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-lg w-full">
                ✓ Approve Platform Premium
              </button>
            </form>
          )}
          {platformRole === 'admin' && generatedBOQ?.platform_premium_status === 'approved' && (
            <span className="mt-1 text-xs font-bold text-green-600 block">✓ Platform Premium Approved</span>
          )}

          {/* Contingency slider */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">Contingency</label>
              <span className="text-sm font-bold text-[#1F3864]">
                {contingencyPct}% &nbsp;·&nbsp; + ₹ {fmtInr(totals.contingencyAmount)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={15}
              step={0.5}
              value={contingencyPct}
              onChange={e => setContingencyPct(Number(e.target.value))}
              className="w-full accent-[#1F3864]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0%</span><span>15%</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {policyContingencyMax !== null
                ? `From Admin's repository (${policyJobType ?? '—'}): ${policyContingencyMax}%. Admin approves up to ${adminContingencyLimit ?? 5}%; above that Super Admin.`
                : (contingencyRepoMsg ?? 'Reading Admin\'s repository…')}
            </p>
            {policyContingencyMax !== null && contingencyPct !== policyContingencyMax && (
              <button type="button" onClick={() => setContingencyPct(policyContingencyMax)}
                className="mt-1 text-[11px] font-semibold text-[#1F3864] underline">
                Use repository value ({policyContingencyMax}%)
              </button>
            )}
            {generatedBOQ?.contingency_status === 'proposed' && Number(generatedBOQ?.contingency_percent ?? 0) > (adminContingencyLimit ?? 5) && (
              <p className="text-[11px] font-semibold text-amber-700 mt-1">
                Saved contingency {generatedBOQ?.contingency_percent}% is above Admin&apos;s limit — Super Admin approves.
              </p>
            )}
          </div>

          {platformRole === 'super_admin' && generatedBOQ?.contingency_status === 'proposed' && Number(generatedBOQ?.contingency_percent ?? 0) > 0 && (
            <form action={async () => { await approveBoqField(generatedBOQ.id, 'contingency', adminUserId) }}>
              <button type="submit" className="mt-1 text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-lg w-full">
                ✓ Approve Contingency (Super Admin)
              </button>
            </form>
          )}
          {platformRole === 'admin' && generatedBOQ?.contingency_status === 'proposed' && Number(generatedBOQ?.contingency_percent ?? 0) <= (adminContingencyLimit ?? 5) && (
            <form action={async () => { await approveBoqField(generatedBOQ.id, 'contingency', adminUserId) }}>
              <button type="submit" className="mt-1 text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-lg w-full">
                ✓ Approve Contingency
              </button>
            </form>
          )}
          {['admin', 'super_admin'].includes(platformRole) && generatedBOQ?.contingency_status === 'approved' && (
            <span className="mt-1 text-xs font-bold text-green-600 block">✓ Contingency Approved</span>
          )}

          {/* Discount input */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Discount</label>
              <span className="text-sm font-bold text-red-600">
                − ₹ {fmtInr(totals.discountAmount)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={discountPct}
                onChange={e => setDiscountPct(Math.max(0, Number(e.target.value)))}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
              />
              <span className="text-sm text-gray-500">%  of subtotal labour</span>
            </div>
            {discountPct > 5 && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-bold text-amber-700">
                  Discount &gt; 5% requires admin approval before sending to client.
                </p>
              </div>
            )}
          </div>

          {/* Grand total */}
          <div className="pt-3 border-t-2 border-[#1F3864]">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-base font-bold text-[#1F3864] uppercase tracking-wide">Total Estimate</p>
                <p className="text-xs text-gray-400 mt-0.5">{tier.toUpperCase()} tier</p>
              </div>
              <p className="text-3xl font-bold text-[#1F3864]">₹ {fmtInr(totals.totalAmount)}</p>
            </div>
          </div>

          {/* Policy indicator */}
          {policyPremiumPct !== null && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-700">Platform Premium</span>
                  {withinBand ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Within Policy
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Approval Required — Outside Policy Band
                    </span>
                  )}
                  {policyContingencyMax !== null && (
                    <span className="text-xs text-gray-400">· repository contingency {policyContingencyMax}%</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    step={0.5}
                    value={platformPremiumPct}
                    onChange={e => setPlatformPremiumPct(Math.max(1, Number(e.target.value)))}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
              {policyAllowedMin !== null && policyAllowedMax !== null && (
                <p className="text-xs text-gray-400 mb-2">
                  Policy: {policyPremiumPct}% | Allowed: {policyAllowedMin}% to {policyAllowedMax}%
                </p>
              )}
              {!withinBand && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700 mb-2">
                    {platformPremiumPct}% is outside the allowed band ({policyAllowedMin}% to {policyAllowedMax}%). Request approval before sending to client.
                  </p>
                  <textarea
                    value={approvalReason}
                    onChange={e => setApprovalReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for premium override (e.g. high-complexity scope, specialist materials)…"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-xs placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 mb-2"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!approvalReason.trim() || approvalSubmitting || !boqId}
                      onClick={handleRequestApproval}
                      className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      {approvalSubmitting ? 'Submitting…' : 'Request Approval'}
                    </button>
                    {approvalMsg && (
                      <p className={`text-xs font-semibold ${approvalMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
                        {approvalMsg.text}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Coordinator Notes ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Coordinator Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Internal notes for this estimate…"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
        />
      </div>

      {/* Status / feedback messages */}
      {saveMsg && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-semibold ${
          saveMsg.ok
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {saveMsg.text}
        </div>
      )}

      {/* Approval notice */}
      {hasEdits && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs font-bold text-amber-700">
            {editedIds.size > 0
              ? `${editedIds.size} line item${editedIds.size > 1 ? 's' : ''} edited${discountPct > 0 ? ' · ' : ''}`
              : ''}
            {discountPct > 0 ? `${discountPct}% discount applied` : ''}
            &nbsp;— Admin approval required before sending to client.
          </p>
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-8">
        <button
          type="button"
          disabled={saving || regenerating}
          onClick={handleSave}
          className="py-4 rounded-xl border-2 border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'SAVE DRAFT'}
        </button>

        <button
          type="button"
          disabled={saving || regenerating}
          onClick={handleSendForAdminApproval}
          className="py-4 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'SEND FOR ADMIN APPROVAL'}
        </button>

        <button
          type="button"
          disabled={saving || regenerating || totals.totalAmount <= 0 || hasClientRemarks || (!withinBand && !approvalRequestSent)}
          onClick={withinBand ? handleSendToClient : handleRequestApprovalFromSendButton}
          title={
            hasClientRemarks
              ? 'Process client remarks before resending'
              : totals.totalAmount <= 0
              ? 'Estimate total is zero — generate BOQ first'
              : !withinBand && !approvalRequestSent
              ? `Platform premium ${platformPremiumPct}% is outside the allowed band (${policyAllowedMin}% to ${policyAllowedMax}%) — approval required`
              : undefined
          }
          className={`py-4 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            withinBand ? 'bg-[#1F3864] hover:bg-[#162950]' : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          {saving
            ? (withinBand ? 'Sending…' : 'Submitting…')
            : withinBand
            ? 'SEND TO CLIENT'
            : approvalRequestSent
            ? 'APPROVAL REQUESTED'
            : 'REQUEST APPROVAL'}
        </button>
      </div>

      </>
      )}

    </div>
    </>
  )
}

// ── LineItemTable sub-component ───────────────────────────────────────────────

type LineItemTableProps = {
  items: LineItem[]
  editingId: string | null
  editQty: string
  editRate: string
  editReason: string
  editedIds: Set<string>
  onStartEdit: (item: LineItem) => void
  onCancelEdit: () => void
  onApplyEdit: () => void
  onEditQtyChange: (v: string) => void
  onEditRateChange: (v: string) => void
  onEditReasonChange: (v: string) => void
}

function LineItemTable({
  items,
  editingId,
  editQty,
  editRate,
  editReason,
  editedIds,
  onStartEdit,
  onCancelEdit,
  onApplyEdit,
  onEditQtyChange,
  onEditRateChange,
  onEditReasonChange,
}: LineItemTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-[38%]">Activity</th>
            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide w-[10%]">Unit</th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[12%]">Qty</th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[14%]">Rate ₹</th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[14%]">Amount ₹</th>
            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wide w-[12%]">Edit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(item => {
            const isEditing = editingId === item.id
            const wasEdited = editedIds.has(item.id)
            const editedQtyNum = parseFloat(editQty) || 0
            const editedRateNum = parseFloat(editRate) || 0

            return (
              <Fragment key={item.id}>
                <tr className={
                  item.isRiskFlag
                    ? 'bg-amber-50'
                    : item.isSupervision
                    ? 'bg-sky-50/60'
                    : 'bg-white'
                }>
                  <td className="px-4 py-3">
                    <div>
                      <p className={`text-sm font-medium leading-tight ${item.isRiskFlag ? 'text-amber-800' : 'text-gray-800'}`}>
                        {item.isRiskFlag && <span className="mr-1 text-amber-500">⚠</span>}
                        {item.activityName || item.activityCode}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{item.description}</p>
                      )}
                      {wasEdited && !isEditing && (
                        <p className="text-xs text-[#2E74B5] mt-0.5">
                          Edited{item.editReason ? ` · ${item.editReason}` : ''}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500">{item.unit}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-700">
                    {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {item.missingRate
                      ? <span className="text-amber-600 font-bold text-xs">No rate</span>
                      : fmtInr(item.rate)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-800">
                    {item.amount > 0 ? fmtInr(item.amount) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => isEditing ? onCancelEdit() : onStartEdit(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isEditing
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-[#1F3864]/10 text-[#1F3864] hover:bg-[#1F3864]/20'
                      }`}
                    >
                      {isEditing ? 'Cancel' : 'EDIT'}
                    </button>
                  </td>
                </tr>

                {isEditing && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 bg-[#2E74B5]/5 border-b border-[#2E74B5]/20">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1.5">
                            Quantity ({item.unit})
                          </label>
                          <input
                            type="number"
                            value={editQty}
                            onChange={e => onEditQtyChange(e.target.value)}
                            className="w-full border border-[#2E74B5]/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1.5">
                            Rate (₹ / {item.unit})
                          </label>
                          <input
                            type="number"
                            value={editRate}
                            onChange={e => onEditRateChange(e.target.value)}
                            className="w-full border border-[#2E74B5]/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500 mb-1.5">New Amount</p>
                          <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-bold text-[#1F3864]">
                            ₹ {fmtInr(editedQtyNum * editedRateNum)}
                          </div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">
                          Reason for change
                        </label>
                        <input
                          type="text"
                          value={editReason}
                          onChange={e => onEditReasonChange(e.target.value)}
                          placeholder="e.g. Site measurement updated, client confirmed scope change…"
                          className="w-full border border-[#2E74B5]/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={onApplyEdit}
                          className="px-4 py-2 rounded-lg bg-[#1F3864] text-white text-xs font-bold"
                        >
                          Apply Change
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold"
                        >
                          Cancel
                        </button>
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
