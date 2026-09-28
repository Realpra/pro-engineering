'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  adminAcknowledgeInstruction,
  adminIssueDirective,
  adminDecideOnLog,
  adminApprovePenalty,
  adminWaivePenalty,
  type ReportActionResult,
  type DirectiveInput,
} from './actions'

// ─── Types ─────────────────────────────────────────────────────────────────

export type Instruction = {
  id: string
  instruction_number: string | null
  subject: string | null
  booking_ref: string | null
  client_ref: string | null
  instruction_type: string | null
  instruction_text: string | null
  target_audience: string | null
  target_roles: string[] | null
  policy_reference: string | null
  effective_from: string | null
  expiry_date: string | null
  trade: string | null
  skill_level: string | null
  job_type: string | null
  zone: string | null
  sector: string | null
  methodology_steps: unknown
  revised_machine_tools: string | null
  revised_material: string | null
  revised_method: string | null
  old_method_reference: string | null
  supersedes_instruction_id: string | null
  copy_to_super_admin: boolean | null
  directive_target_role: string | null
  priority: string | null
  directive_priority: string | null
  directive_type: string | null
  acknowledgement_required: boolean | null
  acknowledgement_deadline: string | null
  acknowledged_count: number | string | null
  admin_acknowledged_at: string | null
  admin_directive_text: string | null
  issued_by: string | null
  issued_at: string | null
  status: string | null
  [key: string]: unknown
}

export type AuditLog = {
  id: string
  instruction_number: string | null
  booking_ref: string | null
  concern_id: string | null
  actor_id: string | null
  actor_role: string | null
  action: string | null
  timestamp: string | null
  notes: string | null
  instruction_type: string | null
  instruction_text: string | null
  trade: string | null
  skill_level: string | null
  job_type: string | null
  target_role: string | null
  priority: string | null
  copy_to_super_admin: boolean | null
  [key: string]: unknown
}

export type SiteLog = {
  id: string
  instruction_number: string | null
  job_id: string | null
  booking_ref: string | null
  zone: string | null
  supervisor_id: string | null
  log_date: string | null
  log_type: string | null
  planned_scope: string | null
  materials_delivered: boolean | null
  materials_description: string | null
  scope_completed: string | null
  crew_attendance: { worker_id: string; name: string; trade: string; status: 'present' | 'absent' | 'late' }[] | null
  weather_condition: string | null
  deviation_from_plan: boolean | null
  deviation_description: string | null
  deviation_reason: string | null
  issue_reported: boolean | null
  issue_description: string | null
  evening_photo_url: string | null
  submitted_at: string | null
  instruction_type: string | null
  instruction_text: string | null
  trade: string | null
  skill_level: string | null
  decision_on_log: string | null
  decision_by: string | null
  decision_at: string | null
  decision_remarks: string | null
  escalate_to_admin: boolean | null
  [key: string]: unknown
}

export type WastageLog = {
  id: string
  booking_ref: string | null
  job_card_type: string | null
  wastage_date: string | null
  calendar_day: string | number | null
  trade_group: string | null
  resource_type: string | null
  resource_count: number | string | null
  idle_hours: number | string | null
  hourly_rate: number | string | null
  idle_cost_impact: number | string | null
  wastage_reason: string | null
  wastage_category: string | null
  evidence_description: string | null
  supervisor_id: string | null
  coordinator_notified: boolean | null
  penalty_applicable: boolean | null
  penalty_amount: number | string | null
  penalty_approved_by: string | null
  penalty_approved_at: string | null
  dispute_raised: boolean | null
  dispute_resolution: string | null
  platform_remarks: string | null
  [key: string]: unknown
}

export type PiTracker = {
  id: string
  tracked_identity_type: string | null
  tracked_identity_id: string | null
  trade: string | null
  skill_level: string | null
  city_of_zone: string | null
  last_5_jobs: unknown
  pi_score: number | string | null
  pi_category: string | null
  pi_trend: string | null
  scoring_formula_version: string | null
  pi_calculated_at: string | null
  pi_remarks: string | null
  historic_period: string | null
  scheduled_completion_pct: number | string | null
  actual_completion_pct: number | string | null
  cost_variance: number | string | null
  quality_score: number | string | null
  client_satisfaction_score: number | string | null
  worker_performance_score: number | string | null
  zone_performance_score: number | string | null
  milestone_adherence_score: number | string | null
  payment_release_timeliness: number | string | null
  rework_count: number | string | null
  decision_5_count: number | string | null
  escalation_count: number | string | null
  safety_incident_count: number | string | null
  methodology_revision_count: number | string | null
  total_jobs_in_period: number | string | null
  on_time_completion_count: number | string | null
  within_budget_count: number | string | null
  client_complaint_count: number | string | null
  score_last_recalculated_at: string | null
  [key: string]: unknown
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isErr(res: ReportActionResult): res is { error: string } {
  return 'error' in res
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(v: unknown): string {
  return `₹${num(v).toLocaleString('en-IN')}`
}

function s(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function fmtDate(v: unknown): string {
  const t = s(v)
  if (!t) return '—'
  const d = new Date(t.length <= 10 ? `${t}T00:00:00` : t)
  if (Number.isNaN(d.getTime())) return t
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(v: unknown): string {
  const t = s(v)
  if (!t) return '—'
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return t
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Shared UI ─────────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const primaryBtn = 'px-4 py-2 rounded-lg text-xs font-bold bg-[#1F3864] text-white hover:bg-[#16305a] disabled:opacity-50'
const ghostBtn = 'px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
const tag = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200'
const searchInp =
  'border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <p className="text-xs text-red-600">{msg}</p>
}

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
        active ? 'bg-[#1F3864] text-white' : 'bg-white text-[#1F3864] border border-[#1F3864] hover:bg-[#1F3864]/5'
      }`}
    >
      {children}
    </button>
  )
}

function ColorTag({ text, color }: { text: string; color: 'orange' | 'blue' | 'gray' }) {
  const cls =
    color === 'orange'
      ? 'bg-orange-100 text-orange-700 border-orange-200'
      : color === 'blue'
        ? 'bg-blue-100 text-blue-700 border-blue-200'
        : 'bg-gray-100 text-gray-600 border-gray-200'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{text}</span>
}

function CountBadge({ n, active }: { n: number; active: boolean }) {
  if (n <= 0) return null
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${
        active ? 'bg-white text-[#F97316]' : 'bg-[#F97316] text-white'
      }`}
    >
      {n}
    </span>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
      <p className="text-sm text-gray-400">{msg}</p>
    </div>
  )
}

