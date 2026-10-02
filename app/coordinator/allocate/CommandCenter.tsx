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

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function shiftDate(d: string, days: number) {
  const dt = new Date(`${d}T00:00:00`)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().split('T')[0]
}

// Each worker's own zones printed explicitly (never implied only by which
// optgroup they landed in -- a real gap confirmed in the old per-job picker).
function workerLabel(w: WorkerOption) {
  const zoneText = w.zones && w.zones.length > 0 ? w.zones.join(', ') : 'no zone on file'
  return `${w.full_name} — ${zoneText} — ${(w.skill_level ?? '').replace('_', ' ')} — ₹${w.daily_wage_inr ?? '—'}/day${w.coordinator_deployable_at ? ' · ADHOC' : ''}`
}

function SubstageAssignRow({
  date,
  bookingRef,
  zone,
  substage,
  workers,
  assignedTodayIds,
  bookedElsewhereToday,
  workerNameById,
  pendingEscalation,
}: {
  date: string
  bookingRef: string
  zone: string | null
  substage: Substage
  workers: WorkerOption[]
  assignedTodayIds: string[]
  bookedElsewhereToday: Map<string, string>
  workerNameById: Record<string, string | null>
  pendingEscalation: Escalation | undefined
}) {
  const router = useRouter()
  const [workerId, setWorkerId] = useState('')
  const [fromDate, setFromDate] = useState(date)
  const [toDate, setToDate] = useState(date)
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
  const shortfall = Math.max(0, needed - assignedTodayIds.length)

  function fillFullDuration() {
    setFromDate(substage.early_start_date ?? date)
    setToDate(substage.early_finish_date ?? date)
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
    setResult(`Booked ${n} day${n === 1 ? '' : 's'}${c > 0 ? ` · ${c} day${c === 1 ? '' : 's'} skipped — worker already on another job that day (${res.conflicts!.map(x => `${x.date} → ${x.bookingRef}`).join(', ')})` : ''}`)
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
            {substage.early_start_date && ` · runs ${substage.early_start_date} → ${substage.early_finish_date ?? '?'}`}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${shortfall > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {assignedTodayIds.length}/{needed || '—'} today
        </span>
      </div>

      {assignedTodayIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assignedTodayIds.map(wId => (
            <span key={wId} className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full pl-2.5 pr-1 py-1">
              {workerNameById[wId] ?? 'Worker'}
              <button type="button" onClick={() => remove(wId)} disabled={busy} className="text-green-700/60 hover:text-green-900 font-bold px-1">×</button>
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

      {!pendingEscalation && (
        <div className="space-y-1.5">
          <select value={workerId} onChange={e => setWorkerId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">Add worker…</option>
            {inZone.length > 0 && (
              <optgroup label={zone ? `In ${zone}` : 'Zone match'}>
                {inZone.map(w => (
                  <option key={w.id} value={w.id}>
                    {workerLabel(w)}{bookedElsewhereToday.has(w.id) ? ` · ⚠ on ${bookedElsewhereToday.get(w.id)} today` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {otherZones.length > 0 && (
              <optgroup label="Other zones">
                {otherZones.map(w => (
                  <option key={w.id} value={w.id}>
                    {workerLabel(w)}{bookedElsewhereToday.has(w.id) ? ` · ⚠ on ${bookedElsewhereToday.get(w.id)} today` : ''}
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
            {substage.early_start_date && (
              <button type="button" onClick={fillFullDuration} className="text-xs font-semibold text-[#2E74B5] underline">
                Fill full substage duration
              </button>
            )}
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={skipSundays} onChange={e => setSkipSundays(e.target.checked)} />
              Skip Sundays
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={assign} disabled={busy || !workerId} className="bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">
              {busy ? 'Booking…' : fromDate === toDate ? 'Assign' : 'Assign for Range'}
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
  date,
  job,
  substages,
  workers,
  slots,
  escalations,
  workerNameById,
}: {
  date: string
  job: Job
  substages: Substage[]
  workers: WorkerOption[]
  slots: SlotRow[]
  escalations: Escalation[]
  workerNameById: Record<string, string | null>
}) {
  const jobSlotsToday = slots.filter(s => s.booking_ref === job.booking_ref)
  const totalNeeded = substages.reduce((sum, s) => sum + (s.skilled_workers_per_day ?? 0) + (s.unskilled_workers_per_day ?? 0), 0)
  const totalAssigned = new Set(jobSlotsToday.map(s => s.worker_id)).size

  // Every slot taken TODAY on any OTHER job, for the cross-job conflict flag
  // shown inside each substage's worker picker.
  const bookedElsewhereToday = new Map<string, string>()
  for (const s of slots) {
    if (s.booking_ref !== job.booking_ref) bookedElsewhereToday.set(s.worker_id, s.booking_ref)
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
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${totalAssigned >= totalNeeded && totalNeeded > 0 ? 'bg-green-500/20 text-green-200 border-green-400/40' : 'bg-orange-500/20 text-orange-200 border-orange-400/40'}`}>
              {totalAssigned}/{totalNeeded || '—'} crew today
            </span>
            <Link href={`/coordinator/allocate/${job.booking_ref}`} className="text-blue-200 text-xs underline">
              Full substage view →
            </Link>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {substages.map(s => (
          <SubstageAssignRow
            key={s.id}
            date={date}
            bookingRef={job.booking_ref}
            zone={job.zone}
            substage={s}
            workers={workers}
            assignedTodayIds={[...new Set(jobSlotsToday.filter(sl => sl.substage_code === s.substage_code).map(sl => sl.worker_id))]}
            bookedElsewhereToday={bookedElsewhereToday}
            workerNameById={workerNameById}
            pendingEscalation={escalations.find(e => e.substage_id === s.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default function CommandCenter({
  date,
  zones,
  activeZone,
  jobs,
  substages,
  workers,
  slots,
  escalations,
}: {
  date: string
  zones: string[]
  activeZone: string | null
  jobs: Job[]
  substages: Substage[]
  workers: WorkerOption[]
  slots: SlotRow[]
  escalations: Escalation[]
}) {
  const workerNameById = Object.fromEntries(workers.map(w => [w.id, w.full_name]))
  const zoneQS = activeZone ? `&zone=${encodeURIComponent(activeZone)}` : ''

  const jobsWithSubstages = jobs
    .map(j => ({ job: j, substages: substages.filter(s => s.booking_ref === j.booking_ref) }))
    .filter(x => x.substages.length > 0)

  return (
    <div className="space-y-5">
      {/* ZONE — first filter, per the confirmed demand-then-supply discipline */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/coordinator/allocate?date=${date}`} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${!activeZone ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-[#1F3864] border-[#1F3864]/30'}`}>
          All Zones ({jobs.length})
        </Link>
        {zones.map(z => (
          <Link key={z} href={`/coordinator/allocate?date=${date}&zone=${encodeURIComponent(z)}`} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${activeZone === z ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-[#1F3864] border-[#1F3864]/30'}`}>
            {z}
          </Link>
        ))}
      </div>

      {/* DAY — second filter. Every job with a substage active this day shows
          automatically below; nothing is gated on guest_enquiries.status. */}
      <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200 px-3 py-2.5">
        <Link href={`/coordinator/allocate?date=${shiftDate(date, -1)}${zoneQS}`} className="text-[#2E74B5] font-bold px-2">‹</Link>
        <div className="flex-1 text-center">
          <p className="text-sm font-bold text-gray-800">{fmtDate(date)}</p>
          {date !== new Date().toISOString().split('T')[0] && (
            <Link href={`/coordinator/allocate?date=${new Date().toISOString().split('T')[0]}${zoneQS}`} className="text-[10px] text-[#2E74B5] underline">Jump to today</Link>
          )}
        </div>
        <Link href={`/coordinator/allocate?date=${shiftDate(date, 1)}${zoneQS}`} className="text-[#2E74B5] font-bold px-2">›</Link>
      </div>

      {/* JOBS — scrollable list, every job with live demand that day, no
          one-job-at-a-time navigation required. */}
      {jobsWithSubstages.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No sub-stage work scheduled for this zone on {fmtDate(date)}.</p>
        </div>
      )}

      <div className="space-y-4">
        {jobsWithSubstages.map(({ job, substages: jobSubstages }) => (
          <JobCard
            key={job.booking_ref}
            date={date}
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
