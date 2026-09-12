'use client'

import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  addMilestoneTemplate,
  editMilestoneTemplate,
  activateMilestoneTemplate,
  deactivateMilestoneTemplate,
  adminApproveScopeContractChange,
  adminRejectScopeContractChange,
  adminOverrideEvidence,
  adminApproveSubstage,
  adminRejectSubstage,
  type MilestoneActionResult,
  type MilestoneTemplateInput,
} from './actions'

// ─── Types ─────────────────────────────────────────────────────────────────

type JsonRow = Record<string, unknown>

export type MilestoneTemplate = {
  id: string
  vertical: string | null
  job_category: string | null
  job_type: string | null
  milestone_code: string | null
  milestone_name: string | null
  description: string | null
  payment_percent: number | null
  milestone_number: number | null
  planned_day: number | null
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  is_template: boolean | null
  is_active: boolean | null
  created_by: string | null
  trade_type: string | null
  skill_level_required: string | null
  sector: string | null
  compliance_requirements: unknown
  quality_checklist: unknown
  methodology_ref: string | null
  payment_trigger_condition: string | null
  admin_notes: string | null
  evidence_checklist: unknown
  prerequisite_milestone_codes: unknown
  updated_at: string | null
  created_at: string | null
  [key: string]: unknown
}

export type ScopeChange = {
  id: string
  booking_ref: string | null
  change_type: string | null
  change_status: string | null
  justification_cos: string | null
  original_scope_items: unknown
  proposed_additions: unknown
  proposed_deletions: unknown
  proposed_substitutions: unknown
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
  client_acceptance: string | null
  description: string | null
  updated_at: string | null
  created_at: string | null
  [key: string]: unknown
}

export type Payment = {
  id: string
  booking_ref: string | null
  milestone_code: string | null
  milestone_name: string | null
  payment_amount: number | null
  payment_percent: number | null
  status: string | null
  evidence_submitted: unknown
  works_completed_this_milestone: unknown
  supervisor_submitted_at: string | null
  coordinator_approved_at: string | null
  platform_remarks: string | null
  admin_override_type: string | null
  admin_override_reason: string | null
  admin_override_by: string | null
  admin_override_at: string | null
  admin_approved_at: string | null
  created_at: string | null
  updated_at: string | null
  [key: string]: unknown
}

