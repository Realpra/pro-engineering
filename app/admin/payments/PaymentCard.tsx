'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  adminApprovePayment,
  adminHoldPayment,
  adminRejectPayment,
  adminConfirmDecision5,
  adminOverrideDecision5,
  adminPartialAcceptDecision5,
  adminApproveReworkDeduction,
  adminModifyReworkDeduction,
  adminWaiveReworkDeduction,
  adminReleaseFromHold,
  adminAddSuperAdminNote,
  type PaymentActionResult,
} from './actions'

export type PaymentMode =
  | 'pending'
  | 'decision5'
  | 'rework'
  | 'hold'
  | 'above_limit'
  | 'history'

export type Payment = {
  id: string
  booking_ref: string | null
  boq_id: string | null
  job_type: string | null
  milestone_number: number | null
  milestone_code: string | null
  milestone_name: string | null
  description: string | null
  trigger_condition: string | null
  payment_percent: number | null
  payment_amount: number | string | null
  planned_date: string | null
  actual_completion_date: string | null
  evidence_submitted: unknown
  supervisor_submitted_at: string | null
  coordinator_approved_at: string | null
  admin_approved_at: string | null
  payment_released_at: string | null
  status: string | null
  platform_remarks: string | null
  coordinator_payment_remarks: string | null
  admin_hold_reason: string | null
  admin_rejection_reason: string | null
  decision_5_raised_by: string | null
  decision_5_raised_at: string | null
  decision_5_reason: string | null
  decision_5_admin_decision: string | null
  decision_5_admin_remarks: string | null
  rework_cost_proposed: number | string | null
  rework_cost_approved: number | string | null
  rework_cost_approved_by: string | null
  rework_cost_approved_at: string | null
  rework_cost_remarks: string | null
  rework_bears_cost: string | null
  above_limit_notified_at: string | null
  above_limit_super_admin_status: string | null
  admin_override_type: string | null
  admin_override_reason: string | null
  admin_override_by: string | null
  admin_override_at: string | null
  // verified live on milestone_payment_schedule
  trade: string | null
  skill_level: string | null
  zone: string | null
  created_at: string | null
  updated_at: string | null
  [key: string]: unknown
}

export const NIL_PAYMENT: Payment = {
  id: '',
  booking_ref: null,
  boq_id: null,
  job_type: null,
  milestone_number: null,
  milestone_code: null,
  milestone_name: null,
  description: null,
  trigger_condition: null,
  payment_percent: null,
  payment_amount: null,
  planned_date: null,
  actual_completion_date: null,
  evidence_submitted: null,
  supervisor_submitted_at: null,
  coordinator_approved_at: null,
  admin_approved_at: null,
  payment_released_at: null,
  status: null,
  platform_remarks: null,
  coordinator_payment_remarks: null,
  admin_hold_reason: null,
  admin_rejection_reason: null,
  decision_5_raised_by: null,
  decision_5_raised_at: null,
  decision_5_reason: null,
  decision_5_admin_decision: null,
  decision_5_admin_remarks: null,
  rework_cost_proposed: null,
  rework_cost_approved: null,
  rework_cost_approved_by: null,
  rework_cost_approved_at: null,
  rework_cost_remarks: null,
  rework_bears_cost: null,
  above_limit_notified_at: null,
  above_limit_super_admin_status: null,
  admin_override_type: null,
  admin_override_reason: null,
  admin_override_by: null,
  admin_override_at: null,
  trade: null,
  skill_level: null,
  zone: null,
  created_at: null,
  updated_at: null,
}

// ─── helpers ────────────────────────────────────────────────────────────────

