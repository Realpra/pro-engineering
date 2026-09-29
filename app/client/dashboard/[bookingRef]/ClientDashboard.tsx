'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  markClientViewed,
  submitLineItemResponse,
  submitOverallResponse,
  acknowledgeRiskFlag,
  acceptTerms,
  submitClientScopeChange,
} from './actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface ClientDashboardProps {
  enquiry: AnyRecord
  boq: AnyRecord | null
  milestones: AnyRecord[]
  substages: AnyRecord[]
  clientResponse: AnyRecord | null
  supervisor: { full_name: string } | null
}

function money(v: unknown): string {
  const n = Number(v) || 0
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const d = new Date(v as string)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function asArray(v: unknown): AnyRecord[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>{children}</span>
  )
}

function SectionHeading({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[#1F3864] font-bold text-lg border-l-4 border-[#F97316] pl-3">{title}</h2>
      {right}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? 'pending'
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    sent_to_client: 'bg-amber-100 text-amber-800',
    accepted: 'bg-green-100 text-green-800',
    review_requested: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
  }
  const cls = map[s] ?? 'bg-gray-100 text-gray-700'
  return <Pill className={cls}>{s.replace(/_/g, ' ').toUpperCase()}</Pill>
}

function MilestoneStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? 'pending'
  const map: Record<string, string> = {
    pending: 'bg-gray-200 text-gray-700',
    supervisor_submitted: 'bg-amber-100 text-amber-800',
    coordinator_approved: 'bg-blue-100 text-blue-800',
    admin_approved: 'bg-green-100 text-green-800',
    payment_released: 'bg-green-800 text-white',
  }
  const cls = map[s] ?? 'bg-gray-100 text-gray-700'
  return <Pill className={cls}>{s.replace(/_/g, ' ').toUpperCase()}</Pill>
}

function TierBadge({ tier }: { tier: string | null | undefined }) {
  const t = (tier ?? '').toLowerCase()
  const map: Record<string, string> = {
    budget: 'bg-gray-200 text-gray-700',
    premium: 'bg-blue-100 text-blue-700',
    luxury: 'bg-yellow-100 text-yellow-800',
  }
  const cls = map[t] ?? 'bg-gray-200 text-gray-700'
  return <Pill className={cls}>{(tier ?? '—').toUpperCase()}</Pill>
}

function milestoneBadgeLabel(m: AnyRecord): string {
  if (typeof m.milestone_code === 'string' && /^M\d+$/i.test(m.milestone_code)) return m.milestone_code.toUpperCase()
  return `M${m.milestone_number ?? '0'}`
}

