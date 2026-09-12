'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  updatePlatformPremium,
  deactivatePlatformPremium,
  addPlatformPremium,
  updateContingency,
  deactivateContingency,
  updatePaymentPolicy,
  addComplianceConfig,
  deactivateComplianceConfig,
  addBusinessRule,
  deactivateBusinessRule,
  type PolicyActionResult,
} from './actions'

// ─── Row types ──────────────────────────────────────────────────────────────

export type PremiumPolicy = {
  id: string
  vertical: string | null
  job_category: string | null
  job_type: string | null
  tier: string | null
  premium_pct: number | null
  min_deviation_pct: number | null
  max_deviation_pct: number | null
  effective_from: string | null
  effective_until: string | null
  set_by: string | null
  remarks: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  [key: string]: unknown
}

export type ContingencyPolicy = {
  id: string
  vertical: string | null
  job_category: string | null
  job_type: string | null
  tier: string | null
  contingency_pct: number | null
  min_deviation_pct: number | null
  max_deviation_pct: number | null
  effective_from: string | null
  effective_until: string | null
  set_by: string | null
  remarks: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  [key: string]: unknown
}

export type PaymentPolicy = {
  id: string
  coordinator_limit: number | null
  admin_limit: number | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean | null
  notes: string | null
  [key: string]: unknown
}

export type ComplianceConfig = {
  id: string
  compliance_type: string | null
  compliance_name: string | null
  applicable_job_types: string[] | null
  applicable_sectors: string[] | null
  rate_pct: number | null
  threshold_value: number | null
  unit: string | null
  legal_reference: string | null
  notes: string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean | null
  [key: string]: unknown
}

export type BusinessRule = {
  id: string
  rule_name: string | null
  rule_category: string | null
  rule_value: string | null
  applies_to: string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean | null
  notes: string | null
  [key: string]: unknown
}

