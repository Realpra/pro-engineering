'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addQualityTest, editQualityTest, setQualityTestActive, deleteQualityTest,
  addTestStep, editTestStep, setTestStepActive, deleteTestStep,
  type TestInput, type StepInput,
} from './actions'
import { ANSWER_TYPES } from './answerTypes'

export type QualityTest = {
  id: string
  template_name: string | null
  template_code: string | null
  version: string | null
  job_type: string | null
  vertical: string | null
  sector: string | null
  milestone_code: string | null
  milestone_number: number | null
  substage_code: string | null
  description: string | null
  hold_hours: number | string | null
  is_active: boolean | null
}

export type TestStep = {
  id: string
  template_id: string
  check_number: string | null
  sequence_order: number | null
  check_description: string | null
  answer_type: string | null
  options: unknown
  unit: string | null
  minimum_standard: string | null
  evidence_type: string | null
  is_mandatory: boolean | null
  is_active: boolean | null
}

export type StageOption = { job_type: string; milestone_code: string; milestone_name: string; milestone_number: number | null; vertical: string | null }

const inputCls = 'w-full border border-gray-300 rounded-lg p-2 text-sm'
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1'
const s = (v: unknown) => (v == null ? '' : String(v))
const numOrNull = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const answerLabel = (v: string | null) => ANSWER_TYPES.find((a) => a.value === v)?.label ?? v ?? '—'

// ─── Test form ──────────────────────────────────────────────────────────────
type TestForm = Record<keyof TestInput, string>

function TestEditor({
  initial, stages, onClose,
}: { initial?: QualityTest; stages: StageOption[]; onClose: () => void }) {
  const router = useRouter()
  const [f, setF] = useState<TestForm>({
    template_name: s(initial?.template_name), template_code: s(initial?.template_code),
    version: s(initial?.version) || 'v1', job_type: s(initial?.job_type), vertical: s(initial?.vertical),
    sector: s(initial?.sector), milestone_code: s(initial?.milestone_code),
    milestone_number: s(initial?.milestone_number), substage_code: s(initial?.substage_code),
    description: s(initial?.description), hold_hours: s(initial?.hold_hours),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof TestForm) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))

  const jobTypes = [...new Set(stages.map((x) => x.job_type))]
  const stagesForJob = stages.filter((x) => x.job_type === f.job_type)

  function pickStage(code: string) {
    const st = stagesForJob.find((x) => x.milestone_code === code)
    setF((p) => ({
      ...p,
      milestone_code: code,
      milestone_number: st?.milestone_number == null ? p.milestone_number : String(st.milestone_number),
      vertical: p.vertical || (st?.vertical ?? ''),
    }))
  }

  async function save() {
    setBusy(true); setError(null)
    const input: TestInput = {
      template_name: f.template_name, template_code: f.template_code, version: f.version,
      job_type: f.job_type, vertical: f.vertical, sector: f.sector, milestone_code: f.milestone_code,
      milestone_number: numOrNull(f.milestone_number), substage_code: f.substage_code,
      description: f.description, hold_hours: numOrNull(f.hold_hours),
    }
    const res = initial ? await editQualityTest(initial.id, input) : await addQualityTest(input)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    onClose()
    router.refresh()
  }

  return (
    <div className="border border-[#2E74B5] rounded-xl p-4 bg-blue-50 space-y-3">
      <p className="text-sm font-bold text-[#1F3864]">{initial ? 'Edit Test' : 'Add New Test'}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className={labelCls}>Test name *</label>
          <input value={f.template_name} onChange={set('template_name')} placeholder="e.g. Ponding Test" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Code</label>
          <input value={f.template_code} onChange={set('template_code')} placeholder="e.g. TST-PONDING-01" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Job type</label>
          <input value={f.job_type} onChange={set('job_type')} list="qt-job-types" placeholder="bathroom-renovation" className={inputCls} />
          <datalist id="qt-job-types">{jobTypes.map((j) => <option key={j} value={j} />)}</datalist>
        </div>
        <div>
          <label className={labelCls}>Stage</label>
          <select value={f.milestone_code} onChange={(e) => pickStage(e.target.value)} className={inputCls}>
            <option value="">— any stage —</option>
            {stagesForJob.map((x) => <option key={x.milestone_code} value={x.milestone_code}>{x.milestone_code} · {x.milestone_name}</option>)}
            {f.milestone_code && !stagesForJob.some((x) => x.milestone_code === f.milestone_code) && (
              <option value={f.milestone_code}>{f.milestone_code}</option>
            )}
          </select>
        </div>
        <div>
          <label className={labelCls}>Sub-stage code</label>
          <input value={f.substage_code} onChange={set('substage_code')} placeholder="optional" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Hold time (hours)</label>
          <input type="number" value={f.hold_hours} onChange={set('hold_hours')} placeholder="e.g. 24" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Vertical</label>
          <input value={f.vertical} onChange={set('vertical')} placeholder="civil-engineering" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Sector</label>
          <input value={f.sector} onChange={set('sector')} placeholder="optional" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Version</label>
          <input value={f.version} onChange={set('version')} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={f.description} onChange={set('description')} rows={2} className={`${inputCls} resize-y`} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy || !f.template_name.trim()} className="bg-[#2E74B5] text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onClose} disabled={busy} className="bg-gray-100 text-gray-600 text-xs font-bold px-4 py-2 rounded-lg">Cancel</button>
      </div>
    </div>
  )
}

