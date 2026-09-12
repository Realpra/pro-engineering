'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  adminApproveHandover,
  adminRejectHandover,
  adminConditionalHandover,
  adminAssignSiteHead,
  adminAddDailyPlanEntry,
  adminApproveScopeChange,
  adminRejectScopeChange,
  adminPartialApproveScopeChange,
  type ScopeActionResult,
} from './actions'

// ─── Types ─────────────────────────────────────────────────────────────────

type JsonRow = Record<string, unknown>

export type Assessment = {
  id: string
  booking_ref: string | null
  job_title: string | null
  zone: string | null
  trade: string | null
  job_type: string | null
  request_date: string | null
  approx_job_value: number | string | null
  is_critical: boolean | null
  critical_reason: string | null
  directions_to_complete: string | null
  assigned_site_head: string | null
  assigned_supervisor: string | null
  daily_plan_log: JsonRow[] | null
  client_name: string | null
  site_head_inspection_date: string | null
  site_head_snag_items: JsonRow[] | null
  site_head_clearance: string | null
  site_head_inspected_by: string | null
  supervisor_inspection_date: string | null
  supervisor_snag_items: JsonRow[] | null
  supervisor_clearance: string | null
  supervisor_inspected_by: string | null
  supervisor_flagged_to_admin: boolean | null
  supervisor_flag_reason: string | null
  admin_decision: string | null
  admin_conditions: string | null
  admin_decided_at: string | null
  admin_decided_by: string | null
  handover_completed_at: string | null
  created_at: string | null
  updated_at: string | null
  [key: string]: unknown
}

export type ScopeChange = {
  id: string
  job_id: string | null
  scope_change_number: string | null
  zone: string | null
  trade: string | null
  job_type: string | null
  raised_by_role: string | null
  client_request: string | null
  supervisor_remarks: string | null
  site_head_remarks: string | null
  approx_job_value: number | string | null
  original_completion_date: string | null
  revised_completion_date: string | null
  supervisor_rough_estimate: JsonRow[] | null
  site_head_rough_estimate: JsonRow[] | null
  trigger_type: string | null
  description: string | null
  client_decision: string | null
  decision_timestamp: string | null
  created_at: string | null
  booking_ref: string | null
  change_type: string | null
  change_status: string | null
  justification_cos: string | null
  original_scope_items: JsonRow[] | null
  proposed_additions: JsonRow[] | null
  proposed_deletions: JsonRow[] | null
  proposed_substitutions: JsonRow[] | null
  cost_impact_additions: number | null
  cost_impact_deletions: number | null
  cost_impact_net: number | null
  timeline_impact_days: number | null
  revised_total_estimate: number | null
  requested_by: string | null
  requested_at: string | null
  coordinator_recommendation: string | null
  coordinator_recommended_at: string | null
  admin_decision: string | null
  admin_remarks: string | null
  admin_decided_at: string | null
  admin_decided_by: string | null
  client_informed_at: string | null
  client_acceptance: string | null
  updated_at: string | null
  [key: string]: unknown
}

export type PiTracker = {
  id: string
  tracked_identity_type: string | null
  tracked_identity_id: string | null
  trade: string | null
  skill_level: string | null
  city_of_zone: string | null
  last_5_jobs: JsonRow[] | null
  pi_score: number | null
  pi_category: string | null
  pi_trend: string | null
  scoring_formula_version: string | null
  pi_calculated_at: string | null
  pi_remarks: string | null
  historic_period: string | null
  scheduled_completion_pct: number | null
  actual_completion_pct: number | null
  cost_variance: number | null
  quality_score: number | null
  client_satisfaction_score: number | null
  worker_performance_score: number | null
  zone_performance_score: number | null
  milestone_adherence_score: number | null
  payment_release_timeliness: number | null
  rework_count: number | null
  decision_5_count: number | null
  escalation_count: number | null
  safety_incident_count: number | null
  methodology_revision_count: number | null
  total_jobs_in_period: number | null
  on_time_completion_count: number | null
  within_budget_count: number | null
  client_complaint_count: number | null
  score_last_recalculated_at: string | null
  created_at: string | null
  updated_at: string | null
  [key: string]: unknown
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isErr(res: ScopeActionResult): res is { error: string } {
  return 'error' in res
}

function asRows(v: unknown): JsonRow[] {
  return Array.isArray(v) ? (v as JsonRow[]) : []
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return `₹${num(v).toLocaleString('en-IN')}`
}

function metric(v: unknown): string {
  return v == null || v === '' ? '—' : String(v)
}

function pick(row: JsonRow, keys: string[]): string {
  for (const k of keys) {
    const val = row[k]
    if (val != null && val !== '') return String(val)
  }
  return '—'
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const da = new Date(a.length <= 10 ? `${a}T00:00:00` : a).getTime()
  const db = new Date(b.length <= 10 ? `${b}T00:00:00` : b).getTime()
  if (Number.isNaN(da) || Number.isNaN(db)) return null
  return Math.round((db - da) / 86_400_000)
}

// ─── Shared UI ─────────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const primaryBtn = 'px-4 py-2 rounded-lg text-xs font-bold bg-[#1F3864] text-white hover:bg-[#16305a] disabled:opacity-50'
const cardClass = 'bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden'
const labelClass = 'text-xs font-semibold uppercase tracking-wider'

function Badge({ children, cls }: { children: ReactNode; cls: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {children}
    </span>
  )
}

function ColorTag({ text, color }: { text: string; color: 'orange' | 'blue' | 'gray' }) {
  const cls =
    color === 'orange'
      ? 'bg-orange-100 text-orange-700 border-orange-200'
      : color === 'blue'
        ? 'bg-blue-100 text-blue-700 border-blue-200'
        : 'bg-gray-100 text-gray-600 border-gray-200'
  return <Badge cls={cls}>{text}</Badge>
}

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <p className="text-xs text-red-600 mt-1">{msg}</p>
}