function InstructionNumberBadge({ v }: { v: string | null }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#1F3864] text-white">
      {v || 'Number pending'}
    </span>
  )
}

const TYPE_COLORS: Record<string, string> = {
  safety_critical: 'bg-red-100 text-red-700 border border-red-200',
  methodology: 'bg-blue-100 text-blue-700 border border-blue-200',
  general_policy: 'bg-[#1F3864]/10 text-[#1F3864] border border-[#1F3864]/30',
  business_policy: 'bg-teal-100 text-teal-700 border border-teal-200',
  quality: 'bg-green-100 text-green-700 border border-green-200',
  general: 'bg-gray-100 text-gray-600 border border-gray-200',
}

function TypeBadge({ v }: { v: string | null }) {
  if (!v) return null
  const cls = TYPE_COLORS[v] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{v}</span>
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  high: 'bg-orange-100 text-orange-700 border border-orange-200',
  medium: 'bg-gray-100 text-gray-600 border border-gray-200',
  low: 'bg-green-100 text-green-700 border border-green-200',
}

function PriorityBadge({ v }: { v: string | null }) {
  if (!v) return null
  const cls = PRIORITY_COLORS[v.toLowerCase()] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{v}</span>
}

// ─── Instruction card (Tabs 1 / 2 / 3) ────────────────────────────────────