// ─── Step form ──────────────────────────────────────────────────────────────
function StepEditor({
  templateId, initial, nextOrder, onClose,
}: { templateId: string; initial?: TestStep; nextOrder: number; onClose: () => void }) {
  const router = useRouter()
  const opts = Array.isArray(initial?.options) ? (initial?.options as unknown[]).map(String) : []
  const [f, setF] = useState({
    check_number: s(initial?.check_number) || String(nextOrder),
    sequence_order: s(initial?.sequence_order) || String(nextOrder),
    check_description: s(initial?.check_description),
    answer_type: s(initial?.answer_type) || 'pass_fail',
    options: opts.join('\n'),
    unit: s(initial?.unit),
    minimum_standard: s(initial?.minimum_standard),
    evidence_type: s(initial?.evidence_type),
    is_mandatory: initial ? initial.is_mandatory !== false : true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setError(null)
    const input: StepInput = {
      check_number: f.check_number,
      sequence_order: numOrNull(f.sequence_order) ?? 0,
      check_description: f.check_description,
      answer_type: f.answer_type,
      options: f.options.split('\n'),
      unit: f.unit,
      minimum_standard: f.minimum_standard,
      evidence_type: f.evidence_type,
      is_mandatory: f.is_mandatory,
    }
    const res = initial ? await editTestStep(initial.id, input) : await addTestStep(templateId, input)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    onClose()
    router.refresh()
  }

  const showOptions = f.answer_type === 'options' || f.answer_type === 'timer_end'

  return (
    <div className="border border-[#2E74B5] rounded-lg p-3 bg-white space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={labelCls}>Step no.</label>
          <input value={f.check_number} onChange={(e) => setF({ ...f, check_number: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Order</label>
          <input type="number" value={f.sequence_order} onChange={(e) => setF({ ...f, sequence_order: e.target.value })} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Answer type</label>
          <select value={f.answer_type} onChange={(e) => setF({ ...f, answer_type: e.target.value })} className={inputCls}>
            {ANSWER_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Question / instruction *</label>
        <textarea value={f.check_description} onChange={(e) => setF({ ...f, check_description: e.target.value })} rows={2} className={`${inputCls} resize-y`} />
      </div>
      {showOptions && (
        <div>
          <label className={labelCls}>Options (one per line)</label>
          <textarea value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} rows={3} className={`${inputCls} resize-y`} />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {f.answer_type === 'number' && (
          <div>
            <label className={labelCls}>Unit</label>
            <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="e.g. bar, cm" className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls}>Minimum standard</label>
          <input value={f.minimum_standard} onChange={(e) => setF({ ...f, minimum_standard: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Evidence</label>
          <select value={f.evidence_type} onChange={(e) => setF({ ...f, evidence_type: e.target.value })} className={inputCls}>
            <option value="">None</option>
            <option value="photograph">Photograph</option>
            <option value="video">Video</option>
            <option value="measurement">Measurement reading</option>
            <option value="test_duration">Test duration</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={f.is_mandatory} onChange={(e) => setF({ ...f, is_mandatory: e.target.checked })} />
        Must be answered
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy || !f.check_description.trim()} className="bg-[#2E74B5] text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onClose} disabled={busy} className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg">Cancel</button>
      </div>
    </div>
  )
}

function StepRow({ step }: { step: TestStep }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = step.is_active !== false
  const opts = Array.isArray(step.options) ? (step.options as unknown[]).map(String) : []

  async function run(fn: () => Promise<{ success: true } | { error: string }>) {
    setBusy(true); setError(null)
    const res = await fn()
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    router.refresh()
  }

  if (editing) return <StepEditor templateId={step.template_id} initial={step} nextOrder={0} onClose={() => setEditing(false)} />

  return (
    <div className={`border rounded-lg p-3 ${active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-100 opacity-60'}`}>
      <p className="text-sm text-gray-800">
        <span className="font-mono text-xs text-gray-500 mr-2">#{step.check_number ?? step.sequence_order ?? '—'}</span>
        {step.check_description}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {answerLabel(step.answer_type)}
        {opts.length > 0 && ` — ${opts.join(' / ')}`}
        {step.unit && ` (${step.unit})`}
        {step.minimum_standard && ` · Standard: ${step.minimum_standard}`}
        {step.evidence_type && ` · Evidence: ${step.evidence_type}`}
        {step.is_mandatory === false && ' · optional'}
        {!active && ' · INACTIVE'}
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button type="button" disabled={busy} onClick={() => setEditing(true)} className="text-xs font-bold text-[#2E74B5]">Edit</button>
        <button type="button" disabled={busy} onClick={() => run(() => setTestStepActive(step.id, !active))} className="text-xs font-bold text-amber-600">{active ? 'Deactivate' : 'Activate'}</button>
        <button
          type="button"
          disabled={busy}
          onClick={() => { if (confirm('Delete this step? This cannot be undone.')) run(() => deleteTestStep(step.id)) }}
          className="text-xs font-bold text-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function TestCard({ test, steps, stages }: { test: QualityTest; steps: TestStep[]; stages: StageOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingStep, setAddingStep] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = test.is_active !== false
  const sorted = [...steps].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
  const nextOrder = sorted.length > 0 ? Math.max(...sorted.map((x) => x.sequence_order ?? 0)) + 1 : 1

  async function run(fn: () => Promise<{ success: true } | { error: string }>) {
    setBusy(true); setError(null)
    const res = await fn()
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    router.refresh()
  }

  if (editing) return <TestEditor initial={test} stages={stages} onClose={() => setEditing(false)} />

  return (
    <div className={`border rounded-xl ${active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-100 opacity-70'}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1F3864]">{test.template_name ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {test.template_code ?? 'no code'} · {test.job_type ?? 'any job'} · stage {test.milestone_code ?? 'any'}
              {test.hold_hours != null && ` · hold ${test.hold_hours} h`} · {sorted.length} step(s)
            </p>
          </div>
          {!active && <span className="text-[10px] font-bold text-gray-400 bg-gray-200 rounded-full px-2 py-0.5 shrink-0">INACTIVE</span>}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {test.description && <p className="text-xs text-gray-600">{test.description}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => setEditing(true)} className="text-xs font-bold text-[#2E74B5]">Edit test</button>
            <button type="button" disabled={busy} onClick={() => run(() => setQualityTestActive(test.id, !active))} className="text-xs font-bold text-amber-600">{active ? 'Deactivate test' : 'Activate test'}</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { if (confirm(`Delete test "${test.template_name ?? ''}" and all its steps? This cannot be undone.`)) run(() => deleteQualityTest(test.id)) }}
              className="text-xs font-bold text-red-600"
            >
              Delete test
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {sorted.map((st) => <StepRow key={st.id} step={st} />)}
          {addingStep ? (
            <StepEditor templateId={test.id} nextOrder={nextOrder} onClose={() => setAddingStep(false)} />
          ) : (
            <button type="button" onClick={() => setAddingStep(true)} className="w-full border border-dashed border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-500 hover:bg-gray-50">
              + Add Step / Question
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function QualityTestsManager({
  tests, steps, stages, loadError,
}: { tests: QualityTest[]; steps: TestStep[]; stages: StageOption[]; loadError: string | null }) {
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const jobTypes = [...new Set(tests.map((t) => t.job_type ?? 'any job'))]
  const shown = filter === 'all' ? tests : tests.filter((t) => (t.job_type ?? 'any job') === filter)

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 text-sm text-amber-800">
          Could not load tests: {loadError}. If this mentions a missing column or permission, the database
          file <code>20261030_admin_structure_quality_tests.sql</code> has not been run yet.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {['all', ...jobTypes].map((j) => (
          <button
            key={j}
            type="button"
            onClick={() => setFilter(j)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border ${filter === j ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-[#1F3864] border-[#1F3864]/30'}`}
          >
            {j === 'all' ? `All (${tests.length})` : j}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="ml-auto px-4 py-2 rounded-lg text-xs font-bold bg-[#1F3864] text-white"
        >
          {adding ? 'CLOSE FORM' : 'ADD NEW TEST'}
        </button>
      </div>
      {adding && <TestEditor stages={stages} onClose={() => setAdding(false)} />}
      {shown.length === 0 && !loadError && <p className="text-sm text-gray-400">No tests yet.</p>}
      {shown.map((t) => (
        <TestCard key={t.id} test={t} steps={steps.filter((x) => x.template_id === t.id)} stages={stages} />
      ))}
    </div>
  )
}