function isErr(res: PaymentActionResult): res is { error: string } {
  return 'error' in res
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return `₹${num(v).toLocaleString('en-IN')}`
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysSince(v: string | null | undefined): number | null {
  if (!v) return null
  const t = new Date(v).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

/** decision_5_raised_at/admin_hold_at do not exist as raw columns — derived from real fields. */
export function decisionType(p: Payment): string {
  if (p.decision_5_admin_decision != null || p.decision_5_raised_at != null) return 'decision_5'
  if (num(p.rework_cost_proposed) > 0) return 'rework'
  if (p.admin_override_type != null) return 'override'
  return 'standard'
}

const DECISION_TYPE_LABEL: Record<string, string> = {
  decision_5: 'Decision 5',
  rework: 'Rework',
  override: 'Override',
  standard: 'Standard',
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  coordinator_approved: { label: 'Awaiting Admin', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  admin_approved: { label: 'Approved', className: 'bg-green-100 text-green-700 border border-green-200' },
  admin_hold: { label: 'On Hold', className: 'bg-red-100 text-red-700 border border-red-200' },
  admin_rejected: { label: 'Rejected', className: 'bg-red-200 text-red-900 border border-red-300' },
  decision_5_raised: { label: 'Decision 5', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  decision_5_confirmed: { label: 'D5 Confirmed', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
}

// ─── shared UI ─────────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">{children}</div>
}

function ActionBtn({
  onClick,
  disabled,
  className,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  className: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  )
}

// ─── card ──────────────────────────────────────────────────────────────────

export default function PaymentCard({
  payment,
  mode,
  adminUserId,
  clientName,
  zone,
  emptyMessage,
}: {
  payment: Payment
  mode: PaymentMode
  adminUserId: string
  clientName: string
  zone: string
  emptyMessage?: string
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [amount, setAmount] = useState('')
  const [choice, setChoice] = useState('platform')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEmpty = payment.id === ''

  function toggle(p: string) {
    if (isEmpty) return
    setPanel((cur) => (cur === p ? null : p))
    setRemarks('')
    setAmount('')
    setChoice('platform')
    setError(null)
  }

  async function submit(fn: () => Promise<PaymentActionResult>) {
    if (isEmpty) return
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setPanel(null)
    setRemarks('')
    setAmount('')
    router.refresh()
  }

  const badge = payment.status ? STATUS_BADGE[payment.status] : undefined
  const evidenceCount = Array.isArray(payment.evidence_submitted) ? payment.evidence_submitted.length : 0
  const waiting = daysSince(payment.coordinator_approved_at)
  const onHoldDays = daysSince(payment.updated_at)
  const readOnly = mode === 'history' || mode === 'above_limit'
  const resolvedZone = payment.zone ?? zone

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#1F3864] px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight">{payment.booking_ref ?? '—'}</p>
          <p className="text-blue-200 text-xs mt-0.5">{payment.milestone_name ?? '—'}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {mode === 'decision5' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                DECISION 5
              </span>
            )}
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <p
            className={`font-bold text-lg leading-tight mt-1 ${
              mode === 'above_limit' ? 'text-red-400' : 'text-white'
            }`}
          >
            {money(payment.payment_amount)}
          </p>
        </div>
      </div>

      {/* BODY */}
      <div className="px-4 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Cell label="Client" value={clientName || '—'} />
        <Cell label="Zone" value={resolvedZone || '—'} />
        <Cell label="Job Type" value={payment.job_type ?? '—'} />
        <Cell label="Trade" value={payment.trade ?? '—'} />
        <Cell label="Skill Level" value={payment.skill_level ?? '—'} />
        <Cell label="Milestone Code" value={payment.milestone_code ?? '—'} />
        <Cell label="Trigger Condition" value={payment.trigger_condition ?? '—'} />
        <Cell label="Supervisor Submitted" value={fmtDate(payment.supervisor_submitted_at)} />
        <Cell label="Coordinator Approved" value={fmtDate(payment.coordinator_approved_at)} />
        <Cell label="Coordinator Remarks" value={payment.coordinator_payment_remarks ?? '—'} />
        <Cell label="Days Waiting" value={waiting == null ? '—' : `${waiting} day${waiting === 1 ? '' : 's'}`} />
        {mode === 'decision5' && <Cell label="Decision 5 Raised" value={fmtDate(payment.decision_5_raised_at)} />}
      </div>

      {/* EVIDENCE STRIP */}
      <div className="px-4 pb-3 -mt-1">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
            evidenceCount > 0
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-gray-50 text-gray-400 border-gray-200'
          }`}
        >
          {evidenceCount > 0 ? `${evidenceCount} item${evidenceCount === 1 ? '' : 's'} submitted` : 'No evidence submitted'}
        </span>
      </div>

      {/* ACTIONS */}
      {!readOnly && (
        <div className="px-4 pb-4 space-y-2">
          {mode === 'pending' && (
            <>
              <ActionBtn onClick={() => toggle('approve')} disabled={isEmpty} className="bg-green-600 hover:bg-green-700">
                APPROVE
              </ActionBtn>
              {panel === 'approve' && (
                <Panel>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Approval remarks…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submit(() => adminApprovePayment(payment.id, adminUserId, remarks.trim()))}
                    className="w-full py-2 rounded-lg text-xs font-bold bg-green-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM APPROVAL'}
                  </button>
                </Panel>
              )}

              <ActionBtn onClick={() => toggle('hold')} disabled={isEmpty} className="bg-amber-500 hover:bg-amber-600">
                HOLD
              </ActionBtn>
              {panel === 'hold' && (
                <Panel>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Hold reason…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !remarks.trim()}
                    onClick={() => submit(() => adminHoldPayment(payment.id, adminUserId, remarks.trim()))}
                    className="w-full py-2 rounded-lg text-xs font-bold bg-amber-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM HOLD'}
                  </button>
                </Panel>
              )}

              <ActionBtn onClick={() => toggle('reject')} disabled={isEmpty} className="bg-red-600 hover:bg-red-700">
                REJECT
              </ActionBtn>
              {panel === 'reject' && (
                <Panel>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Rejection reason…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !remarks.trim()}
                    onClick={() => submit(() => adminRejectPayment(payment.id, adminUserId, remarks.trim()))}
                    className="w-full py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM REJECT'}
                  </button>
                </Panel>
              )}
            </>
          )}

          {mode === 'decision5' && (
            <>
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-0.5">Decision 5 Reason</p>
                <p className="text-sm text-amber-900">{payment.decision_5_reason ?? '—'}</p>
              </div>

              <ActionBtn onClick={() => toggle('d5confirm')} disabled={isEmpty} className="bg-red-600 hover:bg-red-700">
                CONFIRM D5
              </ActionBtn>
              {panel === 'd5confirm' && (
                <Panel>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Who bears cost
                    <select className={`${inputClass} mt-1`} value={choice} onChange={(e) => setChoice(e.target.value)}>
                      <option value="platform">platform</option>
                      <option value="worker">worker</option>
                      <option value="client">client</option>
                    </select>
                  </label>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Admin remarks…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !remarks.trim()}
                    onClick={() =>
                      submit(() => adminConfirmDecision5(payment.id, adminUserId, choice, remarks.trim()))
                    }
                    className="w-full py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM'}
                  </button>
                </Panel>
              )}

              <ActionBtn onClick={() => toggle('d5override')} disabled={isEmpty} className="bg-green-600 hover:bg-green-700">
                OVERRIDE
              </ActionBtn>
              {panel === 'd5override' && (
                <Panel>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Admin remarks…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !remarks.trim()}
                    onClick={() => submit(() => adminOverrideDecision5(payment.id, adminUserId, remarks.trim()))}
                    className="w-full py-2 rounded-lg text-xs font-bold bg-green-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM OVERRIDE'}
                  </button>
                </Panel>
              )}

              <ActionBtn onClick={() => toggle('d5partial')} disabled={isEmpty} className="bg-amber-500 hover:bg-amber-600">
                PARTIAL ACCEPT
              </ActionBtn>
              {panel === 'd5partial' && (
                <Panel>
                  <input
                    type="number"
                    className={inputClass}
                    placeholder="Partial amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Admin remarks…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || amount === '' || !remarks.trim()}
                    onClick={() =>
                      submit(() =>
                        adminPartialAcceptDecision5(payment.id, adminUserId, num(amount), remarks.trim())
                      )
                    }
                    className="w-full py-2 rounded-lg text-xs font-bold bg-amber-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM'}
                  </button>
                </Panel>
              )}
            </>
          )}

          {mode === 'rework' && (
            <>
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700 space-y-1">
                <p>
                  Proposed deduction: <span className="font-bold">{money(payment.rework_cost_proposed)}</span>
                </p>
                <Cell label="Bears Cost" value={payment.rework_bears_cost ?? '—'} />
                <Cell label="Coordinator Remarks" value={payment.coordinator_payment_remarks ?? '—'} />
                <Cell label="Rework Cost Remarks" value={payment.rework_cost_remarks ?? '—'} />
              </div>

              <ActionBtn onClick={() => toggle('rwApprove')} disabled={isEmpty} className="bg-green-600 hover:bg-green-700">
                APPROVE DEDUCTION
              </ActionBtn>
              {panel === 'rwApprove' && (
                <Panel>
                  <p className="text-xs text-gray-600">
                    Approve the proposed deduction of {money(payment.rework_cost_proposed)}?
                  </p>
                  <textarea
                    rows={2}
                    className={`${inputClass} resize-none`}
                    placeholder="Remarks (optional)…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      submit(() =>
                        adminApproveReworkDeduction(
                          payment.id,
                          adminUserId,
                          num(payment.rework_cost_proposed),
                          remarks.trim()
                        )
                      )
                    }
                    className="w-full py-2 rounded-lg text-xs font-bold bg-green-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM APPROVE DEDUCTION'}
                  </button>
                </Panel>
              )}

              <ActionBtn onClick={() => toggle('rwModify')} disabled={isEmpty} className="bg-amber-500 hover:bg-amber-600">
                MODIFY
              </ActionBtn>
              {panel === 'rwModify' && (
                <Panel>
                  <input
                    type="number"
                    className={inputClass}
                    placeholder="New deduction amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <textarea
                    rows={2}
                    className={`${inputClass} resize-none`}
                    placeholder="Remarks…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || amount === ''}
                    onClick={() =>
                      submit(() =>
                        adminModifyReworkDeduction(payment.id, adminUserId, num(amount), remarks.trim())
                      )
                    }
                    className="w-full py-2 rounded-lg text-xs font-bold bg-amber-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM MODIFY'}
                  </button>
                </Panel>
              )}

              <ActionBtn onClick={() => toggle('rwWaive')} disabled={isEmpty} className="bg-gray-500 hover:bg-gray-600">
                WAIVE
              </ActionBtn>
              {panel === 'rwWaive' && (
                <Panel>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Reason for waiving…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !remarks.trim()}
                    onClick={() =>
                      submit(() => adminWaiveReworkDeduction(payment.id, adminUserId, remarks.trim()))
                    }
                    className="w-full py-2 rounded-lg text-xs font-bold bg-gray-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM WAIVE'}
                  </button>
                </Panel>
              )}
            </>
          )}

          {mode === 'hold' && (
            <>
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-0.5">Hold Reason</p>
                <p className="text-sm text-red-900">{payment.admin_hold_reason ?? '—'}</p>
                <p className="text-xs text-red-700 mt-1">
                  {onHoldDays == null ? '—' : `On hold ${onHoldDays} day${onHoldDays === 1 ? '' : 's'} (since last update)`}
                </p>
              </div>

              <ActionBtn
                onClick={() => submit(() => adminReleaseFromHold(payment.id, adminUserId))}
                disabled={isEmpty || busy}
                className="bg-green-600 hover:bg-green-700"
              >
                {busy ? 'Working…' : 'RELEASE FROM HOLD'}
              </ActionBtn>

              <ActionBtn onClick={() => toggle('holdReject')} disabled={isEmpty} className="bg-red-600 hover:bg-red-700">
                REJECT
              </ActionBtn>
              {panel === 'holdReject' && (
                <Panel>
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Rejection reason…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !remarks.trim()}
                    onClick={() => submit(() => adminRejectPayment(payment.id, adminUserId, remarks.trim()))}
                    className="w-full py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'CONFIRM REJECT'}
                  </button>
                </Panel>
              )}
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {/* ABOVE LIMIT — read only + note action */}
      {mode === 'above_limit' && (
        <div className="px-4 pb-4 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Cell label="Notified At" value={fmtDate(payment.above_limit_notified_at)} />
            <Cell label="Super Admin Status" value={payment.above_limit_super_admin_status ?? '—'} />
          </div>
          <ActionBtn onClick={() => toggle('saNote')} disabled={isEmpty} className="bg-blue-600 hover:bg-blue-700">
            ADD NOTE TO SUPER ADMIN
          </ActionBtn>
          {panel === 'saNote' && (
            <Panel>
              <textarea
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Note to Super Admin…"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !remarks.trim()}
                onClick={() => submit(() => adminAddSuperAdminNote(payment.id, adminUserId, remarks.trim()))}
                className="w-full py-2 rounded-lg text-xs font-bold bg-blue-600 text-white disabled:opacity-50"
              >
                {busy ? 'Working…' : 'SUBMIT NOTE'}
              </button>
            </Panel>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {/* HISTORY — read only, full detail */}
      {mode === 'history' && (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <Cell label="Status" value={payment.status ?? '—'} />
            <Cell label="Decision Type" value={DECISION_TYPE_LABEL[decisionType(payment)]} />
            <Cell label="Payment %" value={payment.payment_percent == null ? '—' : `${payment.payment_percent}%`} />
            <Cell label="Planned Date" value={fmtDate(payment.planned_date)} />
            <Cell label="Actual Completion" value={fmtDate(payment.actual_completion_date)} />
            <Cell label="Admin Approved" value={fmtDate(payment.admin_approved_at)} />
            <Cell label="Payment Released" value={fmtDate(payment.payment_released_at)} />
            <Cell label="Platform Remarks" value={payment.platform_remarks ?? '—'} />
            <Cell label="Hold Reason" value={payment.admin_hold_reason ?? '—'} />
            <Cell label="Rejection Reason" value={payment.admin_rejection_reason ?? '—'} />
            <Cell label="Decision 5 Decision" value={payment.decision_5_admin_decision ?? '—'} />
            <Cell label="Decision 5 Remarks" value={payment.decision_5_admin_remarks ?? '—'} />
            <Cell label="Rework Proposed" value={money(payment.rework_cost_proposed)} />
            <Cell label="Rework Approved" value={money(payment.rework_cost_approved)} />
            <Cell label="Rework Remarks" value={payment.rework_cost_remarks ?? '—'} />
            <Cell label="Override Type" value={payment.admin_override_type ?? '—'} />
            <Cell label="Created" value={fmtDate(payment.created_at)} />
            <Cell label="Updated" value={fmtDate(payment.updated_at)} />
          </div>
        </div>
      )}

      {isEmpty && emptyMessage && (
        <div className="px-4 pb-4 -mt-1">
          <p className="text-xs font-semibold text-gray-400 text-center">{emptyMessage}</p>
        </div>
      )}
    </div>
  )
}