function InstructionCard({
  ins,
  adminUserId,
  showAcknowledge,
  showMethodology,
}: {
  ins: Instruction
  adminUserId: string
  showAcknowledge: boolean
  showMethodology: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function acknowledge() {
    setBusy(true)
    setError(null)
    const res = await adminAcknowledgeInstruction(ins.id, adminUserId)
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  const steps = list(ins.methodology_steps)
  const title = ins.subject || (ins.instruction_text ? ins.instruction_text.slice(0, 50) : '—')
  const targetRoles = Array.isArray(ins.target_roles) ? ins.target_roles : []

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] px-4 py-3 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <InstructionNumberBadge v={ins.instruction_number} />
          {ins.copy_to_super_admin && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white shrink-0">
              CC: Super Admin
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge v={ins.instruction_type} />
          <PriorityBadge v={ins.priority} />
        </div>
        <p className="text-white font-bold text-sm leading-tight">{title}</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {ins.instruction_text && <p className="text-sm text-gray-800">{ins.instruction_text}</p>}
        {ins.admin_directive_text && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-0.5">Admin Directive</p>
            <p className="text-sm text-blue-900">{ins.admin_directive_text}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {ins.target_audience && <Cell label="Target Audience" value={ins.target_audience} />}
          {ins.booking_ref && <Cell label="Booking Ref" value={ins.booking_ref} />}
          {ins.client_ref && <Cell label="Client Ref" value={ins.client_ref} />}
          {ins.directive_type && <Cell label="Directive Type" value={ins.directive_type} />}
          {ins.effective_from && <Cell label="Effective From" value={fmtDate(ins.effective_from)} />}
          {ins.expiry_date && <Cell label="Expiry" value={fmtDate(ins.expiry_date)} />}
          {ins.policy_reference && <Cell label="Policy Reference" value={ins.policy_reference} />}
          {ins.issued_at && <Cell label="Issued" value={fmtDateTime(ins.issued_at)} />}
        </div>

        {(ins.trade || ins.skill_level || ins.job_type) && (
          <div className="flex flex-wrap gap-1.5">
            {ins.trade && <ColorTag text={ins.trade} color="orange" />}
            {ins.skill_level && <ColorTag text={ins.skill_level} color="blue" />}
            {ins.job_type && <ColorTag text={ins.job_type} color="gray" />}
          </div>
        )}

        {targetRoles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {targetRoles.map((r) => (
              <span key={r} className={tag}>→ {r}</span>
            ))}
          </div>
        )}

        {ins.acknowledgement_required && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
              Acknowledgement Required
            </span>
            {ins.acknowledgement_deadline && (
              <span className="text-xs text-gray-500">by {fmtDateTime(ins.acknowledgement_deadline)}</span>
            )}
          </div>
        )}

        {showMethodology && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1F3864]">Methodology</p>
            {steps.length > 0 && (
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                {steps.map((st, i) => {
                  const r = rec(st)
                  const text = typeof st === 'string' ? st : s(r.step) || s(r.text) || s(r.description) || JSON.stringify(st)
                  return <li key={i}>{text}</li>
                })}
              </ol>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Revised Machine / Tools</p>
                <p className="text-sm text-gray-800">{ins.revised_machine_tools ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Revised Material</p>
                <p className="text-sm text-gray-800">{ins.revised_material ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Revised Method</p>
                <p className="text-sm text-gray-800">{ins.revised_method ?? '—'}</p>
              </div>
            </div>
            {(ins.old_method_reference || ins.supersedes_instruction_id) && (
              <p className="text-xs text-gray-500">
                {ins.old_method_reference && <>Old method: {ins.old_method_reference}. </>}
                {ins.supersedes_instruction_id && <>Supersedes: {ins.supersedes_instruction_id}</>}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Acknowledged by {ins.acknowledged_count != null ? num(ins.acknowledged_count) : 0} recipient
          {num(ins.acknowledged_count) === 1 ? '' : 's'}
        </p>

        {ins.admin_acknowledged_at ? (
          <p className="text-xs text-green-700">Acknowledged {fmtDateTime(ins.admin_acknowledged_at)}</p>
        ) : (
          showAcknowledge && (
            <button
              type="button"
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              disabled={busy}
              onClick={acknowledge}
            >
              {busy ? 'Working…' : 'ACKNOWLEDGE'}
            </button>
          )
        )}
        <Err msg={error} />
      </div>
    </div>
  )
}

// ─── TAB 1: Safety Critical & Policy Inbox ────────────────────────────────

const INBOX_TYPES = [
  'safety_critical',
  'method_improvement',
  'payment_policy',
  'methodology',
  'general_policy',
  'business_policy',
  'quality',
  'general',
  'admin',
  // Supervisor Dashboard's SOS button (28 Sep 2026) -- confirmed via a real
  // live insert that this row reached issued_to correctly but was invisible
  // in this inbox since 'sos' was never added to this filter.
  'sos',
]

const INBOX_FILTERS: { key: string; label: string; types: string[] | null }[] = [
  { key: 'all', label: 'All', types: null },
  { key: 'sos', label: 'SOS', types: ['sos'] },
  { key: 'safety', label: 'Safety Critical', types: ['safety_critical'] },
  { key: 'method', label: 'Method Improvement', types: ['method_improvement'] },
  { key: 'policy', label: 'Policy', types: ['payment_policy', 'general_policy', 'business_policy'] },
  { key: 'quality', label: 'Quality', types: ['quality'] },
  { key: 'general', label: 'General', types: ['general'] },
]

function SafetyInboxTab({ instructions, adminUserId }: { instructions: Instruction[]; adminUserId: string }) {
  const [filter, setFilter] = useState('all')
  const base = instructions.filter((i) => INBOX_TYPES.includes(i.instruction_type ?? ''))
  const active = INBOX_FILTERS.find((f) => f.key === filter) ?? INBOX_FILTERS[0]
  const shown = active.types == null ? base : base.filter((i) => active.types!.includes(i.instruction_type ?? ''))

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {INBOX_FILTERS.map((f) => (
          <Pill key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Pill>
        ))}
      </div>
      {shown.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((i) => (
            <InstructionCard key={i.id} ins={i} adminUserId={adminUserId} showAcknowledge showMethodology={false} />
          ))}
        </div>
      ) : (
        <EmptyState msg="No instructions" />
      )}
    </div>
  )
}

// ─── TAB 2: Methodology Reports ──────────────────────────────────────────

function MethodologyTab({ instructions, adminUserId }: { instructions: Instruction[]; adminUserId: string }) {
  const shown = instructions.filter((i) => i.instruction_type === 'methodology')
  if (shown.length === 0) {
    return <EmptyState msg="No methodology reports" />
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {shown.map((i) => (
        <InstructionCard key={i.id} ins={i} adminUserId={adminUserId} showAcknowledge showMethodology />
      ))}
    </div>
  )
}

// ─── TAB 3: Directives Issued ───────────────────────────────────────────

const INSTRUCTION_TYPE_OPTIONS: { value: string; label: string; code: string }[] = [
  { value: 'admin', label: 'Admin', code: 'ADM' },
  { value: 'safety_critical', label: 'Safety', code: 'SAF' },
  { value: 'quality', label: 'Quality', code: 'QUA' },
  { value: 'general_policy', label: 'Policy', code: 'POL' },
  { value: 'business_policy', label: 'Business Policy', code: 'BUS' },
  { value: 'methodology', label: 'Methodology', code: 'MET' },
  { value: 'method_improvement', label: 'Method Improvement', code: 'IMP' },
  { value: 'payment_policy', label: 'Payment Policy', code: 'PAY' },
  { value: 'general', label: 'General', code: 'GEN' },
]

const TARGET_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'sub_coordinator', label: 'Sub-Coordinator' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'site_head', label: 'Site Head' },
  { value: 'zone_head', label: 'Zone Head' },
  { value: 'all', label: 'All' },
]

const DIRECTIVE_PRIORITIES: { value: string; label: string }[] = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'within_24hrs', label: 'Within 24hrs' },
  { value: 'within_week', label: 'Within Week' },
]

