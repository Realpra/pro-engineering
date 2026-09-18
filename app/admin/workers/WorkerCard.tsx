'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  adminApproveWorker,
  adminReturnWorker,
  adminRejectWorker,
  adminUpdateCompetency,
  adminTriggerReassessment,
} from './actions'

export type WorkerCardMode =
  | 'pending'
  | 'approved'
  | 'returned'
  | 'reassessment'
  | 'pending_coordinator'
  | 'readonly'

export type Worker = {
  id: string
  full_name: string
  trade: string | null
  skill_level: string | null
  approval_status: string | null
  zones: string[] | null
  secondary_trades: string[] | null
  sector: string | null
  labour_type: string | null
  employment_classification: string | null
  team_name: string | null
  team_number: string | number | null
  daily_wage_inr: number | null
  hourly_rate: number | null
  is_bocw_registered: boolean | null
  height_restriction: boolean | null
  dust_restriction: boolean | null
  deployment_restriction: string | null
  assessment_decision: string | null
  competency_remarks: string | null
  coordinator_forwarding_remarks: string | null
  reassessment_triggered_by: string | null
  reassessment_triggered_at: string | null
  reassessment_reason: string | null
  reassessment_competency: string | null
  jobs_completed_in_trade: number | null
  years_experience: string | null
  address: string | null
  city: string | null
  pincode: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  bank_account_number: string | null
  ifsc_code: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  correction_action: string | null
  is_active: boolean | null
  created_at: string | null
  performance_rating: number | null
  efficiency_multiplier: number | null
  worker_code: string | null
  last_job_date: string | null
  last_job_zone: string | null
  last_job_trade: string | null
  last_job_booking_ref: string | null
  jobs_completed_total: number | null
  current_job_booking_ref: string | null
  last_deployed_at: string | null
  proposed_zone: string | null
  worker_willingness_zone: string | null
  supervisor_recommendation: string | null
  coordinator_recommendation: string | null
  assessed_for: string | null
  [key: string]: unknown
}

// ─── Reference data ──────────────────────────────────────────────────────────

const COMPETENCIES: { key: string; label: string }[] = [
  { key: 'competency_m1', label: 'M1 Tile Works' },
  { key: 'competency_m2', label: 'M2 Plastering' },
  { key: 'competency_m3', label: 'M3 Brickwork' },
  { key: 'competency_m4', label: 'M4 Flooring' },
  { key: 'competency_m5', label: 'M5 Kitchen' },
  { key: 'competency_m6', label: 'M6 Emergency' },
]