export type Substage = {
  id: string
  booking_ref: string | null
  milestone_code: string | null
  substage_code: string | null
  substage_name: string | null
  substage_description: string | null
  trade_type: string | null
  zone: string | null
  planned_day: number | null
  planned_hours: number | null
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  is_proposed: boolean | null
  proposed_by: string | null
  substage_approval_status: string | null
  substage_approved_by: string | null
  substage_approved_at: string | null
  substage_rejection_reason: string | null
  is_critical_path: boolean | null
  predecessor_substage_code: string | null
  dependency_type: string | null
  lag_days: number | null
  float_days: number | null
  completion_pct: number | null
  status: string | null
  created_at: string | null
  updated_at: string | null
  [key: string]: unknown
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isErr(res: MilestoneActionResult): res is { error: string } {
  return 'error' in res
}

function asRows(v: unknown): JsonRow[] {
  return Array.isArray(v) ? (v as JsonRow[]) : []
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((x) => x !== '')
  if (typeof v === 'string' && v.trim() !== '')
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  return []
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(v: unknown): string {
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

// ─── Shared UI ─────────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const cardClass = 'bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden'
const labelClass = 'text-xs font-semibold uppercase tracking-wider'

function Badge({ children, cls }: { children: ReactNode; cls: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {children}
    </span>
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
  countCls,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
  countCls?: string
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
            countCls ?? (active ? 'bg-white text-[#F97316]' : 'bg-[#F97316] text-white')
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active
          ? 'bg-[#1F3864] text-white'
          : 'bg-white text-[#1F3864] border border-[#1F3864] hover:bg-[#1F3864]/5'
      }`}
    >
      {children}
    </button>
  )
}

function CountBadge({ n, cls }: { n: number; cls: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-bold ${cls}`}
    >
      {n}
    </span>
  )
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
    <details className="rounded-lg border border-gray-200 overflow-hidden" open>
      <summary
        className={`list-none cursor-pointer px-3 py-2 text-xs font-bold text-white ${headerCls}`}
      >
        {title}
      </summary>
      <div className="p-3 bg-white">{children}</div>
    </details>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — Milestone Stage Management
// ═══════════════════════════════════════════════════════════════════════════

const SKILL_LEVELS = ['unskilled', 'semi_skilled', 'skilled', 'highly_skilled']
const SECTORS = [
  'civil',
  'mep',
  'interior',
  'false_roofing',
  'painting',
  'wood_work',
  'architecture',
  'construction_pmc',
]

const TEMPLATE_COLS = 12

type FormState = {
  vertical: string
  job_category: string
  job_type: string
  milestone_code: string
  milestone_name: string
  milestone_number: string
  payment_percent: string
  planned_day: string
  skilled_workers_per_day: string
  unskilled_workers_per_day: string
  trade_type: string
  skill_level_required: string
  sector: string
  methodology_ref: string
  compliance_requirements: string
  description: string
  quality_checklist: string
  payment_trigger_condition: string
  admin_notes: string
  evidence_checklist: string
}

function emptyForm(): FormState {
  return {
    vertical: '',
    job_category: '',
    job_type: '',
    milestone_code: '',
    milestone_name: '',
    milestone_number: '',
    payment_percent: '',
    planned_day: '',
    skilled_workers_per_day: '',
    unskilled_workers_per_day: '',
    trade_type: '',
    skill_level_required: SKILL_LEVELS[0],
    sector: SECTORS[0],
    methodology_ref: '',
    compliance_requirements: '',
    description: '',
    quality_checklist: '',
    payment_trigger_condition: '',
    admin_notes: '',
    evidence_checklist: '',
  }
}

function formFromTemplate(t: MilestoneTemplate): FormState {
  return {
    vertical: t.vertical ?? '',
    job_category: t.job_category ?? '',
    job_type: t.job_type ?? '',
    milestone_code: t.milestone_code ?? '',
    milestone_name: t.milestone_name ?? '',
    milestone_number: t.milestone_number == null ? '' : String(t.milestone_number),
    payment_percent: t.payment_percent == null ? '' : String(t.payment_percent),
    planned_day: t.planned_day == null ? '' : String(t.planned_day),
    skilled_workers_per_day:
      t.skilled_workers_per_day == null ? '' : String(t.skilled_workers_per_day),
    unskilled_workers_per_day:
      t.unskilled_workers_per_day == null ? '' : String(t.unskilled_workers_per_day),
    trade_type: t.trade_type ?? '',
    skill_level_required: t.skill_level_required ?? SKILL_LEVELS[0],
    sector: t.sector ?? SECTORS[0],
    methodology_ref: t.methodology_ref ?? '',
    compliance_requirements: asStringList(t.compliance_requirements).join(', '),
    description: t.description ?? '',
    quality_checklist: (() => {
      const rows = asRows(t.quality_checklist)
      if (rows.length === 0 && !Array.isArray(t.quality_checklist)) return ''
      try {
        return JSON.stringify(t.quality_checklist ?? [], null, 2)
      } catch {
        return ''
      }
    })(),
    payment_trigger_condition: t.payment_trigger_condition ?? '',
    admin_notes: t.admin_notes ?? '',
    evidence_checklist: (() => {
      const rows = asRows(t.evidence_checklist)
      if (rows.length === 0 && !Array.isArray(t.evidence_checklist)) return ''
      try {
        return JSON.stringify(t.evidence_checklist ?? [], null, 2)
      } catch {
        return ''
      }
    })(),
  }
}

function buildInput(f: FormState): { input?: MilestoneTemplateInput; error?: string } {
  let quality_checklist: unknown[] = []
  const qcRaw = f.quality_checklist.trim()
  if (qcRaw !== '') {
    try {
      const parsed = JSON.parse(qcRaw)
      if (!Array.isArray(parsed)) return { error: 'Quality checklist must be a JSON array' }
      quality_checklist = parsed
    } catch {
      return { error: 'Quality checklist is not valid JSON' }
    }
  }
  let evidence_checklist: unknown[] = []
  const ecRaw = f.evidence_checklist.trim()
  if (ecRaw !== '') {
    try {
      const parsed = JSON.parse(ecRaw)
      if (!Array.isArray(parsed)) return { error: 'Evidence checklist must be a JSON array' }
      evidence_checklist = parsed
    } catch {
      return { error: 'Evidence checklist is not valid JSON' }
    }
  }
  return {
    input: {
      vertical: f.vertical.trim(),
      job_category: f.job_category.trim(),
      job_type: f.job_type.trim(),
      milestone_code: f.milestone_code.trim(),
      milestone_name: f.milestone_name.trim(),
      description: f.description.trim(),
      payment_percent: num(f.payment_percent),
      milestone_number: num(f.milestone_number),
      planned_day: num(f.planned_day),
      skilled_workers_per_day: num(f.skilled_workers_per_day),
      unskilled_workers_per_day: num(f.unskilled_workers_per_day),
      trade_type: f.trade_type.trim(),
      skill_level_required: f.skill_level_required,
      sector: f.sector,
      compliance_requirements: f.compliance_requirements
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      quality_checklist,
      methodology_ref: f.methodology_ref.trim(),
      payment_trigger_condition: f.payment_trigger_condition.trim(),
      admin_notes: f.admin_notes.trim(),
      evidence_checklist,
    },
  }
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  suffix?: string
}) {
  return (
    <label className="block">
      <span className={`${labelClass} text-gray-400 block mb-1`}>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </span>
      <input
        type={type}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className={`${labelClass} text-gray-400 block mb-1`}>{label}</span>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

function TemplateForm({
  mode,
  initial,
  adminUserId,
  onClose,
}: {
  mode: 'add' | 'edit'
  initial?: MilestoneTemplate
  adminUserId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [f, setF] = useState<FormState>(
    mode === 'edit' && initial ? formFromTemplate(initial) : emptyForm()
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof FormState) => (v: string) => setF((prev) => ({ ...prev, [k]: v }))

  async function save() {
    setError(null)
    const { input, error: buildErr } = buildInput(f)
    if (buildErr || !input) {
      setError(buildErr ?? 'Invalid form')
      return
    }
    setBusy(true)
    const res =
      mode === 'edit' && initial
        ? await editMilestoneTemplate(initial.id, adminUserId, input)
        : await addMilestoneTemplate(adminUserId, input)
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    onClose()
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-[#1F3864]/30 bg-[#1F3864]/5 p-4">
      <p className="text-xs font-bold text-[#1F3864] uppercase tracking-wider mb-3">
        {mode === 'edit' ? 'Edit Template' : 'Add New Template'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Vertical" value={f.vertical} onChange={set('vertical')} />
        <TextField label="Job Category" value={f.job_category} onChange={set('job_category')} />
        <TextField label="Job Type" value={f.job_type} onChange={set('job_type')} />
        <TextField label="Milestone Code" value={f.milestone_code} onChange={set('milestone_code')} />
        <TextField label="Milestone Name" value={f.milestone_name} onChange={set('milestone_name')} />
        <TextField
          label="Milestone Number"
          type="number"
          value={f.milestone_number}
          onChange={set('milestone_number')}
        />
        <TextField
          label="Payment Percent"
          type="number"
          suffix="%"
          value={f.payment_percent}
          onChange={set('payment_percent')}
        />
        <TextField
          label="Planned Day"
          type="number"
          value={f.planned_day}
          onChange={set('planned_day')}
        />
        <TextField
          label="Skilled Workers / Day"
          type="number"
          value={f.skilled_workers_per_day}
          onChange={set('skilled_workers_per_day')}
        />
        <TextField
          label="Unskilled Workers / Day"
          type="number"
          value={f.unskilled_workers_per_day}
          onChange={set('unskilled_workers_per_day')}
        />
        <TextField label="Trade Type" value={f.trade_type} onChange={set('trade_type')} />
        <SelectField
          label="Skill Level Required"
          value={f.skill_level_required}
          options={SKILL_LEVELS}
          onChange={set('skill_level_required')}
        />
        <SelectField
          label="Sector"
          value={f.sector}
          options={SECTORS}
          onChange={set('sector')}
        />
        <TextField
          label="Methodology Ref"
          value={f.methodology_ref}
          onChange={set('methodology_ref')}
        />
        <TextField
          label="Compliance Requirements"
          suffix="comma separated"
          value={f.compliance_requirements}
          onChange={set('compliance_requirements')}
        />
        <TextField
          label="Payment Trigger Condition"
          value={f.payment_trigger_condition}
          onChange={set('payment_trigger_condition')}
        />
      </div>

      <div className="grid gap-3 mt-3">
        <label className="block">
          <span className={`${labelClass} text-gray-400 block mb-1`}>Description</span>
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            value={f.description}
            onChange={(e) => set('description')(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={`${labelClass} text-gray-400 block mb-1`}>Admin Notes</span>
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            value={f.admin_notes}
            onChange={(e) => set('admin_notes')(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={`${labelClass} text-gray-400 block mb-1`}>Quality Checklist</span>
          <textarea
            rows={3}
            className={`${inputClass} resize-none font-mono`}
            placeholder='["Check level", "Verify alignment"]'
            value={f.quality_checklist}
            onChange={(e) => set('quality_checklist')(e.target.value)}
          />
          <span className="text-xs text-gray-400">
            Enter a JSON array of checklist items, e.g. [&quot;Item one&quot;, &quot;Item two&quot;]
          </span>
        </label>
        <label className="block">
          <span className={`${labelClass} text-gray-400 block mb-1`}>Evidence Checklist</span>
          <textarea
            rows={3}
            className={`${inputClass} resize-none font-mono`}
            placeholder='["Photo of finished tiling", "Signed handover note"]'
            value={f.evidence_checklist}
            onChange={(e) => set('evidence_checklist')(e.target.value)}
          />
          <span className="text-xs text-gray-400">
            Enter a JSON array of required evidence items
          </span>
        </label>
      </div>

      <Err msg={error} />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          disabled={busy}
          onClick={save}
        >
          {busy ? 'Saving…' : 'SAVE'}
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          disabled={busy}
          onClick={onClose}
        >
          CANCEL
        </button>
      </div>
    </div>
  )
}

function TemplateRowActions({
  template,
  adminUserId,
  onEdit,
}: {
  template: MilestoneTemplate
  adminUserId: string
  onEdit: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = template.is_active === true

  async function toggle() {
    setBusy(true)
    setError(null)
    const res = active
      ? await deactivateMilestoneTemplate(template.id, adminUserId)
      : await activateMilestoneTemplate(template.id, adminUserId)
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#1F3864] text-white hover:bg-[#1F3864]/90"
        >
          EDIT
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${
            active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {busy ? '…' : active ? 'DEACTIVATE' : 'ACTIVATE'}
        </button>
      </div>
      <Err msg={error} />
    </div>
  )
}

function TemplateDetail({ template }: { template: MilestoneTemplate }) {
  const compliance = asStringList(template.compliance_requirements)
  const checklist = asRows(template.quality_checklist)
  const checklistStrings = Array.isArray(template.quality_checklist)
    ? (template.quality_checklist as unknown[]).map((it) =>
        typeof it === 'string' ? it : pick(it as JsonRow, ['item', 'label', 'name', 'text', 'description'])
      )
    : []
  const evidenceRows = asRows(template.evidence_checklist)
  const evidenceStrings = Array.isArray(template.evidence_checklist)
    ? (template.evidence_checklist as unknown[]).map((it) =>
        typeof it === 'string' ? it : pick(it as JsonRow, ['item', 'label', 'name', 'text', 'description'])
      )
    : []
  const prerequisites = asStringList(template.prerequisite_milestone_codes)

  return (
    <div className="bg-gray-50 p-4 space-y-3">
      <div>
        <p className={`${labelClass} text-gray-400`}>Description</p>
        <p className="text-sm text-gray-700 mt-0.5">{template.description || '—'}</p>
      </div>
      <div>
        <p className={`${labelClass} text-gray-400`}>Compliance Requirements</p>
        {compliance.length === 0 ? (
          <p className="text-sm text-gray-400 mt-0.5">—</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {compliance.map((c, i) => (
              <Badge key={i} cls="bg-gray-100 text-gray-600 border-gray-200">
                {c}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className={`${labelClass} text-gray-400`}>Quality Checklist</p>
        {checklistStrings.length === 0 && checklist.length === 0 ? (
          <p className="text-sm text-gray-400 mt-0.5">—</p>
        ) : (
          <ol className="list-decimal list-inside text-sm text-gray-700 mt-1 space-y-0.5">
            {(checklistStrings.length > 0
              ? checklistStrings
              : checklist.map((r) => pick(r, ['item', 'label', 'name', 'text', 'description']))
            ).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <p className={`${labelClass} text-gray-400`}>Evidence Checklist</p>
        {evidenceStrings.length === 0 && evidenceRows.length === 0 ? (
          <p className="text-sm text-gray-400 mt-0.5">—</p>
        ) : (
          <ol className="list-decimal list-inside text-sm text-gray-700 mt-1 space-y-0.5">
            {(evidenceStrings.length > 0
              ? evidenceStrings
              : evidenceRows.map((r) => pick(r, ['item', 'label', 'name', 'text', 'description']))
            ).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <p className={`${labelClass} text-gray-400`}>Payment Trigger Condition</p>
        <p className="text-sm text-gray-700 mt-0.5">{template.payment_trigger_condition || '—'}</p>
      </div>
      <div>
        <p className={`${labelClass} text-gray-400`}>Admin Notes</p>
        <p className="text-sm text-gray-700 mt-0.5">{template.admin_notes || '—'}</p>
      </div>
      <div>
        <p className={`${labelClass} text-gray-400`}>Prerequisite Milestone Codes</p>
        {prerequisites.length === 0 ? (
          <p className="text-sm text-gray-400 mt-0.5">—</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {prerequisites.map((c, i) => (
              <Badge key={i} cls="bg-gray-100 text-gray-600 border-gray-200">
                {c}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className={`${labelClass} text-gray-400`}>Methodology Ref</p>
        <p className="text-sm text-gray-700 mt-0.5">{template.methodology_ref || '—'}</p>
      </div>
    </div>
  )
}

function TemplateGroup({
  vertical,
  jobCategory,
  rows,
  adminUserId,
}: {
  vertical: string
  jobCategory: string
  rows: MilestoneTemplate[]
  adminUserId: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      <div className="bg-[#1F3864] text-white rounded-lg px-3 py-2 text-sm font-semibold">
        {vertical || '—'} <span className="text-blue-200">/</span> {jobCategory || '—'}
      </div>
      <div className={`${cardClass}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase tracking-wider text-xs">
                <th className="px-3 py-2 font-semibold">Milestone Code</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Number</th>
                <th className="px-3 py-2 font-semibold">Payment %</th>
                <th className="px-3 py-2 font-semibold">Planned Day</th>
                <th className="px-3 py-2 font-semibold">Trade</th>
                <th className="px-3 py-2 font-semibold">Skill Level</th>
                <th className="px-3 py-2 font-semibold">Sector</th>
                <th className="px-3 py-2 font-semibold">Workers (S/U)</th>
                <th className="px-3 py-2 font-semibold">Compliance</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const isOpen = expanded.has(t.id)
                const isEditing = editingId === t.id
                return (
                  <Fragment key={t.id}>
                    <tr
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(t.id)}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {t.milestone_code || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        <p>{t.milestone_name || '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {asRows(t.quality_checklist).length > 0 || Array.isArray(t.quality_checklist)
                            ? `${(t.quality_checklist as unknown[]).length} item${(t.quality_checklist as unknown[]).length === 1 ? '' : 's'}`
                            : '0 items'}
                          {t.methodology_ref && (
                            <span className="underline decoration-dotted ml-2">{t.methodology_ref}</span>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{metric(t.milestone_number)}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {t.payment_percent == null ? '—' : `${t.payment_percent}%`}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {t.planned_day == null ? '—' : `Day ${t.planned_day}`}
                      </td>
                      <td className="px-3 py-2">
                        {t.trade_type ? (
                          <Badge cls="bg-orange-100 text-orange-700 border-orange-200">
                            {t.trade_type}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {t.skill_level_required ? (
                          <Badge cls="bg-blue-100 text-blue-700 border-blue-200">
                            {t.skill_level_required}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {t.sector ? (
                          <Badge cls="bg-gray-100 text-gray-600 border-gray-200">{t.sector}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        S:{num(t.skilled_workers_per_day)} U:{num(t.unskilled_workers_per_day)}
                      </td>
                      <td className="px-3 py-2">
                        {asStringList(t.compliance_requirements).length === 0 ? (
                          '—'
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {asStringList(t.compliance_requirements).map((c, i) => (
                              <Badge key={i} cls="bg-gray-100 text-gray-600 border-gray-200">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {t.is_active === true ? (
                          <span className="text-green-600 font-semibold text-xs">Active</span>
                        ) : (
                          <span className="text-red-600 font-semibold text-xs">Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <TemplateRowActions
                          template={t}
                          adminUserId={adminUserId}
                          onEdit={() => {
                            setEditingId(t.id)
                            setExpanded((prev) => new Set(prev).add(t.id))
                          }}
                        />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-gray-100">
                        <td colSpan={TEMPLATE_COLS} className="p-0">
                          {isEditing ? (
                            <div className="p-4 bg-gray-50">
                              <TemplateForm
                                mode="edit"
                                initial={t}
                                adminUserId={adminUserId}
                                onClose={() => setEditingId(null)}
                              />
                            </div>
                          ) : (
                            <TemplateDetail template={t} />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MilestoneStageManagementTab({
  templates,
  adminUserId,
}: {
  templates: MilestoneTemplate[]
  adminUserId: string
}) {
  const [showAdd, setShowAdd] = useState(false)

  const activeCount = templates.filter((t) => t.is_active === true).length

  // Group by vertical then job_category, preserving fetch order (vertical, job_category, milestone_number)
  const groups: { vertical: string; jobCategory: string; rows: MilestoneTemplate[] }[] = []
  const index = new Map<string, number>()
  for (const t of templates) {
    const v = t.vertical ?? '—'
    const jc = t.job_category ?? '—'
    const key = `${v}::${jc}`
    let i = index.get(key)
    if (i == null) {
      i = groups.length
      index.set(key, i)
      groups.push({ vertical: v, jobCategory: jc, rows: [] })
    }
    groups[i].rows.push(t)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Active templates</span>
          <CountBadge n={activeCount} cls="bg-blue-100 text-blue-700" />
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1F3864] text-white hover:bg-[#1F3864]/90"
        >
          {showAdd ? 'CLOSE FORM' : 'ADD NEW TEMPLATE'}
        </button>
      </div>

      {showAdd && (
        <TemplateForm mode="add" adminUserId={adminUserId} onClose={() => setShowAdd(false)} />
      )}

      {groups.length === 0 ? (
        <div className={cardClass}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase tracking-wider text-xs">
                  <th className="px-3 py-2 font-semibold">Milestone Code</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Number</th>
                  <th className="px-3 py-2 font-semibold">Payment %</th>
                  <th className="px-3 py-2 font-semibold">Planned Day</th>
                  <th className="px-3 py-2 font-semibold">Trade</th>
                  <th className="px-3 py-2 font-semibold">Skill Level</th>
                  <th className="px-3 py-2 font-semibold">Sector</th>
                  <th className="px-3 py-2 font-semibold">Workers (S/U)</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td colSpan={TEMPLATE_COLS} className="px-3 py-8 text-center text-sm text-gray-400">
                    No milestone templates configured
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <TemplateGroup
            key={`${g.vertical}::${g.jobCategory}`}
            vertical={g.vertical}
            jobCategory={g.jobCategory}
            rows={g.rows}
            adminUserId={adminUserId}
          />
        ))
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — Scope Changes Affecting Contract Value
// ═══════════════════════════════════════════════════════════════════════════

const CHANGE_TYPE_BADGE: Record<string, string> = {
  addition: 'bg-orange-100 text-orange-700 border-orange-200',
  deletion: 'bg-red-100 text-red-700 border-red-200',
  substitution: 'bg-blue-100 text-blue-700 border-blue-200',
}

function ScopeChangeAdminPanel({
  change,
  adminUserId,
}: {
  change: ScopeChange
  adminUserId: string
}) {
  const router = useRouter()
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'approve' | 'reject') {
    setBusy(kind)
    setError(null)
    const fn = kind === 'approve' ? adminApproveScopeContractChange : adminRejectScopeContractChange
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
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          disabled={busy != null}
          onClick={() => run('approve')}
        >
          {busy === 'approve' ? 'Working…' : 'APPROVE CONTRACT CHANGE'}
        </button>
        <button
          type="button"
          className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          disabled={busy != null}
          onClick={() => run('reject')}
        >
          {busy === 'reject' ? 'Working…' : 'REJECT CONTRACT CHANGE'}
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
  const net = num(c?.cost_impact_net)
  const netHeaderCls = net > 0 ? 'text-red-300' : net < 0 ? 'text-green-300' : 'text-white'
  const netBarCls =
    net > 0
      ? 'bg-red-50 text-red-700 border-red-200'
      : net < 0
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'
  const clientName = c?.booking_ref ? clientMap[c.booking_ref] : undefined

  return (
    <div className={cardClass}>
      <div className="bg-[#1F3864] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{c?.booking_ref ?? '—'}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge
                cls={
                  CHANGE_TYPE_BADGE[c?.change_type ?? ''] ??
                  'bg-white/10 text-white border-white/30'
                }
              >
                {c?.change_type ?? '—'}
              </Badge>
              <Badge cls="bg-white/10 text-white border-white/30">{c?.change_status ?? '—'}</Badge>
            </div>
          </div>
          <p className={`text-lg font-bold shrink-0 ${netHeaderCls}`}>{money(c?.cost_impact_net)}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!c && (
          <p className="text-sm text-gray-400 text-center">
            No scope changes affecting contract value
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Client</span>
            {clientName ?? (c ? '—' : 'Awaiting data')}
          </p>
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Timeline Impact</span>
            {c ? `${num(c.timeline_impact_days)} days additional` : 'Awaiting data'}
          </p>
          <p className="text-gray-600 sm:col-span-2">
            <span className={`${labelClass} text-gray-400 block`}>Justification</span>
            {c?.justification_cos || c?.description || (c ? '—' : 'Awaiting data')}
          </p>
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Revised Total Estimate</span>
            {c ? money(c.revised_total_estimate) : 'Awaiting data'}
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <CollapsePanel title="ADDITIONS" headerCls="bg-[#F97316]">
            {additions.length === 0 ? (
              <p className="text-xs text-gray-400">None</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider">
                      <th className="py-1 pr-2 font-semibold">Item</th>
                      <th className="py-1 pr-2 font-semibold">Qty</th>
                      <th className="py-1 pr-2 font-semibold">Unit</th>
                      <th className="py-1 pr-2 font-semibold">Rate</th>
                      <th className="py-1 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {additions.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 text-gray-700">
                        <td className="py-1 pr-2">
                          {pick(r, ['item', 'item_name', 'name', 'description'])}
                        </td>
                        <td className="py-1 pr-2">{pick(r, ['qty', 'quantity'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['unit', 'uom'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['rate', 'unit_rate'])}</td>
                        <td className="py-1">{pick(r, ['amount', 'total', 'cost'])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs font-semibold text-gray-600">
              Total: {money(c?.cost_impact_additions)}
            </p>
          </CollapsePanel>

          <CollapsePanel title="DELETIONS" headerCls="bg-red-600">
            {deletions.length === 0 ? (
              <p className="text-xs text-gray-400">None</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider">
                      <th className="py-1 pr-2 font-semibold">Item</th>
                      <th className="py-1 pr-2 font-semibold">Qty</th>
                      <th className="py-1 pr-2 font-semibold">Unit</th>
                      <th className="py-1 font-semibold">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletions.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 text-gray-700">
                        <td className="py-1 pr-2">
                          {pick(r, ['item', 'item_name', 'name', 'description'])}
                        </td>
                        <td className="py-1 pr-2">{pick(r, ['qty', 'quantity'])}</td>
                        <td className="py-1 pr-2">{pick(r, ['unit', 'uom'])}</td>
                        <td className="py-1">{pick(r, ['credit', 'credit_amount', 'amount', 'total'])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs font-semibold text-gray-600">
              Total: {money(c?.cost_impact_deletions)}
            </p>
          </CollapsePanel>

          <CollapsePanel title="SUBSTITUTIONS" headerCls="bg-[#2E74B5]">
            {substitutions.length === 0 ? (
              <p className="text-xs text-gray-400">None</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider">
                      <th className="py-1 pr-2 font-semibold">Old Item</th>
                      <th className="py-1 pr-2 font-semibold">New Item</th>
                      <th className="py-1 font-semibold">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {substitutions.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 text-gray-700">
                        <td className="py-1 pr-2">
                          {pick(r, ['old_item', 'from_item', 'original', 'old'])}
                        </td>
                        <td className="py-1 pr-2">
                          {pick(r, ['new_item', 'to_item', 'replacement', 'new'])}
                        </td>
                        <td className="py-1">
                          {pick(r, ['difference', 'cost_difference', 'cost_diff', 'delta'])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsePanel>
        </div>

        <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${netBarCls}`}>
          Additions {money(c?.cost_impact_additions)} + Deletions -{money(c?.cost_impact_deletions)} ={' '}
          Net {money(c?.cost_impact_net)}
        </div>

        {c?.coordinator_recommendation && (
          <div className="text-xs text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Coordinator Recommendation</span>
            {c.coordinator_recommendation}
            {c.coordinator_recommended_at && (
              <span className="block text-gray-400 mt-0.5">
                {fmtDate(c.coordinator_recommended_at)}
              </span>
            )}
          </div>
        )}

        {c && c.admin_decision == null && (
          <ScopeChangeAdminPanel change={c} adminUserId={adminUserId} />
        )}

        {c && c.admin_decision != null && (
          <div
            className={`rounded-xl border p-3 ${
              c.admin_decision === 'approved'
                ? 'bg-green-50 text-green-700 border-green-200'
                : c.admin_decision === 'rejected'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wider">{c.admin_decision}</p>
            {c.admin_remarks && <p className="text-sm mt-1">{c.admin_remarks}</p>}
            <p className="text-xs mt-1 opacity-80">Decided {fmtDate(c.admin_decided_at)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ScopeContractChangesTab({
  scopeChanges,
  clientMap,
  adminUserId,
}: {
  scopeChanges: ScopeChange[]
  clientMap: Record<string, string>
  adminUserId: string
}) {
  const pending = scopeChanges.filter(
    (c) => num(c.cost_impact_net) !== 0 && c.admin_decision == null
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">
          Pending contract changes
        </span>
        <CountBadge n={pending.length} cls="bg-[#F97316] text-white" />
      </div>
      {pending.length === 0 ? (
        <ScopeChangeCard change={null} clientMap={clientMap} adminUserId={adminUserId} />
      ) : (
        pending.map((c) => (
          <ScopeChangeCard
            key={c.id}
            change={c}
            clientMap={clientMap}
            adminUserId={adminUserId}
          />
        ))
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — Evidence Overrides
// ═══════════════════════════════════════════════════════════════════════════

const OVERRIDE_TYPE_BADGE: Record<string, string> = {
  approve_without_evidence: 'bg-green-100 text-green-700 border-green-200',
  reject_despite_evidence: 'bg-red-100 text-red-700 border-red-200',
}

const PAYMENT_FILTERS = ['All', 'Pending Override', 'Overridden', 'Approved', 'Rejected'] as const
type PaymentFilter = (typeof PAYMENT_FILTERS)[number]

function EvidenceOverridePanel({
  payment,
  adminUserId,
}: {
  payment: Payment
  adminUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState<'approve_without_evidence' | 'reject_despite_evidence' | null>(
    null
  )
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(type: 'approve_without_evidence' | 'reject_despite_evidence') {
    setBusy(true)
    setError(null)
    const res = await adminOverrideEvidence(payment.id, adminUserId, type, reason.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
        Admin Override Actions
      </p>
      {open == null ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700"
            onClick={() => setOpen('approve_without_evidence')}
          >
            APPROVE WITHOUT EVIDENCE
          </button>
          <button
            type="button"
            className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700"
            onClick={() => setOpen('reject_despite_evidence')}
          >
            REJECT DESPITE EVIDENCE
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">
            {open === 'approve_without_evidence'
              ? 'Approve without evidence'
              : 'Reject despite evidence'}
          </p>
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Override reason…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${
                open === 'approve_without_evidence'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              disabled={busy}
              onClick={() => submit(open)}
            >
              {busy ? 'Working…' : 'CONFIRM OVERRIDE'}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setOpen(null)
                setReason('')
              }}
            >
              CANCEL
            </button>
          </div>
          <Err msg={error} />
        </div>
      )}
    </div>
  )
}

function PaymentCard({ payment, adminUserId }: { payment: Payment | null; adminUserId: string }) {
  const p = payment
  const evidence = asRows(p?.evidence_submitted)
  const overridden = p?.admin_override_type != null
  const workDone = Array.isArray(p?.works_completed_this_milestone)
    ? (p!.works_completed_this_milestone as unknown[]).map((it) =>
        typeof it === 'string' ? it : pick(it as JsonRow, ['item', 'label', 'name', 'text', 'description'])
      )
    : []

  return (
    <div className={cardClass}>
      <div className="bg-[#1F3864] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{p?.booking_ref ?? '—'}</p>
            <p className="text-blue-200 text-xs truncate">
              {p?.milestone_code ?? '—'} · {p?.milestone_name ?? '—'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-white">{money(p?.payment_amount)}</p>
            <Badge cls="bg-white/10 text-white border-white/30">{p?.status ?? '—'}</Badge>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!p && <p className="text-sm text-gray-400 text-center">No payment milestones found</p>}

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Supervisor Submitted</span>
            {p?.supervisor_submitted_at ? fmtDate(p.supervisor_submitted_at) : 'Not yet submitted'}
          </p>
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Coordinator Approved</span>
            {p?.coordinator_approved_at ? fmtDate(p.coordinator_approved_at) : 'Not yet approved'}
          </p>
          <p className="text-gray-600">
            <span className={`${labelClass} text-gray-400 block`}>Evidence Items</span>
            {evidence.length > 0 ? `${evidence.length} item(s)` : 'No evidence submitted'}
          </p>
          {p?.platform_remarks && (
            <p className="text-gray-600">
              <span className={`${labelClass} text-gray-400 block`}>Platform Remarks</span>
              {p.platform_remarks}
            </p>
          )}
        </div>

        {p && (
          <div>
            <p className={`${labelClass} text-gray-400`}>Works Completed This Milestone</p>
            {workDone.length === 0 ? (
              <p className="text-sm text-gray-400 mt-0.5">—</p>
            ) : (
              <ul className="list-disc list-inside text-sm text-gray-700 mt-1 space-y-0.5">
                {workDone.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {p && overridden && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Override History
            </p>
            <Badge
              cls={
                OVERRIDE_TYPE_BADGE[p.admin_override_type ?? ''] ??
                'bg-gray-100 text-gray-600 border-gray-200'
              }
            >
              {p.admin_override_type}
            </Badge>
            {p.admin_override_reason && (
              <p className="text-sm text-gray-700">{p.admin_override_reason}</p>
            )}
            <p className="text-xs text-gray-400">{fmtDate(p.admin_override_at)}</p>
          </div>
        )}

        {p && !overridden && <EvidenceOverridePanel payment={p} adminUserId={adminUserId} />}
      </div>
    </div>
  )
}

function EvidenceOverridesTab({
  payments,
  adminUserId,
}: {
  payments: Payment[]
  adminUserId: string
}) {
  const [filter, setFilter] = useState<PaymentFilter>('All')

  const overrideCount = payments.filter((p) => p.admin_override_type != null).length

  const filtered = payments.filter((p) => {
    const status = (p.status ?? '').toLowerCase()
    switch (filter) {
      case 'Pending Override':
        return p.admin_override_type == null
      case 'Overridden':
        return p.admin_override_type != null
      case 'Approved':
        return status.includes('approved')
      case 'Rejected':
        return status.includes('rejected')
      default:
        return true
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">Overrides applied</span>
        <CountBadge n={overrideCount} cls="bg-purple-100 text-purple-700" />
      </div>

      <div className="flex flex-wrap gap-2">
        {PAYMENT_FILTERS.map((f) => (
          <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </FilterPill>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <PaymentCard payment={null} adminUserId={adminUserId} />
        ) : (
          filtered.map((p) => <PaymentCard key={p.id} payment={p} adminUserId={adminUserId} />)
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — Substage Proposals
// ═══════════════════════════════════════════════════════════════════════════

const SUBSTAGE_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

const SUBSTAGE_FILTERS = ['All', 'Pending', 'Approved', 'Rejected'] as const
type SubstageFilter = (typeof SUBSTAGE_FILTERS)[number]

function SubstageAdminPanel({
  substage,
  adminUserId,
}: {
  substage: Substage
  adminUserId: string
}) {
  const router = useRouter()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function approve() {
    if (!window.confirm('Approve this substage proposal?')) return
    setBusy('approve')
    setError(null)
    const res = await adminApproveSubstage(substage.id, adminUserId)
    setBusy(null)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  async function reject() {
    setBusy('reject')
    setError(null)
    const res = await adminRejectSubstage(substage.id, adminUserId, reason.trim())
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
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          disabled={busy != null}
          onClick={approve}
        >
          {busy === 'approve' ? 'Working…' : 'APPROVE SUBSTAGE'}
        </button>
        {!showReject ? (
          <button
            type="button"
            className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            disabled={busy != null}
            onClick={() => setShowReject(true)}
          >
            REJECT SUBSTAGE
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="Rejection reason…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy != null}
                onClick={reject}
              >
                {busy === 'reject' ? 'Working…' : 'CONFIRM REJECT'}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                disabled={busy != null}
                onClick={() => {
                  setShowReject(false)
                  setReason('')
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
      <Err msg={error} />
    </div>
  )
}

function SubstageInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p className="text-gray-600">
      <span className={`${labelClass} text-gray-400 block`}>{label}</span>
      {value}
    </p>
  )
}

function SubstageCard({
  substage,
  adminUserId,
}: {
  substage: Substage | null
  adminUserId: string
}) {
  const s = substage
  const status = s?.substage_approval_status || 'pending'

  return (
    <div className={cardClass}>
      <div className="bg-[#1F3864] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-white font-bold text-sm truncate">{s?.booking_ref ?? '—'}</p>
              <Badge cls="bg-white/10 text-white border-white/30">{s?.milestone_code ?? '—'}</Badge>
            </div>
            <p className="text-blue-200 text-xs mt-1 truncate">
              {s?.substage_code ?? '—'} · {s?.substage_name ?? '—'}
            </p>
          </div>
          <Badge
            cls={
              status === 'approved'
                ? 'bg-green-100 text-green-700 border-green-200'
                : status === 'rejected'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
            }
          >
            {status}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!s && (
          <p className="text-sm text-gray-400 text-center">No substage proposals pending</p>
        )}

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <SubstageInfo
            label="Trade"
            value={
              s?.trade_type ? (
                <Badge cls="bg-orange-100 text-orange-700 border-orange-200">{s.trade_type}</Badge>
              ) : (
                '—'
              )
            }
          />
          <SubstageInfo
            label="Zone"
            value={
              s?.zone ? <Badge cls="bg-gray-100 text-gray-600 border-gray-200">{s.zone}</Badge> : '—'
            }
          />
          <SubstageInfo
            label="Planned Day"
            value={s?.planned_day == null ? '—' : `Day ${s.planned_day}`}
          />
          <SubstageInfo
            label="Planned Hours"
            value={s?.planned_hours == null ? '—' : `${s.planned_hours} hours`}
          />
          <SubstageInfo label="Skilled Workers" value={metric(s?.skilled_workers_per_day)} />
          <SubstageInfo label="Unskilled Workers" value={metric(s?.unskilled_workers_per_day)} />
          <SubstageInfo
            label="Critical Path"
            value={
              s?.is_critical_path === true ? (
                <Badge cls="bg-red-100 text-red-700 border-red-200">Critical path</Badge>
              ) : (
                'No'
              )
            }
          />
          {s?.predecessor_substage_code && (
            <SubstageInfo label="Predecessor" value={s.predecessor_substage_code} />
          )}
          <SubstageInfo label="Dependency Type" value={metric(s?.dependency_type)} />
          <SubstageInfo label="Lag Days" value={metric(s?.lag_days)} />
          <SubstageInfo label="Float Days" value={metric(s?.float_days)} />
        </div>

        {s?.substage_description && (
          <p className="text-sm text-gray-700">
            <span className={`${labelClass} text-gray-400 block`}>Description</span>
            {s.substage_description}
          </p>
        )}

        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className={labelClass}>Completion</span>
            <span className="font-semibold text-gray-700">{s?.completion_pct == null ? '—' : `${s.completion_pct}%`}</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-[#1F3864]"
              style={{ width: `${s?.completion_pct == null ? 0 : Math.max(0, Math.min(100, num(s.completion_pct)))}%` }}
            />
          </div>
        </div>

        {s && status === 'pending' && (
          <SubstageAdminPanel substage={s} adminUserId={adminUserId} />
        )}

        {s && status !== 'pending' && (
          <div
            className={`rounded-xl border p-3 ${
              SUBSTAGE_STATUS_BADGE[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wider">{status}</p>
            <p className="text-xs mt-1 opacity-80">Decided {fmtDate(s.substage_approved_at)}</p>
            {status === 'rejected' && s.substage_rejection_reason && (
              <p className="text-sm mt-1">{s.substage_rejection_reason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SubstageProposalsTab({
  substages,
  adminUserId,
}: {
  substages: Substage[]
  adminUserId: string
}) {
  const [filter, setFilter] = useState<SubstageFilter>('All')

  const pendingCount = substages.filter(
    (s) => (s.substage_approval_status ?? 'pending') === 'pending'
  ).length

  const filtered = substages.filter((s) => {
    const status = s.substage_approval_status ?? 'pending'
    switch (filter) {
      case 'Pending':
        return status === 'pending'
      case 'Approved':
        return status === 'approved'
      case 'Rejected':
        return status === 'rejected'
      default:
        return true
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">Pending proposals</span>
        <CountBadge n={pendingCount} cls="bg-[#F97316] text-white" />
      </div>

      <div className="flex flex-wrap gap-2">
        {SUBSTAGE_FILTERS.map((f) => (
          <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </FilterPill>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <SubstageCard substage={null} adminUserId={adminUserId} />
        ) : (
          filtered.map((s) => (
            <SubstageCard key={s.id} substage={s} adminUserId={adminUserId} />
          ))
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Root
// ═══════════════════════════════════════════════════════════════════════════

export default function MilestoneTabs({
  templates,
  scopeChanges,
  payments,
  substages,
  clientMap,
  adminUserId,
}: {
  templates: MilestoneTemplate[]
  scopeChanges: ScopeChange[]
  payments: Payment[]
  substages: Substage[]
  clientMap: Record<string, string>
  adminUserId: string
}) {
  const [tab, setTab] = useState<'stages' | 'contract' | 'evidence' | 'substages'>('stages')

  const activeTemplates = templates.filter((t) => t.is_active === true).length
  const pendingContract = scopeChanges.filter(
    (c) => num(c.cost_impact_net) !== 0 && c.admin_decision == null
  ).length
  const overrides = payments.filter((p) => p.admin_override_type != null).length
  const pendingSubstages = substages.filter(
    (s) => (s.substage_approval_status ?? 'pending') === 'pending'
  ).length

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <NavyPill
          active={tab === 'stages'}
          onClick={() => setTab('stages')}
          count={activeTemplates}
          countCls={tab === 'stages' ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'}
        >
          Milestone Stage Management
        </NavyPill>
        <NavyPill active={tab === 'contract'} onClick={() => setTab('contract')} count={pendingContract}>
          Scope Changes Affecting Contract Value
        </NavyPill>
        <NavyPill active={tab === 'evidence'} onClick={() => setTab('evidence')}>
          Evidence Overrides
        </NavyPill>
        <NavyPill
          active={tab === 'substages'}
          onClick={() => setTab('substages')}
          count={pendingSubstages}
        >
          Substage Proposals
        </NavyPill>
      </div>

      {tab === 'stages' && (
        <MilestoneStageManagementTab templates={templates} adminUserId={adminUserId} />
      )}
      {tab === 'contract' && (
        <ScopeContractChangesTab
          scopeChanges={scopeChanges}
          clientMap={clientMap}
          adminUserId={adminUserId}
        />
      )}
      {tab === 'evidence' && (
        <EvidenceOverridesTab payments={payments} adminUserId={adminUserId} />
      )}
      {tab === 'substages' && (
        <SubstageProposalsTab substages={substages} adminUserId={adminUserId} />
      )}
    </div>
  )
}
