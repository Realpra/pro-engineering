'use client'

// The Deployer-facing surface for the Dynamic Scheduling Engine
// (lib/scheduling-engine/) -- "Deployer" is whichever role is actually
// driving this job (Coordinator, Admin, or Super Admin; see
// requireAllocator() in taskLedgerActions.ts), not a Coordinator-only
// concept -- also reachable cross-job from /coordinator/dynamic-scheduler,
// which links back into this same tab per booking rather than duplicating
// any of this logic. "Materialize" turns a sub-stage's own plan
// dates/headcount (job_milestone_substages, the real Plan Template) into
// real day-grain Task Ledger rows, split into separate skilled (the
// sub-stage's own trade) and unskilled ('Helper') demand buckets; "Find
// Candidates" walks the confirmed -3..+3 deviance ladder (negative/cheaper
// side first, fully, then positive/costlier side as a last resort) then
// adjoining zones before declaring NO SUPPLY, and returns the full ranked
// list (by jobs completed) to pick from -- never a silent auto-pick, for an
// ordinary slot or a delay-recast slot alike. NO LEVEL IS EVER GATED OR
// SKIPPED by policy (10 Oct 2026 correction: "there is no automatic booking
// by system/program... there is no allow/not allow embargo") -- every
// level, at every zone, is always checked and shown; the human always picks.
//
// RECAST SLOTS RUN THE WALK AUTOMATICALLY (10 Oct 2026 correction): the
// project owner was explicit -- once a delay is logged, "the whole program
// gets revised... allot all skills afresh... deviance run" has to happen as
// part of the recast itself, not sit blank waiting for a manual Find-
// Candidates click per shifted slot. Every slot with origin==='Recast' (the
// fresh slots re-materialized at the CPM-recomputed dates for every
// sub-stage that actually moved -- see recast.ts, NOT a flat date-add to
// every later row) has its deviance walk triggered the moment this tab
// loads -- see the auto-fetch effect below -- so its real candidate list is
// already showing, with only the final Book click left as a human decision
// (never silently auto-booked). Ordinary freshly-Materialized
// (origin==='Planned') slots keep the manual Find Candidates button,
// unchanged -- that flow was already confirmed correct and wasn't what this
// correction was about. A booked slot can always be cancelled/unassigned,
// unconditionally -- "system shall not fail/obstruct that logic" -- see
// handleCancel below.

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getTaskLedgerData,
  materializeSubstage,
  confirmSlotMatch,
  reportSlotDelay,
  logSaviorForSlot,
  setSlotShiftWindow,
  findCandidatesForSlot,
  assignCandidate,
  cancelSlotBooking,
  type TaskLedgerSubstage,
  type TaskLedgerSlot,
  type PendingDecision,
} from './taskLedgerActions'
import type { CandidateListResult } from '@/lib/scheduling-engine/match'

type Props = { bookingRef: string }

function statusBadge(slot: TaskLedgerSlot): { label: string; cls: string } {
  if (slot.slot_status === 'Cancelled_Delayed') return { label: 'Delayed', cls: 'bg-red-100 text-red-800 border-red-300' }
  if (slot.compliance_check_status === 'NO SUPPLY') return { label: 'No Supply', cls: 'bg-red-100 text-red-800 border-red-300' }
  if (slot.operational_action_trigger === 'BUILD_UPSKILL_SUPERVISE' && !slot.assigned_worker_id) {
    return { label: 'Awaiting Coordinator', cls: 'bg-amber-100 text-amber-800 border-amber-300' }
  }
  if (slot.assigned_worker_id) return { label: 'Matched', cls: 'bg-green-100 text-green-800 border-green-300' }
  return { label: 'Unmatched', cls: 'bg-gray-100 text-gray-700 border-gray-300' }
}