// NOTE: spec assumed specialist_track_a..i. Verified live against the DB
// (PostgREST 42703 on e-i) — only tracks A-D actually exist.
const TRACKS: { key: string; label: string }[] = ['a', 'b', 'c', 'd'].map((x) => ({
  key: `specialist_track_${x}`,
  label: `Specialist Track ${x.toUpperCase()}`,
}))

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  not_assessed: { label: 'Not Assessed', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  assessed: { label: 'Assessed', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  coordinator_approved: { label: 'Coordinator Approved', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  admin_approved: { label: 'Admin Approved', className: 'bg-green-100 text-green-700 border border-green-200' },
  returned: { label: 'Returned', className: 'bg-red-100 text-red-700 border border-red-200' },
  rejected: { label: 'Rejected', className: 'bg-red-200 text-red-900 border border-red-300' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notEmpty(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function isErr(res: { success: true } | { error: string }): res is { error: string } {
  return 'error' in res
}

function inr(v: unknown): string {
  return typeof v === 'number' ? `₹${v.toLocaleString('en-IN')}` : '—'
}

function fmtDate(v: unknown): string {
  if (!notEmpty(v)) return '—'
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN')
}

function workerCode(worker: Worker): string {
  return notEmpty(worker.worker_code) ? asText(worker.worker_code) : `PE-W-${worker.id.slice(0, 4).toUpperCase()}`
}

// ─── Small presentational bits ───────────────────────────────────────────────

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

function Pill({ text, color }: { text: string; color: 'orange' | 'blue' | 'grey' | 'green' }) {
  const styles: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-700 border border-orange-200',
    blue: 'bg-blue-100 text-blue-700 border border-blue-200',
    grey: 'bg-gray-100 text-gray-600 border border-gray-200',
    green: 'bg-green-100 text-green-700 border border-green-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${styles[color]}`}>
      {text}
    </span>
  )
}

function InfoBox({ label, value, color }: { label: string; value: string; color: 'blue' | 'amber' | 'grey' | 'red' }) {
  const box: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    amber: 'bg-amber-50 border-amber-200',
    grey: 'bg-gray-50 border-gray-200',
    red: 'bg-red-50 border-red-200',
  }
  const text: Record<string, string> = {
    blue: 'text-blue-900',
    amber: 'text-amber-900',
    grey: 'text-gray-700',
    red: 'text-red-900',
  }
  const lbl: Record<string, string> = {
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    grey: 'text-gray-500',
    red: 'text-red-700',
  }
  return (
    <div className={`rounded-lg border px-3 py-2 ${box[color]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${lbl[color]}`}>{label}</p>
      <p className={`text-sm ${text[color]}`}>{value}</p>
    </div>
  )
}

function CompetencyStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.not_assessed
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  )
}

// ─── Competency table row ────────────────────────────────────────────────────

function CompetencyRow({
  worker,
  adminUserId,
  fieldKey,
  label,
}: {
  worker: Worker
  adminUserId: string
  fieldKey: string
  label: string
}) {
  const router = useRouter()
  const assessedLevel = worker[fieldKey]
  const currentStatus = asText(worker[`${fieldKey}_status`]) || 'not_assessed'
  const existingRemark = asText(worker[`${fieldKey}_admin_remarks`])

  const [pending, setPending] = useState<null | 'return' | 'reject'>(null)
  const [remark, setRemark] = useState(existingRemark)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(statusValue: string, remarksValue: string) {
    setBusy(true)
    setError(null)
    const res = await adminUpdateCompetency(worker.id, adminUserId, fieldKey, statusValue, remarksValue)
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setPending(null)
    router.refresh()
  }

  return (
    <tr className="border-b border-gray-100 last:border-0 align-top">
      <td className="px-3 py-2.5 text-sm font-medium text-gray-800">{label}</td>
      <td className="px-3 py-2.5 text-sm text-gray-600">
        {notEmpty(assessedLevel) ? String(assessedLevel) : <span className="text-gray-400 italic">Not Assessed</span>}
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-400">—</td>
      <td className="px-3 py-2.5">
        <CompetencyStatusBadge status={currentStatus} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => run('admin_approved', remark)}
            disabled={busy}
            className="px-2 py-1 rounded-md text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            APPROVE
          </button>
          <button
            type="button"
            onClick={() => setPending((p) => (p === 'return' ? null : 'return'))}
            disabled={busy}
            className={`px-2 py-1 rounded-md text-xs font-semibold disabled:opacity-50 ${
              pending === 'return' ? 'bg-amber-600 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            RETURN
          </button>
          <button
            type="button"
            onClick={() => setPending((p) => (p === 'reject' ? null : 'reject'))}
            disabled={busy}
            className={`px-2 py-1 rounded-md text-xs font-semibold disabled:opacity-50 ${
              pending === 'reject' ? 'bg-red-700 text-white' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            REJECT
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </td>
      <td className="px-3 py-2.5">
        {pending ? (
          <div className="space-y-1.5">
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              placeholder={pending === 'return' ? 'Reason for return…' : 'Reason for rejection…'}
              className="w-full border border-gray-300 rounded-lg p-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
            />
            <button
              type="button"
              onClick={() => run(pending === 'return' ? 'returned' : 'rejected', remark)}
              disabled={busy || !remark.trim()}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#1F3864] text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : pending === 'return' ? 'Submit Return' : 'Submit Reject'}
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-500">{existingRemark || '—'}</span>
        )}
      </td>
    </tr>
  )
}

// ─── Competency section — always rendered (all 6 M rows) for pending/reassessment ──

function CompetencySection({ worker, adminUserId }: { worker: Worker; adminUserId: string }) {
  const trackRows = TRACKS.filter((t) => notEmpty(worker[t.key]))

  return (
    <div className="px-4 py-4 border-t border-gray-100">
      <p className="text-xs font-bold uppercase tracking-wider text-[#1F3864] mb-2">Competency Assessment</p>

      {notEmpty(worker.competency_remarks) && (
        <div className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Coordinator Competency Remarks</p>
          <p className="text-sm text-gray-700">{asText(worker.competency_remarks)}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border border-gray-200 rounded-lg">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 font-semibold">Competency</th>
              <th className="px-3 py-2 font-semibold">Assessed Level</th>
              <th className="px-3 py-2 font-semibold">Coordinator Remarks</th>
              <th className="px-3 py-2 font-semibold">Admin Decision</th>
              <th className="px-3 py-2 font-semibold">Admin Remarks</th>
            </tr>
          </thead>
          <tbody>
            {COMPETENCIES.map((c) => (
              <CompetencyRow key={c.key} worker={worker} adminUserId={adminUserId} fieldKey={c.key} label={c.label} />
            ))}
            {trackRows.map((t) => (
              <CompetencyRow key={t.key} worker={worker} adminUserId={adminUserId} fieldKey={t.key} label={t.label} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Compact competency / specialist badge strips (Admin Approved tab) ──────

function CompetencyBadgeStrip({ worker }: { worker: Worker }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {COMPETENCIES.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
        >
          {c.label.split(' ')[0]}: {notEmpty(worker[c.key]) ? String(worker[c.key]) : '—'}
        </span>
      ))}
    </div>
  )
}

function SpecialistBadgeStrip({ worker }: { worker: Worker }) {
  const rows = TRACKS.filter((t) => notEmpty(worker[t.key]))
  if (rows.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {rows.map((t) => (
        <span
          key={t.key}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200"
        >
          {t.label}: {String(worker[t.key])}
        </span>
      ))}
    </div>
  )
}

// ─── Job History (collapsible, all modes) ────────────────────────────────────

function JobHistorySection({ worker }: { worker: Worker }) {
  const [open, setOpen] = useState(false)
  const allNull =
    !notEmpty(worker.last_job_date) &&
    !notEmpty(worker.last_job_trade) &&
    !notEmpty(worker.last_job_zone) &&
    !notEmpty(worker.last_job_booking_ref) &&
    worker.jobs_completed_in_trade == null &&
    worker.jobs_completed_total == null &&
    !notEmpty(worker.current_job_booking_ref) &&
    !notEmpty(worker.last_deployed_at)

  return (
    <div className="px-4 py-3 border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-[#1F3864]"
      >
        <span>Job History</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        allNull ? (
          <p className="text-sm text-gray-400 mt-2">No job history recorded yet.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {notEmpty(worker.current_job_booking_ref) && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">
                  Currently Deployed
                </span>
                <span className="text-sm text-gray-700">{asText(worker.current_job_booking_ref)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Cell label="Last Job Date" value={fmtDate(worker.last_job_date)} />
              <Cell label="Last Job Trade" value={notEmpty(worker.last_job_trade) ? asText(worker.last_job_trade) : '—'} />
              <Cell label="Last Job Zone" value={notEmpty(worker.last_job_zone) ? asText(worker.last_job_zone) : '—'} />
              <Cell label="Last Job Booking Ref" value={notEmpty(worker.last_job_booking_ref) ? asText(worker.last_job_booking_ref) : '—'} />
              <Cell label="Jobs Completed (Trade)" value={worker.jobs_completed_in_trade != null ? String(worker.jobs_completed_in_trade) : '—'} />
              <Cell label="Jobs Completed (Total)" value={worker.jobs_completed_total != null ? String(worker.jobs_completed_total) : '—'} />
              <Cell label="Last Deployed At" value={fmtDate(worker.last_deployed_at)} />
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ─── Overall approve / return / reject ───────────────────────────────────────

function OverallActions({ worker, adminUserId }: { worker: Worker; adminUserId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState<null | 'approve' | 'return' | 'reject'>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function finish(res: { success: true } | { error: string }) {
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setOpen(null)
    setText('')
    router.refresh()
  }

  async function approve() {
    setBusy(true)
    setError(null)
    finish(await adminApproveWorker(worker.id, adminUserId))
  }

  async function doReturn() {
    setBusy(true)
    setError(null)
    finish(await adminReturnWorker(worker.id, adminUserId, text.trim()))
  }

  async function doReject() {
    setBusy(true)
    setError(null)
    finish(await adminRejectWorker(worker.id, adminUserId, text.trim()))
  }

  return (
    <div className="px-4 py-4 border-t border-gray-100 space-y-2">
      {open !== 'approve' ? (
        <button
          type="button"
          onClick={() => {
            setOpen('approve')
            setError(null)
          }}
          disabled={busy}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          APPROVE WORKER
        </button>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-800 mb-2">Confirm approval?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={approve}
              disabled={busy}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-green-600 text-white disabled:opacity-50"
            >
              {busy ? 'Working…' : 'YES'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(null)}
              disabled={busy}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-600"
            >
              NO
            </button>
          </div>
        </div>
      )}

      {open !== 'return' ? (
        <button
          type="button"
          onClick={() => {
            setOpen('return')
            setText('')
            setError(null)
          }}
          disabled={busy}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
        >
          RETURN FOR CORRECTION
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Correction action required…"
            className="w-full border border-amber-300 rounded-lg p-2 text-sm resize-none bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doReturn}
              disabled={busy || !text.trim()}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-amber-600 text-white disabled:opacity-50"
            >
              {busy ? 'Working…' : 'SUBMIT RETURN'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(null)}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {open !== 'reject' ? (
        <button
          type="button"
          onClick={() => {
            setOpen('reject')
            setText('')
            setError(null)
          }}
          disabled={busy}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          REJECT WORKER
        </button>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Reason for rejection…"
            className="w-full border border-red-300 rounded-lg p-2 text-sm resize-none bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doReject}
              disabled={busy || !text.trim()}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50"
            >
              {busy ? 'Working…' : 'CONFIRM REJECT'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(null)}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Re-assessment trigger (Admin Approved tab) ──────────────────────────────

function ReassessmentTrigger({ worker, adminUserId }: { worker: Worker; adminUserId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [competency, setCompetency] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await adminTriggerReassessment(worker.id, adminUserId, competency, reason.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setOpen(false)
    setCompetency('')
    setReason('')
    router.refresh()
  }

  return (
    <div className="px-4 py-4 border-t border-gray-100">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-[#1F3864] border border-[#1F3864] px-3 py-1.5 rounded-lg hover:bg-[#1F3864] hover:text-white transition-colors"
        >
          Trigger Re-assessment
        </button>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Competency</label>
            <select
              value={competency}
              onChange={(e) => setCompetency(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
            >
              <option value="">Select…</option>
              {COMPETENCIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
              {TRACKS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is re-assessment needed?"
              className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !competency || !reason.trim()}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#1F3864] text-white disabled:opacity-50"
            >
              {busy ? 'Working…' : 'SUBMIT RE-ASSESSMENT'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

export default function WorkerCard({
  worker,
  adminUserId,
  mode,
  approverName,
}: {
  worker: Worker
  adminUserId: string
  mode: WorkerCardMode
  approverName?: string | null
}) {
  const restrictions: string[] = []
  if (worker.height_restriction) restrictions.push('Height')
  if (worker.dust_restriction) restrictions.push('Dust')
  if (notEmpty(worker.deployment_restriction)) restrictions.push(asText(worker.deployment_restriction))

  const showCompetency = mode === 'pending' || mode === 'reassessment'
  const daysWaiting = notEmpty(worker.created_at)
    ? Math.max(0, Math.floor((Date.now() - new Date(String(worker.created_at)).getTime()) / 86400000))
    : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#1F3864] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-white text-[#1F3864]">
                {workerCode(worker)}
              </span>
              <span className="text-[#8fa8cf] text-[10px]">ID {worker.id.slice(0, 8)}</span>
            </div>
            <p className="text-white font-bold text-sm leading-tight break-words mt-1">{worker.full_name}</p>
            {notEmpty(worker.employment_classification) && (
              <p className="text-blue-200 text-xs mt-0.5">{asText(worker.employment_classification)}</p>
            )}
            {(worker.team_name || worker.team_number) && (
              <p className="text-blue-200 text-xs mt-0.5">
                {asText(worker.team_name)}
                {notEmpty(worker.team_number) ? ` · #${String(worker.team_number)}` : ''}
              </p>
            )}
            {mode === 'approved' && (notEmpty(worker.approved_at) || notEmpty(approverName)) && (
              <p className="text-[#8fa8cf] text-[10px] mt-1">
                Approved {fmtDate(worker.approved_at)}
                {notEmpty(approverName) ? ` by ${approverName}` : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
            {notEmpty(worker.trade) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F97316] text-white">
                {asText(worker.trade)}
              </span>
            )}
            {notEmpty(worker.skill_level) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500 text-white">
                {asText(worker.skill_level)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="px-4 py-4">
        <div className="mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Zone(s)</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.isArray(worker.zones) && worker.zones.length > 0 ? (
              worker.zones.map((z) => <Pill key={z} text={z} color="orange" />)
            ) : (
              <span className="text-sm text-gray-400">No zone assigned</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Cell label="Sector" value={notEmpty(worker.sector) ? asText(worker.sector) : '—'} />
          <Cell label="Labour Type" value={notEmpty(worker.labour_type) ? asText(worker.labour_type) : '—'} />
          <Cell label="Daily Wage" value={inr(worker.daily_wage_inr)} />
          <Cell label="Hourly Rate" value={worker.hourly_rate != null ? `₹${worker.hourly_rate}` : '—'} />
          <Cell label="BOCW Registered" value={worker.is_bocw_registered ? 'Yes' : 'No'} />
          <Cell label="Restrictions" value={restrictions.length > 0 ? restrictions.join(', ') : 'None'} />
          <Cell label="Performance Rating" value={worker.performance_rating != null ? String(worker.performance_rating) : '—'} />
          <Cell label="Efficiency Multiplier" value={worker.efficiency_multiplier != null ? String(worker.efficiency_multiplier) : '—'} />
          <Cell label="Jobs Completed (Trade)" value={worker.jobs_completed_in_trade != null ? String(worker.jobs_completed_in_trade) : '—'} />
          <Cell label="Last Job Date" value={fmtDate(worker.last_job_date)} />
          <Cell label="Last Job Zone" value={notEmpty(worker.last_job_zone) ? asText(worker.last_job_zone) : '—'} />
          <Cell label="Last Job Trade" value={notEmpty(worker.last_job_trade) ? asText(worker.last_job_trade) : '—'} />
          <Cell label="Years Experience" value={notEmpty(worker.years_experience) ? asText(worker.years_experience) : '—'} />
          <Cell label="Address" value={notEmpty(worker.address) ? asText(worker.address) : '—'} />
          <Cell label="City" value={notEmpty(worker.city) ? asText(worker.city) : '—'} />
          <Cell label="Pincode" value={notEmpty(worker.pincode) ? asText(worker.pincode) : '—'} />
          <Cell label="Emergency Contact" value={notEmpty(worker.emergency_contact_name) ? asText(worker.emergency_contact_name) : '—'} />
          <Cell label="Emergency Phone" value={notEmpty(worker.emergency_contact_phone) ? asText(worker.emergency_contact_phone) : '—'} />
          <Cell label="Bank Account" value={notEmpty(worker.bank_account_number) ? asText(worker.bank_account_number) : '—'} />
          <Cell label="IFSC Code" value={notEmpty(worker.ifsc_code) ? asText(worker.ifsc_code) : '—'} />
        </div>

        {(notEmpty(worker.proposed_zone) || notEmpty(worker.worker_willingness_zone)) && (
          <div className="mt-3 flex flex-wrap gap-3">
            {notEmpty(worker.proposed_zone) && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Proposed Zone</p>
                <Pill text={asText(worker.proposed_zone)} color="green" />
              </div>
            )}
            {notEmpty(worker.worker_willingness_zone) && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Worker Willingness Zone</p>
                <Pill text={asText(worker.worker_willingness_zone)} color="green" />
              </div>
            )}
          </div>
        )}

        {notEmpty(worker.assessed_for) && (
          <div className="mt-3">
            <Cell label="Assessed For" value={asText(worker.assessed_for)} />
          </div>
        )}

        <div className="mt-3 space-y-2">
          {notEmpty(worker.supervisor_recommendation) && (
            <InfoBox label="Supervisor Recommendation" value={asText(worker.supervisor_recommendation)} color="blue" />
          )}
          {notEmpty(worker.coordinator_recommendation) && (
            <InfoBox label="Coordinator Recommendation" value={asText(worker.coordinator_recommendation)} color="amber" />
          )}
          {notEmpty(worker.coordinator_forwarding_remarks) && (
            <InfoBox label="Coordinator Forwarding Remarks" value={asText(worker.coordinator_forwarding_remarks)} color="grey" />
          )}
        </div>

        {mode === 'approved' && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Competency Levels</p>
            <CompetencyBadgeStrip worker={worker} />
            <SpecialistBadgeStrip worker={worker} />
            <p className="text-xs text-gray-500 mt-2">
              Last Job: {fmtDate(worker.last_job_date)} · Jobs Completed: {worker.jobs_completed_total != null ? String(worker.jobs_completed_total) : '—'}
            </p>
          </div>
        )}
      </div>

      {/* Returned / rejected context */}
      {mode === 'returned' && (notEmpty(worker.correction_action) || notEmpty(worker.rejection_reason)) && (
        <div className="px-4 pb-4 -mt-1 space-y-2">
          {notEmpty(worker.correction_action) && (
            <InfoBox label="Correction Action" value={asText(worker.correction_action)} color="amber" />
          )}
          {notEmpty(worker.rejection_reason) && (
            <InfoBox label="Rejection Reason" value={asText(worker.rejection_reason)} color="red" />
          )}
        </div>
      )}

      {/* Pending Coordinator context */}
      {mode === 'pending_coordinator' && (
        <div className="px-4 pb-4 -mt-1 space-y-2">
          <p className="text-xs text-gray-500">{daysWaiting != null ? `Waiting ${daysWaiting} day(s)` : ''}</p>
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-sm text-gray-600">Awaiting coordinator assessment before this worker can be forwarded to Admin.</p>
          </div>
        </div>
      )}

      {/* Re-assessment context */}
      {mode === 'reassessment' && (
        <div className="px-4 pb-4 -mt-1 space-y-2">
          {notEmpty(worker.reassessment_competency) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#1F3864] text-white">
              Re-assessing: {asText(worker.reassessment_competency)}
            </span>
          )}
          {notEmpty(worker.reassessment_reason) && (
            <InfoBox label="Re-assessment Reason" value={asText(worker.reassessment_reason)} color="red" />
          )}
          {notEmpty(worker.reassessment_triggered_by) && (
            <p className="text-xs text-gray-500">Triggered by Admin · {fmtDate(worker.reassessment_triggered_at)}</p>
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Current Competency Status</p>
            <div className="grid grid-cols-3 gap-1.5">
              {COMPETENCIES.map((c) => (
                <div key={c.key} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 gap-1">
                  <span className="text-xs text-gray-500 whitespace-nowrap">{c.label.split(' ')[0]}</span>
                  <CompetencyStatusBadge status={asText(worker[`${c.key}_status`]) || 'not_assessed'} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-sm text-red-900">This worker has been returned for re-assessment. Coordinator must re-assess and resubmit.</p>
          </div>
        </div>
      )}

      {showCompetency && <CompetencySection worker={worker} adminUserId={adminUserId} />}
      <JobHistorySection worker={worker} />
      {mode === 'pending' && <OverallActions worker={worker} adminUserId={adminUserId} />}
      {mode === 'approved' && <ReassessmentTrigger worker={worker} adminUserId={adminUserId} />}
    </div>
  )
}
