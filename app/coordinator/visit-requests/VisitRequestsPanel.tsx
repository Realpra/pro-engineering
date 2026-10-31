'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logVisitRequest, scheduleVisitRequest, cancelVisitRequest, deferVisitForClientNextSlot } from './actions'

export type VisitRequest = {
  id: string
  booking_ref: string
  visit_category: 'scope_survey' | 'client_visit' | 'estimate_visit'
  requested_date: string | null
  requested_slot: 'morning' | 'afternoon' | 'evening' | null
  requested_by_role: string
  source: string
  notes: string | null
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
  created_at: string
}

export type SupervisorOption = { id: string; full_name: string }

type JobInfo = { booking_ref: string; job_title: string | null; contact_name: string | null; zone: string | null; district: string | null }

const CATEGORY_LABEL: Record<string, string> = {
  scope_survey: 'Scope Survey',
  client_visit: 'Client Visit',
  estimate_visit: 'Estimate Visit',
}

function fmtDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function VisitRequestsPanel({
  requests,
  jobMap,
  supervisors,
  loggedByUserId,
  loggedByRole,
  visitManagers = [],
}: {
  requests: VisitRequest[]
  jobMap: Record<string, JobInfo>
  supervisors: SupervisorOption[]
  loggedByUserId: string
  loggedByRole: 'coordinator' | 'admin'
  visitManagers?: SupervisorOption[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null)

  // log-new-request form state
  const [logBookingRef, setLogBookingRef] = useState('')
  const [logCategory, setLogCategory] = useState<'scope_survey' | 'client_visit' | 'estimate_visit'>('scope_survey')
  const [logDate, setLogDate] = useState('')
  const [logSlot, setLogSlot] = useState<'morning' | 'afternoon' | 'evening'>('morning')
  const [logSource, setLogSource] = useState<'phone' | 'whatsapp' | 'email' | 'other'>('phone')
  const [logNotes, setLogNotes] = useState('')

  // schedule form state
  const [schedSupervisor, setSchedSupervisor] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedStart, setSchedStart] = useState('10:00')
  const [schedEnd, setSchedEnd] = useState('12:00')

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  async function handleLog() {
    if (!logBookingRef.trim()) { setError('Enter a booking reference.'); return }
    setBusy(true)
    setError(null)
    const res = await logVisitRequest({
      bookingRef: logBookingRef.trim(),
      visitCategory: logCategory,
      requestedDate: logDate || null,
      requestedSlot: logSlot,
      source: logSource,
      notes: logNotes.trim() || null,
      loggedByRole,
      loggedByUserId,
    })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setLogBookingRef('')
    setLogDate('')
    setLogNotes('')
    router.refresh()
  }

  function openSchedule(req: VisitRequest) {
    setScheduling(req.id)
    setSchedDate(req.requested_date ?? '')
    setSchedSupervisor('')
    setError(null)
  }

  async function handleSchedule(req: VisitRequest) {
    if (!schedSupervisor || !schedDate) { setError('Select a supervisor and date.'); return }
    setBusy(true)
    setError(null)
    const job = jobMap[req.booking_ref]
    const res = await scheduleVisitRequest({
      requestId: req.id,
      bookingRef: req.booking_ref,
      supervisorId: schedSupervisor,
      scheduledDate: schedDate,
      slotStart: schedStart,
      slotEnd: schedEnd,
      visitCategory: req.visit_category,
      siteAddress: job ? `${job.district ?? ''} ${job.zone ?? ''}`.trim() || null : null,
    })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setScheduling(null)
    router.refresh()
  }

  async function handleCancel(id: string) {
    setBusy(true)
    setError(null)
    const res = await cancelVisitRequest(id)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#1F3864]'

  return (
    <div className="space-y-5">
      {/* SUMMARY */}
      <div className="bg-[#1F3864] rounded-2xl px-5 py-4 grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-white font-bold text-2xl">{pending.length}</p>
          <p className="text-blue-300 text-xs">Pending</p>
        </div>
        <div>
          <p className="text-green-400 font-bold text-2xl">{requests.filter(r => r.status === 'scheduled').length}</p>
          <p className="text-blue-300 text-xs">Scheduled</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      {/* LOG A NEW REQUEST -- phone/WhatsApp/email received */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Log a Visit Request</p>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
          <p className="text-xs text-gray-400">For requests received by phone, WhatsApp or email rather than through the website.</p>
          <input
            value={logBookingRef}
            onChange={e => setLogBookingRef(e.target.value)}
            placeholder="Booking reference (e.g. PE78D4XRAU)"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={logCategory} onChange={e => setLogCategory(e.target.value as typeof logCategory)} className={inputClass}>
              <option value="scope_survey">Scope Survey</option>
              <option value="client_visit">Client Visit</option>
              <option value="estimate_visit">Estimate Visit</option>
            </select>
            <select value={logSource} onChange={e => setLogSource(e.target.value as typeof logSource)} className={inputClass}>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className={inputClass} />
            <select value={logSlot} onChange={e => setLogSlot(e.target.value as typeof logSlot)} className={inputClass}>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <textarea
            value={logNotes}
            onChange={e => setLogNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className={`${inputClass} resize-none`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleLog}
            className="w-full bg-[#1F3864] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Log Request'}
          </button>
        </div>
      </section>

      {/* PENDING REQUESTS */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Pending Requests</p>
        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">No pending visit requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(req => {
              const job = jobMap[req.booking_ref]
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{req.booking_ref}</p>
                      <p className="text-xs text-gray-500">{job?.job_title ?? '—'} · {job?.contact_name ?? '—'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {CATEGORY_LABEL[req.visit_category] ?? req.visit_category}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">{req.source}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested: {fmtDate(req.requested_date)} {req.requested_slot ? `· ${req.requested_slot}` : ''}
                      </p>
                      {req.notes && <p className="text-xs text-gray-500 italic mt-1">{req.notes}</p>}
                    </div>
                  </div>

                  {scheduling === req.id ? (
                    <div className="px-5 pb-4 space-y-2 bg-gray-50 border-t border-gray-100 pt-3">
                      <select value={schedSupervisor} onChange={e => setSchedSupervisor(e.target.value)} className={inputClass}>
                        <option value="">Select supervisor or Site Visit Manager…</option>
                        <optgroup label="Supervisors">
                          {supervisors.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name}</option>
                          ))}
                        </optgroup>
                        {visitManagers.length > 0 && (
                          <optgroup label="Site Visit Managers">
                            {visitManagers.map(s => (
                              <option key={s.id} value={s.id}>{s.full_name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className={inputClass} />
                        <input type="time" value={schedStart} onChange={e => setSchedStart(e.target.value)} className={inputClass} />
                        <input type="time" value={schedEnd} onChange={e => setSchedEnd(e.target.value)} className={inputClass} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSchedule(req)}
                          className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
                        >
                          {busy ? 'Working…' : 'Confirm Schedule'}
                        </button>
                        <button type="button" onClick={() => setScheduling(null)} className="px-4 text-sm text-gray-500">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 pb-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openSchedule(req)}
                        className="flex-1 bg-[#1F3864] text-white font-bold py-2.5 rounded-xl text-sm"
                      >
                        Schedule Visit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleCancel(req.id)}
                        className="px-4 text-sm text-red-600 font-semibold disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* RESOLVED */}
      {resolved.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Resolved</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {resolved.map(req => (
              <div key={req.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{req.booking_ref}</p>
                  <p className="text-xs text-gray-400">{CATEGORY_LABEL[req.visit_category] ?? req.visit_category}</p>
                </div>
                {req.status === 'scheduled' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const note = window.prompt('Client cannot make it / visit cannot happen — reason (client will be asked for the next slot):')
                      if (!note) return
                      setBusy(true); setError(null)
                      const res = await deferVisitForClientNextSlot({ requestId: req.id, note, byUserId: loggedByUserId, byRole: loggedByRole })
                      setBusy(false)
                      if (res.error) setError(res.error); else router.refresh()
                    }}
                    className="text-xs font-semibold text-amber-700 border border-amber-400 rounded-lg px-2 py-1 disabled:opacity-50"
                  >
                    Defer — next slot
                  </button>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  req.status === 'scheduled' ? 'bg-green-100 text-green-700' :
                  req.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>{req.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
