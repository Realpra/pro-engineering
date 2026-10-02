'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCoverage, routeJobToDriver, resolveEscalation, escalateEscalationToSuperadmin } from './actions'
import { TIER_LABEL, tierRank } from '@/lib/allocationPriority'

export type DriverUser = {
  id: string
  full_name: string | null
  email: string | null
  platform_role: 'coordinator' | 'sub_coordinator'
  coverage_states: string[] | null
  coverage_zones: string[] | null
}

export type GeoNode = { id: string; name: string; level: string | null; is_active: boolean }

export type UnroutedJob = {
  booking_ref: string
  job_title: string | null
  contact_name: string | null
  zone: string | null
  district: string | null
  created_at: string
}

export type Escalation = {
  id: string
  booking_ref: string
  substage_id: string
  trade: string
  skill_level_needed: string | null
  remark: string | null
  raised_at: string
}

export type WorkerOption = {
  id: string
  full_name: string | null
  trade: string | null
  skill_level: string | null
  zones: string[] | null
  daily_wage_inr: number | null
}

function roleLabel(r: string): string {
  return r === 'sub_coordinator' ? 'Sub-Coordinator' : 'Coordinator'
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-[#1F3864] text-white border-[#1F3864]'
          : 'bg-white text-gray-600 border-gray-300 hover:border-[#1F3864]'
      }`}
    >
      {children}
    </button>
  )
}

function CoverageEditor({ driver, states, zones }: { driver: DriverUser; states: GeoNode[]; zones: GeoNode[] }) {
  const router = useRouter()
  const [selStates, setSelStates] = useState<string[]>(driver.coverage_states ?? [])
  const [selZones, setSelZones] = useState<string[]>(driver.coverage_zones ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggle(list: string[], set: (v: string[]) => void, name: string) {
    set(list.includes(name) ? list.filter((x) => x !== name) : [...list, name])
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    await updateCoverage(driver.id, selStates, selZones)
    setSaving(false)
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-800">{driver.full_name ?? driver.email ?? 'Unnamed'}</p>
          <p className="text-xs text-gray-400">{roleLabel(driver.platform_role)} · {driver.email}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Coverage'}
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Covered States</p>
        <div className="flex flex-wrap gap-1.5">
          {states.map((s) => (
            <Chip key={s.id} active={selStates.includes(s.name)} onClick={() => toggle(selStates, setSelStates, s.name)}>
              {s.name}
            </Chip>
          ))}
          {states.length === 0 && <p className="text-xs text-gray-400">No states found in geo_hierarchy.</p>}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">
          Covered Zones <span className="text-gray-400 font-normal">(independent of states above — an NCR zone can cross a state line)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {zones.map((z) => (
            <Chip key={z.id} active={selZones.includes(z.name)} onClick={() => toggle(selZones, setSelZones, z.name)}>
              {z.name}
            </Chip>
          ))}
          {zones.length === 0 && <p className="text-xs text-gray-400">No zones found in geo_hierarchy.</p>}
        </div>
      </div>
    </div>
  )
}

function RouteJobRow({ job, drivers }: { job: UnroutedJob; drivers: DriverUser[] }) {
  const router = useRouter()
  const matching = drivers.filter((d) => job.zone && (d.coverage_zones ?? []).includes(job.zone))
  const others = drivers.filter((d) => !matching.includes(d))
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function assign() {
    if (!choice) return
    const driver = drivers.find((d) => d.id === choice)
    if (!driver) return
    setBusy(true)
    setError(null)
    const res = await routeJobToDriver(job.booking_ref, driver.id, driver.platform_role)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-800">{job.booking_ref} — {job.job_title ?? 'Untitled job'}</p>
        <p className="text-xs text-gray-500">{job.contact_name ?? 'No contact'} · {job.zone ?? 'Zone TBC'}{job.district ? `, ${job.district}` : ''}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-gray-50"
        >
          <option value="">Assign to…</option>
          {matching.length > 0 && (
            <optgroup label={`Covers ${job.zone}`}>
              {matching.map((d) => (
                <option key={d.id} value={d.id}>{roleLabel(d.platform_role)} — {d.full_name ?? d.email}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="All (no zone match confirmed)">
            {others.map((d) => (
              <option key={d.id} value={d.id}>{roleLabel(d.platform_role)} — {d.full_name ?? d.email}</option>
            ))}
          </optgroup>
        </select>
        <button
          type="button"
          onClick={assign}
          disabled={busy || !choice}
          className="bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
        >
          {busy ? 'Assigning…' : 'Assign'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  )
}

function EscalationRow({
  escalation,
  substageName,
  allWorkers,
  tier,
}: {
  escalation: Escalation
  substageName: string
  allWorkers: WorkerOption[]
  tier: string
}) {
  const router = useRouter()
  const candidates = allWorkers
    .filter((w) => w.trade === escalation.trade)
    .sort((a, b) => (a.daily_wage_inr ?? 0) - (b.daily_wage_inr ?? 0))
  const [workerId, setWorkerId] = useState('')
  const [slotDate, setSlotDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuperadminBox, setShowSuperadminBox] = useState(false)
  const [superadminRemark, setSuperadminRemark] = useState('')

  async function resolve() {
    if (!workerId || !slotDate) { setError('Pick a worker and a date.'); return }
    setBusy(true)
    setError(null)
    const res = await resolveEscalation(escalation.id, escalation.booking_ref, substageName, workerId, slotDate)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  async function escalateToSuperadmin() {
    if (!superadminRemark.trim()) { setError('Add a remark explaining why no one platform-wide can fill this.'); return }
    setBusy(true)
    setError(null)
    const res = await escalateEscalationToSuperadmin(escalation.id, superadminRemark.trim())
    setBusy(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-5 space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-800">{escalation.booking_ref} — {escalation.trade}</p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-300">{TIER_LABEL[tier] ?? tier}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{substageName}</p>
        {escalation.remark && (
          <p className="text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2 mt-2 italic">"{escalation.remark}"</p>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50">
          <option value="">Pick any {escalation.trade} platform-wide…</option>
          {candidates.map((w) => (
            <option key={w.id} value={w.id}>
              {w.full_name} — {w.skill_level} — {(w.zones ?? []).join(', ') || 'no zone'} — ₹{w.daily_wage_inr ?? '—'}/day
            </option>
          ))}
        </select>
        <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50" />
        <button type="button" onClick={resolve} disabled={busy || !workerId} className="bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">
          {busy ? 'Resolving…' : 'Resolve'}
        </button>
        {candidates.length === 0 && !showSuperadminBox && (
          <button type="button" onClick={() => setShowSuperadminBox(true)} className="text-xs font-semibold text-red-700 border border-red-300 px-3 py-2 rounded-xl">
            Nobody platform-wide — Escalate to Superadmin
          </button>
        )}
      </div>
      {showSuperadminBox && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <textarea value={superadminRemark} onChange={(e) => setSuperadminRemark(e.target.value)} placeholder="Why can nobody platform-wide fill this?" className="w-full border border-red-200 rounded-lg px-3 py-2 text-xs bg-white" rows={2} />
          <div className="flex gap-2">
            <button type="button" onClick={escalateToSuperadmin} disabled={busy} className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">Send to Superadmin</button>
            <button type="button" onClick={() => setShowSuperadminBox(false)} className="text-xs text-gray-500 px-3 py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CoordinatorsTabs({
  drivers,
  geo,
  unroutedJobs,
  escalations,
  escalationTiers,
  substageById,
  allWorkers,
}: {
  drivers: DriverUser[]
  geo: GeoNode[]
  unroutedJobs: UnroutedJob[]
  escalations: Escalation[]
  escalationTiers: Record<string, string>
  substageById: Record<string, { id: string; substage_code: string; substage_name: string }>
  allWorkers: WorkerOption[]
}) {
  const [tab, setTab] = useState<'routing' | 'coverage' | 'escalations'>('routing')
  const states = geo.filter((g) => g.level === 'state')
  const zones = geo.filter((g) => g.level === 'zone')
  // Highest-tier job's shortfall gets Admin's attention first -- same
  // priority rule as the Coordinator's own Command Center.
  const sortedEscalations = [...escalations].sort(
    (a, b) => tierRank(escalationTiers[b.booking_ref]) - tierRank(escalationTiers[a.booking_ref]),
  )

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        <Chip active={tab === 'routing'} onClick={() => setTab('routing')}>
          New-Job Routing {unroutedJobs.length > 0 && `(${unroutedJobs.length})`}
        </Chip>
        <Chip active={tab === 'coverage'} onClick={() => setTab('coverage')}>
          Zone Coverage
        </Chip>
        <Chip active={tab === 'escalations'} onClick={() => setTab('escalations')}>
          Allocation Escalations {escalations.length > 0 && `(${escalations.length})`}
        </Chip>
      </div>

      {tab === 'routing' && (
        <section>
          <p className="text-xs text-gray-500 mb-3">
            Every new job needs a Coordinator or Sub-Coordinator before anyone can act on it. The dropdown groups
            drivers who already cover the job's zone first — picking from the second group means that driver's
            coverage doesn't list this zone yet.
          </p>
          {unroutedJobs.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {unroutedJobs.map((j) => (
                <RouteJobRow key={j.booking_ref} job={j} drivers={drivers} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">No new jobs waiting for routing.</p>
            </div>
          )}
        </section>
      )}

      {tab === 'coverage' && (
        <section className="space-y-4">
          {drivers.length > 0 ? (
            drivers.map((d) => <CoverageEditor key={d.id} driver={d} states={states} zones={zones} />)
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">No Coordinator or Sub-Coordinator accounts found.</p>
            </div>
          )}
        </section>
      )}

      {tab === 'escalations' && (
        <section>
          <p className="text-xs text-gray-500 mb-3">
            A Coordinator found nobody suitable in a job's zone for one of these trades and asked
            you to pick from every worker of that trade, platform-wide.
          </p>
          {sortedEscalations.length > 0 ? (
            <div className="space-y-3">
              {sortedEscalations.map((e) => (
                <EscalationRow
                  key={e.id}
                  escalation={e}
                  substageName={substageById[e.substage_id]?.substage_code ?? e.substage_id}
                  allWorkers={allWorkers}
                  tier={escalationTiers[e.booking_ref] ?? 'budget'}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">No pending allocation escalations.</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
