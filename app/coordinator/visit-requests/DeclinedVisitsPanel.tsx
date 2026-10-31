'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { overrideDecline, confirmPending, reassignVisit, deferVisitForClientNextSlot } from './actions'

export type DeclinedSlot = {
  id: string
  scheduled_date: string
  slot_start: string | null
  slot_end: string | null
  slot_type: string | null
  site_id: string | null
  decline_reason: string | null
  declined_at: string | null
  supervisor_id: string | null
}

function fmtDate(v: string): string {
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Project owner's rule (29 Sep 2026, corrected 30 Sep 2026): a supervisor's
// decline needs a real yes/no from a higher role. "Override" keeps the slot
// assigned as originally planned; "Confirm — Send to Pending" explicitly
// records agreement that it opens up for any supervisor to self-pick-up
// (app/supervisor/route/plan's own "Pending Visits — Pick Up" section reads
// the same rows either way -- confirming doesn't change WHEN a slot becomes
// pickup-eligible, only that a real decision got recorded instead of silence).
export default function DeclinedVisitsPanel({
  slots,
  bookingRefBySiteId,
  supervisorNameById,
  overriddenByUserId,
  byRole,
  supervisors,
  visitManagers,
  siteManagerBySiteId,
}: {
  slots: DeclinedSlot[]
  bookingRefBySiteId: Record<string, string>
  supervisorNameById: Record<string, string>
  overriddenByUserId: string
  byRole: 'coordinator' | 'admin'
  supervisors: { id: string; full_name: string }[]
  visitManagers: { id: string; full_name: string }[]
  siteManagerBySiteId: Record<string, { id: string; name: string }>
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleOverride(slotId: string) {
    setBusyId(slotId)
    setError(null)
    const res = await overrideDecline(slotId, overriddenByUserId)
    setBusyId(null)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  async function handleConfirmPending(slotId: string) {
    setBusyId(slotId)
    setError(null)
    const res = await confirmPending(slotId, overriddenByUserId)
    setBusyId(null)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  // Owner, 31 Oct 2026 (D28): reassign to another Supervisor, a Site Visit Manager or the job's
  // Site Manager, or defer and ask the client for the next slot.
  const [assignee, setAssignee] = useState<Record<string, string>>({})
  const [deferNote, setDeferNote] = useState<Record<string, string>>({})

  async function handleReassign(slot: DeclinedSlot) {
    const value = assignee[slot.id]
    if (!value) { setError('Choose who takes this visit.'); return }
    const [kind, workerId] = value.split(':')
    const label =
      kind === 'site_manager' ? `Site Manager ${(slot.site_id && siteManagerBySiteId[slot.site_id]?.name) ?? ''}`.trim()
      : kind === 'svm' ? `Site Visit Manager ${visitManagers.find(v => v.id === workerId)?.full_name ?? ''}`.trim()
      : `Supervisor ${supervisors.find(v => v.id === workerId)?.full_name ?? ''}`.trim()
    setBusyId(slot.id); setError(null)
    const res = await reassignVisit({ slotId: slot.id, workerId, assigneeLabel: label, byUserId: overriddenByUserId })
    setBusyId(null)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  async function handleDefer(slot: DeclinedSlot) {
    setBusyId(slot.id); setError(null)
    const res = await deferVisitForClientNextSlot({ slotId: slot.id, note: deferNote[slot.id] ?? '', byUserId: overriddenByUserId, byRole })
    setBusyId(null)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  if (slots.length === 0) return null

  return (
    <section>
      <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">
        Declined Visits Needing a Decision ({slots.length})
      </p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">{error}</div>}
      <div className="space-y-3">
        {slots.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3">
              <p className="text-sm font-bold text-gray-800">{(s.site_id && bookingRefBySiteId[s.site_id]) ?? 'Site TBC'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {fmtDate(s.scheduled_date)} · {s.slot_start ?? '—'}–{s.slot_end ?? '—'} · {(s.slot_type ?? 'inspection').replace('_', ' ')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Declined by {(s.supervisor_id && supervisorNameById[s.supervisor_id]) ?? 'Supervisor'}
              </p>
              {s.decline_reason && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-2 italic">"{s.decline_reason}"</p>
              )}
            </div>
            <div className="px-5 pb-4 flex gap-2">
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => handleOverride(s.id)}
                className="flex-1 bg-[#1F3864] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {busyId === s.id ? 'Working…' : 'Yes — Override, Keep Assigned'}
              </button>
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => handleConfirmPending(s.id)}
                className="flex-1 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {busyId === s.id ? 'Working…' : 'No — Send to Pending'}
              </button>
            </div>
            <div className="px-5 pb-4 space-y-2 border-t border-gray-100 pt-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Or give it to someone else</p>
              <div className="flex gap-2">
                <select
                  value={assignee[s.id] ?? ''}
                  onChange={e => setAssignee(a => ({ ...a, [s.id]: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="">Choose…</option>
                  {s.site_id && siteManagerBySiteId[s.site_id] && (
                    <option value={`site_manager:${siteManagerBySiteId[s.site_id].id}`}>
                      Site Manager (this job) — {siteManagerBySiteId[s.site_id].name}
                    </option>
                  )}
                  <optgroup label="Site Visit Managers">
                    {visitManagers.map(v => <option key={v.id} value={`svm:${v.id}`}>{v.full_name}</option>)}
                  </optgroup>
                  <optgroup label="Supervisors">
                    {supervisors.filter(v => v.id !== s.supervisor_id).map(v => <option key={v.id} value={`sup:${v.id}`}>{v.full_name}</option>)}
                  </optgroup>
                </select>
                <button type="button" disabled={busyId === s.id} onClick={() => handleReassign(s)}
                  className="bg-green-700 text-white font-bold px-4 rounded-xl text-sm disabled:opacity-50">
                  Reassign
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={deferNote[s.id] ?? ''}
                  onChange={e => setDeferNote(d => ({ ...d, [s.id]: e.target.value }))}
                  placeholder="No one can go / client not available — reason"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"
                />
                <button type="button" disabled={busyId === s.id} onClick={() => handleDefer(s)}
                  className="border border-amber-500 text-amber-700 font-bold px-4 rounded-xl text-sm disabled:opacity-50">
                  Defer — ask client for next slot
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
