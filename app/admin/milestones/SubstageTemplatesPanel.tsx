'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addSubstageTemplate,
  editSubstageTemplate,
  setSubstageTemplateActive,
  deleteSubstageTemplate,
  type SubstageTemplateInput,
} from './substageTemplateActions'

// Sub-stage templates for one stage template (live table milestone_substage_templates).
// Add / edit / activate-deactivate / delete -- owner's instruction, 30 Oct 2026.

export type SubstageTemplate = {
  id: string
  stage_template_id: string
  substage_code: string | null
  substage_name: string | null
  substage_description: string | null
  sequence_order: number | null
  planned_day: number | null
  planned_hours: number | string | null
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  trade_type: string | null
  skill_level_required: string | null
  sector: string | null
  methodology_ref: string | null
  evidence_checklist: unknown
  supervisor_checklist: unknown
  subcoordinator_checklist: unknown
  coordinator_checklist: unknown
  quality_checklist: unknown
  is_active: boolean | null
}

const inputCls = 'w-full border border-gray-300 rounded-lg p-2 text-sm'
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1'

function toLines(v: unknown): string {
  if (!Array.isArray(v)) return ''
  return v
    .map((it) => (typeof it === 'string' ? it : (it as Record<string, unknown>)?.item ?? (it as Record<string, unknown>)?.label ?? ''))
    .filter(Boolean)
    .join('\n')
}

function toList(text: string): string[] {
  return text.split('\n').map((s) => s.trim()).filter(Boolean)
}

function numOrNull(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

type FormState = {
  substage_code: string
  substage_name: string
  substage_description: string
  sequence_order: string
  planned_day: string
  planned_hours: string
  skilled_workers_per_day: string
  unskilled_workers_per_day: string
  trade_type: string
  skill_level_required: string
  sector: string
  methodology_ref: string
  evidence_checklist: string
  supervisor_checklist: string
  subcoordinator_checklist: string
  coordinator_checklist: string
  quality_checklist: string
}

function emptyForm(nextOrder: number): FormState {
  return {
    substage_code: '', substage_name: '', substage_description: '',
    sequence_order: String(nextOrder), planned_day: '', planned_hours: '',
    skilled_workers_per_day: '', unskilled_workers_per_day: '',
    trade_type: '', skill_level_required: '', sector: '', methodology_ref: '',
    evidence_checklist: '', supervisor_checklist: '', subcoordinator_checklist: '',
    coordinator_checklist: '', quality_checklist: '',
  }
}

function formFrom(t: SubstageTemplate): FormState {
  const s = (v: unknown) => (v == null ? '' : String(v))
  return {
    substage_code: s(t.substage_code), substage_name: s(t.substage_name),
    substage_description: s(t.substage_description), sequence_order: s(t.sequence_order),
    planned_day: s(t.planned_day), planned_hours: s(t.planned_hours),
    skilled_workers_per_day: s(t.skilled_workers_per_day),
    unskilled_workers_per_day: s(t.unskilled_workers_per_day),
    trade_type: s(t.trade_type), skill_level_required: s(t.skill_level_required),
    sector: s(t.sector), methodology_ref: s(t.methodology_ref),
    evidence_checklist: toLines(t.evidence_checklist),
    supervisor_checklist: toLines(t.supervisor_checklist),
    subcoordinator_checklist: toLines(t.subcoordinator_checklist),
    coordinator_checklist: toLines(t.coordinator_checklist),
    quality_checklist: toLines(t.quality_checklist),
  }
}

function toInput(f: FormState): SubstageTemplateInput {
  return {
    substage_code: f.substage_code,
    substage_name: f.substage_name,
    substage_description: f.substage_description,
    sequence_order: numOrNull(f.sequence_order) ?? 0,
    planned_day: numOrNull(f.planned_day),
    planned_hours: numOrNull(f.planned_hours),
    skilled_workers_per_day: numOrNull(f.skilled_workers_per_day),
    unskilled_workers_per_day: numOrNull(f.unskilled_workers_per_day),
    trade_type: f.trade_type,
    skill_level_required: f.skill_level_required,
    sector: f.sector,
    methodology_ref: f.methodology_ref,
    evidence_checklist: toList(f.evidence_checklist),
    supervisor_checklist: toList(f.supervisor_checklist),
    subcoordinator_checklist: toList(f.subcoordinator_checklist),
    coordinator_checklist: toList(f.coordinator_checklist),
    quality_checklist: toList(f.quality_checklist),
  }
}

function SubstageForm({
  stageTemplateId,
  initial,
  nextOrder,
  onClose,
}: {
  stageTemplateId: string
  initial?: SubstageTemplate
  nextOrder: number
  onClose: () => void
}) {
  const router = useRouter()
  const [f, setF] = useState<FormState>(initial ? formFrom(initial) : emptyForm(nextOrder))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    setError(null)
    const res = initial
      ? await editSubstageTemplate(initial.id, toInput(f))
      : await addSubstageTemplate(stageTemplateId, toInput(f))
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    onClose()
    router.refresh()
  }

  const area = (k: keyof FormState, label: string, hint: string) => (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea value={f[k]} onChange={set(k)} rows={3} placeholder={hint} className={`${inputCls} resize-y`} />
    </div>
  )
  const field = (k: keyof FormState, label: string, type = 'text', hint = '') => (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} value={f[k]} onChange={set(k)} placeholder={hint} className={inputCls} />
    </div>
  )

  return (
    <div className="border border-[#2E74B5] rounded-xl p-4 bg-blue-50 space-y-3">
      <p className="text-sm font-bold text-[#1F3864]">{initial ? 'Edit Sub-stage' : 'Add Sub-stage'}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {field('substage_code', 'Code *', 'text', 'e.g. M1-A')}
        <div className="sm:col-span-2">{field('substage_name', 'Name *', 'text', 'e.g. Demolition complete')}</div>
      </div>
      {area('substage_description', 'Description', 'What must be completed in this sub-stage')}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {field('sequence_order', 'Order', 'number')}
        {field('planned_day', 'Planned day', 'number')}
        {field('planned_hours', 'Hours', 'number')}
        {field('skilled_workers_per_day', 'Skilled / day', 'number')}
        {field('unskilled_workers_per_day', 'Unskilled / day', 'number')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {field('trade_type', 'Trade')}
        {field('skill_level_required', 'Skill level')}
        {field('sector', 'Sector')}
        {field('methodology_ref', 'Methodology ref')}
      </div>
      <p className="text-xs text-gray-500">Checklists: one item per line.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {area('evidence_checklist', 'Evidence checklist', 'Photo of each pipe run…')}
        {area('quality_checklist', 'Quality checklist', 'One check per line')}
        {area('supervisor_checklist', 'Supervisor checks', 'Physical completion…')}
        {area('subcoordinator_checklist', 'Sub-Coordinator checks', 'Matches BOQ scope…')}
        {area('coordinator_checklist', 'Coordinator checks', 'Enough to release payment…')}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="bg-[#2E74B5] text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="bg-gray-100 text-gray-600 text-xs font-bold px-4 py-2 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  )
}

