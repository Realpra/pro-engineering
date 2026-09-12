'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  activateZone,
  deactivateZone,
  updateZoneDetails,
  approveRateCard,
  rejectRateCard,
  createRateCard,
  editRateCard,
  deactivateRateCard,
  approveZoneProposal,
  rejectZoneProposal,
  deferZoneProposal,
  addZoneProposal,
  updateWorkerZoneAssignment,
  addRegion,
  updateRegion,
  setRegionActive,
  type ZoneActionResult,
  type EditRateCardInput,
} from './actions'

// ─── Types ─────────────────────────────────────────────────────────────────

export type Zone = {
  id: string
  name: string | null
  level: string | null
  parent_id: string | null
  is_active: boolean | null
  trades: string[] | null
  skills: string[] | null
  job_types: string[] | null
  zone_proposal_status: string | null
  zone_proposed_by: string | null
  short_code: string | null
  description: string | null
  state: string | null
  city: string | null
  pincode: string | null
  region_name: string | null
  region_id: string | null
  [key: string]: unknown
}

export type RateCard = {
  id: string
  geo_id: string | null
  activity_code: string | null
  activity_name: string | null
  unit: string | null
  base_rate: number | string | null
  min_rate: number | string | null
  max_rate: number | string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean | null
  activity_type: string | null
  activity_skill: string | null
  activity_skill_level: string | null
  rate_change_proposed_by: string | null
  rate_change_proposed_at: string | null
  rate_change_status: string | null
  rate_change_remarks: string | null
  [key: string]: unknown
}

export type ZoneProposal = {
  id: string
  new_zone_name: string | null
  new_zone_justification: string | null
  new_zone_structure: string | null
  old_zones_affected: string[] | null
  old_zones_changes: string | null
  proposed_by: string | null
  proposed_at: string | null
  admin_decision: string | null
  admin_remarks: string | null
  admin_decided_at: string | null
  admin_decided_by: string | null
  super_admin_copy: boolean | null
  super_admin_notified_at: string | null
  [key: string]: unknown
}

// NOTE: spec/prior code assumed `zone_id` (FK) + `is_primary_zone`. Verified live —
// neither exists. Real columns: `zone_name` (plain text, no FK) and `is_primary`.
export type WorkerAssignment = {
  id: string
  worker_id: string | null
  zone_name: string | null
  is_primary: boolean | null
  worker_type: string | null
  skill_level: string | null
  job_type: string | null
  assign_date: string | null
  relocated_from: string | null
  additional_zone: boolean | null
  serial_number: number | string | null
  [key: string]: unknown
}

export type WorkerLite = {
  id: string
  full_name: string | null
  trade: string | null
  skill_level: string | null
  zones: string[] | null
  [key: string]: unknown
}

export type Region = {
  id: string
  region_name: string | null
  region_code: string | null
  state: string | null
  description: string | null
  is_active: boolean | null
  [key: string]: unknown
}

export type JobTypeConfig = {
  id: string
  job_name: string | null
  job_code: string | null
  trade_name: string | null
  is_active: boolean | null
  [key: string]: unknown
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isErr(res: ZoneActionResult): res is { error: string } {
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

function csv(v: string): string[] {
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : []
}

// ─── Shared UI ─────────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const primaryBtn = 'px-4 py-2 rounded-lg text-xs font-bold bg-[#1F3864] text-white hover:bg-[#16305a] disabled:opacity-50'
const ghostBtn = 'px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'

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

function Pills({ items, tone }: { items: string[]; tone: 'orange' | 'blue' | 'gray' }) {
  const cls =
    tone === 'orange'
      ? 'bg-orange-100 text-orange-700 border-orange-200'
      : tone === 'blue'
        ? 'bg-blue-100 text-blue-700 border-blue-200'
        : 'bg-gray-100 text-gray-600 border-gray-200'
  if (items.length === 0) return <span className="text-xs text-gray-400">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
          {i}
        </span>
      ))}
    </div>
  )
}

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

const tag = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200'

const ZONE_LEVELS = ['city', 'district', 'sector']
const WORKER_TYPES = ['skilled_trade', 'support_labour', 'supervisor', 'specialist', 'coordinator']

// ─── TAB 1: Active Zones ──────────────────────────────────────────────────

