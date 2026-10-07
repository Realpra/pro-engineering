'use client'

// The Coordinator-facing surface for the Dynamic Scheduling Engine
// (lib/scheduling-engine/) -- a new, additive tab, not a replacement for the
// live Coordinator Command Center (app/coordinator/allocate/*), which keeps
// running on worker_day_slots unchanged until this path is itself
// live-tested. "Materialize" turns a sub-stage's own plan dates/headcount
// (job_milestone_substages, the real Plan Template) into real day-grain
// Task Ledger rows; "Run Match" walks the confirmed -3..+3 deviance ladder
// (negative side first) then adjoining zones before declaring NO SUPPLY;
// a proposed substitute match sits pending until a Coordinator explicitly
// confirms it -- never silently auto-booked.

import { useEffect, useState, useCallback } from 'react'
import {
  getTaskLedgerData,
  materializeSubstage,
  runMatchOnSlot,
  confirmSlotMatch,
  reportSlotDelay,
  logSaviorForSlot,
  type TaskLedgerSubstage,
  type TaskLedgerSlot,
  type PendingDecision,
} from './taskLedgerActions'

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

  async function handleRunMatch(slotId: string) {
    setBusy(slotId)
    setMsg(null)
    const res = await runMatchOnSlot({ bookingRef, slotId })
    setBusy(null)
    if (res.error) setMsg({ text: res.error, ok: false })
    else {
      const r = res.result
      setMsg({
        text: r?.outcome === 'MATCHED'
          ? `Matched at ${r.match_score ?? ''} (${r.via === 'ADJOINING_ZONE' ? 'adjoining zone' : 'own zone'})${r.pendingCoordinatorDecision ? ' -- awaiting your confirmation' : ''}.`
          : 'No supply found -- own zone and adjoining zones both exhausted.',
        ok: true,
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
          <p className="text-xs text-gray-500 mt-0.5">One row per worker-slot per day. Run Match walks own zone first (deviance -3..+3, cheaper side first), then adjoining zones, before NO SUPPLY.</p>
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
                        <span className="text-xs text-gray-500">{slot.shift_window}</span>
                        <span className="text-xs text-gray-500">{slot.required_skill_code} (grade ≥{slot.min_proficiency_req})</span>
                        {slot.origin === 'Recast' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">RECAST</span>}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                      </div>
                      {substage && <p className="text-xs text-gray-400 mt-0.5">{substage.substage_name ?? substage.substage_code}</p>}
                      {slot.assigned_worker_name && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          Booked: <span className="font-semibold">{slot.assigned_worker_name}</span>
                          {slot.match_score && <> · {slot.match_score}</>}
                          {typeof slot.deviance_level_applied === 'number' && slot.deviance_level_applied !== 0 && (
                            <> · deviance {slot.deviance_level_applied > 0 ? '+' : ''}{slot.deviance_level_applied}</>
                          )}
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
                      {canRunMatch && (
                        <button
                          type="button"
                          disabled={busy === slot.slot_id}
                          onClick={() => handleRunMatch(slot.slot_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {busy === slot.slot_id ? 'Matching...' : 'Run Match'}
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
    else { setMsg({ text: 'Delay recorded -- a recast slot was created and run through matching.', ok: true }); onDone() }
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