export default function ClientDashboard({
  enquiry,
  boq,
  milestones,
  substages,
  clientResponse,
  supervisor,
}: ClientDashboardProps) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    if (boq && !boq.client_viewed_at) {
      markClientViewed(boq.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- overall response state ----
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRemarks, setReviewRemarks] = useState('')

  // ---- terms state ----
  const [termsChecked, setTermsChecked] = useState(false)
  const [termsBusy, setTermsBusy] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(!!boq?.terms_accepted_at)

  // ---- risk flag panel state (keyed by item index) ----
  const [riskPanel, setRiskPanel] = useState<Record<number, 'review' | 'decline' | null>>({})
  const [riskReviewText, setRiskReviewText] = useState<Record<number, string>>({})

  // ---- line item review row state (keyed by item key) ----
  const [reviewRowOpen, setReviewRowOpen] = useState<string | null>(null)
  const [reviewRowText, setReviewRowText] = useState<Record<string, string>>({})

  // ---- scope change state ----
  const [scopeOpen, setScopeOpen] = useState(false)
  const [changeType, setChangeType] = useState<'Addition' | 'Deletion' | 'Substitution'>('Addition')
  const [scopeDescription, setScopeDescription] = useState('')
  const [justification, setJustification] = useState('')
  const [timelineConcern, setTimelineConcern] = useState('')
  const [roughItems, setRoughItems] = useState<
    { description: string; unit: string; qty: string; rate: string }[]
  >([])
  const [scopeSubmitting, setScopeSubmitting] = useState(false)
  const [scopeSuccess, setScopeSuccess] = useState(false)
  const [scopeError, setScopeError] = useState<string | null>(null)

  if (!boq) {
    return (
      <div className="bg-white max-w-4xl mx-auto px-4 py-6">
        <p className="text-gray-500 text-center">Your estimate is being prepared.</p>
      </div>
    )
  }

  // FIX 5 — decision/remarks map built from clientResponse, keyed by lineItemKey
  const responseMap: Record<string, { decision: string; remarks: string; responded_at?: string }> = {}
  asArray(clientResponse?.line_item_responses).forEach(r => {
    if (r && typeof r.key === 'string') {
      responseMap[r.key] = { decision: r.decision, remarks: r.remarks, responded_at: r.responded_at }
    }
  })

  function getResponseFor(key: string) {
    return responseMap[key]
  }

  // FIX 1 — 'pending' means no overall response has been submitted yet
  const hasSubmittedResponse = ['accepted', 'review_requested', 'rejected'].includes(
    clientResponse?.response_type ?? '',
  )

  async function runAction(key: string, fn: () => Promise<{ error?: string }>) {
    setBusyKey(key)
    const result = await fn()
    setBusyKey(null)
    if (result?.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const lineItems = asArray(boq.line_items)
  const riskItems = lineItems.filter(item => item.isRiskFlag === true)

  const labourItems = lineItems.filter(item => item.category === 'labour' && !item.isRiskFlag)
  const materialItems = lineItems.filter(item => item.category === 'material' && !item.isRiskFlag)
  const jobCardType = (boq?.job_card_type ?? '').toUpperCase()
  const showMaterials = jobCardType === 'LM' || jobCardType === 'M'

  function itemKey(item: AnyRecord, idx: number, prefix: string) {
    return item.skuCode ?? item.sku_code ?? item.key ?? `${prefix}-${idx}`
  }

  const acceptedRiskItems = riskItems.filter(item => {
    const key = item.skuCode ?? item.key
    return responseMap[key]?.decision === 'accepted'
  })

  const declinedRiskItems = riskItems
    .map((item, idx) => ({ item, idx, key: item.skuCode ?? `risk-${idx}` }))
    .filter(({ item }) => responseMap[item.skuCode]?.decision === 'declined')

  const paidToDate = milestones
    .filter(m => m.payment_released_at)
    .reduce((sum, m) => sum + (Number(m.payment_amount) || 0), 0)
  const outstanding = (Number(boq.total_amount) || 0) - paidToDate

  let _cumulative = 0
  const milestonesWithCumulative: AnyRecord[] = milestones.map(m => {
    _cumulative += Number(m.payment_amount) || 0
    return { ...m, cumulativeAmount: _cumulative } as AnyRecord
  })

  // ---- FIX 4: BOQ line item review flow (Section 5A / 5B) ----
  async function handleItemAccept(item: AnyRecord, idx: number, prefix: string) {
    const key = itemKey(item, idx, prefix)
    await runAction(`${prefix}-${key}`, () =>
      submitLineItemResponse(enquiry.booking_ref, boq!.id, key, 'accepted', ''),
    )
  }

  function toggleReviewRow(key: string) {
    setReviewRowOpen(prev => (prev === key ? null : key))
  }

  async function handleItemSaveReview(item: AnyRecord, idx: number, prefix: string) {
    const key = itemKey(item, idx, prefix)
    const text = reviewRowText[key] ?? ''
    await runAction(`${prefix}-${key}`, () =>
      submitLineItemResponse(enquiry.booking_ref, boq!.id, key, 'review_requested', text),
    )
    setReviewRowOpen(null)
  }

  async function handleItemReject(item: AnyRecord, idx: number, prefix: string) {
    if (!window.confirm('Are you sure you want to reject this item?')) return
    const key = itemKey(item, idx, prefix)
    await runAction(`${prefix}-${key}`, () =>
      submitLineItemResponse(enquiry.booking_ref, boq!.id, key, 'rejected', ''),
    )
  }

  // ---- FIX 3: risk flag review/decline panels (Section 4) ----
  function openRiskPanel(idx: number, panel: 'review' | 'decline') {
    setRiskPanel(prev => ({ ...prev, [idx]: panel }))
  }

  function closeRiskPanel(idx: number) {
    setRiskPanel(prev => ({ ...prev, [idx]: null }))
  }

  async function handleRiskInclude(item: AnyRecord, idx: number) {
    const key = item.skuCode ?? `risk-${idx}`
    await runAction(`risk-${key}`, async () => {
      await acknowledgeRiskFlag(enquiry.booking_ref, boq!.id, key)
      return submitLineItemResponse(enquiry.booking_ref, boq!.id, key, 'accepted', '')
    })
  }

  async function handleRiskSubmitReview(item: AnyRecord, idx: number) {
    const key = item.skuCode ?? `risk-${idx}`
    const text = riskReviewText[idx] ?? ''
    await runAction(`risk-${key}`, () =>
      submitLineItemResponse(enquiry.booking_ref, boq!.id, key, 'review_requested', text),
    )
    closeRiskPanel(idx)
  }

  async function handleRiskConfirmDecline(item: AnyRecord, idx: number) {
    const key = item.skuCode ?? `risk-${idx}`
    await runAction(`risk-${key}`, () =>
      submitLineItemResponse(enquiry.booking_ref, boq!.id, key, 'declined', ''),
    )
    closeRiskPanel(idx)
  }

  async function handleAcknowledgeNotice(key: string) {
    await runAction(`ack-${key}`, () => acknowledgeRiskFlag(enquiry.booking_ref, boq!.id, key))
  }

  // ---- FIX 2: accept terms ----
  async function handleAcceptTerms() {
    setTermsBusy(true)
    setTermsError(null)
    const result = await acceptTerms(enquiry.booking_ref, boq!.id)
    setTermsBusy(false)
    if (result.error) {
      setTermsError(result.error)
    } else {
      setTermsAccepted(true)
      router.refresh()
    }
  }

  async function handleAccept() {
    if (!window.confirm('Are you sure you want to accept this estimate?')) return
    await runAction('overall-accept', () => submitOverallResponse(enquiry.booking_ref, boq!.id, 'accepted', ''))
  }

  async function handleDecline() {
    if (!window.confirm('Are you sure you want to decline this estimate?')) return
    await runAction('overall-decline', () => submitOverallResponse(enquiry.booking_ref, boq!.id, 'rejected', ''))
  }

  async function handleSubmitReview() {
    await runAction('overall-review', () =>
      submitOverallResponse(enquiry.booking_ref, boq!.id, 'review_requested', reviewRemarks),
    )
  }

  function addRoughItem() {
    setRoughItems(prev => [...prev, { description: '', unit: '', qty: '', rate: '' }])
  }

  function updateRoughItem(idx: number, field: 'description' | 'unit' | 'qty' | 'rate', value: string) {
    setRoughItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  function removeRoughItem(idx: number) {
    setRoughItems(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmitScopeChange() {
    setScopeSubmitting(true)
    setScopeError(null)
    const result = await submitClientScopeChange(enquiry.booking_ref, {
      change_type: changeType,
      description: scopeDescription,
      justification_cos: justification,
      rough_items: roughItems.map(it => ({
        description: it.description,
        unit: it.unit,
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
        amount: (Number(it.qty) || 0) * (Number(it.rate) || 0),
      })),
      timeline_concern: timelineConcern,
    })
    setScopeSubmitting(false)
    if (result.error) {
      setScopeError(result.error)
    } else {
      setScopeSuccess(true)
      setScopeDescription('')
      setJustification('')
      setTimelineConcern('')
      setRoughItems([])
    }
  }

  return (
    <div className="bg-white max-w-4xl mx-auto px-4 py-6">
      {/* SECTION 1 — COVER */}
      <div className="bg-[#1F3864] rounded-2xl p-6 mb-6">
        <p className="text-white text-2xl font-bold text-center">PRO ENGINEERING</p>
        <p className="text-blue-200 text-sm text-center">Project Estimate and Agreement</p>
        <div className="h-0.5 bg-[#F97316] my-3" />
        <div className="flex items-center justify-between">
          <span className="text-blue-200 text-xs">{enquiry.booking_ref}</span>
          <span className="text-blue-200 text-xs">{fmtDate(boq.created_at)}</span>
          <StatusBadge status={boq.status} />
        </div>
        {enquiry.job_title && (
          <p className="text-white font-semibold text-center mt-2">{enquiry.job_title}</p>
        )}
      </div>

      <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
        {/* SECTION 2 — PROJECT SUMMARY */}
        <SectionHeading title="2. Project Summary" />
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Client Name: </span>{enquiry.contact_name ?? '—'}</p>
              <p><span className="text-gray-500">Address: </span>{enquiry.address_line ?? '—'}</p>
              <p><span className="text-gray-500">Floor: </span>{enquiry.floor_number ?? '—'}</p>
              <p>
                <span className="text-gray-500">Zone: </span>
                <Pill className="bg-orange-100 text-orange-700">{enquiry.zone ?? '—'}</Pill>
              </p>
              <p><span className="text-gray-500">City: </span>{enquiry.city ?? '—'}</p>
              <p><span className="text-gray-500">Property type: </span>{enquiry.property_type ?? '—'}</p>
              <p>
                <span className="text-gray-500">Job type: </span>
                <Pill className="bg-blue-100 text-blue-700">{enquiry.job_type ?? '—'}</Pill>
              </p>
              <p>
                <span className="text-gray-500">Sector: </span>
                <Pill className="bg-gray-200 text-gray-700">{enquiry.sector ?? '—'}</Pill>
              </p>
              <p><span className="text-gray-500">Service model: </span>{enquiry.service_model_title ?? enquiry.service_model ?? '—'}</p>
              <p>
                <span className="text-gray-500">Tier: </span>
                <TierBadge tier={boq.tier} />
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Estimated start: </span>{fmtDate(enquiry.preferred_start_date)}</p>
              <p><span className="text-gray-500">Duration: </span>{enquiry.duration_weeks ?? '—'} weeks</p>
              <div>
                <span className="text-gray-500">Scope: </span>
                <div className="bg-gray-50 rounded p-2 text-sm mt-1">{enquiry.scope_description ?? '—'}</div>
              </div>
            </div>
          </div>
          <div className="border-t pt-3 mt-3 text-sm">
            <p><span className="text-gray-500">Your Supervisor: </span>{supervisor?.full_name ?? 'To be assigned'}</p>
          </div>
        </div>
      </div>

      <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
        {/* SECTION 3 — PROJECT UNDERSTANDING */}
        <SectionHeading title="3. Project Understanding" />
        {!boq.client_summary ? (
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4 text-sm text-amber-700">
            Your coordinator is preparing the project summary. It will appear here once ready.
          </div>
        ) : (
          <div className="bg-blue-50 border-l-4 border-[#1F3864] rounded-r-xl p-4 text-sm text-gray-700 leading-relaxed">
            {boq.client_summary}
            {boq.client_negotiation_notes && (
              <p className="text-gray-500 text-xs italic mt-2">Coordinator note: {boq.client_negotiation_notes}</p>
            )}
          </div>
        )}
      </div>

      {/* SECTION 4 — RISK FLAGS */}
      {riskItems.length > 0 && (
        <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
          <SectionHeading title="4. Risk Flags and Client Decisions" />
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4 text-amber-800 text-sm">
            The following items were identified during the site assessment. Please review and decide whether to
            include or decline each one.
          </div>
          {riskItems.map((item, idx) => {
            const key = item.skuCode ?? `risk-${idx}`
            const response = getResponseFor(key)
            const panel = riskPanel[idx] ?? null
            const isBusy = busyKey === `risk-${key}`
            return (
              <div key={key} className="bg-white rounded-xl border p-4 mb-3">
                <p>
                  <span className="text-[#F97316] font-bold">R{idx + 1}</span>{' '}
                  <span className="font-bold">{item.skuName ?? 'Risk item'}</span>
                </p>
                {item.amount != null && (
                  <p className="text-right font-bold text-gray-800 mt-2">{money(item.amount)}</p>
                )}
                {!response ? (
                  <>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRiskInclude(item, idx)}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                      >
                        INCLUDE IN SCOPE
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openRiskPanel(idx, 'review')}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                      >
                        REVIEW / REMARK
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openRiskPanel(idx, 'decline')}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                      >
                        DECLINE THIS ITEM
                      </button>
                    </div>

                    {panel === 'review' && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={riskReviewText[idx] ?? ''}
                          onChange={e =>
                            setRiskReviewText(prev => ({ ...prev, [idx]: e.target.value }))
                          }
                          placeholder="Add your remarks..."
                          className="w-full border rounded-xl p-3 text-sm"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRiskSubmitReview(item, idx)}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                          >
                            SUBMIT REVIEW
                          </button>
                          <button
                            type="button"
                            onClick={() => closeRiskPanel(idx)}
                            className="text-gray-500 text-sm px-4 py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {panel === 'decline' && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 space-y-2">
                        <p>Are you sure? This will be recorded as a Declined Risk Notice.</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRiskConfirmDecline(item, idx)}
                            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                          >
                            CONFIRM DECLINE
                          </button>
                          <button
                            type="button"
                            onClick={() => closeRiskPanel(idx)}
                            className="text-gray-500 text-sm px-4 py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-3">
                    {response.decision === 'accepted' && (
                      <Pill className="bg-green-100 text-green-800">
                        INCLUDED{response.responded_at ? ` — ${fmtDate(response.responded_at)}` : ''}
                      </Pill>
                    )}
                    {response.decision === 'review_requested' && (
                      <Pill className="bg-amber-100 text-amber-800">
                        UNDER REVIEW{response.responded_at ? ` — ${fmtDate(response.responded_at)}` : ''}
                      </Pill>
                    )}
                    {response.decision === 'declined' && (
                      <Pill className="bg-red-100 text-red-800">
                        DECLINED{response.responded_at ? ` — ${fmtDate(response.responded_at)}` : ''}
                      </Pill>
                    )}
                    {response.remarks && (
                      <p className="text-gray-500 text-xs italic mt-1">{response.remarks}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {riskItems.length === 0 && (
        <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
          <SectionHeading title="4. Risk Flags and Client Decisions" />
          <div className="bg-gray-50 rounded-xl p-4 text-gray-500 text-sm">
            No risk items were identified during the site assessment.
          </div>
        </div>
      )}

      <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
        {/* SECTION 5 — SCOPE OF WORK */}
        <SectionHeading
          title="5. Scope of Work"
          right={
            <div className="flex gap-2">
              <TierBadge tier={boq.tier} />
              <Pill className="bg-gray-200 text-gray-700">{boq.job_card_type}</Pill>
            </div>
          }
        />

        <p className="text-[#F97316] font-semibold mb-2">5A. Labour Activities</p>
        {labourItems.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-4 text-gray-500 text-sm mb-6">
            No labour activities in this estimate.
          </div>
        ) : (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 pr-2">Qty</th>
                  <th className="py-2 pr-2">Rate ₹</th>
                  <th className="py-2 pr-2">Amount ₹</th>
                  <th className="py-2 pr-2">Your Decision</th>
                </tr>
              </thead>
              <tbody>
                {labourItems.map((item, idx) => {
                  const key = itemKey(item, idx, 'lab')
                  const response = getResponseFor(key)
                  const isReviewOpen = reviewRowOpen === key
                  const isBusy = busyKey === `lab-${key}`
                  return (
                    <Fragment key={key}>
                      <tr className="border-b last:border-0">
                        <td className="py-2 pr-2">{idx + 1}</td>
                        <td className="py-2 pr-2">{item.description || item.skuName}</td>
                        <td className="py-2 pr-2">{item.unit}</td>
                        <td className="py-2 pr-2">{item.quantity}</td>
                        <td className="py-2 pr-2">{money(item.rate)}</td>
                        <td className="py-2 pr-2">{money(item.amount)}</td>
                        <td className="py-2 pr-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleItemAccept(item, idx, 'lab')}
                              className={`rounded-full px-2 py-0.5 text-xs disabled:opacity-60 ${
                                response?.decision === 'accepted' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700'
                              }`}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => toggleReviewRow(key)}
                              className={`rounded-full px-2 py-0.5 text-xs disabled:opacity-60 ${
                                response?.decision === 'review_requested' || isReviewOpen
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleItemReject(item, idx, 'lab')}
                              className={`rounded-full px-2 py-0.5 text-xs disabled:opacity-60 ${
                                response?.decision === 'rejected' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              ✗
                            </button>
                          </div>
                        </td>
                      </tr>
                      {response?.remarks && !isReviewOpen && (
                        <tr>
                          <td colSpan={7} className="pb-2 text-gray-500 text-xs italic">
                            {response.remarks}
                          </td>
                        </tr>
                      )}
                      {isReviewOpen && (
                        <tr>
                          <td colSpan={7} className="pb-3">
                            <div className="flex flex-col sm:flex-row gap-2 items-start bg-amber-50 rounded-lg p-2">
                              <textarea
                                value={reviewRowText[key] ?? response?.remarks ?? ''}
                                onChange={e =>
                                  setReviewRowText(prev => ({ ...prev, [key]: e.target.value }))
                                }
                                placeholder="Add remarks..."
                                className="flex-1 w-full border rounded-lg p-2 text-sm"
                                rows={2}
                              />
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleItemSaveReview(item, idx, 'lab')}
                                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
                              >
                                SAVE
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
        )}

        {showMaterials && (
          <>
            <p className="text-[#F97316] font-semibold mb-2">5B. Material Supply</p>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 pr-2">Unit</th>
                    <th className="py-2 pr-2">Qty</th>
                    <th className="py-2 pr-2">Rate ₹</th>
                    <th className="py-2 pr-2">Amount ₹</th>
                    <th className="py-2 pr-2">Your Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {materialItems.map((item, idx) => {
                    const key = itemKey(item, idx, 'mat')
                    const response = getResponseFor(key)
                    const isReviewOpen = reviewRowOpen === key
                    const isBusy = busyKey === `mat-${key}`
                    return (
                      <Fragment key={key}>
                        <tr className="border-b last:border-0">
                          <td className="py-2 pr-2">{idx + 1}</td>
                          <td className="py-2 pr-2">{item.description || item.skuName}</td>
                          <td className="py-2 pr-2">{item.unit}</td>
                          <td className="py-2 pr-2">{item.quantity}</td>
                          <td className="py-2 pr-2">{money(item.rate)}</td>
                          <td className="py-2 pr-2">{money(item.amount)}</td>
                          <td className="py-2 pr-2">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleItemAccept(item, idx, 'mat')}
                                className={`rounded-full px-2 py-0.5 text-xs disabled:opacity-60 ${
                                  response?.decision === 'accepted' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700'
                                }`}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => toggleReviewRow(key)}
                                className={`rounded-full px-2 py-0.5 text-xs disabled:opacity-60 ${
                                  response?.decision === 'review_requested' || isReviewOpen
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleItemReject(item, idx, 'mat')}
                                className={`rounded-full px-2 py-0.5 text-xs disabled:opacity-60 ${
                                  response?.decision === 'rejected' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'
                                }`}
                              >
                                ✗
                              </button>
                            </div>
                          </td>
                        </tr>
                        {response?.remarks && !isReviewOpen && (
                          <tr>
                            <td colSpan={7} className="pb-2 text-gray-500 text-xs italic">
                              {response.remarks}
                            </td>
                          </tr>
                        )}
                        {isReviewOpen && (
                          <tr>
                            <td colSpan={7} className="pb-3">
                              <div className="flex flex-col sm:flex-row gap-2 items-start bg-amber-50 rounded-lg p-2">
                                <textarea
                                  value={reviewRowText[key] ?? response?.remarks ?? ''}
                                  onChange={e =>
                                    setReviewRowText(prev => ({ ...prev, [key]: e.target.value }))
                                  }
                                  placeholder="Add remarks..."
                                  className="flex-1 w-full border rounded-lg p-2 text-sm"
                                  rows={2}
                                />
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleItemSaveReview(item, idx, 'mat')}
                                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
                                >
                                  SAVE
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
          </>
        )}

        {acceptedRiskItems.length > 0 && (
          <>
            <p className="text-[#F97316] font-semibold mb-2">5C. Risk Flag Additions</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 pr-2">Amount ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {acceptedRiskItems.map((item, idx) => (
                    <tr key={item.skuCode ?? idx} className="border-b last:border-0">
                      <td className="py-2 pr-2">{idx + 1}</td>
                      <td className="py-2 pr-2">{item.description}</td>
                      <td className="py-2 pr-2">{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
        {/* SECTION 6 — ESTIMATE SUMMARY */}
        <SectionHeading title="6. Estimate Summary" />
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <tbody>
              <tr>
                <td className="text-gray-600 text-sm px-4 py-2">Labour Subtotal</td>
                <td className="text-gray-800 text-sm font-medium px-4 py-2 text-right">{money(boq.subtotal_labour)}</td>
              </tr>
              {showMaterials && (
                <tr>
                  <td className="text-gray-600 text-sm px-4 py-2">Material Subtotal</td>
                  <td className="text-gray-800 text-sm font-medium px-4 py-2 text-right">{money(boq.subtotal_material)}</td>
                </tr>
              )}
              {Number(boq.subtotal_risk_flags) > 0 && (
                <tr>
                  <td className="text-gray-600 text-sm px-4 py-2">Risk Flag Additions</td>
                  <td className="text-gray-800 text-sm font-medium px-4 py-2 text-right">{money(boq.subtotal_risk_flags)}</td>
                </tr>
              )}
              <tr>
                <td className="text-gray-600 text-sm px-4 py-2">Platform Premium ({boq.platform_premium_pct}%)</td>
                <td className="text-gray-800 text-sm font-medium px-4 py-2 text-right">{money(boq.platform_premium_amount)}</td>
              </tr>
              {boq.bocw_applicable && (
                <tr>
                  <td className="text-gray-600 text-sm px-4 py-2">BOCW Cess</td>
                  <td className="text-gray-800 text-sm font-medium px-4 py-2 text-right">{money(boq.bocw_cess_amount)}</td>
                </tr>
              )}
              {Number(boq.contingency_amount) > 0 && (
                <tr>
                  <td className="text-gray-600 text-sm px-4 py-2">Contingency ({boq.contingency_percent}%)</td>
                  <td className="text-gray-800 text-sm font-medium px-4 py-2 text-right">{money(boq.contingency_amount)}</td>
                </tr>
              )}
              <tr>
                <td className="text-gray-600 text-sm px-4 py-2">GST ({boq.gst_percent}%)</td>
                <td className="text-gray-800 text-sm font-medium px-4 py-2 text-right">{money(boq.gst_amount)}</td>
              </tr>
              {boq.tds_applicable && (
                <tr>
                  <td className="text-gray-600 text-sm px-4 py-2">TDS Deductible ({boq.tds_rate_pct}%)</td>
                  <td className="text-red-600 text-sm font-medium px-4 py-2 text-right">-{money(boq.tds_amount)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-200">
                <td colSpan={2} className="p-0">
                  <div className="bg-[#1F3864] text-white p-3 font-bold text-lg flex justify-between">
                    <span>TOTAL ESTIMATE</span>
                    <span>{money(boq.total_amount)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-400 text-xs italic mt-2">
          This estimate is valid until {fmtDate(boq.valid_until)}
        </p>
      </div>

      <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
        {/* SECTION 7 — PROJECT TIMELINE */}
        <SectionHeading title="7. Project Timeline" />
        <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-2">
          {milestones.map((m, idx) => {
            const stages = substages.filter(s => s.milestone_code === m.milestone_code)
            return (
              <div key={m.id} className="flex items-center gap-4">
                <div className="bg-white rounded-xl border p-4 min-w-48 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-full bg-[#1F3864] text-white text-sm font-bold flex items-center justify-center">
                      {milestoneBadgeLabel(m)}
                    </div>
                    <MilestoneStatusBadge status={m.status} />
                  </div>
                  <p className="font-semibold mt-2">{m.milestone_name}</p>
                  {m.description && <p className="text-gray-500 text-xs mt-1">{m.description}</p>}
                  <p className="text-gray-500 text-xs">{money(m.payment_amount)} · {fmtDate(m.planned_date)}</p>
                  <p className="text-[#F97316] text-xs font-bold">{m.payment_percent}%</p>
                  <div className="border-t my-2" />
                  {stages.length > 0 ? (
                    <ul className="space-y-1">
                      {stages.map(s => (
                        <li key={s.id} className="text-xs flex items-center gap-1 flex-wrap">
                          <span className="text-gray-400">{s.substage_code}</span>
                          <span>{s.substage_name}</span>
                          {s.trade_type && <span className="text-gray-400">({s.trade_type})</span>}
                          <span className="text-gray-400">Day {s.planned_day}</span>
                          {s.is_critical_path && (
                            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">CRITICAL</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-sm italic">
                      Detailed schedule will be provided after estimate acceptance.
                    </p>
                  )}
                </div>
                {idx < milestones.length - 1 && (
                  <span className="hidden md:inline text-gray-300 text-2xl">→</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
        {/* SECTION 8 — PAYMENT MILESTONE SCHEDULE */}
        <SectionHeading title="8. Payment Milestone Schedule" />
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-blue-800 text-sm">
          Payments are released as each milestone is completed and verified.
        </div>
        {milestonesWithCumulative.map(m => {
          const works = asArray(m.works_completed_this_milestone)
          const cumulativePct = (Number(boq.total_amount) || 0) > 0
            ? Math.min(100, (m.cumulativeAmount / Number(boq.total_amount)) * 100)
            : 0
          return (
            <div key={m.id} className="bg-white rounded-xl border shadow-sm overflow-hidden mb-4">
              <div className="bg-[#1F3864] text-white px-4 py-3 flex justify-between items-center">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">{milestoneBadgeLabel(m)}</span>
                  {m.milestone_name}
                </span>
                <MilestoneStatusBadge status={m.status} />
              </div>
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-amber-800 text-sm">
                Payment triggered when: {m.trigger_condition}
              </div>
              <div className="px-4 py-3">
                {works.length > 0 ? (
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {works.map((w, i) => (
                      <li key={i}>{typeof w === 'string' ? w : w.description}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 italic text-sm">Works list will be updated as the job progresses.</p>
                )}
              </div>
              <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Payment Amount</p>
                  <p className="text-xl font-bold text-[#1F3864]">{money(m.payment_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Payment %</p>
                  <p>{m.payment_percent}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Planned Date</p>
                  <p>{fmtDate(m.planned_date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Released At</p>
                  <p>{m.payment_released_at ? fmtDate(m.payment_released_at) : 'Pending'}</p>
                </div>
              </div>
              <div className="px-4 pb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Cumulative: {money(m.cumulativeAmount)}</span>
                  <span>{cumulativePct.toFixed(0)}% of total</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-[#F97316] h-2 rounded-full" style={{ width: `${cumulativePct}%` }} />
                </div>
              </div>
            </div>
          )
        })}
        <div className="bg-[#1F3864] text-white rounded-xl p-4 grid grid-cols-3 text-center">
          <div>
            <p className="text-blue-200 text-xs">Total Estimate</p>
            <p className="font-bold">{money(boq.total_amount)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs">Paid to Date</p>
            <p className="font-bold">{money(paidToDate)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs">Outstanding</p>
            <p className="font-bold">{money(outstanding)}</p>
          </div>
        </div>
      </div>

      {declinedRiskItems.length > 0 && (
        <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
          {/* SECTION 9 — DECLINED RISK NOTICES */}
          <h2 className="text-red-700 font-bold text-lg border-l-4 border-red-500 pl-3 mb-4">
            9. Declined Risk Notices
          </h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-800 text-sm">
            You have declined the following risk items. Please review the consequences below.
          </div>
          {declinedRiskItems.map(({ item, key }) => {
            const response = getResponseFor(key)
            return (
              <div key={key} className="bg-white rounded-xl border p-4 mb-3">
                <div className="bg-red-600 text-white text-sm font-bold px-3 py-2 rounded-lg -mt-1 mb-2">
                  DECLINED RISK NOTICE — {item.skuCode}
                </div>
                <p className="text-gray-800 font-semibold mt-1">{item.skuName}</p>
                <p className="text-gray-700 text-sm mt-1">{item.description}</p>
                {item.consequence && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm mt-2">{item.consequence}</div>
                )}
                <p className="text-gray-500 text-xs italic mt-2">
                  Pro Engineering holds no liability for damage arising from this declined item.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Pill className="bg-red-100 text-red-800">DECLINED — {fmtDate(response?.responded_at)}</Pill>
                </div>
                {!item.client_acknowledged ? (
                  <button
                    type="button"
                    disabled={busyKey === `ack-${key}`}
                    onClick={() => handleAcknowledgeNotice(key)}
                    className="bg-[#1F3864] text-white text-xs px-3 py-1.5 rounded-lg mt-2 disabled:opacity-60"
                  >
                    ACKNOWLEDGE THIS NOTICE
                  </button>
                ) : (
                  <Pill className="bg-green-100 text-green-800 mt-2">
                    Acknowledged on {fmtDate(item.acknowledged_at)}
                  </Pill>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="border-b border-[#1F3864]/20 pb-8 mb-8">
        {/* SECTION 10 — TERMS AND CONDITIONS */}
        <SectionHeading title="10. Terms and Conditions" />
        {[
          { title: 'Scope', body: 'The scope of work is as defined in Section 5 above. Any work outside this scope must be raised as a formal scope change request.' },
          { title: 'Payment Terms', body: 'Payments are released per the milestone payment schedule shown above, upon verified completion of each milestone.' },
          { title: 'Quality', body: 'All work is executed as per standard construction quality benchmarks and is subject to supervisor and coordinator inspection at each milestone.' },
          { title: 'Warranty', body: 'All workmanship is covered under a 12-month warranty from the date of completion.' },
          { title: 'Cancellation', body: 'Cancellation after work has commenced may be subject to charges for work completed and materials procured.' },
          { title: 'Liability', body: 'Pro Engineering holds liability only for work executed within the accepted scope. Declined risk items and client-directed changes fall outside this liability, as noted in the relevant sections above.' },
          { title: 'Dispute Resolution', body: 'Any dispute shall be resolved through arbitration, with exclusive jurisdiction in Noida.' },
        ].map(card => (
          <div key={card.title} className="border-l-4 border-[#F97316] bg-white rounded-r-xl p-4 mb-3 shadow-sm">
            <p className="text-[#1F3864] font-bold text-sm mb-1">{card.title}</p>
            <p className="text-gray-600 text-sm">{card.body}</p>
          </div>
        ))}

        <a href="/terms-and-conditions.pdf" className="text-[#1F3864] underline text-sm">
          Download Full Terms and Conditions (PDF)
        </a>

        <div className="bg-white border-2 border-[#1F3864] rounded-xl p-4 mt-4">
          {!termsAccepted ? (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                <input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} />
                I have read and understood the Terms and Conditions of Pro Engineering
              </label>
              <button
                type="button"
                disabled={!termsChecked || termsBusy}
                onClick={handleAcceptTerms}
                className="bg-[#1F3864] text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {termsBusy ? 'Accepting...' : 'ACCEPT TERMS'}
              </button>
              {termsError && <p className="text-red-600 text-sm mt-2">{termsError}</p>}
            </>
          ) : (
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-xl">✓</span>
              <span className="text-sm font-semibold">
                Terms accepted {boq.terms_accepted_at ? `on ${fmtDate(boq.terms_accepted_at)}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="pb-8">
        {/* SECTION 11 — CLIENT RESPONSE PANEL */}
        <SectionHeading title="11. Client Response Panel" />

        {!hasSubmittedResponse ? (
          !termsAccepted ? (
            <div>
              <div className="flex flex-col gap-2 opacity-50 pointer-events-none">
                <button className="bg-green-600 text-white w-full py-3 rounded-xl font-bold cursor-not-allowed">
                  ACCEPT ESTIMATE
                </button>
                <button className="bg-amber-500 text-white w-full py-3 rounded-xl font-bold cursor-not-allowed">
                  REQUEST REVIEW
                </button>
                <button className="bg-red-600 text-white w-full py-3 rounded-xl font-bold cursor-not-allowed">
                  DECLINE ESTIMATE
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Please accept the Terms and Conditions above before responding.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busyKey === 'overall-accept'}
                onClick={handleAccept}
                className="bg-green-600 text-white w-full py-3 rounded-xl font-bold disabled:opacity-60"
              >
                ACCEPT ESTIMATE
              </button>

              {!reviewOpen ? (
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="bg-amber-500 text-white w-full py-3 rounded-xl font-bold"
                >
                  REQUEST REVIEW
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={reviewRemarks}
                    onChange={e => setReviewRemarks(e.target.value)}
                    placeholder="What would you like reviewed?"
                    className="w-full border rounded-xl p-3 text-sm"
                    rows={3}
                  />
                  <button
                    type="button"
                    disabled={busyKey === 'overall-review'}
                    onClick={handleSubmitReview}
                    className="bg-amber-500 text-white w-full py-3 rounded-xl font-bold disabled:opacity-60"
                  >
                    SUBMIT REVIEW
                  </button>
                </div>
              )}

              <button
                type="button"
                disabled={busyKey === 'overall-decline'}
                onClick={handleDecline}
                className="bg-red-600 text-white w-full py-3 rounded-xl font-bold disabled:opacity-60"
              >
                DECLINE ESTIMATE
              </button>
            </div>
          )
        ) : clientResponse?.response_type === 'accepted' ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-2">
            <p>✓ Estimate Accepted on {fmtDate(clientResponse?.responded_at)}. Work will commence as per the agreed schedule.</p>
            {milestones[0] && (
              <>
                <p>
                  Your first payment of {money(milestones[0].payment_amount)} is due on {fmtDate(milestones[0].planned_date)}.
                </p>
                {milestones[0].payment_released_at ? (
                  <p className="font-semibold">✓ Token payment received.</p>
                ) : milestones[0].status === 'verification_pending' ? (
                  <p className="font-semibold">Payment submitted — awaiting coordinator verification.</p>
                ) : (
                  <Link
                    href={`/client/payment?booking_ref=${enquiry.booking_ref}`}
                    className="inline-block bg-green-700 hover:bg-green-800 text-white text-sm font-bold px-4 py-2 rounded-lg"
                  >
                    PAY TOKEN AMOUNT
                  </Link>
                )}
              </>
            )}
            <p>You will receive daily site updates through this dashboard.</p>
          </div>
        ) : clientResponse?.response_type === 'review_requested' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
            <p>Review Requested on {fmtDate(clientResponse?.responded_at)}.</p>
            <p>{clientResponse?.overall_remarks}</p>
            <p>Your coordinator has been notified.</p>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 space-y-1">
            <p>Estimate Declined on {fmtDate(clientResponse?.responded_at)}.</p>
            <p>Your coordinator will be in touch to discuss your requirements.</p>
          </div>
        )}

        {hasSubmittedResponse && clientResponse?.response_type === 'accepted' && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setScopeOpen(open => !open)}
              className="text-[#1F3864] font-semibold"
            >
              Need to change the scope of work? {scopeOpen ? '▲' : '▼'}
            </button>

            {scopeOpen && (
              <div className="bg-gray-50 rounded-xl border p-4 mt-3 space-y-3">
                <div className="flex gap-2">
                  {(['Addition', 'Deletion', 'Substitution'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setChangeType(type)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        changeType === type ? 'bg-[#1F3864] text-white' : 'bg-white text-[#1F3864] border border-[#1F3864]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <textarea
                  required
                  value={scopeDescription}
                  onChange={e => setScopeDescription(e.target.value)}
                  placeholder="Describe the change you need..."
                  className="w-full border rounded-xl p-3 text-sm"
                  rows={3}
                />

                <textarea
                  required
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  placeholder="Reason / Justification"
                  className="w-full border rounded-xl p-3 text-sm"
                  rows={3}
                />

                <div className="overflow-x-auto">
                  {roughItems.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="py-2 pr-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Unit
                          </th>
                          <th className="py-2 pr-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="py-2 pr-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Rate ₹
                          </th>
                          <th className="py-2 pr-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Amount ₹
                          </th>
                          <th className="py-2 pr-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            (remove column)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {roughItems.map((it, idx) => {
                          const qtyNum = Number(it.qty) || 0
                          const rateNum = Number(it.rate) || 0
                          const amountDisplay = qtyNum > 0 && rateNum > 0 ? money(qtyNum * rateNum) : '—'
                          return (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="py-1 pr-2">
                                <input
                                  value={it.description}
                                  onChange={e => updateRoughItem(idx, 'description', e.target.value)}
                                  className="w-full border rounded px-2 py-1"
                                />
                              </td>
                              <td className="py-1 pr-2">
                                <input
                                  value={it.unit}
                                  onChange={e => updateRoughItem(idx, 'unit', e.target.value)}
                                  className="w-20 border rounded px-2 py-1"
                                />
                              </td>
                              <td className="py-1 pr-2">
                                <input
                                  value={it.qty}
                                  onChange={e => updateRoughItem(idx, 'qty', e.target.value)}
                                  className="w-16 border rounded px-2 py-1"
                                />
                              </td>
                              <td className="py-1 pr-2">
                                <input
                                  value={it.rate}
                                  onChange={e => updateRoughItem(idx, 'rate', e.target.value)}
                                  className="w-20 border rounded px-2 py-1"
                                />
                              </td>
                              <td className="py-1 pr-2">
                                <div className="px-2 py-1 bg-gray-100 rounded text-gray-700">{amountDisplay}</div>
                              </td>
                              <td className="py-1 pr-2">
                                <button
                                  type="button"
                                  onClick={() => removeRoughItem(idx)}
                                  className="text-red-600 text-xs"
                                >
                                  REMOVE
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  <button type="button" onClick={addRoughItem} className="text-[#1F3864] text-xs font-semibold mt-2">
                    + ADD ITEM
                  </button>
                </div>

                <textarea
                  value={timelineConcern}
                  onChange={e => setTimelineConcern(e.target.value)}
                  placeholder="Timeline concern (optional)"
                  className="w-full border rounded-xl p-3 text-sm"
                  rows={2}
                />

                <button
                  type="button"
                  disabled={scopeSubmitting || !scopeDescription || !justification}
                  onClick={handleSubmitScopeChange}
                  className="bg-[#1F3864] text-white w-full py-3 rounded-xl font-bold disabled:opacity-60"
                >
                  {scopeSubmitting ? 'SUBMITTING…' : 'SUBMIT SCOPE CHANGE REQUEST'}
                </button>

                {scopeSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                    Your scope change request has been submitted.
                  </div>
                )}
                {scopeError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    {scopeError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
