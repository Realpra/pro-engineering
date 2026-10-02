'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { allocateWorkerRange, removeAllocation, escalateAllocation } from './[bookingRef]/actions'

export type Job = {
  booking_ref: string
  job_title: string | null
  zone: string | null
  district: string | null
  contact_name: string | null
  is_active: boolean | null
}

export type PendingPlanJob = { booking_ref: string; job_title: string | null; zone: string | null; confirmed_for_execution_at: string }

export type Substage = {
  id: string
  booking_ref: string
  substage_code: string
  substage_name: string
  milestone_code: string
  trade_type: string | null
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  early_start_date: string | null
  early_finish_date: string | null
  status: string
}

export type WorkerOption = {
  id: string
  full_name: string | null
  trade: string | null
  skill_level: string | null
  zones: string[] | null
  daily_wage_inr: number | null
  is_available: boolean | null
  coordinator_deployable_at: string | null
}

export type SlotRow = { worker_id: string; slot_date: string; booking_ref: string; substage_code: string; status: string }
export type Escalation = { id: string; substage_id: string; trade: string; skill_level_needed: string | null; remark: string | null; status: string; raised_at: string }

const TODAY = new Date().toISOString().split('T')[0]

function shortDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Caps how many day-cells one substage's calendar strip renders -- real job
// spans are weeks/months, not years; this just guards against a stray bad
// date pair rendering an unbounded row. The underlying assign action has no
// such cap (it books the real date range entered).
function buildDateRange(start: string, end: string, maxDays = 120): string[] {
  const dates: string[] = []
  const cur = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  let i = 0
  while (cur.getTime() <= last.getTime() && i < maxDays) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
    i++
  }
  return dates
}

// Every worker's own zones printed explicitly (never implied only by which
// optgroup they landed in -- a real gap confirmed in the old picker).
function workerLabel(w: WorkerOption) {
  const zoneText = w.zones && w.zones.length > 0 ? w.zones.join(', ') : 'no zone on file'
  return `${w.full_name} — ${zoneText} — ${(w.skill_level ?? '').replace('_', ' ')} — ₹${w.daily_wage_inr ?? '—'}/day${w.coordinator_deployable_at ? ' · ADHOC' : ''}`
}