export default function TaskLedgerTab({ bookingRef }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [substages, setSubstages] = useState<TaskLedgerSubstage[]>([])
  const [slots, setSlots] = useState<TaskLedgerSlot[]>([])
  const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [delayFormFor, setDelayFormFor] = useState<string | null>(null)
  const [saviorFormFor, setSaviorFormFor] = useState<string | null>(null)
  const [candidateListFor, setCandidateListFor] = useState<string | null>(null)
  const [candidateList, setCandidateList] = useState<CandidateListResult | null>(null)
  const [recastCandidates, setRecastCandidates] = useState<Record<string, CandidateListResult>>({})
  const fetchedRecastRef = useRef<Set<string>>(new Set())

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    getTaskLedgerData(bookingRef).then(res => {
      if (res.error) setLoadError(res.error)
      else {
        setSubstages(res.substages ?? [])
        setSlots(res.slots ?? [])
        setPendingDecisions(res.pendingDecisions ?? [])
      }
      setLoading(false)
    })
  }, [bookingRef])

  useEffect(() => { load() }, [load])

  // Auto-run the deviance walk for every unmatched Recast-origin slot the moment it's visible
  // -- see the file header's "RECAST SLOTS RUN THE WALK AUTOMATICALLY" note.
  useEffect(() => {
    const toFetch = slots.filter(
      s => s.origin === 'Recast' && s.slot_status === 'Pending' && !s.assigned_worker_id && !fetchedRecastRef.current.has(s.slot_id)
    )
    if (toFetch.length === 0) return
    for (const s of toFetch) {
      fetchedRecastRef.current.add(s.slot_id)
      findCandidatesForSlot({ bookingRef, slotId: s.slot_id }).then(res => {
        if (res.result) setRecastCandidates(prev => ({ ...prev, [s.slot_id]: res.result! }))
      })
    }
  }, [slots, bookingRef])

  async function handleMaterialize(substageId: string) {
    setBusy(substageId)
    setMsg(null)
    const res = await materializeSubstage({ bookingRef, substageId })
    setBusy(null)
    if (res.error) setMsg({ text: res.error, ok: false })
    else {
      setMsg({ text: `Materialized ${res.inserted ?? 0} new slot(s).`, ok: true })
      load()
    }
  }

  async function handleShiftChange(slotId: string, shiftWindow: 'AM' | 'PM' | 'FULL_DAY') {
    setBusy(slotId)
    setMsg(null)
    const res = await setSlotShiftWindow({ bookingRef, slotId, shiftWindow })
    setBusy(null)
    if (res.error) setMsg({ text: res.error, ok: false })
    else load()
  }

  async function handleFindCandidates(slotId: string) {
    if (candidateListFor === slotId) { setCandidateListFor(null); setCandidateList(null); return }
    setBusy(slotId)
    setMsg(null)
    const res = await findCandidatesForSlot({ bookingRef, slotId })
    setBusy(null)
    if (res.error) { setMsg({ text: res.error, ok: false }); return }
    setCandidateListFor(slotId)
    setCandidateList(res.result ?? { via: 'NONE', level: null, candidates: [] })
  }

  async function handleAssign(slotId: string, candidate: { id: string; deviance_level: number; match_score: string }) {
    setBusy(slotId)
    setMsg(null)
    const res = await assignCandidate({
      bookingRef, slotId, workerId: candidate.id, devianceLevel: candidate.deviance_level, matchScore: candidate.match_score,
    })
    setBusy(null)
    if (res.error) setMsg({ text: res.error, ok: false })
    else {
      setMsg({ text: 'Worker booked.', ok: true })
      setCandidateListFor(null)
      setCandidateList(null)
      setRecastCandidates(prev => {
        const next = { ...prev }
        delete next[slotId]
        return next
      })
      load()
    }
  }

  async function handleConfirm(decision: PendingDecision) {
    setBusy(decision.slotId)
    setMsg(null)
    const res = await confirmSlotMatch({ bookingRef, slotId: decision.slotId, workerId: decision.candidateWorkerId })
    setBusy(null)
    if (res.error) setMsg({ text: res.error, ok: false })
    else { setMsg({ text: 'Substitute confirmed and booked.', ok: true }); load() }
  }

  // Always available for a booked slot -- "one alloted can always be cancelled. system shall
  // not fail/obstruct that logic" (10 Oct 2026 correction). No condition gates this beyond the
  // worker actually being booked; the slot goes back to Unmatched and the worker is freed.
  async function handleCancel(slotId: string) {
    if (!window.confirm('Cancel this booking? The worker will be freed and this slot returns to Unmatched.')) return
    setBusy(slotId)
    setMsg(null)
    const res = await cancelSlotBooking({ bookingRef, slotId })
    setBusy(null)
    if (res.error) setMsg({ text: res.error, ok: false })
    else { setMsg({ text: 'Booking cancelled -- worker freed, slot is Unmatched again.', ok: true }); load() }
  }

  const pendingBySlot = new Map(pendingDecisions.map(d => [d.slotId, d]))
  const substageById = new Map(substages.map(s => [s.id, s]))

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading task ledger...</div>
  if (loadError) return <div className="p-6 text-sm text-red-600">{loadError}</div>

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`rounded-lg border px-4 py-2 text-sm ${msg.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-bold text-sm text-[#1F3864]">Sub-Stages -- Materialize Work Program</h3>
          <p className="text-xs text-gray-500 mt-0.5">Turns each sub-stage&apos;s own plan dates + headcount into real day-grain Task Ledger slots. Safe to run again -- only the shortfall is inserted.</p>
        </div>
        {substages.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">No sub-stages found for this booking yet -- build the Milestone Plan first.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {substages.map(s => {
              const slotCount = slots.filter(sl => sl.substage_id === s.id).length
              return (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{s.substage_name ?? s.substage_code ?? s.id}</p>
                    <p className="text-xs text-gray-500">
                      {s.trade_type} · {s.early_start_date} → {s.early_finish_date} · {(s.skilled_workers_per_day ?? 0) + (s.unskilled_workers_per_day ?? 0)}/day · {slotCount} slot(s) materialized
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => handleMaterialize(s.id)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1F3864] text-white hover:bg-[#15294d] disabled:opacity-50"
                  >
                    {busy === s.id ? 'Working...' : 'Materialize'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-bold text-sm text-[#1F3864]">Task Ledger Slots</h3>
          <p className="text-xs text-gray-500 mt-0.5">One row per worker-slot per day (skilled and Helper demand listed separately). Set Full Day or AM/PM, then Find Candidates -- own zone first (deviance -3..+3, cheaper side exhausted first, then costlier as last resort), then adjoining zones, before NO SUPPLY -- every level is shown, nothing is auto-booked or blocked, you pick who to book from the list. A RECAST slot (re-materialized at the whole job's recomputed dates after a delay) runs this walk automatically -- no button needed, just review and Book once it appears. A booked slot can always be cancelled -- see Cancel Booking.</p>
        </div>
        {slots.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">No slots yet -- materialize a sub-stage above first.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {slots.map(slot => {
              const badge = statusBadge(slot)
              const decision = pendingBySlot.get(slot.slot_id)
              const substage = slot.substage_id ? substageById.get(slot.substage_id) : null
              const canRunMatch = slot.slot_status === 'Pending' && !slot.assigned_worker_id && badge.label !== 'Awaiting Coordinator'
              const canReportDelay = slot.slot_status === 'Pending'
              const canLogSavior = badge.label === 'No Supply'
              return (
                <div key={slot.slot_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{slot.target_date}</span>
                        {canRunMatch ? (
                          <select
                            value={slot.shift_window}
                            disabled={busy === slot.slot_id}
                            onChange={e => handleShiftChange(slot.slot_id, e.target.value as 'AM' | 'PM' | 'FULL_DAY')}
                            className="text-xs border rounded px-1.5 py-0.5 text-gray-700"
                          >
                            <option value="FULL_DAY">Full Day</option>
                            <option value="AM">Half Day -- AM</option>
                            <option value="PM">Half Day -- PM</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500">{slot.shift_window === 'FULL_DAY' ? 'Full Day' : `Half Day -- ${slot.shift_window}`}</span>
                        )}
                        <span className="text-xs text-gray-500">{slot.required_skill_code} (grade ≥{slot.min_proficiency_req})</span>
                        {slot.origin === 'Recast' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">RECAST</span>}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                      </div>
                      {substage && <p className="text-xs text-gray-400 mt-0.5">{substage.substage_name ?? substage.substage_code}</p>}
                      {slot.assigned_worker_name && (
                        <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>
                            Booked: <span className="font-semibold">{slot.assigned_worker_name}</span>
                            {slot.match_score && <> · {slot.match_score}</>}
                            {typeof slot.deviance_level_applied === 'number' && slot.deviance_level_applied !== 0 && (
                              <> · deviance {slot.deviance_level_applied > 0 ? '+' : ''}{slot.deviance_level_applied}</>
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={busy === slot.slot_id}
                            onClick={() => handleCancel(slot.slot_id)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {busy === slot.slot_id ? 'Working...' : 'Cancel Booking'}
                          </button>
                        </p>
                      )}
                      {decision && (
                        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <p className="font-semibold">Proposed substitute: {decision.candidateWorkerName} ({decision.skillMatchPct ?? 'score n/a'}{typeof decision.devianceLevel === 'number' ? `, deviance ${decision.devianceLevel > 0 ? '+' : ''}${decision.devianceLevel}` : ''})</p>
                          {decision.decisionReason && <p className="mt-0.5 text-amber-700">{decision.decisionReason}</p>}
                          <button
                            type="button"
                            disabled={busy === slot.slot_id}
                            onClick={() => handleConfirm(decision)}
                            className="mt-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {busy === slot.slot_id ? 'Confirming...' : 'Confirm This Substitute'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canRunMatch && slot.origin !== 'Recast' && (
                        <button
                          type="button"
                          disabled={busy === slot.slot_id}
                          onClick={() => handleFindCandidates(slot.slot_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {busy === slot.slot_id ? 'Searching...' : candidateListFor === slot.slot_id ? 'Hide Candidates' : 'Find Candidates'}
                        </button>
                      )}
                      {canReportDelay && (
                        <button
                          type="button"
                          onClick={() => setDelayFormFor(delayFormFor === slot.slot_id ? null : slot.slot_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-gray-300 text-gray-700 hover:border-gray-400"
                        >
                          Report Delay
                        </button>
                      )}
                      {canLogSavior && (
                        <button
                          type="button"
                          onClick={() => setSaviorFormFor(saviorFormFor === slot.slot_id ? null : slot.slot_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-gray-300 text-gray-700 hover:border-gray-400"
                        >
                          Log Savior
                        </button>
                      )}
                    </div>
                  </div>

                  {slot.origin !== 'Recast' && candidateListFor === slot.slot_id && candidateList && (
                    <CandidateListBody result={candidateList} slotId={slot.slot_id} busy={busy === slot.slot_id} onBook={handleAssign} />
                  )}

                  {canRunMatch && slot.origin === 'Recast' && (
                    recastCandidates[slot.slot_id] ? (
                      <CandidateListBody
                        result={recastCandidates[slot.slot_id]}
                        slotId={slot.slot_id}
                        busy={busy === slot.slot_id}
                        onBook={handleAssign}
                        autoRun
                      />
                    ) : (
                      <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900">
                        Running the deviance walk for this recast slot...
                      </div>
                    )
                  )}

                  {delayFormFor === slot.slot_id && (
                    <DelayForm
                      bookingRef={bookingRef}
                      slotId={slot.slot_id}
                      requiredSkillCode={slot.required_skill_code}
                      busy={busy === slot.slot_id}
                      setBusy={setBusy}
                      setMsg={setMsg}
                      onDone={() => { setDelayFormFor(null); load() }}
                    />
                  )}
                  {saviorFormFor === slot.slot_id && (
                    <SaviorForm
                      bookingRef={bookingRef}
                      slotId={slot.slot_id}
                      requiredSkillCode={slot.required_skill_code}
                      busy={busy === slot.slot_id}
                      setBusy={setBusy}
                      setMsg={setMsg}
                      onDone={() => { setSaviorFormFor(null); load() }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Shared candidate-list renderer -- used both for the manual Find-Candidates flow (ordinary
// Planned slots) and the automatic recast flow (autoRun, Recast-origin slots, no button needed
// to see it -- see the file header's "RECAST SLOTS RUN THE WALK AUTOMATICALLY" note).
function CandidateListBody({ result, slotId, busy, onBook, autoRun }: {
  result: CandidateListResult
  slotId: string
  busy: boolean
  onBook: (slotId: string, candidate: { id: string; deviance_level: number; match_score: string }) => void
  autoRun?: boolean
}) {
  const cls = autoRun ? 'border-purple-200 bg-purple-50' : 'border-blue-200 bg-blue-50'
  const textCls = autoRun ? 'text-purple-900' : 'text-blue-900'
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 ${cls}`}>
      {result.candidates.length === 0 ? (
        <p className={`text-xs ${textCls}`}>
          No eligible worker found -- own zone and adjoining zones both exhausted at every deviance level.
        </p>
      ) : (
        <>
          <p className={`text-xs font-semibold mb-1.5 ${textCls}`}>
            {autoRun && 'Recast -- '}{result.candidates.length} eligible at deviance {result.level! > 0 ? '+' : ''}{result.level}
            {' '}({result.via === 'ADJOINING_ZONE' ? 'adjoining zone' : 'own zone'}) -- ranked by jobs completed (track record), pick who to book:
          </p>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {result.candidates.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 bg-white rounded px-2 py-1.5 border border-gray-100">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-gray-800">{c.full_name}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    {c.match_score}{c.deviance_level !== 0 ? ` · deviance ${c.deviance_level > 0 ? '+' : ''}${c.deviance_level}` : ''}
                    {typeof c.jobs_completed === 'number' ? ` · ${c.jobs_completed} jobs done` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onBook(slotId, c)}
                  className="shrink-0 px-2.5 py-1 rounded text-[11px] font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Book
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DelayForm({ bookingRef, slotId, requiredSkillCode, busy, setBusy, setMsg, onDone }: {
  bookingRef: string
  slotId: string
  requiredSkillCode: string
  busy: boolean
  setBusy: (id: string | null) => void
  setMsg: (m: { text: string; ok: boolean } | null) => void
  onDone: () => void
}) {
  const [eventType, setEventType] = useState('client_delay')
  const [daysLost, setDaysLost] = useState('1')
  const [skillChanged, setSkillChanged] = useState(false)
  const [newSkill, setNewSkill] = useState(requiredSkillCode)
  const [reasonCategory, setReasonCategory] = useState<'Client' | 'Project Reasons' | 'Beyond Control'>('Project Reasons')
  const [remarks, setRemarks] = useState('')

  async function submit() {
    setBusy(slotId)
    setMsg(null)
    const res = await reportSlotDelay({
      bookingRef,
      affectedSlotId: slotId,
      eventType,
      daysLost: Number(daysLost) || 0,
      skillChanged,
      newRequiredSkillCode: skillChanged ? newSkill : undefined,
      reasonCategory,
      reasonRemarks: remarks || undefined,
    })
    setBusy(null)
    if (res.error) setMsg({ text: res.error, ok: false })
    else {
      const subCount = res.affectedSubstageIds?.length ?? 0
      const inserted = res.insertedCount ?? 0
      setMsg({
        text: subCount > 0
          ? `Delay recorded -- the job's whole schedule was recomputed (real dependency-aware CPM, not a flat shift). ${subCount} sub-stage(s) actually moved as a result, and ${inserted} fresh slot(s) were re-materialized at their new dates. Candidates are being found automatically for each recast slot -- review and Book below.`
          : "Delay recorded and the job's schedule was recomputed -- no other sub-stage's dates actually changed as a result.",
        ok: true,
      })
      onDone()
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-gray-600">Event type</span>
          <input value={eventType} onChange={e => setEventType(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" placeholder="e.g. client_delay" />
        </label>
        <label className="block">
          <span className="text-gray-600">Days lost</span>
          <input type="number" min="0" value={daysLost} onChange={e => setDaysLost(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={skillChanged} onChange={e => setSkillChanged(e.target.checked)} />
        <span className="text-gray-600">Skill requirement changed for the recast slot</span>
      </label>
      {skillChanged && (
        <label className="block">
          <span className="text-gray-600">New required skill code</span>
          <input value={newSkill} onChange={e => setNewSkill(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" />
        </label>
      )}
      <label className="block">
        <span className="text-gray-600">Reason category</span>
        <select value={reasonCategory} onChange={e => setReasonCategory(e.target.value as typeof reasonCategory)} className="mt-0.5 w-full border rounded px-2 py-1">
          <option value="Client">Client</option>
          <option value="Project Reasons">Project Reasons</option>
          <option value="Beyond Control">Beyond Control</option>
        </select>
      </label>
      <label className="block">
        <span className="text-gray-600">Remarks</span>
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" rows={2} />
      </label>
      <button type="button" disabled={busy} onClick={submit} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
        {busy ? 'Submitting...' : 'Submit Delay Report'}
      </button>
    </div>
  )
}

function SaviorForm({ bookingRef, slotId, requiredSkillCode, busy, setBusy, setMsg, onDone }: {
  bookingRef: string
  slotId: string
  requiredSkillCode: string
  busy: boolean
  setBusy: (id: string | null) => void
  setMsg: (m: { text: string; ok: boolean } | null) => void
  onDone: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [rateAgreed, setRateAgreed] = useState('')
  const [remarks, setRemarks] = useState('')

  async function submit() {
    if (!fullName.trim()) { setMsg({ text: 'Savior name is required.', ok: false }); return }
    setBusy(slotId)
    setMsg(null)
    const res = await logSaviorForSlot({
      bookingRef,
      slotId,
      fullName: fullName.trim(),
      mobile: mobile || undefined,
      tradeCode: requiredSkillCode,
      rateAgreed: rateAgreed ? Number(rateAgreed) : undefined,
      remarks: remarks || undefined,
    })
    setBusy(null)
    if (res.error) setMsg({ text: res.error, ok: false })
    else { setMsg({ text: 'Savior logged -- an off-system emergency worker record, not added to the Worker Master.', ok: true }); onDone() }
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 space-y-2 text-xs">
      <p className="text-gray-500">Absolute last resort -- own zone and adjoining zones both exhausted. A Savior is a record, not an onboarded worker.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-gray-600">Full name</span>
          <input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-gray-600">Mobile</span>
          <input value={mobile} onChange={e => setMobile(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" />
        </label>
      </div>
      <label className="block">
        <span className="text-gray-600">Rate agreed (₹)</span>
        <input type="number" min="0" value={rateAgreed} onChange={e => setRateAgreed(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" />
      </label>
      <label className="block">
        <span className="text-gray-600">Remarks</span>
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" rows={2} />
      </label>
      <button type="button" disabled={busy} onClick={submit} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50">
        {busy ? 'Submitting...' : 'Log Savior'}
      </button>
    </div>
  )
}
