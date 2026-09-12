'use client'

import { useState, useMemo } from 'react'
import { processClientRemarks } from './actions'

type LineItemResponse = {
  skuCode: string
  action: 'accepted' | 'review_requested' | 'rejected'
  remarks: string
  suggestedQty: number | null
  suggestedRate: number | null
  // Snapshot captured at client submission time — may be absent on old records
  skuName?: string | null
  description?: string | null
  unit?: string | null
  originalQty?: number | null
  originalRate?: number | null
  originalAmount?: number | null
}

type DecisionEntry = {
  coordinatorAction: 'accepted' | 'declined' | 'deferred' | null
  declineReason: string
  coordinatorRemark: string
  newQty: number | undefined
  newRate: number | undefined
}

type Props = {
  bookingRef: string
  boqId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lineItems: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  latestResponse: any
  onProcessed: () => void
}

function fmtInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

export default function ClientRemarksPanel({
  bookingRef,
  boqId,
  lineItems,
  latestResponse,
  onProcessed,
}: Props) {
  const responses: LineItemResponse[] = (
    (latestResponse?.line_item_responses ?? []) as LineItemResponse[]
  ).filter((r) => r.action !== 'accepted')

  // One entry per skuCode — Record ensures no array-ordering bugs
  const [decisions, setDecisions] = useState<Record<string, DecisionEntry>>(() =>
    Object.fromEntries(
      responses.map((r) => [
        r.skuCode,
        {
          coordinatorAction: null,
          declineReason: '',
          coordinatorRemark: '',
          newQty: r.suggestedQty ?? undefined,
          newRate: r.suggestedRate ?? undefined,
        },
      ])
    )
  )

  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findLineItem(skuCode: string): any | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return lineItems.find((i: any) => i.skuCode === skuCode || i.activityCode === skuCode)
  }

  function setDecision(skuCode: string, updates: Partial<DecisionEntry>) {
    setDecisions((prev) => ({
      ...prev,
      [skuCode]: { ...prev[skuCode], ...updates },
    }))
  }

  const deferredTotal = useMemo(() => {
    return responses.reduce((sum, resp) => {
      const d = decisions[resp.skuCode]
      if (d?.coordinatorAction !== 'deferred') return sum
      // Prefer snapshot captured at submission; fall back to live line_items lookup
      const amount = resp.originalAmount ?? (Number(findLineItem(resp.skuCode)?.amount) || 0)
      return sum + amount
    }, 0)
  }, [decisions]) // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalProjectValue = lineItems.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)
  const deferredPct = totalProjectValue > 0 ? (deferredTotal / totalProjectValue) * 100 : 0

  const allEntries = Object.values(decisions)
  const undecidedCount = allEntries.filter((d) => d.coordinatorAction === null).length
  const allDecided = undecidedCount === 0
  const allValid =
    allDecided &&
    allEntries.every((d) =>
      d.coordinatorAction === 'declined' ? d.declineReason.trim().length > 0 : true
    )

  async function handleSubmit() {
    if (!allValid) return
    setSubmitting(true)
    setMsg(null)
    try {
      const payload = responses.map((resp) => {
        const d = decisions[resp.skuCode]
        // Only treat as deferred if client explicitly rejected AND coordinator accepted
        // with no replacement values. review_requested + accepted = keep item as-is.
        const isRejectionAccepted =
          resp.action === 'rejected' &&
          d.coordinatorAction === 'accepted' &&
          d.newQty == null &&
          d.newRate == null

        const finalAction = isRejectionAccepted
          ? ('deferred' as const)
          : (d.coordinatorAction as 'accepted' | 'declined' | 'deferred')

        return {
          skuCode: resp.skuCode,
          coordinatorAction: finalAction,
          originalClientAction: resp.action,
          coordinatorRemark:
            [d.declineReason, d.coordinatorRemark].filter(Boolean).join(' | ') || undefined,
          newQty: finalAction === 'accepted' ? d.newQty : undefined,
          newRate: finalAction === 'accepted' ? d.newRate : undefined,
        }
      })

      const result = await processClientRemarks(bookingRef, boqId, payload)
      if (result.error) throw new Error(result.error)
      setMsg({
        text: [
          `Decisions applied. New total: ₹${fmtInr(result.newTotal ?? 0)}.`,
          result.deferredCount ? `${result.deferredCount} item(s) deferred.` : '',
          result.subEstimateCreated ? 'Sub-estimate created for deferred items.' : '',
        ]
          .filter(Boolean)
          .join(' '),
        ok: true,
      })
      setTimeout(() => onProcessed(), 1500)
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Processing failed', ok: false })
    } finally {
      setSubmitting(false)
    }
  }

  if (responses.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-gray-500">No items require review.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Overall client remarks */}
      {latestResponse?.overall_remarks && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
            Client&apos;s Overall Remarks
          </p>
          <p className="text-sm text-amber-900">{latestResponse.overall_remarks}</p>
        </div>
      )}

      {/* Per-item cards */}
      {responses.map((resp) => {
        // Prefer snapshot fields stored at submission time. Fall back to live
        // line_items lookup for old records that predate snapshot capture.
        const li = findLineItem(resp.skuCode)
        const dec = decisions[resp.skuCode]
        const title          = resp.skuName ?? li?.skuName ?? li?.activityName ?? resp.skuCode
        const subtitle       = resp.description ?? li?.description ?? null
        const unit           = resp.unit ?? li?.unit ?? 'unit'
        const originalQty    = resp.originalQty    ?? Number(li?.quantity ?? 0)
        const originalRate   = resp.originalRate   ?? Number(li?.rate ?? 0)
        const originalAmount = resp.originalAmount ?? (originalQty * originalRate)
        const suggestedQty = resp.suggestedQty ?? originalQty
        const suggestedRate = resp.suggestedRate ?? originalRate
        const suggestedAmount = suggestedQty * suggestedRate
        const hasSuggestions = resp.suggestedQty != null || resp.suggestedRate != null
        const isRejected = resp.action === 'rejected'

        return (
          <div
            key={resp.skuCode}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Card header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  {title}
                </p>
                {subtitle && (
                  <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
                )}
              </div>
              <span
                className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                  isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isRejected ? 'REJECTED' : 'REVIEW REQUESTED'}
              </span>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Original vs client-suggested values */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Original
                  </p>
                  <p className="text-xs text-gray-700">
                    {originalQty} {unit} × ₹{fmtInr(originalRate)} ={' '}
                    <span className="font-bold">₹{fmtInr(originalAmount)}</span>
                  </p>
                </div>
                <div
                  className={`rounded-lg px-3 py-2.5 ${isRejected ? 'bg-red-50' : 'bg-amber-50'}`}
                >
                  <p
                    className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                      isRejected ? 'text-red-600' : 'text-amber-600'
                    }`}
                  >
                    Client Requested
                  </p>
                  {hasSuggestions ? (
                    <p className="text-xs text-gray-700">
                      {suggestedQty} {unit} × ₹{fmtInr(suggestedRate)} ={' '}
                      <span className="font-bold">₹{fmtInr(suggestedAmount)}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      {isRejected ? 'Remove from scope' : 'No specific values suggested'}
                    </p>
                  )}
                </div>
              </div>

              {/* Client remark text */}
              {resp.remarks && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-gray-500 mb-0.5">Client&apos;s Remark</p>
                  <p className="text-xs text-gray-700 italic">&ldquo;{resp.remarks}&rdquo;</p>
                </div>
              )}

              {/* Coordinator decision buttons — each button closes over resp.skuCode only */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Coordinator Decision
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        action: 'accepted' as const,
                        label: "Accept Client's Request",
                        active: 'bg-green-600 border-green-600 text-white',
                        idle: 'bg-white border-green-300 text-green-700 hover:bg-green-50',
                      },
                      {
                        action: 'declined' as const,
                        label: 'Decline — Keep As Is',
                        active: 'bg-gray-600 border-gray-600 text-white',
                        idle: 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50',
                      },
                      {
                        action: 'deferred' as const,
                        label: 'Move to Deferred List',
                        active: 'bg-amber-500 border-amber-500 text-white',
                        idle: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50',
                      },
                    ] as const
                  ).map(({ action, label, active, idle }) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setDecision(resp.skuCode, { coordinatorAction: action })}
                      className={`py-2.5 px-2 rounded-lg text-xs font-bold border-2 transition-colors leading-tight ${
                        dec?.coordinatorAction === action ? active : idle
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accepted: editable qty/rate when client suggested specific values */}
              {dec?.coordinatorAction === 'accepted' && hasSuggestions && (
                <div className="grid grid-cols-2 gap-3 bg-green-50 rounded-lg p-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      New Qty ({unit})
                    </label>
                    <input
                      type="number"
                      value={dec.newQty ?? ''}
                      onChange={(e) =>
                        setDecision(resp.skuCode, { newQty: Number(e.target.value) })
                      }
                      className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      New Rate (₹)
                    </label>
                    <input
                      type="number"
                      value={dec.newRate ?? ''}
                      onChange={(e) =>
                        setDecision(resp.skuCode, { newRate: Number(e.target.value) })
                      }
                      className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </div>
                  {dec.newQty != null && dec.newRate != null && (
                    <div className="col-span-2">
                      <p className="text-xs font-bold text-green-700">
                        New amount: ₹{fmtInr(dec.newQty * dec.newRate)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Accepted rejection (no suggestions) → will be auto-deferred */}
              {dec?.coordinatorAction === 'accepted' && isRejected && !hasSuggestions && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-800">
                    Accepting a rejection with no replacement values will move this item to the
                    deferred list.
                  </p>
                </div>
              )}

              {/* Declined: mandatory justification */}
              {dec?.coordinatorAction === 'declined' && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Reason for keeping as-is <span className="text-red-500">*</span>
                    <span className="font-normal text-gray-400 ml-1">
                      (explain why this scope is recommended)
                    </span>
                  </label>
                  <textarea
                    value={dec.declineReason}
                    onChange={(e) =>
                      setDecision(resp.skuCode, { declineReason: e.target.value })
                    }
                    rows={2}
                    placeholder="e.g. future risk if skipped — waterproofing must precede tiling…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
              )}

              {/* Deferred: confirmation notice */}
              {dec?.coordinatorAction === 'deferred' && (
                <div className="bg-amber-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-700">
                    Will be removed from core estimate. Original values (₹
                    {fmtInr(originalAmount)}) preserved in the deferred list.
                  </p>
                </div>
              )}

              {/* Optional coordinator remark to client (any decision) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  Coordinator remark to client{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={dec?.coordinatorRemark ?? ''}
                  onChange={(e) =>
                    setDecision(resp.skuCode, { coordinatorRemark: e.target.value })
                  }
                  rows={2}
                  placeholder="Any message to pass to the client about this item…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                />
              </div>
            </div>
          </div>
        )
      })}

      {/* Deferral running total */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Deferral Summary
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Value deferred this session</p>
            <p className="text-sm font-bold text-amber-700">₹{fmtInr(deferredTotal)}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Deferred as % of project total</p>
            <p
              className={`text-sm font-bold ${deferredPct > 25 ? 'text-red-600' : 'text-gray-800'}`}
            >
              {deferredPct.toFixed(1)}%
            </p>
          </div>
        </div>
        {deferredPct > 25 && (
          <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg">
            <p className="text-xs font-bold text-amber-800">
              This deferral exceeds 25% of project value. A separate Balance Scope Sub-Estimate
              will be auto-generated for the deferred items so the core job can proceed without
              delay.
            </p>
          </div>
        )}
      </div>

      {/* Pending decisions notice */}
      {!allDecided && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xs font-bold text-blue-700">
            {undecidedCount} item{undecidedCount > 1 ? 's' : ''} still need{undecidedCount === 1 ? 's' : ''} a decision.
          </p>
        </div>
      )}

      {/* Feedback */}
      {msg && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm font-semibold ${
            msg.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        disabled={!allValid || submitting}
        onClick={handleSubmit}
        className="w-full py-4 rounded-xl bg-[#1F3864] text-white font-bold text-sm hover:bg-[#162950] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? 'Applying decisions…' : 'Apply Decisions & Regenerate Estimate'}
      </button>
    </div>
  )
}