function ZoneCard({
  zone,
  adminUserId,
  workerCount,
  tradeCounts,
}: {
  zone: Zone
  adminUserId: string
  workerCount: number
  tradeCounts: { trade: string; count: number }[]
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | 'edit' | 'deactivate'>(null)
  const [name, setName] = useState(zone.name ?? '')
  const [level, setLevel] = useState(zone.level ?? 'sector')
  const [description, setDescription] = useState(zone.description ?? '')
  const [state, setState] = useState(zone.state ?? '')
  const [city, setCity] = useState(zone.city ?? '')
  const [pincode, setPincode] = useState(zone.pincode ?? '')
  const [trades, setTrades] = useState(arr(zone.trades).join(', '))
  const [skills, setSkills] = useState(arr(zone.skills).join(', '))
  const [jobTypes, setJobTypes] = useState(arr(zone.job_types).join(', '))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<ZoneActionResult>) {
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${zone.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
          <p className="text-white font-bold text-sm truncate">{zone.name ?? '—'}</p>
          {zone.short_code && (
            <span className="text-blue-200 text-xs shrink-0">({zone.short_code})</span>
          )}
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white text-[#1F3864] shrink-0 capitalize">
          {zone.level ?? '—'}
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        {zone.description && <p className="text-sm text-gray-600">{zone.description}</p>}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Cell label="State" value={zone.state ?? '—'} />
          <Cell label="City" value={zone.city ?? '—'} />
          <Cell label="Pincode" value={zone.pincode ?? '—'} />
          <Cell label="Region" value={zone.region_name ?? '—'} />
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Trades</p>
          <Pills items={arr(zone.trades)} tone="orange" />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Skills</p>
          <Pills items={arr(zone.skills)} tone="blue" />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Job Types</p>
          <Pills items={arr(zone.job_types)} tone="gray" />
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-500">
            <span className="font-bold text-gray-800">{workerCount}</span> worker{workerCount === 1 ? '' : 's'} assigned to this zone
          </p>
          {tradeCounts.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tradeCounts.map((tc) => (
                <span key={tc.trade} className={tag}>
                  {tc.trade}: {tc.count}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className={primaryBtn}
            onClick={() => setPanel((p) => (p === 'edit' ? null : 'edit'))}
          >
            EDIT
          </button>
          {zone.is_active ? (
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              onClick={() => setPanel((p) => (p === 'deactivate' ? null : 'deactivate'))}
            >
              DEACTIVATE
            </button>
          ) : (
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => run(() => activateZone(zone.id, adminUserId))}
            >
              {busy ? 'Working…' : 'ACTIVATE'}
            </button>
          )}
        </div>

        {panel === 'edit' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Name">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Level">
                <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)}>
                  {ZONE_LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="State">
                <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} />
              </Field>
              <Field label="City">
                <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="Pincode">
                <input className={inputClass} value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={2} className={`${inputClass} resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Trades (comma separated)">
              <input className={inputClass} value={trades} onChange={(e) => setTrades(e.target.value)} />
            </Field>
            <Field label="Skills (comma separated)">
              <input className={inputClass} value={skills} onChange={(e) => setSkills(e.target.value)} />
            </Field>
            <Field label="Job Types (comma separated)">
              <input className={inputClass} value={jobTypes} onChange={(e) => setJobTypes(e.target.value)} />
            </Field>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={primaryBtn}
                disabled={busy || !name.trim()}
                onClick={() =>
                  run(() =>
                    updateZoneDetails(zone.id, adminUserId, {
                      name: name.trim(),
                      level,
                      description: description.trim(),
                      state: state.trim(),
                      city: city.trim(),
                      pincode: pincode.trim(),
                      trades: csv(trades),
                      skills: csv(skills),
                      job_types: csv(jobTypes),
                    })
                  )
                }
              >
                {busy ? 'Saving…' : 'SAVE'}
              </button>
              <button type="button" className={ghostBtn} onClick={() => setPanel(null)}>
                Cancel
              </button>
              <Err msg={error} />
            </div>
          </div>
        )}

        {panel === 'deactivate' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-red-800">Deactivate this zone?</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => run(() => deactivateZone(zone.id, adminUserId))}
              >
                {busy ? 'Working…' : 'CONFIRM DEACTIVATE'}
              </button>
              <button type="button" className={ghostBtn} onClick={() => setPanel(null)}>
                Cancel
              </button>
              <Err msg={error} />
            </div>
          </div>
        )}

        {panel === null && <Err msg={error} />}
      </div>
    </div>
  )
}

function ActiveZonesTab({
  zones,
  adminUserId,
  workerAssignments,
  workers,
}: {
  zones: Zone[]
  adminUserId: string
  workerAssignments: WorkerAssignment[]
  workers: WorkerLite[]
}) {
  const workerMap = useMemo(() => {
    const m: Record<string, WorkerLite> = {}
    for (const w of workers) m[w.id] = w
    return m
  }, [workers])

  function statsFor(zone: Zone) {
    const inZone = workerAssignments.filter((a) => (a.zone_name ?? '') === (zone.name ?? ''))
    const tradeTally: Record<string, number> = {}
    for (const t of arr(zone.trades)) tradeTally[t] = 0
    for (const a of inZone) {
      const w = a.worker_id ? workerMap[a.worker_id] : undefined
      const trade = w?.trade
      if (trade && trade in tradeTally) tradeTally[trade] += 1
    }
    return {
      workerCount: inZone.length,
      tradeCounts: Object.entries(tradeTally).map(([trade, count]) => ({ trade, count })),
    }
  }

  if (zones.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
        <p className="text-sm text-gray-400">No zones configured. Add zones to get started.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {zones.map((z) => {
        const s = statsFor(z)
        return (
          <ZoneCard key={z.id} zone={z} adminUserId={adminUserId} workerCount={s.workerCount} tradeCounts={s.tradeCounts} />
        )
      })}
    </div>
  )
}

// ─── Rate card edit form (shared) ────────────────────────────────────────

const ACTIVITY_TYPES = ['labour', 'material', 'equipment', 'supervision']
const SKILL_LEVELS = ['unskilled', 'semi_skilled', 'skilled', 'highly_skilled']

function useRateCardForm(rc?: RateCard) {
  const [baseRate, setBaseRate] = useState(String(rc?.base_rate ?? ''))
  const [minRate, setMinRate] = useState(String(rc?.min_rate ?? ''))
  const [maxRate, setMaxRate] = useState(String(rc?.max_rate ?? ''))
  const [activityType, setActivityType] = useState(String(rc?.activity_type ?? 'labour'))
  const [activitySkill, setActivitySkill] = useState(String(rc?.activity_skill ?? ''))
  const [activitySkillLevel, setActivitySkillLevel] = useState(String(rc?.activity_skill_level ?? 'skilled'))
  const payload = (): EditRateCardInput => ({
    base_rate: num(baseRate),
    min_rate: num(minRate),
    max_rate: num(maxRate),
    activity_type: activityType,
    activity_skill: activitySkill.trim(),
    activity_skill_level: activitySkillLevel,
  })
  return {
    baseRate,
    setBaseRate,
    minRate,
    setMinRate,
    maxRate,
    setMaxRate,
    activityType,
    setActivityType,
    activitySkill,
    setActivitySkill,
    activitySkillLevel,
    setActivitySkillLevel,
    payload,
  }
}

function RateCardFields({ form }: { form: ReturnType<typeof useRateCardForm> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Base Rate">
        <input type="number" className={inputClass} value={form.baseRate} onChange={(e) => form.setBaseRate(e.target.value)} />
      </Field>
      <Field label="Min Rate">
        <input type="number" className={inputClass} value={form.minRate} onChange={(e) => form.setMinRate(e.target.value)} />
      </Field>
      <Field label="Max Rate">
        <input type="number" className={inputClass} value={form.maxRate} onChange={(e) => form.setMaxRate(e.target.value)} />
      </Field>
      <Field label="Activity Type">
        <select className={inputClass} value={form.activityType} onChange={(e) => form.setActivityType(e.target.value)}>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Activity Skill">
        <input className={inputClass} value={form.activitySkill} onChange={(e) => form.setActivitySkill(e.target.value)} />
      </Field>
      <Field label="Activity Skill Level">
        <select
          className={inputClass}
          value={form.activitySkillLevel}
          onChange={(e) => form.setActivitySkillLevel(e.target.value)}
        >
          {SKILL_LEVELS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}

// ─── TAB 2: Rate Card by Zone ────────────────────────────────────────────

function RateCardRow({ rc, adminUserId }: { rc: RateCard; adminUserId: string }) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | 'edit' | 'deactivate'>(null)
  const form = useRateCardForm(rc)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<ZoneActionResult>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setPanel(null)
    setReason('')
    router.refresh()
  }

  return (
    <>
      <tr className="border-b border-gray-100">
        <td className="px-3 py-2 text-sm text-gray-800">{rc.activity_code ?? '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-800">{rc.activity_name ?? '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{rc.unit ?? '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-800">{money(rc.base_rate)}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{money(rc.min_rate)}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{money(rc.max_rate)}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{rc.activity_type ?? '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{rc.activity_skill ?? '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{rc.activity_skill_level ?? '—'}</td>
        <td className="px-3 py-2 text-sm">
          <span className={rc.is_active ? 'text-green-600 font-semibold text-xs' : 'text-gray-400 text-xs'}>
            {rc.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              className="px-2 py-1 rounded-md text-xs font-semibold bg-[#1F3864] text-white hover:bg-[#16305a]"
              onClick={() => setPanel((p) => (p === 'edit' ? null : 'edit'))}
            >
              EDIT
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
              disabled={!rc.is_active}
              onClick={() => setPanel((p) => (p === 'deactivate' ? null : 'deactivate'))}
            >
              DEACTIVATE
            </button>
          </div>
        </td>
      </tr>
      {panel === 'edit' && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={11} className="px-3 py-3">
            <RateCardFields form={form} />
            <div className="mt-3">
              <Field label="Change Reason">
                <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={primaryBtn}
                disabled={busy || !reason.trim()}
                onClick={() => run(() => editRateCard(rc.id, adminUserId, form.payload(), reason.trim()))}
              >
                {busy ? 'Saving…' : 'SAVE'}
              </button>
              <button type="button" className={ghostBtn} onClick={() => setPanel(null)}>
                Cancel
              </button>
              <Err msg={error} />
            </div>
          </td>
        </tr>
      )}
      {panel === 'deactivate' && (
        <tr className="border-b border-gray-100 bg-red-50">
          <td colSpan={11} className="px-3 py-3">
            <p className="text-sm font-semibold text-red-800 mb-2">Deactivate this rate card?</p>
            <Field label="Change Reason">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy || !reason.trim()}
                onClick={() => run(() => deactivateRateCard(rc.id, adminUserId, reason.trim()))}
              >
                {busy ? 'Working…' : 'CONFIRM DEACTIVATE'}
              </button>
              <button type="button" className={ghostBtn} onClick={() => setPanel(null)}>
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

function CreateRateCardForm({
  zones,
  adminUserId,
  onDone,
}: {
  zones: Zone[]
  adminUserId: string
  onDone: () => void
}) {
  const [geoId, setGeoId] = useState(zones[0]?.id ?? '')
  const [activityCode, setActivityCode] = useState('')
  const [activityName, setActivityName] = useState('')
  const [unit, setUnit] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const form = useRateCardForm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const p = form.payload()
    const res = await createRateCard(adminUserId, {
      geo_id: geoId,
      activity_code: activityCode.trim(),
      activity_name: activityName.trim(),
      unit: unit.trim(),
      base_rate: p.base_rate,
      min_rate: p.min_rate,
      max_rate: p.max_rate,
      activity_type: p.activity_type,
      activity_skill: p.activity_skill,
      activity_skill_level: p.activity_skill_level,
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
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Zone">
          <select className={inputClass} value={geoId} onChange={(e) => setGeoId(e.target.value)}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name ?? z.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Activity Code">
          <input className={inputClass} value={activityCode} onChange={(e) => setActivityCode(e.target.value)} />
        </Field>
        <Field label="Activity Name">
          <input className={inputClass} value={activityName} onChange={(e) => setActivityName(e.target.value)} />
        </Field>
        <Field label="Unit">
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="Effective From">
          <input type="date" className={inputClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
      </div>
      <RateCardFields form={form} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={primaryBtn}
          disabled={busy || !geoId || !activityCode.trim() || !activityName.trim()}
          onClick={save}
        >
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

function RateCardTableHead() {
  return (
    <thead>
      <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
        <th className="px-3 py-2 font-semibold">Activity Code</th>
        <th className="px-3 py-2 font-semibold">Activity Name</th>
        <th className="px-3 py-2 font-semibold">Unit</th>
        <th className="px-3 py-2 font-semibold">Base Rate ₹</th>
        <th className="px-3 py-2 font-semibold">Min Rate ₹</th>
        <th className="px-3 py-2 font-semibold">Max Rate ₹</th>
        <th className="px-3 py-2 font-semibold">Activity Type</th>
        <th className="px-3 py-2 font-semibold">Activity Skill</th>
        <th className="px-3 py-2 font-semibold">Skill Level</th>
        <th className="px-3 py-2 font-semibold">Status</th>
        <th className="px-3 py-2 font-semibold">Actions</th>
      </tr>
    </thead>
  )
}

function RateCardByZoneTab({
  ratecards,
  zones,
  zoneName,
  adminUserId,
}: {
  ratecards: RateCard[]
  zones: Zone[]
  zoneName: (geoId: string | null) => string
  adminUserId: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const groups = useMemo(() => {
    const out: Record<string, RateCard[]> = {}
    for (const rc of ratecards) {
      const key = zoneName(rc.geo_id)
      if (!out[key]) out[key] = []
      out[key].push(rc)
    }
    return out
  }, [ratecards, zoneName])

  const groupNames = Object.keys(groups).sort()

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className={primaryBtn} onClick={() => setCreating((c) => !c)}>
          {creating ? 'Cancel' : 'CREATE NEW RATE CARD'}
        </button>
      </div>
      {creating && (
        <CreateRateCardForm
          zones={zones}
          adminUserId={adminUserId}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
        />
      )}

      {groupNames.length === 0 ? (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-left">
            <RateCardTableHead />
            <tbody>
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-sm text-gray-400">
                  No rate cards configured
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {groupNames.map((gn) => (
            <div key={gn}>
              <div className="bg-[#1F3864] text-white text-sm font-bold px-4 py-2 rounded-t-xl">{gn}</div>
              <div className="overflow-x-auto border border-gray-200 border-t-0 rounded-b-xl">
                <table className="w-full text-left">
                  <RateCardTableHead />
                  <tbody>
                    {groups[gn].map((rc) => (
                      <RateCardRow key={rc.id} rc={rc} adminUserId={adminUserId} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB 3: Rate Card Approval Queue ────────────────────────────────────

function RateQueueCard({
  rc,
  zoneName,
  adminUserId,
}: {
  rc: RateCard
  zoneName: string
  adminUserId: string
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | 'approve' | 'reject' | 'edit'>(null)
  const form = useRateCardForm(rc)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<ZoneActionResult>) {
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
    router.refresh()
  }

  async function editThenApprove() {
    setBusy(true)
    setError(null)
    const editRes = await editRateCard(rc.id, adminUserId, form.payload(), remarks.trim() || 'Edited before approval')
    if (isErr(editRes)) {
      setBusy(false)
      setError(editRes.error)
      return
    }
    const approveRes = await approveRateCard(rc.id, adminUserId, remarks.trim())
    setBusy(false)
    if (isErr(approveRes)) {
      setError(approveRes.error)
      return
    }
    setPanel(null)
    setRemarks('')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-800">{rc.activity_code ?? '—'} · {rc.activity_name ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">{zoneName}</p>
        </div>
        <p className="text-lg font-bold text-gray-800 shrink-0">{money(rc.base_rate)}</p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        <Cell label="Activity Type" value={rc.activity_type ?? '—'} />
        <Cell label="Activity Skill" value={rc.activity_skill ?? '—'} />
        <Cell label="Skill Level" value={rc.activity_skill_level ?? '—'} />
        <Cell label="Proposed By" value={rc.rate_change_proposed_by ?? '—'} />
        <Cell label="Proposed At" value={fmtDate(rc.rate_change_proposed_at)} />
      </div>
      {rc.rate_change_remarks && <p className="mt-2 text-sm text-gray-600">{rc.rate_change_remarks}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700"
          onClick={() => setPanel((p) => (p === 'approve' ? null : 'approve'))}
        >
          APPROVE
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700"
          onClick={() => setPanel((p) => (p === 'reject' ? null : 'reject'))}
        >
          REJECT
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600"
          onClick={() => setPanel((p) => (p === 'edit' ? null : 'edit'))}
        >
          EDIT AND APPROVE
        </button>
      </div>

      {panel === 'approve' && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 space-y-2">
          <textarea
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Approval remarks…"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => run(() => approveRateCard(rc.id, adminUserId, remarks.trim()))}
          >
            {busy ? 'Working…' : 'CONFIRM APPROVE'}
          </button>
          <Err msg={error} />
        </div>
      )}

      {panel === 'reject' && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
          <textarea
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Rejection remarks…"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50"
            disabled={busy || !remarks.trim()}
            onClick={() => run(() => rejectRateCard(rc.id, adminUserId, remarks.trim()))}
          >
            {busy ? 'Working…' : 'CONFIRM REJECT'}
          </button>
          <Err msg={error} />
        </div>
      )}

      {panel === 'edit' && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
          <RateCardFields form={form} />
          <Field label="Remarks">
            <input className={inputClass} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 text-white disabled:opacity-50"
            disabled={busy}
            onClick={editThenApprove}
          >
            {busy ? 'Working…' : 'SAVE & APPROVE'}
          </button>
          <Err msg={error} />
        </div>
      )}
    </div>
  )
}

function RateQueueTab({
  rateCardQueue,
  zoneName,
  adminUserId,
}: {
  rateCardQueue: RateCard[]
  zoneName: (geoId: string | null) => string
  adminUserId: string
}) {
  if (rateCardQueue.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
        <p className="text-sm text-gray-400">No rate cards pending approval</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rateCardQueue.map((rc) => (
        <RateQueueCard key={rc.id} rc={rc} zoneName={zoneName(rc.geo_id)} adminUserId={adminUserId} />
      ))}
    </div>
  )
}

// ─── TAB 4: New Zone Proposals ─────────────────────────────────────────

const PROPOSAL_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  approved: 'bg-green-100 text-green-700 border border-green-200',
  rejected: 'bg-red-100 text-red-700 border border-red-200',
  deferred: 'bg-gray-100 text-gray-600 border border-gray-200',
}

function AddZoneProposalForm({ adminUserId, onDone }: { adminUserId: string; onDone: () => void }) {
  const [newZoneName, setNewZoneName] = useState('')
  const [justification, setJustification] = useState('')
  const [oldZonesAffected, setOldZonesAffected] = useState('')
  const [oldZonesChanges, setOldZonesChanges] = useState('')
  const [superAdminCopy, setSuperAdminCopy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await addZoneProposal(adminUserId, {
      new_zone_name: newZoneName.trim(),
      new_zone_justification: justification.trim(),
      old_zones_affected: csv(oldZonesAffected),
      old_zones_changes: oldZonesChanges.trim(),
      super_admin_copy: superAdminCopy,
    })
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <Field label="New Zone Name">
        <input className={inputClass} value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} />
      </Field>
      <Field label="Justification">
        <textarea rows={2} className={`${inputClass} resize-none`} value={justification} onChange={(e) => setJustification(e.target.value)} />
      </Field>
      <Field label="Old Zones Affected (comma separated)">
        <input className={inputClass} value={oldZonesAffected} onChange={(e) => setOldZonesAffected(e.target.value)} />
      </Field>
      <Field label="Old Zones Changes">
        <textarea rows={2} className={`${inputClass} resize-none`} value={oldZonesChanges} onChange={(e) => setOldZonesChanges(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={superAdminCopy} onChange={(e) => setSuperAdminCopy(e.target.checked)} />
        CC Super Admin
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={primaryBtn} disabled={busy || !newZoneName.trim()} onClick={save}>
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

function ZoneProposalCard({ proposal, adminUserId }: { proposal: ZoneProposal; adminUserId: string }) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | 'approve' | 'reject' | 'defer'>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const decision = proposal.admin_decision || 'pending'

  async function run(fn: () => Promise<ZoneActionResult>) {
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
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold text-gray-800">{proposal.new_zone_name ?? '—'}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {proposal.super_admin_copy && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
              CC: Super Admin
            </span>
          )}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
              PROPOSAL_BADGE[decision] ?? PROPOSAL_BADGE.pending
            }`}
          >
            {decision}
          </span>
        </div>
      </div>

      {proposal.new_zone_justification && (
        <p className="mt-2 text-sm text-gray-700">{proposal.new_zone_justification}</p>
      )}

      {arr(proposal.old_zones_affected).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {arr(proposal.old_zones_affected).map((z) => (
            <span key={z} className={tag}>
              {z}
            </span>
          ))}
        </div>
      )}

      {proposal.old_zones_changes && (
        <p className="mt-2 text-xs text-gray-500">Changes: {proposal.old_zones_changes}</p>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Proposed by {proposal.proposed_by ?? '—'} · {fmtDate(proposal.proposed_at)}
      </p>

      {proposal.admin_remarks && (
        <p className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {proposal.admin_remarks}
        </p>
      )}

      {decision === 'pending' && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700"
              onClick={() => setPanel((p) => (p === 'approve' ? null : 'approve'))}
            >
              APPROVE
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              onClick={() => setPanel((p) => (p === 'reject' ? null : 'reject'))}
            >
              REJECT
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-500 text-white hover:bg-gray-600"
              onClick={() => setPanel((p) => (p === 'defer' ? null : 'defer'))}
            >
              DEFER
            </button>
          </div>

          {panel && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
              <textarea
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Admin remarks…"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <button
                type="button"
                className={primaryBtn}
                disabled={busy || !remarks.trim()}
                onClick={() => {
                  if (panel === 'approve') return run(() => approveZoneProposal(proposal.id, adminUserId, remarks.trim()))
                  if (panel === 'reject') return run(() => rejectZoneProposal(proposal.id, adminUserId, remarks.trim()))
                  return run(() => deferZoneProposal(proposal.id, adminUserId, remarks.trim()))
                }}
              >
                {busy ? 'Working…' : `CONFIRM ${panel.toUpperCase()}`}
              </button>
              <Err msg={error} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ZoneProposalsTab({ zoneProposals, adminUserId }: { zoneProposals: ZoneProposal[]; adminUserId: string }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className={primaryBtn} onClick={() => setAdding((a) => !a)}>
          {adding ? 'Cancel' : 'ADD NEW ZONE PROPOSAL'}
        </button>
      </div>
      {adding && (
        <AddZoneProposalForm
          adminUserId={adminUserId}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}
      {zoneProposals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No zone proposals</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {zoneProposals.map((p) => (
            <ZoneProposalCard key={p.id} proposal={p} adminUserId={adminUserId} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB 5: Zone Worker Registry ──────────────────────────────────────

function WorkerRegistryRow({
  row,
  adminUserId,
  jobTypeOptions,
}: {
  row: { a: WorkerAssignment; name: string; trade: string; skill: string }
  adminUserId: string
  jobTypeOptions: string[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [workerType, setWorkerType] = useState(row.a.worker_type ?? WORKER_TYPES[0])
  const [jobType, setJobType] = useState(row.a.job_type ?? '')
  const [assignDate, setAssignDate] = useState((row.a.assign_date ?? '').slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await updateWorkerZoneAssignment(row.a.id, adminUserId, {
      worker_type: workerType,
      job_type: jobType,
      assign_date: assignDate,
    })
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  return (
    <>
      <tr className="border-b border-gray-100 align-top">
        <td className="px-3 py-2 text-sm font-semibold text-gray-800">{row.a.serial_number != null ? `${row.trade} ${row.a.serial_number}` : '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-800">{row.name}</td>
        <td className="px-3 py-2 text-sm">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
            {row.trade}
          </span>
        </td>
        <td className="px-3 py-2 text-sm">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
            {row.skill}
          </span>
        </td>
        {!editing ? (
          <>
            <td className="px-3 py-2 text-sm text-gray-600">{row.a.worker_type ?? '—'}</td>
            <td className="px-3 py-2 text-sm text-gray-600">{row.a.job_type ?? '—'}</td>
            <td className="px-3 py-2 text-sm text-gray-600">{fmtDate(row.a.assign_date)}</td>
          </>
        ) : (
          <td colSpan={3} className="px-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <select className={inputClass} value={workerType} onChange={(e) => setWorkerType(e.target.value)}>
                {WORKER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select className={inputClass} value={jobType} onChange={(e) => setJobType(e.target.value)}>
                <option value="">Select…</option>
                {jobTypeOptions.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
              <input type="date" className={inputClass} value={assignDate} onChange={(e) => setAssignDate(e.target.value)} />
            </div>
          </td>
        )}
        <td className="px-3 py-2 text-sm">
          <div className="flex flex-wrap gap-1">
            {row.a.is_primary && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                Primary
              </span>
            )}
            {row.a.additional_zone && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                Additional
              </span>
            )}
            {row.a.relocated_from && <span className={tag}>from {row.a.relocated_from}</span>}
          </div>
        </td>
        <td className="px-3 py-2">
          {!editing ? (
            <button
              type="button"
              className="px-2 py-1 rounded-md text-xs font-semibold bg-[#1F3864] text-white hover:bg-[#16305a]"
              onClick={() => setEditing(true)}
            >
              EDIT
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button
                type="button"
                className="px-2 py-1 rounded-md text-xs font-semibold bg-green-600 text-white disabled:opacity-50"
                disabled={busy}
                onClick={save}
              >
                {busy ? '…' : 'SAVE'}
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded-md text-xs font-semibold bg-white border border-gray-300 text-gray-600"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={9} className="px-3 pb-2"><Err msg={error} /></td>
        </tr>
      )}
    </>
  )
}

function WorkerRegistryTab({
  workerAssignments,
  workers,
  jobTypeConfigs,
  adminUserId,
}: {
  workerAssignments: WorkerAssignment[]
  workers: WorkerLite[]
  jobTypeConfigs: JobTypeConfig[]
  adminUserId: string
}) {
  const [zoneQ, setZoneQ] = useState('')
  const [tradeQ, setTradeQ] = useState('')
  const [skillQ, setSkillQ] = useState('')

  const workerMap = useMemo(() => {
    const m: Record<string, WorkerLite> = {}
    for (const w of workers) m[w.id] = w
    return m
  }, [workers])

  const rows = useMemo(
    () =>
      workerAssignments.map((a) => {
        const w = a.worker_id ? workerMap[a.worker_id] : undefined
        return {
          a,
          name: w?.full_name ?? '—',
          trade: w?.trade ?? 'Unassigned Trade',
          skill: a.skill_level ?? w?.skill_level ?? '—',
          zone: a.zone_name ?? 'Unassigned',
        }
      }),
    [workerAssignments, workerMap]
  )

  const filtered = rows.filter((r) => {
    if (zoneQ && !r.zone.toLowerCase().includes(zoneQ.toLowerCase())) return false
    if (tradeQ && !r.trade.toLowerCase().includes(tradeQ.toLowerCase())) return false
    if (skillQ && !r.skill.toLowerCase().includes(skillQ.toLowerCase())) return false
    return true
  })

  // grouped by TRADE first, sorted by serial_number within each group
  const groups: Record<string, typeof filtered> = {}
  for (const r of filtered) {
    if (!groups[r.trade]) groups[r.trade] = []
    groups[r.trade].push(r)
  }
  const groupNames = Object.keys(groups).sort()
  for (const gn of groupNames) {
    groups[gn].sort((x, y) => num(x.a.serial_number) - num(y.a.serial_number))
  }

  const jobTypesByTrade = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const j of jobTypeConfigs) {
      if (!j.is_active) continue
      const trade = j.trade_name ?? ''
      if (!m[trade]) m[trade] = []
      if (j.job_name) m[trade].push(j.job_name)
    }
    return m
  }, [jobTypeConfigs])

  const inp =
    'border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4 grid gap-3 sm:grid-cols-3">
        <input className={inp} placeholder="Zone name" value={zoneQ} onChange={(e) => setZoneQ(e.target.value)} />
        <input className={inp} placeholder="Trade" value={tradeQ} onChange={(e) => setTradeQ(e.target.value)} />
        <input className={inp} placeholder="Skill level" value={skillQ} onChange={(e) => setSkillQ(e.target.value)} />
      </div>

      {groupNames.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No workers assigned to zones</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupNames.map((gn) => (
            <div key={gn}>
              <div className="bg-[#1F3864] text-white text-sm font-bold px-4 py-2 rounded-t-xl">
                {gn} <span className="text-blue-200 font-normal">({groups[gn].length})</span>
              </div>
              <div className="overflow-x-auto border border-gray-200 border-t-0 rounded-b-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Worker</th>
                      <th className="px-3 py-2 font-semibold">Trade</th>
                      <th className="px-3 py-2 font-semibold">Skill Level</th>
                      <th className="px-3 py-2 font-semibold">Worker Type</th>
                      <th className="px-3 py-2 font-semibold">Job Type</th>
                      <th className="px-3 py-2 font-semibold">Assign Date</th>
                      <th className="px-3 py-2 font-semibold">Flags</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups[gn].map((r) => (
                      <WorkerRegistryRow
                        key={r.a.id}
                        row={r}
                        adminUserId={adminUserId}
                        jobTypeOptions={jobTypesByTrade[gn] ?? []}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB 6: Regions ────────────────────────────────────────────────────

function RegionRow({ region, adminUserId }: { region: Region; adminUserId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [regionName, setRegionName] = useState(region.region_name ?? '')
  const [regionCode, setRegionCode] = useState(region.region_code ?? '')
  const [state, setState] = useState(region.state ?? '')
  const [description, setDescription] = useState(region.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<ZoneActionResult>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  return (
    <>
      <tr className="border-b border-gray-100">
        <td className="px-3 py-2 text-sm text-gray-800">{region.region_name ?? '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{region.region_code ?? '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{region.state ?? '—'}</td>
        <td className="px-3 py-2 text-sm">
          <span className={region.is_active ? 'text-green-600 font-semibold text-xs' : 'text-gray-400 text-xs'}>
            {region.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              className="px-2 py-1 rounded-md text-xs font-semibold bg-[#1F3864] text-white hover:bg-[#16305a]"
              onClick={() => setEditing((e) => !e)}
            >
              EDIT
            </button>
            {region.is_active ? (
              <button
                type="button"
                className="px-2 py-1 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => run(() => setRegionActive(region.id, adminUserId, false))}
              >
                DEACTIVATE
              </button>
            ) : (
              <button
                type="button"
                className="px-2 py-1 rounded-md text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => run(() => setRegionActive(region.id, adminUserId, true))}
              >
                ACTIVATE
              </button>
            )}
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={5} className="px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Region Name">
                <input className={inputClass} value={regionName} onChange={(e) => setRegionName(e.target.value)} />
              </Field>
              <Field label="Region Code">
                <input className={inputClass} value={regionCode} onChange={(e) => setRegionCode(e.target.value)} />
              </Field>
              <Field label="State">
                <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} />
              </Field>
            </div>
            <div className="mt-2">
              <Field label="Description">
                <textarea rows={2} className={`${inputClass} resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={primaryBtn}
                disabled={busy || !regionName.trim()}
                onClick={() =>
                  run(() =>
                    updateRegion(region.id, adminUserId, {
                      region_name: regionName.trim(),
                      region_code: regionCode.trim(),
                      state: state.trim(),
                      description: description.trim(),
                    })
                  )
                }
              >
                {busy ? 'Saving…' : 'SAVE'}
              </button>
              <button type="button" className={ghostBtn} onClick={() => setEditing(false)}>
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

function AddRegionForm({ adminUserId, onDone }: { adminUserId: string; onDone: () => void }) {
  const [regionName, setRegionName] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [state, setState] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await addRegion(adminUserId, {
      region_name: regionName.trim(),
      region_code: regionCode.trim(),
      state: state.trim(),
      description: description.trim(),
    })
    setBusy(false)
    if (isErr(res)) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Region Name">
          <input className={inputClass} value={regionName} onChange={(e) => setRegionName(e.target.value)} />
        </Field>
        <Field label="Region Code">
          <input className={inputClass} value={regionCode} onChange={(e) => setRegionCode(e.target.value)} />
        </Field>
        <Field label="State">
          <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <textarea rows={2} className={`${inputClass} resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <button type="button" className={primaryBtn} disabled={busy || !regionName.trim()} onClick={save}>
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

function RegionsTab({ regions, adminUserId }: { regions: Region[]; adminUserId: string }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className={primaryBtn} onClick={() => setAdding((a) => !a)}>
          {adding ? 'Cancel' : 'ADD REGION'}
        </button>
      </div>
      {adding && (
        <AddRegionForm
          adminUserId={adminUserId}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 font-semibold">Region Name</th>
              <th className="px-3 py-2 font-semibold">Region Code</th>
              <th className="px-3 py-2 font-semibold">State</th>
              <th className="px-3 py-2 font-semibold">Active</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {regions.length > 0 ? (
              regions.map((r) => <RegionRow key={r.id} region={r} adminUserId={adminUserId} />)
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">
                  No regions configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'zones', label: 'Active Zones' },
  { key: 'ratecards', label: 'Rate Card by Zone' },
  { key: 'queue', label: 'Rate Card Approval Queue' },
  { key: 'proposals', label: 'New Zone Proposals' },
  { key: 'registry', label: 'Zone Worker Registry' },
  { key: 'regions', label: 'Regions' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ZoneTabs({
  zones,
  ratecards,
  rateCardQueue,
  zoneProposals,
  workerAssignments,
  workers,
  regions,
  jobTypeConfigs,
  adminUserId,
}: {
  zones: Zone[]
  ratecards: RateCard[]
  rateCardQueue: RateCard[]
  zoneProposals: ZoneProposal[]
  workerAssignments: WorkerAssignment[]
  workers: WorkerLite[]
  regions: Region[]
  jobTypeConfigs: JobTypeConfig[]
  adminUserId: string
}) {
  const [tab, setTab] = useState<TabKey>('zones')

  const zoneNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const z of zones) m[z.id] = z.name ?? z.id
    return m
  }, [zones])

  const zoneName = (id: string | null) => (id ? zoneNameById[id] ?? 'Unassigned' : 'Unassigned')

  const pendingProposals = zoneProposals.filter((p) => !p.admin_decision || p.admin_decision === 'pending').length

  const counts: Partial<Record<TabKey, number>> = {
    queue: rateCardQueue.length,
    proposals: pendingProposals,
  }

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
              {c != null && c > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${
                    active ? 'bg-white text-[#F97316]' : 'bg-[#F97316] text-white'
                  }`}
                >
                  {c}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'zones' && (
        <ActiveZonesTab zones={zones} adminUserId={adminUserId} workerAssignments={workerAssignments} workers={workers} />
      )}
      {tab === 'ratecards' && (
        <RateCardByZoneTab ratecards={ratecards} zones={zones} zoneName={zoneName} adminUserId={adminUserId} />
      )}
      {tab === 'queue' && (
        <RateQueueTab rateCardQueue={rateCardQueue} zoneName={zoneName} adminUserId={adminUserId} />
      )}
      {tab === 'proposals' && <ZoneProposalsTab zoneProposals={zoneProposals} adminUserId={adminUserId} />}
      {tab === 'registry' && (
        <WorkerRegistryTab
          workerAssignments={workerAssignments}
          workers={workers}
          jobTypeConfigs={jobTypeConfigs}
          adminUserId={adminUserId}
        />
      )}
      {tab === 'regions' && <RegionsTab regions={regions} adminUserId={adminUserId} />}
    </div>
  )
}