export type PolicyChangeLog = {
  id: string
  table_name: string | null
  record_id: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  change_reason: string | null
  changed_by: string | null
  changed_at: string | null
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isErr(res: PolicyActionResult): res is { error: string } {
  return 'error' in res
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  return `₹${Number(v).toLocaleString('en-IN')}`
}

function fmtPct(v: number | null | undefined): string {
  return v == null ? '—' : `${v}%`
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function csvToArray(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// ─── Reusable bits ──────────────────────────────────────────────────────────

function Pill({
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
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
        active
          ? 'bg-[#1F3864] text-white'
          : 'bg-white text-[#1F3864] border border-[#1F3864] hover:bg-[#1F3864]/5'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputClass =
  'w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'

const primaryBtn =
  'px-4 py-2 rounded-lg text-xs font-bold bg-[#1F3864] text-white hover:bg-[#16305a] disabled:opacity-50'
const ghostBtn =
  'px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
const tag =
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200'

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <p className="text-xs text-red-600">{msg}</p>
}

// ─── Section 1: Platform Premium ────────────────────────────────────────────

function AddPremiumForm({ adminUserId, onDone }: { adminUserId: string; onDone: () => void }) {
  const [vertical, setVertical] = useState('')
  const [jobCategory, setJobCategory] = useState('')
  const [ratePct, setRatePct] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await addPlatformPremium(adminUserId, vertical.trim(), jobCategory.trim(), Number(ratePct))
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    onDone()
  }

  const valid = vertical.trim() && jobCategory.trim() && ratePct !== '' && !Number.isNaN(Number(ratePct))

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 grid gap-3 sm:grid-cols-3">
      <Field label="Vertical">
        <input className={inputClass} value={vertical} onChange={(e) => setVertical(e.target.value)} />
      </Field>
      <Field label="Job Category">
        <input className={inputClass} value={jobCategory} onChange={(e) => setJobCategory(e.target.value)} />
      </Field>
      <Field label="Rate %">
        <input
          type="number"
          className={inputClass}
          value={ratePct}
          onChange={(e) => setRatePct(e.target.value)}
        />
      </Field>
      <div className="sm:col-span-3 flex items-center gap-2">
        <button type="button" className={primaryBtn} disabled={busy || !valid} onClick={save}>
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

function PremiumRow({ row, adminUserId }: { row: PremiumPolicy; adminUserId: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<null | 'edit' | 'deactivate'>(null)
  const [rate, setRate] = useState(String(row.premium_pct ?? ''))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setMode(null)
    setRate(String(row.premium_pct ?? ''))
    setReason('')
    setError(null)
  }

  async function save() {
    setBusy(true)
    setError(null)
    const res = await updatePlatformPremium(row.id, adminUserId, Number(rate), reason.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    reset()
    router.refresh()
  }

  async function deactivate() {
    setBusy(true)
    setError(null)
    const res = await deactivatePlatformPremium(row.id, adminUserId, reason.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    reset()
    router.refresh()
  }

  return (
    <>
      <tr className="border-b border-gray-100">
        <td className="px-3 py-2.5 text-sm text-gray-800">{row.vertical ?? '—'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{row.job_category ?? '—'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{row.job_type ?? '—'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{row.tier ?? '—'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{fmtPct(row.premium_pct)}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{fmtPct(row.min_deviation_pct)}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{fmtPct(row.max_deviation_pct)}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{fmtDate(row.effective_from)}</td>
        <td className="px-3 py-2.5 text-sm">
          <span className={row.is_active ? 'text-green-600 font-semibold' : 'text-gray-400'}>
            {row.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'edit' ? null : 'edit'))}
              className="px-2 py-1 rounded-md text-xs font-semibold bg-[#1F3864] text-white hover:bg-[#16305a]"
            >
              EDIT
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'deactivate' ? null : 'deactivate'))}
              disabled={!row.is_active}
              className="px-2 py-1 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            >
              DEACTIVATE
            </button>
          </div>
        </td>
      </tr>
      {mode === 'edit' && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={10} className="px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New Rate %">
                <input type="number" className={inputClass} value={rate} onChange={(e) => setRate(e.target.value)} />
              </Field>
              <Field label="Change Reason">
                <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" className={primaryBtn} disabled={busy || !reason.trim()} onClick={save}>
                {busy ? 'Saving…' : 'SAVE'}
              </button>
              <button type="button" className={ghostBtn} onClick={reset}>
                Cancel
              </button>
              <Err msg={error} />
            </div>
          </td>
        </tr>
      )}
      {mode === 'deactivate' && (
        <tr className="border-b border-gray-100 bg-red-50">
          <td colSpan={10} className="px-3 py-3">
            <p className="text-sm font-semibold text-red-800 mb-2">Deactivate this policy row?</p>
            <Field label="Change Reason">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy || !reason.trim()}
                onClick={deactivate}
              >
                {busy ? 'Working…' : 'CONFIRM DEACTIVATE'}
              </button>
              <button type="button" className={ghostBtn} onClick={reset}>
                Cancel
              </button>
              <Err msg={error} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function PlatformPremiumTab({ rows, adminUserId }: { rows: PremiumPolicy[]; adminUserId: string }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className={primaryBtn} onClick={() => setAdding((a) => !a)}>
          {adding ? 'Cancel' : '+ Add New Row'}
        </button>
      </div>
      {adding && (
        <AddPremiumForm
          adminUserId={adminUserId}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border border-gray-200 rounded-lg">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 font-semibold">Vertical</th>
              <th className="px-3 py-2 font-semibold">Job Category</th>
              <th className="px-3 py-2 font-semibold">Job Type</th>
              <th className="px-3 py-2 font-semibold">Tier</th>
              <th className="px-3 py-2 font-semibold">Premium %</th>
              <th className="px-3 py-2 font-semibold">Min Deviation %</th>
              <th className="px-3 py-2 font-semibold">Max Deviation %</th>
              <th className="px-3 py-2 font-semibold">Effective From</th>
              <th className="px-3 py-2 font-semibold">Active</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => <PremiumRow key={r.id} row={r} adminUserId={adminUserId} />)
            ) : (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-400">
                  No data configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Section 1: Contingency ─────────────────────────────────────────────────

function ContingencyRow({ row, adminUserId }: { row: ContingencyPolicy; adminUserId: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<null | 'edit' | 'deactivate'>(null)
  const [maxPct, setMaxPct] = useState(String(row.contingency_pct ?? ''))
  const [limitPct, setLimitPct] = useState(String(row.max_deviation_pct ?? ''))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setMode(null)
    setMaxPct(String(row.contingency_pct ?? ''))
    setLimitPct(String(row.max_deviation_pct ?? ''))
    setReason('')
    setError(null)
  }

  async function save() {
    setBusy(true)
    setError(null)
    const res = await updateContingency(row.id, adminUserId, Number(maxPct), Number(limitPct), reason.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    reset()
    router.refresh()
  }

  async function deactivate() {
    setBusy(true)
    setError(null)
    const res = await deactivateContingency(row.id, adminUserId, reason.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    reset()
    router.refresh()
  }

  return (
    <>
      <tr className="border-b border-gray-100">
        <td className="px-3 py-2.5 text-sm text-gray-800">{row.vertical ?? '—'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{row.job_category ?? '—'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{row.job_type ?? '—'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{row.tier ?? '—'}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{fmtPct(row.contingency_pct)}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{fmtPct(row.min_deviation_pct)}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{fmtPct(row.max_deviation_pct)}</td>
        <td className="px-3 py-2.5 text-sm text-gray-800">{fmtDate(row.effective_from)}</td>
        <td className="px-3 py-2.5 text-sm">
          <span className={row.is_active ? 'text-green-600 font-semibold' : 'text-gray-400'}>
            {row.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'edit' ? null : 'edit'))}
              className="px-2 py-1 rounded-md text-xs font-semibold bg-[#1F3864] text-white hover:bg-[#16305a]"
            >
              EDIT
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'deactivate' ? null : 'deactivate'))}
              disabled={!row.is_active}
              className="px-2 py-1 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            >
              DEACTIVATE
            </button>
          </div>
        </td>
      </tr>
      {mode === 'edit' && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={10} className="px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Contingency %">
                <input type="number" className={inputClass} value={maxPct} onChange={(e) => setMaxPct(e.target.value)} />
              </Field>
              <Field label="Max Deviation %">
                <input
                  type="number"
                  className={inputClass}
                  value={limitPct}
                  onChange={(e) => setLimitPct(e.target.value)}
                />
              </Field>
              <Field label="Change Reason">
                <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" className={primaryBtn} disabled={busy || !reason.trim()} onClick={save}>
                {busy ? 'Saving…' : 'SAVE'}
              </button>
              <button type="button" className={ghostBtn} onClick={reset}>
                Cancel
              </button>
              <Err msg={error} />
            </div>
          </td>
        </tr>
      )}
      {mode === 'deactivate' && (
        <tr className="border-b border-gray-100 bg-red-50">
          <td colSpan={10} className="px-3 py-3">
            <p className="text-sm font-semibold text-red-800 mb-2">Deactivate this contingency policy?</p>
            <Field label="Change Reason">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy || !reason.trim()}
                onClick={deactivate}
              >
                {busy ? 'Working…' : 'CONFIRM DEACTIVATE'}
              </button>
              <button type="button" className={ghostBtn} onClick={reset}>
                Cancel
              </button>
              <Err msg={error} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ContingencyTab({ rows, adminUserId }: { rows: ContingencyPolicy[]; adminUserId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <th className="px-3 py-2 font-semibold">Vertical</th>
            <th className="px-3 py-2 font-semibold">Job Category</th>
            <th className="px-3 py-2 font-semibold">Job Type</th>
            <th className="px-3 py-2 font-semibold">Tier</th>
            <th className="px-3 py-2 font-semibold">Contingency %</th>
            <th className="px-3 py-2 font-semibold">Min Deviation %</th>
            <th className="px-3 py-2 font-semibold">Max Deviation %</th>
            <th className="px-3 py-2 font-semibold">Effective From</th>
            <th className="px-3 py-2 font-semibold">Active</th>
            <th className="px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((r) => <ContingencyRow key={r.id} row={r} adminUserId={adminUserId} />)
          ) : (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-400">
                No data configured
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section 1: Payment Thresholds ─────────────────────────────────────────

function PaymentThresholdsTab({ row, adminUserId }: { row: PaymentPolicy | null; adminUserId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [coord, setCoord] = useState(String(row?.coordinator_limit ?? ''))
  const [admin, setAdmin] = useState(String(row?.admin_limit ?? ''))
  const [notes, setNotes] = useState(row?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!row) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
        No active payment policy configured.
      </div>
    )
  }

  async function save() {
    if (!row) return
    setBusy(true)
    setError(null)
    const res = await updatePaymentPolicy(row.id, adminUserId, Number(coord), Number(admin), notes)
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {!editing ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Coordinator Limit</p>
              <p className="text-lg font-bold text-gray-800">{fmtMoney(row.coordinator_limit)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Admin Limit</p>
              <p className="text-lg font-bold text-gray-800">{fmtMoney(row.admin_limit)}</p>
            </div>
          </div>
          {row.notes && <p className="mt-3 text-sm text-gray-600">{row.notes}</p>}
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Above admin limit → Super Admin notified automatically
          </p>
          <button type="button" className={`${primaryBtn} mt-4`} onClick={() => setEditing(true)}>
            EDIT
          </button>
        </>
      ) : (
        <div className="grid gap-3">
          <Field label="Coordinator Limit (₹)">
            <input type="number" className={inputClass} value={coord} onChange={(e) => setCoord(e.target.value)} />
          </Field>
          <Field label="Admin Limit (₹)">
            <input type="number" className={inputClass} value={admin} onChange={(e) => setAdmin(e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea
              rows={3}
              className={`${inputClass} resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <div className="flex items-center gap-2">
            <button type="button" className={primaryBtn} disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'SAVE'}
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => {
                setEditing(false)
                setCoord(String(row.coordinator_limit ?? ''))
                setAdmin(String(row.admin_limit ?? ''))
                setNotes(row.notes ?? '')
                setError(null)
              }}
            >
              Cancel
            </button>
            <Err msg={error} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section 1 wrapper ─────────────────────────────────────────────────────

function RatePolicySection({
  premium,
  contingency,
  payment,
  adminUserId,
}: {
  premium: PremiumPolicy[]
  contingency: ContingencyPolicy[]
  payment: PaymentPolicy | null
  adminUserId: string
}) {
  const [tab, setTab] = useState<'premium' | 'contingency' | 'payment'>('premium')

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] px-4 py-3">
        <h2 className="text-white font-bold text-sm">Rate Policy</h2>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <Pill active={tab === 'premium'} onClick={() => setTab('premium')}>
            Platform Premium
          </Pill>
          <Pill active={tab === 'contingency'} onClick={() => setTab('contingency')}>
            Contingency
          </Pill>
          <Pill active={tab === 'payment'} onClick={() => setTab('payment')}>
            Payment Thresholds
          </Pill>
        </div>
        {tab === 'premium' && <PlatformPremiumTab rows={premium} adminUserId={adminUserId} />}
        {tab === 'contingency' && <ContingencyTab rows={contingency} adminUserId={adminUserId} />}
        {tab === 'payment' && <PaymentThresholdsTab row={payment} adminUserId={adminUserId} />}
      </div>
    </section>
  )
}

// ─── Section 2: Compliance ────────────────────────────────────────────────

const COMPLIANCE_SUBTABS: { key: string; label: string; type: string | null }[] = [
  { key: 'bocw', label: 'BOCW', type: 'bocw' },
  { key: 'tds', label: 'TDS', type: 'tds' },
  { key: 'gst', label: 'GST', type: 'gst' },
  { key: 'custom', label: 'Custom', type: 'custom' },
  { key: 'all', label: 'All', type: null },
]

function AddComplianceForm({ adminUserId, onDone }: { adminUserId: string; onDone: () => void }) {
  const [complianceType, setComplianceType] = useState('bocw')
  const [name, setName] = useState('')
  const [ratePct, setRatePct] = useState('')
  const [unit, setUnit] = useState('')
  const [jobTypes, setJobTypes] = useState('')
  const [sectors, setSectors] = useState('')
  const [legalRef, setLegalRef] = useState('')
  const [notes, setNotes] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await addComplianceConfig(adminUserId, {
      compliance_type: complianceType,
      compliance_name: name.trim(),
      applicable_job_types: csvToArray(jobTypes),
      applicable_sectors: csvToArray(sectors),
      rate_pct: ratePct === '' ? null : Number(ratePct),
      threshold_value: null,
      unit: unit.trim(),
      legal_reference: legalRef.trim(),
      notes: notes.trim(),
      effective_from: effectiveFrom,
    })
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 grid gap-3 sm:grid-cols-2">
      <Field label="Compliance Type">
        <select className={inputClass} value={complianceType} onChange={(e) => setComplianceType(e.target.value)}>
          <option value="bocw">bocw</option>
          <option value="tds">tds</option>
          <option value="gst">gst</option>
          <option value="sla">sla</option>
          <option value="custom">custom</option>
        </select>
      </Field>
      <Field label="Compliance Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Rate %">
        <input type="number" className={inputClass} value={ratePct} onChange={(e) => setRatePct(e.target.value)} />
      </Field>
      <Field label="Unit">
        <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
      </Field>
      <Field label="Applicable Job Types (comma separated)">
        <input className={inputClass} value={jobTypes} onChange={(e) => setJobTypes(e.target.value)} />
      </Field>
      <Field label="Applicable Sectors (comma separated)">
        <input className={inputClass} value={sectors} onChange={(e) => setSectors(e.target.value)} />
      </Field>
      <Field label="Legal Reference">
        <input className={inputClass} value={legalRef} onChange={(e) => setLegalRef(e.target.value)} />
      </Field>
      <Field label="Effective From">
        <input type="date" className={inputClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes">
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <button type="button" className={primaryBtn} disabled={busy || !name.trim()} onClick={save}>
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

function ComplianceCard({ cfg, adminUserId }: { cfg: ComplianceConfig; adminUserId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deactivate() {
    setBusy(true)
    setError(null)
    const res = await deactivateComplianceConfig(cfg.id, adminUserId, reason.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setConfirming(false)
    router.refresh()
  }

  const jobTypes = Array.isArray(cfg.applicable_job_types) ? cfg.applicable_job_types : []
  const sectors = Array.isArray(cfg.applicable_sectors) ? cfg.applicable_sectors : []

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-800">{cfg.compliance_name ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5 uppercase">{cfg.compliance_type ?? '—'}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-800">
            {fmtPct(cfg.rate_pct)} {cfg.unit ?? ''}
          </p>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
              cfg.is_active
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            {cfg.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {(jobTypes.length > 0 || sectors.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {jobTypes.map((j) => (
            <span key={`j-${j}`} className={tag}>
              {j}
            </span>
          ))}
          {sectors.map((s) => (
            <span key={`s-${s}`} className={tag}>
              {s}
            </span>
          ))}
        </div>
      )}

      {cfg.legal_reference && <p className="mt-2 text-xs italic text-gray-400">{cfg.legal_reference}</p>}

      <p className="mt-2 text-xs text-gray-500">
        {fmtDate(cfg.effective_from)} → {fmtDate(cfg.effective_until)}
      </p>

      {cfg.notes && <p className="mt-2 text-sm text-gray-600">{cfg.notes}</p>}

      {cfg.is_active && (
        <div className="mt-3">
          {!confirming ? (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              onClick={() => setConfirming(true)}
            >
              Deactivate
            </button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <Field label="Change Reason">
                <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  disabled={busy || !reason.trim()}
                  onClick={deactivate}
                >
                  {busy ? 'Working…' : 'Confirm'}
                </button>
                <button type="button" className={ghostBtn} onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <Err msg={error} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ComplianceSection({ configs, adminUserId }: { configs: ComplianceConfig[]; adminUserId: string }) {
  const router = useRouter()
  const [tab, setTab] = useState('bocw')
  const [adding, setAdding] = useState(false)

  const activeTab = COMPLIANCE_SUBTABS.find((t) => t.key === tab) ?? COMPLIANCE_SUBTABS[0]
  const filtered =
    activeTab.type == null
      ? configs
      : configs.filter((c) => (c.compliance_type ?? '').toLowerCase() === activeTab.type)

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-[#2E74B5] px-4 py-3">
        <h2 className="text-white font-bold text-sm">Compliance</h2>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {COMPLIANCE_SUBTABS.map((t) => (
            <Pill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </Pill>
          ))}
          <button type="button" className={`${primaryBtn} ml-auto`} onClick={() => setAdding((a) => !a)}>
            {adding ? 'Cancel' : '+ Add Compliance'}
          </button>
        </div>

        {adding && (
          <AddComplianceForm
            adminUserId={adminUserId}
            onDone={() => {
              setAdding(false)
              router.refresh()
            }}
          />
        )}

        {filtered.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((c) => (
              <ComplianceCard key={c.id} cfg={c} adminUserId={adminUserId} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-6 text-center">No compliance entries in this category</p>
        )}
      </div>
    </section>
  )
}

// ─── Section 3: Business Rules ────────────────────────────────────────────

function AddBusinessRuleForm({ adminUserId, onDone }: { adminUserId: string; onDone: () => void }) {
  const [ruleName, setRuleName] = useState('')
  const [ruleCategory, setRuleCategory] = useState('estimate')
  const [ruleValue, setRuleValue] = useState('')
  const [appliesTo, setAppliesTo] = useState('all')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await addBusinessRule(adminUserId, {
      rule_name: ruleName.trim(),
      rule_category: ruleCategory,
      rule_value: ruleValue.trim(),
      applies_to: appliesTo,
      effective_from: effectiveFrom,
      notes: notes.trim(),
    })
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 grid gap-3 sm:grid-cols-2">
      <Field label="Rule Name">
        <input className={inputClass} value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
      </Field>
      <Field label="Rule Category">
        <select className={inputClass} value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)}>
          <option value="estimate">estimate</option>
          <option value="payment">payment</option>
          <option value="deployment">deployment</option>
          <option value="escalation">escalation</option>
          <option value="compliance">compliance</option>
          <option value="custom">custom</option>
        </select>
      </Field>
      <Field label="Rule Value">
        <input className={inputClass} value={ruleValue} onChange={(e) => setRuleValue(e.target.value)} />
      </Field>
      <Field label="Applies To">
        <select className={inputClass} value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
          <option value="all">all</option>
          <option value="specific job type">specific job type</option>
          <option value="specific zone">specific zone</option>
        </select>
      </Field>
      <Field label="Effective From">
        <input type="date" className={inputClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes">
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <button type="button" className={primaryBtn} disabled={busy || !ruleName.trim()} onClick={save}>
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

function BusinessRuleCard({ rule, adminUserId }: { rule: BusinessRule; adminUserId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deactivate() {
    setBusy(true)
    setError(null)
    const res = await deactivateBusinessRule(rule.id, adminUserId, reason.trim())
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setConfirming(false)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold text-gray-800">{rule.rule_name ?? '—'}</p>
        {rule.rule_category && <span className={tag}>{rule.rule_category}</span>}
      </div>

      <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
        <p className="text-sm font-semibold text-blue-800 break-words">{rule.rule_value ?? '—'}</p>
      </div>

      <p className="mt-2 text-xs text-gray-500">Applies to: {rule.applies_to ?? '—'}</p>
      <p className="text-xs text-gray-500">Effective from: {fmtDate(rule.effective_from)}</p>
      {rule.notes && <p className="mt-2 text-sm text-gray-600">{rule.notes}</p>}

      <div className="mt-3">
        {!confirming ? (
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700"
            onClick={() => setConfirming(true)}
          >
            DEACTIVATE
          </button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-red-800">Deactivate this rule?</p>
            <Field label="Change Reason">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy || !reason.trim()}
                onClick={deactivate}
              >
                {busy ? 'Working…' : 'Confirm'}
              </button>
              <button type="button" className={ghostBtn} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <Err msg={error} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BusinessRulesSection({ rules, adminUserId }: { rules: BusinessRule[]; adminUserId: string }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const active = rules.filter((r) => r.is_active)

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-[#1A6B75] px-4 py-3">
        <h2 className="text-white font-bold text-sm">Business Rules</h2>
      </div>
      <div className="p-4">
        <div className="flex justify-end mb-4">
          <button type="button" className={primaryBtn} onClick={() => setAdding((a) => !a)}>
            {adding ? 'Cancel' : '+ Add Business Rule'}
          </button>
        </div>

        {adding && (
          <AddBusinessRuleForm
            adminUserId={adminUserId}
            onDone={() => {
              setAdding(false)
              router.refresh()
            }}
          />
        )}

        {active.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((r) => (
              <BusinessRuleCard key={r.id} rule={r} adminUserId={adminUserId} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-6 text-center">No active business rules</p>
        )}
      </div>
    </section>
  )
}

// ─── Change log ──────────────────────────────────────────────────────────

function ChangeLogSection({ logs }: { logs: PolicyChangeLog[] }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-gray-700">Policy Change Log</span>
        <span className="text-xs text-gray-400">
          {logs.length} recent {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {logs.length > 0 ? (
            logs.map((l) => (
              <div key={l.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{fmtDate(l.changed_at)}</span>
                  <span className={tag}>{l.table_name ?? '—'}</span>
                  <span className="font-medium text-gray-700">{l.field_name ?? '—'}</span>
                </div>
                <p className="mt-1 text-sm text-gray-800">
                  <span className="text-gray-400 line-through">{l.old_value ?? '—'}</span>
                  {' → '}
                  <span className="font-semibold">{l.new_value ?? '—'}</span>
                </p>
                {l.change_reason && <p className="mt-0.5 text-xs text-gray-500">{l.change_reason}</p>}
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No changes logged yet</p>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Root ────────────────────────────────────────────────────────────────

export default function PolicyTabs({
  premiumPolicies,
  contingencyPolicies,
  paymentPolicies,
  complianceConfigs,
  businessRules,
  policyChangeLogs,
  adminUserId,
}: {
  premiumPolicies: PremiumPolicy[]
  contingencyPolicies: ContingencyPolicy[]
  paymentPolicies: PaymentPolicy[]
  complianceConfigs: ComplianceConfig[]
  businessRules: BusinessRule[]
  policyChangeLogs: PolicyChangeLog[]
  adminUserId: string
}) {
  return (
    <div className="space-y-6">
      <RatePolicySection
        premium={premiumPolicies}
        contingency={contingencyPolicies}
        payment={paymentPolicies[0] ?? null}
        adminUserId={adminUserId}
      />
      <ComplianceSection configs={complianceConfigs} adminUserId={adminUserId} />
      <BusinessRulesSection rules={businessRules} adminUserId={adminUserId} />
      <ChangeLogSection logs={policyChangeLogs} />
    </div>
  )
}