function SubstageRow({ t, stageTemplateId }: { t: SubstageTemplate; stageTemplateId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = t.is_active !== false

  async function toggle() {
    setBusy(true); setError(null)
    const res = await setSubstageTemplateActive(t.id, !active)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete sub-stage "${t.substage_code ?? ''} ${t.substage_name ?? ''}"? This cannot be undone.`)) return
    setBusy(true); setError(null)
    const res = await deleteSubstageTemplate(t.id)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    router.refresh()
  }

  if (editing) {
    return <SubstageForm stageTemplateId={stageTemplateId} initial={t} nextOrder={0} onClose={() => setEditing(false)} />
  }

  return (
    <div className={`border rounded-xl p-3 ${active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            <span className="font-mono text-xs text-gray-500 mr-2">{t.substage_code ?? '—'}</span>
            {t.substage_name ?? '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Order {t.sequence_order ?? '—'} · Day {t.planned_day ?? '—'} · {t.planned_hours ?? '—'} h ·
            S:{t.skilled_workers_per_day ?? 0} U:{t.unskilled_workers_per_day ?? 0}
            {t.trade_type ? ` · ${t.trade_type}` : ''}
          </p>
          {t.substage_description && <p className="text-xs text-gray-600 mt-1">{t.substage_description}</p>}
        </div>
        {!active && <span className="text-[10px] font-bold text-gray-400 bg-gray-200 rounded-full px-2 py-0.5 shrink-0">INACTIVE</span>}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button type="button" onClick={() => setEditing(true)} disabled={busy} className="text-xs font-bold text-[#2E74B5]">Edit</button>
        <button type="button" onClick={toggle} disabled={busy} className="text-xs font-bold text-amber-600">{active ? 'Deactivate' : 'Activate'}</button>
        <button type="button" onClick={remove} disabled={busy} className="text-xs font-bold text-red-600">Delete</button>
      </div>
    </div>
  )
}

export default function SubstageTemplatesPanel({
  stageTemplateId,
  rows,
}: {
  stageTemplateId: string
  rows: SubstageTemplate[]
}) {
  const [adding, setAdding] = useState(false)
  const sorted = [...rows].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
  const nextOrder = sorted.length > 0 ? Math.max(...sorted.map((r) => r.sequence_order ?? 0)) + 1 : 1

  return (
    <div className="p-4 bg-white border-t border-gray-100 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-[#1F3864]">
        Sub-stages ({sorted.length})
      </p>
      {sorted.length === 0 && !adding && (
        <p className="text-sm text-gray-400">No sub-stages yet for this stage.</p>
      )}
      {sorted.map((t) => <SubstageRow key={t.id} t={t} stageTemplateId={stageTemplateId} />)}
      {adding ? (
        <SubstageForm stageTemplateId={stageTemplateId} nextOrder={nextOrder} onClose={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="w-full border border-dashed border-gray-300 rounded-xl p-3 text-sm font-bold text-gray-500 hover:bg-gray-50">
          + Add Sub-stage
        </button>
      )}
    </div>
  )
}