function NavyPill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
        active
          ? 'bg-[#1F3864] text-white'
          : 'bg-white text-[#1F3864] border border-[#1F3864] hover:bg-[#1F3864]/5'
      }`}
    >
      {children}
      {count != null && count > 0 && (
        <span
          className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${
            active ? 'bg-white text-[#F97316]' : 'bg-[#F97316] text-white'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

const CLEARANCE_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  cleared: 'bg-green-100 text-green-700 border-green-200',
  not_cleared: 'bg-red-100 text-red-700 border-red-200',
  conditional: 'bg-amber-100 text-amber-700 border-amber-200',
}

function ClearanceBadge({ value }: { value: string | null | undefined }) {
  const v = (value ?? 'pending') || 'pending'
  return <Badge cls={CLEARANCE_BADGE[v] ?? CLEARANCE_BADGE.pending}>{v}</Badge>
}

const SEVERITY_BADGE: Record<string, string> = {
  minor: 'bg-green-100 text-green-700 border-green-200',
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  moderate: 'bg-amber-100 text-amber-700 border-amber-200',
  major: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-red-100 text-red-700 border-red-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
}

function SeverityBadge({ value }: { value: string }) {
  if (!value) return null
  return <Badge cls={SEVERITY_BADGE[value.toLowerCase()] ?? 'bg-gray-100 text-gray-600 border-gray-200'}>{value}</Badge>
}

function SnagList({ items }: { items: JsonRow[] }) {
  if (items.length === 0) return <p className="text-xs text-gray-400">No snag items raised</p>
  return (
    <ol className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="text-sm text-gray-700 flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-500">{i + 1}.</span>
          <span className="font-medium">{pick(it, ['location', 'area', 'room'])}</span>
          <span className="text-gray-600">— {pick(it, ['description', 'detail', 'note'])}</span>
          <SeverityBadge value={pick(it, ['severity', 'priority']) === '—' ? '' : pick(it, ['severity', 'priority'])} />
        </li>
      ))}
    </ol>
  )
}

// ─── TAB 1: Pre-Delivery Assessment Queue ──────────────────────────────────

const ASSESSMENT_DECISION_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approve_handover: 'bg-green-100 text-green-700 border-green-200',
  reject_handover: 'bg-red-100 text-red-700 border-red-200',
  conditional_handover: 'bg-blue-100 text-blue-700 border-blue-200',
}

function AssessmentAdminPanel({ assessment, adminUserId }: { assessment: Assessment; adminUserId: string }) {
  const router = useRouter()
  const [conditions, setConditions] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'approve' | 'conditional' | 'reject') {
    setBusy(kind)
    setError(null)
    const fn =
      kind === 'approve'
        ? adminApproveHandover
        : kind === 'conditional'
          ? adminConditionalHandover
          : adminRejectHandover
    const res = await fn(assessment.id, adminUserId, conditions.trim())
    setBusy(null)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Admin Decision Required</p>
      <textarea
        rows={2}
        className={`${inputClass} resize-none`}
        placeholder="Conditions (required for conditional handover)…"
        value={conditions}
        onChange={(e) => setConditions(e.target.value)}
      />
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          disabled={busy != null}
          onClick={() => run('approve')}
        >
          {busy === 'approve' ? 'Working…' : 'APPROVE HANDOVER'}
        </button>
        <button
          type="button"
          className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          disabled={busy != null || !conditions.trim()}
          onClick={() => run('conditional')}
        >
          {busy === 'conditional' ? 'Working…' : 'CONDITIONAL HANDOVER'}
        </button>
        <button
          type="button"
          className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          disabled={busy != null}
          onClick={() => run('reject')}
        >
          {busy === 'reject' ? 'Working…' : 'REJECT HANDOVER'}
        </button>
      </div>
      <Err msg={error} />
    </div>
  )
}

function AssignSection({ assessment, adminUserId }: { assessment: Assessment | null; adminUserId: string }) {
  const router = useRouter()
  const [siteHeadId, setSiteHeadId] = useState(assessment?.assigned_site_head ?? '')
  const [supervisorId, setSupervisorId] = useState(assessment?.assigned_supervisor ?? '')
  const [logEntry, setLogEntry] = useState('')
  const [busy, setBusy] = useState<'assign' | 'log' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const disabled = assessment == null

  async function saveAssignment() {
    if (!assessment) return
    setBusy('assign')
    setError(null)
    const res = await adminAssignSiteHead(assessment.id, siteHeadId.trim(), supervisorId.trim(), adminUserId)
    setBusy(null)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  async function addLogEntry() {
    if (!assessment || !logEntry.trim()) return
    setBusy('log')
    setError(null)
    const res = await adminAddDailyPlanEntry(assessment.id, logEntry.trim(), adminUserId)
    setBusy(null)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setLogEntry('')
    router.refresh()
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Assign</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign Site Head (UUID)</span>
          <input
            className={`${inputClass} mt-1`}
            value={siteHeadId}
            onChange={(e) => setSiteHeadId(e.target.value)}
            disabled={disabled}
            placeholder="Site head user id…"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign Supervisor (UUID)</span>
          <input
            className={`${inputClass} mt-1`}
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            disabled={disabled}
            placeholder="Supervisor user id…"
          />
        </label>
      </div>
      <button type="button" className={primaryBtn} disabled={disabled || busy != null} onClick={saveAssignment}>
        {busy === 'assign' ? 'Saving…' : 'SAVE ASSIGNMENT'}
      </button>

      <div className="pt-2 border-t border-gray-200">
        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add to Daily Plan Log</span>
          <textarea
            rows={2}
            className={`${inputClass} mt-1 resize-none`}
            value={logEntry}
            onChange={(e) => setLogEntry(e.target.value)}
            disabled={disabled}
            placeholder="New daily plan entry…"
          />
        </label>
        <button
          type="button"
          className={`${primaryBtn} mt-2`}
          disabled={disabled || busy != null || !logEntry.trim()}
          onClick={addLogEntry}
        >
          {busy === 'log' ? 'Saving…' : 'ADD LOG ENTRY'}
        </button>
      </div>
      <Err msg={error} />
    </div>
  )
}

function AssessmentCard({
  assessment,
  adminUserId,
}: {
  assessment: Assessment | null
  adminUserId: string
}) {
  const a = assessment
  const decision = a?.admin_decision || 'pending'
  const flagged = a?.supervisor_flagged_to_admin === true
  const needsDecision = flagged && a != null && a.admin_decision == null
  const siteSnags = asRows(a?.site_head_snag_items)
  const supSnags = asRows(a?.supervisor_snag_items)
  const planLog = asRows(a?.daily_plan_log)

  return (
    <div className={cardClass}>
      {a?.supervisor_flagged_to_admin && (
        <div className="bg-orange-500 text-white text-xs font-bold px-4 py-2">Flagged to Admin</div>
      )}
      <div className="bg-[#1F3864] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-white font-bold text-sm truncate">{a?.booking_ref ?? '—'}</p>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              ASSESSMENT_DECISION_BADGE[decision] ?? ASSESSMENT_DECISION_BADGE.pending
            }`}
          >
            {decision}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {a?.job_title && <span className="text-blue-200 text-xs">{a.job_title}</span>}
          {a?.zone && <Badge cls="bg-white/10 text-white border-white/30">{a.zone}</Badge>}
          {a?.trade && <Badge cls="bg-white/10 text-white border-white/30">{a.trade}</Badge>}
          {a?.job_type && <Badge cls="bg-white/10 text-white border-white/30">{a.job_type}</Badge>}
          {a?.is_critical && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
              CRITICAL
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Cell label="Request Date" value={fmtDate(a?.request_date)} />
          <Cell label="Approx Job Value" value={money(a?.approx_job_value)} />
          <Cell label="Client" value={a?.client_name ?? '—'} />
          <Cell label="Site Head" value={a?.assigned_site_head ? `Site Head: ${a.assigned_site_head}` : '—'} />
          <Cell label="Supervisor" value={a?.assigned_supervisor ? `Supervisor: ${a.assigned_supervisor}` : '—'} />
        </div>
        {a?.critical_reason && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-0.5">Critical Reason</p>
            <p className="text-sm text-red-900">{a.critical_reason}</p>
          </div>
        )}
        {a?.directions_to_complete && (
          <div className="rounded-lg bg-[#1F3864]/5 border border-[#1F3864]/20 px-3 py-2">
            <p className="text-xs font-semibold text-[#1F3864] uppercase tracking-wider mb-0.5">Directions to Complete</p>
            <p className="text-sm text-gray-800">{a.directions_to_complete}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Daily Plan Log</p>
          {planLog.length === 0 ? (
            <p className="text-xs text-gray-400">No daily plan entries yet</p>
          ) : (
            <ol className="space-y-1">
              {planLog.map((entry, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-500">{i + 1}.</span>{' '}
                  {pick(entry, ['text', 'entry', 'note'])}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="p-4 grid gap-4 md:grid-cols-2">
        {/* LEFT — Site Head */}
        <div className="space-y-2">
          <p className={`${labelClass} text-[#F97316]`}>Site Head Inspection</p>
          <p className="text-sm text-gray-700">
            {a?.site_head_inspection_date ? fmtDate(a.site_head_inspection_date) : 'Not yet inspected'}
          </p>
          <ClearanceBadge value={a?.site_head_clearance} />
          <div className="pt-1">{a ? <SnagList items={siteSnags} /> : <p className="text-xs text-gray-400">Awaiting data</p>}</div>
        </div>

        {/* RIGHT — Supervisor */}
        <div className="space-y-2">
          <p className={`${labelClass} text-[#2E74B5]`}>Supervisor Inspection</p>
          <p className="text-sm text-gray-700">
            {a?.supervisor_inspection_date ? fmtDate(a.supervisor_inspection_date) : 'Not yet inspected'}
          </p>
          <ClearanceBadge value={a?.supervisor_clearance} />
          <div className="pt-1">{a ? <SnagList items={supSnags} /> : <p className="text-xs text-gray-400">Awaiting data</p>}</div>
          {flagged && (
            <div className="mt-2 rounded-lg bg-red-600 text-white text-xs font-bold px-3 py-2">
              FLAGGED TO ADMIN — Requires admin decision
            </div>
          )}
          {a?.supervisor_flag_reason && (
            <p className="text-xs text-gray-600 mt-1">{a.supervisor_flag_reason}</p>
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        {!a && <p className="text-sm text-gray-400 text-center py-2">No assessments pending</p>}

        {needsDecision && a && (
          <>
            <p className="text-sm font-bold text-red-700">ADMIN DECISION REQUIRED</p>
            <AssessmentAdminPanel assessment={a} adminUserId={adminUserId} />
          </>
        )}

        {a && a.admin_decision != null && (
          <div
            className={`mt-2 rounded-xl border p-3 ${
              ASSESSMENT_DECISION_BADGE[decision] ?? ASSESSMENT_DECISION_BADGE.pending
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wider">{decision}</p>
            {a.admin_conditions && <p className="text-sm mt-1">{a.admin_conditions}</p>}
            <p className="text-xs mt-1 opacity-80">Decided {fmtDate(a.admin_decided_at)}</p>
          </div>
        )}

        <AssignSection assessment={a} adminUserId={adminUserId} />
      </div>
    </div>
  )
}

function AssessmentQueue({
  assessments,
  adminUserId,
}: {
  assessments: Assessment[]
  adminUserId: string
}) {
  const flagged = assessments.filter((a) => a.supervisor_flagged_to_admin === true)
  const rest = assessments.filter((a) => a.supervisor_flagged_to_admin !== true)
  const ordered = [...flagged, ...rest]

  return (
    <div className="space-y-4">
      {ordered.length === 0 ? (
        <AssessmentCard assessment={null} adminUserId={adminUserId} />
      ) : (
        ordered.map((a) => <AssessmentCard key={a.id} assessment={a} adminUserId={adminUserId} />)
      )}
    </div>
  )
}

// ─── TAB 2: Scope Change Requests ─────────────────────────────────────────

const CLIENT_ACCEPTANCE_BADGE: Record<string, string> = {
  accepted: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
}

const RAISED_BY_BADGE: Record<string, string> = {
  client: 'bg-blue-100 text-blue-700 border-blue-200',
  supervisor: 'bg-orange-100 text-orange-700 border-orange-200',
  site_head: 'bg-purple-100 text-purple-700 border-purple-200',
}

function CollapsePanel({
  title,
  headerCls,
  children,
}: {
  title: string
  headerCls: string
  children: ReactNode
}) {
  return (
    <details className="rounded-lg border border-gray-200 overflow-hidden">
      <summary className={`list-none cursor-pointer px-3 py-2 text-xs font-bold text-white ${headerCls}`}>
        {title}
      </summary>
      <div className="p-3 bg-white">{children}</div>
    </details>
  )
}

function RoughEstimateTable({ rows }: { rows: JsonRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-gray-400">None</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-gray-400 uppercase tracking-wider">
            <th className="py-1 pr-2 font-semibold">#</th>
            <th className="py-1 pr-2 font-semibold">Description</th>
            <th className="py-1 pr-2 font-semibold">Unit</th>
            <th className="py-1 pr-2 font-semibold">Qty</th>
            <th className="py-1 pr-2 font-semibold">Rate ₹</th>
            <th className="py-1 font-semibold">Amount ₹</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100 text-gray-700">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{pick(r, ['description', 'item_name', 'name', 'item'])}</td>
              <td className="py-1 pr-2">{pick(r, ['unit', 'uom'])}</td>
              <td className="py-1 pr-2">{pick(r, ['quantity', 'qty'])}</td>
              <td className="py-1 pr-2">{pick(r, ['rate', 'unit_rate'])}</td>
              <td className="py-1">{pick(r, ['amount', 'total', 'cost'])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScopeChangeAdminPanel({ change, adminUserId }: { change: ScopeChange; adminUserId: string }) {
  const router = useRouter()
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'approve' | 'partial' | 'reject') {
    setBusy(kind)
    setError(null)
    const fn =
      kind === 'approve'
        ? adminApproveScopeChange
        : kind === 'partial'
          ? adminPartialApproveScopeChange
          : adminRejectScopeChange
    const res = await fn(change.id, adminUserId, remarks.trim())
    setBusy(null)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Admin Decision</p>
      <textarea
        rows={2}
        className={`${inputClass} resize-none`}
        placeholder="Admin remarks…"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          disabled={busy != null}
          onClick={() => run('approve')}
        >
          {busy === 'approve' ? 'Working…' : 'APPROVE'}
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          disabled={busy != null}
          onClick={() => run('partial')}
        >
          {busy === 'partial' ? 'Working…' : 'PARTIAL APPROVE'}
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          disabled={busy != null}
          onClick={() => run('reject')}
        >
          {busy === 'reject' ? 'Working…' : 'REJECT'}
        </button>
      </div>
      <Err msg={error} />
    </div>
  )
}

function ScopeChangeCard({
  change,
  clientMap,
  adminUserId,
}: {
  change: ScopeChange | null
  clientMap: Record<string, string>
  adminUserId: string
}) {
  const c = change
  const additions = asRows(c?.proposed_additions)
  const deletions = asRows(c?.proposed_deletions)
  const substitutions = asRows(c?.proposed_substitutions)
  const supervisorRough = asRows(c?.supervisor_rough_estimate)
  const siteHeadRough = asRows(c?.site_head_rough_estimate)
  const net = num(c?.cost_impact_net)
  const netHeaderCls = net === 0 ? 'text-green-300' : net > 0 ? 'text-red-300' : 'text-blue-300'
  const netBarCls =
    net > 0
      ? 'bg-red-50 text-red-700 border-red-200'
      : net < 0
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'
  const changeStatus = c?.change_status ?? ''
  const showAdminPanel =
    c != null && c.admin_decision == null && changeStatus !== 'admin_approved' && changeStatus !== 'rejected'
  const clientName = c?.booking_ref ? clientMap[c.booking_ref] : undefined
  const shift = daysBetween(c?.original_completion_date ?? null, c?.revised_completion_date ?? null)

  return (
    <div className={cardClass}>
      <div className="bg-[#1F3864] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-white text-[#1F3864]">
            {c?.scope_change_number || 'Number pending'}
          </span>
          <p className={`text-sm font-bold shrink-0 ${netHeaderCls}`}>{money(c?.cost_impact_net)}</p>
        </div>
        <p className="text-white font-bold text-sm truncate mt-1">{c?.booking_ref ?? '—'}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge cls="bg-white/10 text-white border-white/30">{c?.change_type ?? '—'}</Badge>
          <Badge cls="bg-white/10 text-white border-white/30">{c?.change_status ?? '—'}</Badge>
          {c?.zone && <Badge cls="bg-white/10 text-white border-white/30">{c.zone}</Badge>}
          {c?.trade && <Badge cls="bg-white/10 text-white border-white/30">{c.trade}</Badge>}
          {c?.job_type && <Badge cls="bg-white/10 text-white border-white/30">{c.job_type}</Badge>}
          {c?.raised_by_role && (
            <Badge cls={RAISED_BY_BADGE[c.raised_by_role] ?? 'bg-white/10 text-white border-white/30'}>
              {c.raised_by_role}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!c && <p className="text-sm text-gray-400 text-center">No scope change requests</p>}

        {c?.client_request && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-0.5">Client Request</p>
            <p className="text-sm text-blue-900">{c.client_request}</p>
          </div>
        )}
        {c?.supervisor_remarks && (
          <div className="rounded-lg bg-[#1F3864]/5 border border-[#1F3864]/20 px-3 py-2">
            <p className="text-xs font-semibold text-[#1F3864] uppercase tracking-wider mb-0.5">Supervisor Remarks</p>
            <p className="text-sm text-gray-800">{c.supervisor_remarks}</p>
          </div>
        )}
        {c?.site_head_remarks && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Site Head Remarks</p>
            <p className="text-sm text-gray-700">{c.site_head_remarks}</p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Client</span>
            {clientName ?? (c ? '—' : 'Awaiting data')}
          </p>
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Approx Job Value</span>
            {c ? money(c.approx_job_value) : 'Awaiting data'}
          </p>
          <p className="text-gray-600 sm:col-span-2">
            <span className={`${labelClass} text-gray-400 block`}>Justification</span>
            {c?.justification_cos || c?.description || (c ? '—' : 'Awaiting data')}
          </p>
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Revised Total Estimate</span>
            {c ? money(c.revised_total_estimate) : 'Awaiting data'}
          </p>
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Revised Program</span>
            {c ? (
              <>
                {fmtDate(c.original_completion_date)} → {fmtDate(c.revised_completion_date)}
                {shift != null && (
                  <span className={shift > 0 ? 'text-red-600 font-semibold' : shift < 0 ? 'text-green-600 font-semibold' : ''}>
                    {' '}({shift > 0 ? '+' : ''}{shift}d)
                  </span>
                )}
              </>
            ) : (
              'Awaiting data'
            )}
          </p>
        </div>

        <div className="space-y-2">
          <CollapsePanel title="ADDITIONS" headerCls="bg-[#F97316]">
            {additions.length === 0 ? (
              <p className="text-xs text-gray-400">None proposed</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider">
                      <th className="py-1 pr-2 font-semibold">#</th>
                      <th className="py-1 pr-2 font-semibold">Description</th>
                      <th className="py-1 pr-2 font-semibold">Unit</th>
                      <th className="py-1 pr-2 font-semibold">Qty</th>
                      <th className="py-1 pr-2 font-semibold">Rate ₹</th>
                      <th className="py-1 font-semibold">Amount ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {additions.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 text-gray-700">
                        <td className="py-1 pr-2">{i + 1}</td>
                        <td className="py-1 pr-2">{pick(r, ['item_name', 'name', 'item', 'description'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['unit', 'uom'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['quantity', 'qty'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['rate', 'unit_rate'])}</td>
                        <td className="py-1">{pick(r, ['amount', 'total', 'cost'])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs font-semibold text-gray-600">Total: {money(c?.cost_impact_additions)}</p>
          </CollapsePanel>

          <CollapsePanel title="DELETIONS" headerCls="bg-red-600">
            {deletions.length === 0 ? (
              <p className="text-xs text-gray-400">None</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider">
                      <th className="py-1 pr-2 font-semibold">#</th>
                      <th className="py-1 pr-2 font-semibold">Description</th>
                      <th className="py-1 pr-2 font-semibold">Unit</th>
                      <th className="py-1 pr-2 font-semibold">Qty</th>
                      <th className="py-1 pr-2 font-semibold">Credit ₹</th>
                      <th className="py-1 font-semibold">Total Credit ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletions.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 text-gray-700">
                        <td className="py-1 pr-2">{i + 1}</td>
                        <td className="py-1 pr-2">{pick(r, ['item_name', 'name', 'item', 'description'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['unit', 'uom'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['quantity', 'qty'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['credit_amount', 'credit', 'rate'])}</td>
                        <td className="py-1">{pick(r, ['total_credit', 'amount', 'total'])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs font-semibold text-gray-600">Total credit: {money(c?.cost_impact_deletions)}</p>
          </CollapsePanel>

          <CollapsePanel title="SUBSTITUTIONS" headerCls="bg-[#2E74B5]">
            {substitutions.length === 0 ? (
              <p className="text-xs text-gray-400">None</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider">
                      <th className="py-1 pr-2 font-semibold">#</th>
                      <th className="py-1 pr-2 font-semibold">Old Item</th>
                      <th className="py-1 pr-2 font-semibold">New Item</th>
                      <th className="py-1 pr-2 font-semibold">Unit</th>
                      <th className="py-1 pr-2 font-semibold">Qty</th>
                      <th className="py-1 pr-2 font-semibold">Rate Diff ₹</th>
                      <th className="py-1 font-semibold">Net ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {substitutions.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 text-gray-700">
                        <td className="py-1 pr-2">{i + 1}</td>
                        <td className="py-1 pr-2">{pick(r, ['old_item', 'from_item', 'original', 'old'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['new_item', 'to_item', 'replacement', 'new'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['unit', 'uom'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['quantity', 'qty'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['rate_difference', 'rate_diff'])}</td>
                        <td className="py-1">{pick(r, ['net', 'cost_difference', 'cost_diff', 'difference', 'delta'])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsePanel>
        </div>

        <div className="space-y-2">
          <CollapsePanel title="SUPERVISOR ROUGH ESTIMATE" headerCls="bg-gray-600">
            <RoughEstimateTable rows={supervisorRough} />
          </CollapsePanel>
          <CollapsePanel title="SITE HEAD ROUGH ESTIMATE" headerCls="bg-gray-600">
            <RoughEstimateTable rows={siteHeadRough} />
          </CollapsePanel>
        </div>

        <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${netBarCls}`}>
          Additions {money(c?.cost_impact_additions)} — Credits {money(c?.cost_impact_deletions)} = Net{' '}
          {money(c?.cost_impact_net)}
        </div>

        <div className="text-xs text-gray-600">
          <span className={`${labelClass} text-gray-400 block`}>Coordinator</span>
          {c?.coordinator_recommendation || (c ? '—' : 'Awaiting data')}
          {c?.coordinator_recommended_at && (
            <span className="block text-gray-400 mt-0.5">{fmtDate(c.coordinator_recommended_at)}</span>
          )}
        </div>

        {showAdminPanel && c && <ScopeChangeAdminPanel change={c} adminUserId={adminUserId} />}

        {c && c.admin_decision != null && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700">{c.admin_decision}</p>
            {c.admin_remarks && <p className="text-sm mt-1 text-gray-700">{c.admin_remarks}</p>}
            <p className="text-xs mt-1 text-gray-400">Decided {fmtDate(c.admin_decided_at)}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className={`${labelClass} text-gray-400`}>Client acceptance</span>
          <Badge cls={CLIENT_ACCEPTANCE_BADGE[c?.client_acceptance ?? 'pending'] ?? CLIENT_ACCEPTANCE_BADGE.pending}>
            {c?.client_acceptance ?? 'pending'}
          </Badge>
          {c?.client_informed_at && <span className="text-xs text-gray-400">informed {fmtDate(c.client_informed_at)}</span>}
        </div>
      </div>
    </div>
  )
}

function ScopeChangeQueue({
  scopeChanges,
  clientMap,
  adminUserId,
}: {
  scopeChanges: ScopeChange[]
  clientMap: Record<string, string>
  adminUserId: string
}) {
  const pending = scopeChanges.filter((c) => c.admin_decision == null)
  const rest = scopeChanges.filter((c) => c.admin_decision != null)
  const ordered = [...pending, ...rest]

  return (
    <div className="space-y-4">
      {ordered.length === 0 ? (
        <ScopeChangeCard change={null} clientMap={clientMap} adminUserId={adminUserId} />
      ) : (
        ordered.map((c) => (
          <ScopeChangeCard key={c.id} change={c} clientMap={clientMap} adminUserId={adminUserId} />
        ))
      )}
    </div>
  )
}

// ─── TAB 3: PI Tracker ────────────────────────────────────────────────────

const PI_HEADER: Record<string, string> = {
  excellent: 'bg-green-600',
  good: 'bg-blue-600',
  average: 'bg-amber-500',
  poor: 'bg-red-600',
  blacklist_risk: 'bg-red-900',
  not_rated: 'bg-gray-500',
}

const PI_FILTERS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Worker', value: 'worker' },
  { label: 'Supervisor', value: 'supervisor' },
  { label: 'Zone', value: 'zone' },
  { label: 'Job Type', value: 'job_type' },
  { label: 'Client', value: 'client' },
]

function Trend({ value }: { value: string | null | undefined }) {
  const v = (value ?? '').toLowerCase()
  if (v === 'improving') return <span className="text-green-600 font-bold text-sm">↑ improving</span>
  if (v === 'declining') return <span className="text-red-600 font-bold text-sm">↓ declining</span>
  return <span className="text-gray-500 font-bold text-sm">→ stable</span>
}

function MetricCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  )
}

function CompletionBar({ scheduled, actual }: { scheduled: number | null; actual: number | null }) {
  const sch = scheduled == null ? 0 : Math.max(0, Math.min(100, scheduled))
  const act = actual == null ? 0 : Math.max(0, Math.min(100, actual))
  const behind = actual != null && scheduled != null && actual < scheduled
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>Scheduled {metric(scheduled)}%</span>
        <span className={behind ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>Actual {metric(actual)}%</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gray-200 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-gray-400" style={{ width: `${sch}%` }} />
        <div className={`absolute inset-y-0 left-0 ${behind ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${act}%`, opacity: 0.75 }} />
      </div>
    </div>
  )
}

function PiCard({ pi }: { pi: PiTracker | null }) {
  const p = pi
  const category = p?.pi_category || 'not_rated'
  const jobs = asRows(p?.last_5_jobs)
  const cv = p?.cost_variance
  const cvCls = cv == null ? 'text-gray-800' : num(cv) > 0 ? 'text-red-600' : num(cv) < 0 ? 'text-green-600' : 'text-gray-800'

  return (
    <div className={cardClass}>
      <div className={`px-4 py-3 text-white ${PI_HEADER[category] ?? PI_HEADER.not_rated}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge cls="bg-white/15 text-white border-white/30">{p?.tracked_identity_type ?? '—'}</Badge>
              {p?.trade && <Badge cls="bg-white/15 text-white border-white/30">{p.trade}</Badge>}
              {p?.skill_level && <Badge cls="bg-white/15 text-white border-white/30">{p.skill_level}</Badge>}
            </div>
            {p?.city_of_zone && <p className="text-xs text-white/80">{p.city_of_zone}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold leading-none">
              {metric(p?.pi_score)}
              <span className="text-xs font-normal text-white/70"> /100</span>
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-xs">
            <Trend value={p?.pi_trend} />
          </span>
          <Badge cls="bg-white/15 text-white border-white/30">{category}</Badge>
          {p?.scoring_formula_version && (
            <Badge cls="bg-white/15 text-white border-white/30">Formula v{p.scoring_formula_version}</Badge>
          )}
          <span className="text-xs text-white/80">{fmtDate(p?.pi_calculated_at)}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!p && <p className="text-sm text-gray-400 text-center">No PI data yet</p>}

        <CompletionBar scheduled={p?.scheduled_completion_pct ?? null} actual={p?.actual_completion_pct ?? null} />

        <div className="grid grid-cols-3 gap-2">
          <MetricCell label="Cost Variance" value={p ? <span className={cvCls}>{money(p.cost_variance)}</span> : '—'} />
          <MetricCell label="Quality Score" value={metric(p?.quality_score)} />
          <MetricCell label="Client Satisfaction" value={metric(p?.client_satisfaction_score)} />
          <MetricCell label="Worker Performance" value={metric(p?.worker_performance_score)} />
          <MetricCell label="Zone Performance" value={metric(p?.zone_performance_score)} />
          <MetricCell label="Milestone Adherence" value={metric(p?.milestone_adherence_score)} />
          <MetricCell label="Payment Timeliness" value={metric(p?.payment_release_timeliness)} />
        </div>

        <div className="flex flex-wrap gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600">
          <span>Rework: {num(p?.rework_count)}</span>
          <span className="text-gray-300">|</span>
          <span>Decision 5: {num(p?.decision_5_count)}</span>
          <span className="text-gray-300">|</span>
          <span>Escalations: {num(p?.escalation_count)}</span>
          <span className="text-gray-300">|</span>
          <span>Safety: {num(p?.safety_incident_count)}</span>
          <span className="text-gray-300">|</span>
          <span>Methodology: {num(p?.methodology_revision_count)}</span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
          <span>Total jobs: <b>{num(p?.total_jobs_in_period)}</b></span>
          <span>On time: <b>{num(p?.on_time_completion_count)}</b></span>
          <span>Within budget: <b>{num(p?.within_budget_count)}</b></span>
          <span>Complaints: <b>{num(p?.client_complaint_count)}</b></span>
        </div>

        <details className="rounded-lg border border-gray-200 overflow-hidden">
          <summary className="list-none cursor-pointer px-3 py-2 text-xs font-bold text-white bg-[#1F3864]">
            LAST 5 JOBS
          </summary>
          <div className="p-3 bg-white">
            {jobs.length === 0 ? (
              <p className="text-xs text-gray-400">No job history recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider">
                      <th className="py-1 pr-2 font-semibold">Job Ref</th>
                      <th className="py-1 pr-2 font-semibold">Job Type</th>
                      <th className="py-1 pr-2 font-semibold">Zone</th>
                      <th className="py-1 pr-2 font-semibold">Quality</th>
                      <th className="py-1 font-semibold">Client Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 text-gray-700">
                        <td className="py-1 pr-2">{pick(r, ['job_ref', 'booking_ref', 'ref', 'job_id'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['job_type', 'type'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['zone', 'city_of_zone', 'city'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['quality', 'quality_score'])}</td>
                        <td className="py-1">{pick(r, ['client_rating', 'client_satisfaction', 'rating'])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          {p?.historic_period && <Badge cls="bg-gray-100 text-gray-600 border-gray-200">{p.historic_period}</Badge>}
          <span className="text-xs text-gray-400">Recalculated: {fmtDate(p?.score_last_recalculated_at)}</span>
        </div>
        {p?.pi_remarks && <p className="text-xs text-gray-600">{p.pi_remarks}</p>}
      </div>
    </div>
  )
}

function PiQueue({ piTrackers }: { piTrackers: PiTracker[] }) {
  const [filter, setFilter] = useState<string | null>(null)

  const filtered =
    filter == null
      ? piTrackers
      : piTrackers.filter((p) => (p.tracked_identity_type ?? '').toLowerCase().replace(/\s+/g, '_') === filter)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {PI_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f.value
                ? 'bg-[#1F3864] text-white'
                : 'bg-white text-[#1F3864] border border-[#1F3864] hover:bg-[#1F3864]/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <PiCard pi={null} />
        ) : (
          filtered.map((p) => <PiCard key={p.id} pi={p} />)
        )}
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────

export default function ScopeTabs({
  assessments,
  scopeChanges,
  piTrackers,
  clientMap,
  adminUserId,
}: {
  assessments: Assessment[]
  scopeChanges: ScopeChange[]
  piTrackers: PiTracker[]
  clientMap: Record<string, string>
  adminUserId: string
}) {
  const [tab, setTab] = useState<'assessments' | 'changes' | 'pi'>('assessments')

  const pendingAssessments = assessments.filter(
    (a) => a.supervisor_flagged_to_admin === true && a.admin_decision == null
  ).length
  const pendingChanges = scopeChanges.filter((c) => c.admin_decision == null).length

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <NavyPill active={tab === 'assessments'} onClick={() => setTab('assessments')} count={pendingAssessments}>
          Pre-Delivery Assessment Queue
        </NavyPill>
        <NavyPill active={tab === 'changes'} onClick={() => setTab('changes')} count={pendingChanges}>
          Scope Change Requests
        </NavyPill>
        <NavyPill active={tab === 'pi'} onClick={() => setTab('pi')}>
          PI Tracker
        </NavyPill>
      </div>

      {tab === 'assessments' && <AssessmentQueue assessments={assessments} adminUserId={adminUserId} />}
      {tab === 'changes' && (
        <ScopeChangeQueue scopeChanges={scopeChanges} clientMap={clientMap} adminUserId={adminUserId} />
      )}
      {tab === 'pi' && <PiQueue piTrackers={piTrackers} />}
    </div>
  )
}