function SubstageCalendarRow({
  bookingRef,
  zone,
  substage,
  workers,
  slotsForSubstage,
  bookedElsewhereByDate,
  workerNameById,
  pendingEscalation,
}: {
  bookingRef: string
  zone: string | null
  substage: Substage
  workers: WorkerOption[]
  slotsForSubstage: SlotRow[]
  bookedElsewhereByDate: Map<string, Map<string, string>>
  workerNameById: Record<string, string | null>
  pendingEscalation: Escalation | undefined
}) {
  const router = useRouter()
  const hasDates = !!(substage.early_start_date && substage.early_finish_date)
  const [workerId, setWorkerId] = useState('')
  const [fromDate, setFromDate] = useState(substage.early_start_date ?? TODAY)
  const [toDate, setToDate] = useState(substage.early_finish_date ?? TODAY)
  const [skipSundays, setSkipSundays] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [showEscalate, setShowEscalate] = useState(false)
  const [remark, setRemark] = useState('')

  const trade = substage.trade_type
  const candidates = workers.filter(w => w.trade === trade)
  const inZone = candidates.filter(w => zone && (w.zones ?? []).includes(zone))
  const otherZones = candidates.filter(w => !inZone.includes(w))
  const needed = (substage.skilled_workers_per_day ?? 0) + (substage.unskilled_workers_per_day ?? 0)
  const days = hasDates ? buildDateRange(substage.early_start_date!, substage.early_finish_date!) : []

  function fillFullDuration() {
    setFromDate(substage.early_start_date ?? TODAY)
    setToDate(substage.early_finish_date ?? TODAY)
  }
  function pickDay(d: string) {
    setFromDate(d)
    setToDate(d)
  }

  async function assign() {
    if (!workerId) { setError('Pick a worker.'); return }
    setBusy(true); setError(null); setResult(null)
    const res = await allocateWorkerRange({
      bookingRef, substageCode: substage.substage_code, workerId, startDate: fromDate, endDate: toDate, skipSundays,
    })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    const n = res.booked?.length ?? 0
    const c = res.conflicts?.length ?? 0
    setResult(`Booked ${n} day${n === 1 ? '' : 's'}${c > 0 ? ` · ${c} skipped — worker already on ${res.conflicts!.map(x => `${x.bookingRef} (${x.date})`).join(', ')}` : ''}`)
    setWorkerId('')
    router.refresh()
  }

  async function remove(wId: string) {
    setBusy(true)
    await removeAllocation({ bookingRef, substageCode: substage.substage_code, workerId: wId })
    setBusy(false)
    router.refresh()
  }

  async function escalate() {
    if (!remark.trim()) { setError('Add a remark explaining the shortfall.'); return }
    setBusy(true); setError(null)
    const res = await escalateAllocation({ bookingRef, substageId: substage.id, trade: trade ?? 'Unknown', skillLevelNeeded: null, remark: remark.trim() })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setShowEscalate(false); setRemark('')
    router.refresh()
  }

  const assignedByDate = new Map<string, Set<string>>()
  for (const s of slotsForSubstage) {
    if (!assignedByDate.has(s.slot_date)) assignedByDate.set(s.slot_date, new Set())
    assignedByDate.get(s.slot_date)!.add(s.worker_id)
  }
  const assignedWorkerIdsAny = [...new Set(slotsForSubstage.map(s => s.worker_id))]

  return (
    <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400">{substage.milestone_code} · {substage.substage_code}</p>
          <p className="text-sm font-bold text-gray-800">{substage.substage_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {trade ?? 'Trade TBC'} · needs {needed || '—'}/day
            {substage.skilled_workers_per_day ? ` (${substage.skilled_workers_per_day} skilled` : ''}
            {substage.unskilled_workers_per_day ? `${substage.skilled_workers_per_day ? ', ' : ' ('}${substage.unskilled_workers_per_day} unskilled)` : (substage.skilled_workers_per_day ? ')' : '')}
            {hasDates && ` · runs ${substage.early_start_date} → ${substage.early_finish_date}`}
          </p>
        </div>
      </div>

      {!hasDates && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Dates not yet set by the CPM work-program plan — run/save the milestone plan for this job first, then this substage gets its own calendar here automatically.
        </p>
      )}

      {hasDates && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {days.map(d => {
            const assignedCount = assignedByDate.get(d)?.size ?? 0
            const full = needed > 0 && assignedCount >= needed
            const some = assignedCount > 0 && !full
            return (
              <button
                key={d}
                type="button"
                onClick={() => pickDay(d)}
                className={`shrink-0 w-14 text-center rounded-lg border px-1 py-1 ${d === TODAY ? 'ring-2 ring-[#2E74B5]' : ''} ${full ? 'bg-green-50 border-green-200' : some ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'} ${fromDate === d && toDate === d ? 'outline outline-2 outline-[#1F3864]' : ''}`}
                title={d}
              >
                <p className="text-[9px] text-gray-400 leading-tight">{shortDate(d)}</p>
                <p className="text-xs font-bold text-gray-700 leading-tight">{assignedCount}/{needed || '—'}</p>
              </button>
            )
          })}
        </div>
      )}

      {assignedWorkerIdsAny.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assignedWorkerIdsAny.map(wId => (
            <span key={wId} className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full pl-2.5 pr-1 py-1">
              {workerNameById[wId] ?? 'Worker'} · {[...assignedByDate.entries()].filter(([, ids]) => ids.has(wId)).length}d
              <button type="button" onClick={() => remove(wId)} disabled={busy} className="text-green-700/60 hover:text-green-900 font-bold px-1" title="Remove from every day on this sub-stage">×</button>
            </span>
          ))}
        </div>
      )}

      {pendingEscalation && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs text-orange-800">
          Escalated to Admin — "{pendingEscalation.remark}"
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && <p className="text-xs text-green-700">{result}</p>}

      {!pendingEscalation && hasDates && (
        <div className="space-y-1.5">
          <select value={workerId} onChange={e => setWorkerId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">Add worker…</option>
            {inZone.length > 0 && (
              <optgroup label={zone ? `In ${zone}` : 'Zone match'}>
                {inZone.map(w => (
                  <option key={w.id} value={w.id}>
                    {workerLabel(w)}{bookedElsewhereByDate.get(fromDate)?.has(w.id) ? ` · ⚠ on ${bookedElsewhereByDate.get(fromDate)!.get(w.id)} on ${fromDate}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {otherZones.length > 0 && (
              <optgroup label="Other zones">
                {otherZones.map(w => (
                  <option key={w.id} value={w.id}>
                    {workerLabel(w)}{bookedElsewhereByDate.get(fromDate)?.has(w.id) ? ` · ⚠ on ${bookedElsewhereByDate.get(fromDate)!.get(w.id)} on ${fromDate}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
            <button type="button" onClick={fillFullDuration} className="text-xs font-semibold text-[#2E74B5] underline">
              Full duration
            </button>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={skipSundays} onChange={e => setSkipSundays(e.target.checked)} />
              Skip Sundays
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={assign} disabled={busy || !workerId} className="bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">
              {busy ? 'Booking…' : fromDate === toDate ? `Assign ${fromDate}` : 'Assign for Range'}
            </button>
            {candidates.length === 0 && !showEscalate && (
              <button type="button" onClick={() => setShowEscalate(true)} className="text-xs font-semibold text-orange-700 border border-orange-300 px-3 py-2 rounded-xl">
                Nobody available — Escalate to Admin
              </button>
            )}
          </div>
        </div>
      )}

      {showEscalate && !pendingEscalation && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
          <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Why is nobody available in this zone?" className="w-full border border-orange-200 rounded-lg px-3 py-2 text-xs bg-white" rows={2} />
          <div className="flex gap-2">
            <button type="button" onClick={escalate} disabled={busy} className="bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">Send to Admin</button>
            <button type="button" onClick={() => setShowEscalate(false)} className="text-xs text-gray-500 px-3 py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function JobCard({
  job,
  substages,
  workers,
  slots,
  escalations,
  workerNameById,
}: {
  job: Job
  substages: Substage[]
  workers: WorkerOption[]
  slots: SlotRow[]
  escalations: Escalation[]
  workerNameById: Record<string, string | null>
}) {
  const jobSlots = slots.filter(s => s.booking_ref === job.booking_ref)
  const todaySlots = jobSlots.filter(s => s.slot_date === TODAY)
  const totalNeededToday = substages
    .filter(s => s.early_start_date && s.early_start_date <= TODAY && s.early_finish_date && s.early_finish_date >= TODAY)
    .reduce((sum, s) => sum + (s.skilled_workers_per_day ?? 0) + (s.unskilled_workers_per_day ?? 0), 0)
  const totalAssignedToday = new Set(todaySlots.map(s => s.worker_id)).size

  // Every slot taken on any OTHER job, indexed by date, for the cross-job
  // conflict flag shown inside each substage's worker picker.
  const bookedElsewhereByDate = new Map<string, Map<string, string>>()
  for (const s of slots) {
    if (s.booking_ref === job.booking_ref) continue
    if (!bookedElsewhereByDate.has(s.slot_date)) bookedElsewhereByDate.set(s.slot_date, new Map())
    bookedElsewhereByDate.get(s.slot_date)!.set(s.worker_id, s.booking_ref)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-[#1F3864] px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-blue-300 text-xs font-semibold">{job.booking_ref}</p>
            <p className="text-white font-bold text-sm mt-0.5 leading-snug truncate">{job.job_title ?? 'Job'}</p>
            <p className="text-blue-300 text-xs mt-0.5">{[job.zone, job.district].filter(Boolean).join(', ')}{job.contact_name ? ` · ${job.contact_name}` : ''}</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${totalAssignedToday >= totalNeededToday && totalNeededToday > 0 ? 'bg-green-500/20 text-green-200 border-green-400/40' : 'bg-orange-500/20 text-orange-200 border-orange-400/40'}`}>
              {totalAssignedToday}/{totalNeededToday || '—'} crew today
            </span>
            <Link href={`/coordinator/allocate/${job.booking_ref}`} className="text-blue-200 text-xs underline">
              Full substage view →
            </Link>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {substages.map(s => (
          <SubstageCalendarRow
            key={s.id}
            bookingRef={job.booking_ref}
            zone={job.zone}
            substage={s}
            workers={workers}
            slotsForSubstage={jobSlots.filter(sl => sl.substage_code === s.substage_code)}
            bookedElsewhereByDate={bookedElsewhereByDate}
            workerNameById={workerNameById}
            pendingEscalation={escalations.find(e => e.substage_id === s.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default function CommandCenter({
  zones,
  activeZone,
  jobs,
  substages,
  workers,
  slots,
  escalations,
  pendingPlan,
}: {
  zones: string[]
  activeZone: string | null
  jobs: Job[]
  substages: Substage[]
  workers: WorkerOption[]
  slots: SlotRow[]
  escalations: Escalation[]
  pendingPlan: PendingPlanJob[]
}) {
  const workerNameById = Object.fromEntries(workers.map(w => [w.id, w.full_name]))

  const jobsWithSubstages = jobs
    .map(j => ({ job: j, substages: substages.filter(s => s.booking_ref === j.booking_ref) }))
    .filter(x => x.substages.length > 0)

  return (
    <div className="space-y-5">
      {/* PENDING ALLOCATION -- jobs already confirmed for execution with no
          work plan at all yet. These would otherwise just never appear
          anywhere; surfaced here instead of silently dropped. */}
      {pendingPlan.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">
            ⚠ Confirmed Jobs With No Work Plan Yet — {pendingPlan.length}
          </p>
          <div className="space-y-1.5">
            {pendingPlan.map(j => (
              <div key={j.booking_ref} className="flex items-center justify-between gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-orange-100">
                <span className="text-gray-700">
                  <span className="font-mono text-gray-400">{j.booking_ref}</span> — {j.job_title ?? 'Job'}{j.zone ? ` · ${j.zone}` : ''}
                  <span className="text-gray-400"> · confirmed {new Date(j.confirmed_for_execution_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </span>
                <Link href="/coordinator/estimate" className="text-orange-700 underline font-semibold shrink-0">Build Milestone Plan →</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ZONE — first filter, per the confirmed demand-then-supply discipline */}
      <div className="flex flex-wrap gap-2">
        <Link href="/coordinator/allocate" className={`text-xs font-bold px-3 py-1.5 rounded-full border ${!activeZone ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-[#1F3864] border-[#1F3864]/30'}`}>
          All Zones ({jobs.length})
        </Link>
        {zones.map(z => (
          <Link key={z} href={`/coordinator/allocate?zone=${encodeURIComponent(z)}`} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${activeZone === z ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-[#1F3864] border-[#1F3864]/30'}`}>
            {z}
          </Link>
        ))}
      </div>

      {/* JOBS — scrollable list, every job with a work plan, each showing its
          OWN full calendar (keeps extending automatically as later substages
          get their own dates) -- no one-day-at-a-time navigation, no
          one-job-at-a-time drill-in required. */}
      {jobsWithSubstages.length === 0 && pendingPlan.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No jobs with an active work plan in this zone yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {jobsWithSubstages.map(({ job, substages: jobSubstages }) => (
          <JobCard
            key={job.booking_ref}
            job={job}
            substages={jobSubstages}
            workers={workers}
            slots={slots}
            escalations={escalations}
            workerNameById={workerNameById}
          />
        ))}
      </div>
    </div>
  )
}