const SKILL_LEVELS = ['unskilled', 'semi_skilled', 'skilled', 'highly_skilled']
const SECTOR_OPTIONS = [
  'civil', 'mep', 'interior', 'false_roofing', 'painting', 'wood_work', 'architecture', 'construction_pmc',
]

function IssueDirectiveForm({ adminUserId, onDone }: { adminUserId: string; onDone: () => void }) {
  const [typeValue, setTypeValue] = useState('general')
  const [subject, setSubject] = useState('')
  const [instructionText, setInstructionText] = useState('')
  const [adminDirectiveText, setAdminDirectiveText] = useState('')
  const [targetRoles, setTargetRoles] = useState<string[]>(['all'])
  const [targetAudience, setTargetAudience] = useState('')
  const [directivePriority, setDirectivePriority] = useState('within_week')
  const [directiveType, setDirectiveType] = useState('')
  const [trade, setTrade] = useState('')
  const [skill_level, setSkillLevel] = useState('skilled')
  const [jobType, setJobType] = useState('')
  const [zone, setZone] = useState('')
  const [sector, setSector] = useState('civil')
  const [policyReference, setPolicyReference] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [ackRequired, setAckRequired] = useState(false)
  const [ackDeadline, setAckDeadline] = useState('')
  const [ccSuperAdmin, setCcSuperAdmin] = useState(false)
  const [bookingRef, setBookingRef] = useState('')
  const [clientRef, setClientRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleRole(v: string) {
    setTargetRoles((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  async function save() {
    setBusy(true)
    setError(null)
    const categoryCode = INSTRUCTION_TYPE_OPTIONS.find((t) => t.value === typeValue)?.code ?? 'GEN'
    const payload: DirectiveInput = {
      booking_ref: bookingRef,
      client_ref: clientRef,
      instruction_type: typeValue,
      subject,
      instruction_text: instructionText,
      admin_directive_text: adminDirectiveText,
      target_roles: targetRoles,
      target_audience: targetAudience,
      directive_priority: directivePriority,
      directive_type: directiveType,
      trade,
      skill_level: skill_level,
      job_type: jobType,
      zone,
      sector,
      policy_reference: policyReference,
      effective_from: effectiveFrom,
      expiry_date: expiryDate,
      acknowledgement_required: ackRequired,
      acknowledgement_deadline: ackRequired ? ackDeadline : '',
      copy_to_super_admin: ccSuperAdmin,
    }
    const res = await adminIssueDirective(adminUserId, categoryCode, payload)
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Instruction Type</span>
        <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
          {INSTRUCTION_TYPE_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTypeValue(t.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                typeValue === t.value ? 'bg-[#1F3864] text-white' : 'bg-white text-[#1F3864] border border-[#1F3864]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Subject">
        <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Instruction Text">
        <textarea rows={3} className={`${inputClass} resize-none`} value={instructionText} onChange={(e) => setInstructionText(e.target.value)} />
      </Field>
      <Field label="Admin Directive Text">
        <textarea rows={3} className={`${inputClass} resize-none`} value={adminDirectiveText} onChange={(e) => setAdminDirectiveText(e.target.value)} />
      </Field>

      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Target Roles</span>
        <div className="mt-1 flex flex-wrap gap-3">
          {TARGET_ROLE_OPTIONS.map((r) => (
            <label key={r.value} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={targetRoles.includes(r.value)} onChange={() => toggleRole(r.value)} />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Target Audience">
          <input className={inputClass} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
        </Field>
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Directive Priority</span>
          <div className="mt-1 flex gap-2">
            {DIRECTIVE_PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setDirectivePriority(p.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  directivePriority === p.value ? 'bg-[#1F3864] text-white' : 'bg-white text-[#1F3864] border border-[#1F3864]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Directive Type">
          <input className={inputClass} value={directiveType} onChange={(e) => setDirectiveType(e.target.value)} />
        </Field>
        <Field label="Trade">
          <input className={inputClass} value={trade} onChange={(e) => setTrade(e.target.value)} />
        </Field>
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Skill Level</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {SKILL_LEVELS.map((sl) => (
              <button
                key={sl}
                type="button"
                onClick={() => setSkillLevel(sl)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  skill_level === sl ? 'bg-[#1F3864] text-white' : 'bg-white text-[#1F3864] border border-[#1F3864]'
                }`}
              >
                {sl}
              </button>
            ))}
          </div>
        </div>
        <Field label="Job Type">
          <input className={inputClass} value={jobType} onChange={(e) => setJobType(e.target.value)} />
        </Field>
        <Field label="Zone">
          <input className={inputClass} value={zone} onChange={(e) => setZone(e.target.value)} />
        </Field>
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sector</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {SECTOR_OPTIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setSector(sec)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  sector === sec ? 'bg-[#1F3864] text-white' : 'bg-white text-[#1F3864] border border-[#1F3864]'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>
        <Field label="Policy Reference">
          <input className={inputClass} value={policyReference} onChange={(e) => setPolicyReference(e.target.value)} />
        </Field>
        <Field label="Booking Ref (optional)">
          <input className={inputClass} value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} />
        </Field>
        <Field label="Client Ref (optional)">
          <input className={inputClass} value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
        </Field>
        <Field label="Effective From">
          <input type="date" className={inputClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
        <Field label="Expiry Date">
          <input type="date" className={inputClass} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={ackRequired} onChange={(e) => setAckRequired(e.target.checked)} />
          Acknowledgement Required
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={ccSuperAdmin} onChange={(e) => setCcSuperAdmin(e.target.checked)} />
          Copy to Super Admin
        </label>
      </div>
      {ackRequired && (
        <Field label="Acknowledgement Deadline">
          <input type="datetime-local" className={inputClass} value={ackDeadline} onChange={(e) => setAckDeadline(e.target.value)} />
        </Field>
      )}

      <div className="flex items-center gap-2">
        <button type="button" className={primaryBtn} disabled={busy || !instructionText.trim()} onClick={save}>
          {busy ? 'Saving…' : 'SAVE'}
        </button>
        <button type="button" className={ghostBtn} onClick={onDone}>
          Cancel
        </button>
        <Err msg={error} />
      </div>
    </div>
  )
}

function DirectivesTab({ instructions, adminUserId }: { instructions: Instruction[]; adminUserId: string }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const shown = instructions.filter((i) => i.issued_by === adminUserId)

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className={primaryBtn} onClick={() => setCreating((c) => !c)}>
          {creating ? 'Cancel' : 'ISSUE NEW DIRECTIVE'}
        </button>
      </div>
      {creating && (
        <IssueDirectiveForm
          adminUserId={adminUserId}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
        />
      )}
      {shown.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((i) => (
            <InstructionCard key={i.id} ins={i} adminUserId={adminUserId} showAcknowledge={false} showMethodology={false} />
          ))}
        </div>
      ) : (
        <EmptyState msg="No directives issued" />
      )}
    </div>
  )
}

// ─── TAB 4: Milestone Audit Log ─────────────────────────────────────────

function ConcernAuditList({ auditLogs }: { auditLogs: AuditLog[] }) {
  if (auditLogs.length === 0) {
    return <EmptyState msg="No audit log entries" />
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
      {auditLogs.map((a) => (
        <div key={a.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <InstructionNumberBadge v={a.instruction_number} />
            <span>{fmtDateTime(a.timestamp)}</span>
            {a.actor_role && <span className={tag}>{a.actor_role}</span>}
            <span className="font-semibold text-gray-800">{a.action ?? '—'}</span>
            <PriorityBadge v={a.priority} />
            {a.copy_to_super_admin && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                CC: Super Admin
              </span>
            )}
          </div>
          {a.booking_ref && <p className="mt-1 text-xs text-gray-500">Booking: {a.booking_ref}</p>}
          {a.notes && <p className="mt-1 text-sm text-gray-700">{a.notes}</p>}
          {a.instruction_text && <p className="mt-1 text-sm text-gray-600">{a.instruction_text}</p>}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {a.instruction_type && <span className={tag}>{a.instruction_type}</span>}
            {a.trade && <ColorTag text={a.trade} color="orange" />}
            {a.skill_level && <ColorTag text={a.skill_level} color="blue" />}
            {a.job_type && <ColorTag text={a.job_type} color="gray" />}
            {a.target_role && <span className={tag}>→ {a.target_role}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function SiteLogCard({ log, adminUserId }: { log: SiteLog; adminUserId: string }) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | 'approve' | 'flag'>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: string) {
    setBusy(true)
    setError(null)
    const res = await adminDecideOnLog(log.id, adminUserId, decision, remarks.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setPanel(null)
    setRemarks('')
    router.refresh()
  }

  const canDecide = !log.decision_on_log && log.escalate_to_admin === true
  // workers_present/workers_planned/deviation_found don't exist under those
  // names anywhere in daily_site_logs -- real data sits in crew_attendance
  // (a per-worker JSONB array) and deviation_from_plan. Previously this whole
  // block always read undefined and silently showed "— / —" / never rendered.
  const crew = Array.isArray(log.crew_attendance) ? log.crew_attendance : []
  const workersPresent = crew.filter(c => c.status === 'present' || c.status === 'late').length
  const workersPlanned = crew.length

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {log.escalate_to_admin && (
        <div className="bg-orange-500 text-white text-xs font-bold px-4 py-2">Escalated to Admin</div>
      )}
      <div className="px-4 py-4 space-y-3">
        {log.instruction_number && <InstructionNumberBadge v={log.instruction_number} />}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Cell label="Log Date" value={fmtDate(log.log_date)} />
          <Cell label="Log Type" value={log.log_type ?? '—'} />
          <Cell label="Supervisor" value={log.supervisor_id ?? '—'} />
          {log.zone && <Cell label="Zone" value={log.zone} />}
          {log.booking_ref && <Cell label="Booking Ref" value={log.booking_ref} />}
          {log.trade && <Cell label="Trade" value={log.trade} />}
          {log.skill_level && <Cell label="Skill Level" value={log.skill_level} />}
          {crew.length > 0 && (
            <Cell
              label="Workers Present / Planned"
              value={`${workersPresent} / ${workersPlanned}`}
            />
          )}
          {log.weather_condition && <Cell label="Weather" value={log.weather_condition} />}
        </div>

        {log.planned_scope && <Cell label="Planned Scope" value={log.planned_scope} />}
        {log.scope_completed && <Cell label="Scope Completed" value={log.scope_completed} />}
        {log.deviation_from_plan && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-0.5">Deviation</p>
            <p className="text-sm text-amber-900">{log.deviation_description ?? '—'}</p>
            {log.deviation_reason && <p className="text-xs text-amber-700 mt-0.5">Reason: {log.deviation_reason}</p>}
          </div>
        )}
        {log.issue_reported && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-0.5">Issue Reported</p>
            <p className="text-sm text-red-900">{log.issue_description ?? '—'}</p>
          </div>
        )}
        {log.instruction_text && <Cell label="Instruction" value={log.instruction_text} />}

        {log.decision_on_log ? (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
              Decision: {log.decision_on_log}
            </p>
            {log.decision_remarks && <p className="text-sm text-gray-700">{log.decision_remarks}</p>}
            {log.decision_at && <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(log.decision_at)}</p>}
          </div>
        ) : (
          canDecide && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700"
                  onClick={() => setPanel((p) => (p === 'approve' ? null : 'approve'))}
                >
                  APPROVE LOG
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700"
                  onClick={() => setPanel((p) => (p === 'flag' ? null : 'flag'))}
                >
                  FLAG FOR ACTION
                </button>
              </div>
              {panel && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Decision remarks…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    className={primaryBtn}
                    disabled={busy || !remarks.trim()}
                    onClick={() => decide(panel === 'approve' ? 'approved' : 'flagged')}
                  >
                    {busy ? 'Working…' : panel === 'approve' ? 'CONFIRM APPROVE' : 'CONFIRM FLAG'}
                  </button>
                  <Err msg={error} />
                </div>
              )}
            </div>
          )
        )}
        {!panel && <Err msg={error} />}
      </div>
    </div>
  )
}

function AuditLogTab({
  auditLogs,
  siteLogs,
  adminUserId,
}: {
  auditLogs: AuditLog[]
  siteLogs: SiteLog[]
  adminUserId: string
}) {
  const [sub, setSub] = useState<'concern' | 'site'>('concern')
  const orderedSiteLogs = useMemo(() => {
    const esc = siteLogs.filter((l) => l.escalate_to_admin === true)
    const rest = siteLogs.filter((l) => l.escalate_to_admin !== true)
    return [...esc, ...rest]
  }, [siteLogs])

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Pill active={sub === 'concern'} onClick={() => setSub('concern')}>
          Concern Audit
        </Pill>
        <Pill active={sub === 'site'} onClick={() => setSub('site')}>
          Site Logs
        </Pill>
      </div>
      {sub === 'concern' ? (
        <ConcernAuditList auditLogs={auditLogs} />
      ) : orderedSiteLogs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orderedSiteLogs.map((l) => (
            <SiteLogCard key={l.id} log={l} adminUserId={adminUserId} />
          ))}
        </div>
      ) : (
        <EmptyState msg="No site logs" />
      )}
    </div>
  )
}

// ─── TAB 5: Client Wastage Log ─────────────────────────────────────────

function WastageCard({
  w,
  clientName,
  adminUserId,
}: {
  w: WastageLog
  clientName: string
  adminUserId: string
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | 'approve'>(null)
  const [amount, setAmount] = useState(String(w.penalty_amount ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<ReportActionResult>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setPanel(null)
    router.refresh()
  }

  const pendingPenalty = w.penalty_approved_at == null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-800">{w.booking_ref ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">{clientName || '—'}</p>
        </div>
        <p className="text-lg font-bold text-gray-800 shrink-0">{money(w.idle_cost_impact)}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <Cell label="Wastage Date" value={fmtDate(w.wastage_date)} />
        <Cell label="Calendar Day" value={s(w.calendar_day) || '—'} />
        <Cell label="Resource Type" value={w.resource_type ?? '—'} />
        <Cell label="Resource Count" value={s(w.resource_count) || '—'} />
        <Cell label="Idle Hours" value={s(w.idle_hours) || '—'} />
        <Cell label="Hourly Rate" value={money(w.hourly_rate)} />
      </div>
      {w.trade_group && (
        <div className="mt-2">
          <ColorTag text={w.trade_group} color="orange" />
        </div>
      )}

      {w.wastage_reason && <p className="mt-2 text-sm text-gray-700">{w.wastage_reason}</p>}
      {w.evidence_description && <p className="mt-1 text-xs text-gray-500 italic">{w.evidence_description}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {w.wastage_category && <span className={tag}>{w.wastage_category}</span>}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            w.penalty_applicable
              ? 'bg-red-100 text-red-700 border border-red-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {w.penalty_applicable ? 'Penalty Applicable' : 'No Penalty'}
        </span>
        {w.penalty_amount != null && s(w.penalty_amount) !== '' && (
          <span className={tag}>{money(w.penalty_amount)}</span>
        )}
        {w.dispute_raised && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
            Dispute Raised
          </span>
        )}
      </div>

      {w.platform_remarks && <p className="mt-2 text-xs text-gray-500">{w.platform_remarks}</p>}

      {pendingPenalty && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700"
              onClick={() => setPanel((p) => (p === 'approve' ? null : 'approve'))}
            >
              APPROVE PENALTY
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
              disabled={busy}
              onClick={() => run(() => adminWaivePenalty(w.id, adminUserId))}
            >
              {busy ? 'Working…' : 'WAIVE PENALTY'}
            </button>
          </div>
          {panel === 'approve' && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-2">
              <input
                type="number"
                className={inputClass}
                placeholder="Penalty amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white disabled:opacity-50"
                disabled={busy || amount === ''}
                onClick={() => run(() => adminApprovePenalty(w.id, adminUserId, num(amount)))}
              >
                {busy ? 'Working…' : 'CONFIRM PENALTY'}
              </button>
            </div>
          )}
          <Err msg={error} />
        </div>
      )}
    </div>
  )
}

function WastageTab({
  wastageLogs,
  clientMap,
  adminUserId,
}: {
  wastageLogs: WastageLog[]
  clientMap: Record<string, string>
  adminUserId: string
}) {
  const [bookingRef, setBookingRef] = useState('')
  const [tradeGroup, setTradeGroup] = useState('')
  const [category, setCategory] = useState('')

  const shown = wastageLogs.filter((w) => {
    if (bookingRef && !(w.booking_ref ?? '').toLowerCase().includes(bookingRef.toLowerCase())) return false
    if (tradeGroup && !(w.trade_group ?? '').toLowerCase().includes(tradeGroup.toLowerCase())) return false
    if (category && !(w.wastage_category ?? '').toLowerCase().includes(category.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4 grid gap-3 sm:grid-cols-3">
        <input className={searchInp} placeholder="Booking ref" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} />
        <input className={searchInp} placeholder="Trade group" value={tradeGroup} onChange={(e) => setTradeGroup(e.target.value)} />
        <input className={searchInp} placeholder="Wastage category" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      {shown.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((w) => (
            <WastageCard
              key={w.id}
              w={w}
              clientName={clientMap[w.booking_ref ?? ''] ?? '—'}
              adminUserId={adminUserId}
            />
          ))}
        </div>
      ) : (
        <EmptyState msg="No wastage log entries" />
      )}
    </div>
  )
}

// ─── TAB 6: PI Tracker ─────────────────────────────────────────────────

const PI_FILTERS: { key: string; label: string; type: string | null }[] = [
  { key: 'all', label: 'All', type: null },
  { key: 'worker', label: 'Worker', type: 'worker' },
  { key: 'supervisor', label: 'Supervisor', type: 'supervisor' },
  { key: 'zone', label: 'Zone', type: 'zone' },
  { key: 'job_type', label: 'Job Type', type: 'job_type' },
  { key: 'client', label: 'Client', type: 'client' },
]

const PI_CATEGORY: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700 border border-green-200',
  good: 'bg-blue-100 text-blue-700 border border-blue-200',
  average: 'bg-amber-100 text-amber-700 border border-amber-200',
  poor: 'bg-red-100 text-red-700 border border-red-200',
  blacklist_risk: 'bg-red-200 text-red-900 border border-red-300',
  not_rated: 'bg-gray-100 text-gray-600 border border-gray-200',
}

function piTrend(t: string | null): { arrow: string; className: string; label: string } {
  const v = (t ?? '').toLowerCase()
  if (v === 'improving') return { arrow: '↑', className: 'text-green-600', label: 'improving' }
  if (v === 'declining') return { arrow: '↓', className: 'text-red-600', label: 'declining' }
  return { arrow: '→', className: 'text-gray-500', label: 'stable' }
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}

function PiCard({ p }: { p: PiTracker }) {
  const [open, setOpen] = useState(false)
  const trend = piTrend(p.pi_trend)
  const catCls = PI_CATEGORY[(p.pi_category ?? 'not_rated').toLowerCase()] ?? PI_CATEGORY.not_rated
  const jobs = list(p.last_5_jobs)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#1F3864] text-white">
            {p.tracked_identity_type ?? '—'}
          </span>
          {p.trade && <ColorTag text={p.trade} color="orange" />}
          {p.skill_level && <ColorTag text={p.skill_level} color="blue" />}
          {p.city_of_zone && <span className={tag}>{p.city_of_zone}</span>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-gray-800">
            {p.pi_score != null ? num(p.pi_score) : '—'}
            <span className="text-sm text-gray-400">/100</span>{' '}
            <span className={`text-base ${trend.className}`} title={trend.label}>{trend.arrow}</span>
          </p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${catCls}`}>
            {p.pi_category ?? 'not_rated'}
          </span>
        </div>
      </div>

      {p.scoring_formula_version && (
        <span className={`${tag} mt-2 inline-flex`}>Formula v{p.scoring_formula_version}</span>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Scheduled %" value={s(p.scheduled_completion_pct) || '—'} />
        <Metric label="Actual %" value={s(p.actual_completion_pct) || '—'} />
        <Metric label="Cost Variance ₹" value={s(p.cost_variance) || '—'} />
        <Metric label="Quality /100" value={s(p.quality_score) || '—'} />
        <Metric label="Client Sat /100" value={s(p.client_satisfaction_score) || '—'} />
        <Metric label="Worker Perf /100" value={s(p.worker_performance_score) || '—'} />
        <Metric label="Zone Perf /100" value={s(p.zone_performance_score) || '—'} />
        <Metric label="Milestone Adh /100" value={s(p.milestone_adherence_score) || '—'} />
        <Metric label="Pay Timeliness /100" value={s(p.payment_release_timeliness) || '—'} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        <span className={tag}>Rework {s(p.rework_count) || '0'}</span>
        <span className={tag}>D5 {s(p.decision_5_count) || '0'}</span>
        <span className={tag}>Escalations {s(p.escalation_count) || '0'}</span>
        <span className={tag}>Safety {s(p.safety_incident_count) || '0'}</span>
        <span className={tag}>Method Rev {s(p.methodology_revision_count) || '0'}</span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-gray-600">
        <span>Total jobs: <b>{s(p.total_jobs_in_period) || '0'}</b></span>
        <span>On time: <b>{s(p.on_time_completion_count) || '0'}</b></span>
        <span>Within budget: <b>{s(p.within_budget_count) || '0'}</b></span>
        <span>Complaints: <b>{s(p.client_complaint_count) || '0'}</b></span>
      </div>

      <div className="mt-3 border-t border-gray-100 pt-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-wider"
        >
          <span>Last 5 Jobs</span>
          <span>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          jobs.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider">
                    <th className="pr-3 py-1 font-semibold">Job Ref</th>
                    <th className="pr-3 py-1 font-semibold">Job Type</th>
                    <th className="pr-3 py-1 font-semibold">Zone</th>
                    <th className="pr-3 py-1 font-semibold">Quality Score</th>
                    <th className="pr-3 py-1 font-semibold">Client Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j, i) => {
                    const r = rec(j)
                    return (
                      <tr key={i} className="border-t border-gray-100 text-gray-700">
                        <td className="pr-3 py-1 font-medium text-gray-800">{s(r.job_ref) || s(r.booking_ref) || `Job ${i + 1}`}</td>
                        <td className="pr-3 py-1">{s(r.job_type) || '—'}</td>
                        <td className="pr-3 py-1">{s(r.zone) || '—'}</td>
                        <td className="pr-3 py-1">{s(r.quality_score) || '—'}</td>
                        <td className="pr-3 py-1">{s(r.client_rating) || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-400">No job history recorded</p>
          )
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {p.historic_period && <span className={tag}>{p.historic_period}</span>}
        <span className="text-xs text-gray-400">Calculated {fmtDateTime(p.pi_calculated_at)}</span>
        <span className="text-xs text-gray-400">Recalculated {fmtDateTime(p.score_last_recalculated_at)}</span>
      </div>
      {p.pi_remarks && <p className="mt-1 text-xs text-gray-500">{p.pi_remarks}</p>}
    </div>
  )
}

function PiTrackerTab({ piTrackers }: { piTrackers: PiTracker[] }) {
  const [filter, setFilter] = useState('all')
  const active = PI_FILTERS.find((f) => f.key === filter) ?? PI_FILTERS[0]
  const shown =
    active.type == null
      ? piTrackers
      : piTrackers.filter((p) => (p.tracked_identity_type ?? '').toLowerCase() === active.type)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {PI_FILTERS.map((f) => (
          <Pill key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Pill>
        ))}
      </div>
      {shown.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((p) => (
            <PiCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <EmptyState msg="No PI trackers" />
      )}
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'inbox', label: 'Safety Critical & Policy Inbox' },
  { key: 'methodology', label: 'Methodology Reports' },
  { key: 'directives', label: 'Directives Issued' },
  { key: 'audit', label: 'Milestone Audit Log' },
  { key: 'wastage', label: 'Client Wastage Log' },
  { key: 'pi', label: 'PI Tracker' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ReportTabs({
  instructions,
  auditLogs,
  siteLogs,
  wastageLogs,
  piTrackers,
  clientMap,
  adminUserId,
}: {
  instructions: Instruction[]
  auditLogs: AuditLog[]
  siteLogs: SiteLog[]
  wastageLogs: WastageLog[]
  piTrackers: PiTracker[]
  clientMap: Record<string, string>
  adminUserId: string
}) {
  const [tab, setTab] = useState<TabKey>('inbox')

  const unacknowledged = instructions.filter(
    (i) => INBOX_TYPES.includes(i.instruction_type ?? '') && !i.admin_acknowledged_at
  ).length

  const counts: Partial<Record<TabKey, number>> = { inbox: unacknowledged }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => {
          const active = t.key === tab
          const c = counts[t.key]
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                active
                  ? 'bg-[#1F3864] text-white'
                  : 'bg-white text-[#1F3864] border border-[#1F3864] hover:bg-[#1F3864]/5'
              }`}
            >
              {t.label}
              <CountBadge n={c ?? 0} active={active} />
            </button>
          )
        })}
      </div>

      {tab === 'inbox' && <SafetyInboxTab instructions={instructions} adminUserId={adminUserId} />}
      {tab === 'methodology' && <MethodologyTab instructions={instructions} adminUserId={adminUserId} />}
      {tab === 'directives' && <DirectivesTab instructions={instructions} adminUserId={adminUserId} />}
      {tab === 'audit' && <AuditLogTab auditLogs={auditLogs} siteLogs={siteLogs} adminUserId={adminUserId} />}
      {tab === 'wastage' && <WastageTab wastageLogs={wastageLogs} clientMap={clientMap} adminUserId={adminUserId} />}
      {tab === 'pi' && <PiTrackerTab piTrackers={piTrackers} />}
    </div>
  )
}
