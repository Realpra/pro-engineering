'use client'

import { useState } from 'react'
import { addSlotManually } from '../actions'

type Job = { booking_ref: string; job_title: string | null; job_type: string | null }

const slotTypes = [
  { value: 'inspection', label: '🟢 QIP Inspection' },
  { value: 'overhang', label: '🔴 Overhang' },
  { value: 'client_visit', label: '🔵 Client Visit' },
  { value: 'scope_survey', label: '🔵 Scope Survey' },
  { value: 'estimate_visit', label: '💰 Estimate Visit' },
  { value: 'hq', label: '🟡 HQ Briefing' },
]

export default function AddSlotForm({
  supervisorId,
  today,
  tomorrow,
  activeJobs,
}: {
  supervisorId: string
  today: string
  tomorrow: string
  activeJobs: Job[]
}) {
  const [scheduledDate, setScheduledDate] = useState(today)
  const [slotType, setSlotType] = useState('inspection')
  const [bookingRef, setBookingRef] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [slotStart, setSlotStart] = useState('08:30')
  const [slotEnd, setSlotEnd] = useState('10:30')
  const [departFrom, setDepartFrom] = useState('')
  const [departTime, setDepartTime] = useState('')
  const [travelMinutes, setTravelMinutes] = useState('')
  const [workDurationMinutes, setWorkDurationMinutes] = useState('120')
  const [nextBookingRef, setNextBookingRef] = useState('')
  const [travelToNextMinutes, setTravelToNextMinutes] = useState('')
  const [lunchBreak, setLunchBreak] = useState(false)
  const [ltfNote, setLtfNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!bookingRef) { setError('Select a site / booking first.'); setStatus('error'); return }
    setStatus('loading')
    setError(null)
    const result = await addSlotManually({
      supervisorId,
      scheduledDate,
      slotType,
      bookingRef,
      siteAddress: siteAddress || null,
      slotStart,
      slotEnd,
      departFrom: departFrom || null,
      departTime: departTime || null,
      travelMinutes: travelMinutes ? Number(travelMinutes) : null,
      workDurationMinutes: workDurationMinutes ? Number(workDurationMinutes) : null,
      nextBookingRef: nextBookingRef || null,
      travelToNextMinutes: travelToNextMinutes ? Number(travelToNextMinutes) : null,
      lunchBreak,
      ltfNote: ltfNote || null,
    })
    if (result.error) {
      setError(result.error)
      setStatus('error')
    } else {
      setStatus('done')
    }
  }

  if (status === 'done') {
    return (
      <div className="px-5 py-6 text-center">
        <p className="text-green-600 font-bold text-sm">✓ Slot added to route</p>
        <button onClick={() => setStatus('idle')} className="mt-2 text-xs text-[#2E74B5] font-semibold underline">
          Add another
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Scheduled Date</p>
        <select value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
          <option value={today}>Today — {today}</option>
          <option value={tomorrow}>Tomorrow — {tomorrow}</option>
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot Type</p>
        <select value={slotType} onChange={e => setSlotType(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
          {slotTypes.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Site / Booking</p>
        <select value={bookingRef} onChange={e => setBookingRef(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
          <option value="">Select site...</option>
          {activeJobs.map(job => (
            <option key={job.booking_ref} value={job.booking_ref}>{job.booking_ref} — {job.job_title ?? job.job_type}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Site Address</p>
        <input type="text" value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="Enter site address..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot Start</p>
          <input type="time" value={slotStart} onChange={e => setSlotStart(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Slot End</p>
          <input type="time" value={slotEnd} onChange={e => setSlotEnd(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Depart From</p>
          <input type="text" value={departFrom} onChange={e => setDepartFrom(e.target.value)} placeholder="Home / Prev site..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Depart Time</p>
          <input type="time" value={departTime} onChange={e => setDepartTime(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Travel Time (min)</p>
          <input type="number" value={travelMinutes} onChange={e => setTravelMinutes(e.target.value)} placeholder="e.g. 30" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Work Duration (min)</p>
          <input type="number" value={workDurationMinutes} onChange={e => setWorkDurationMinutes(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Next Site (if applicable)</p>
        <select value={nextBookingRef} onChange={e => setNextBookingRef(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
          <option value="">None — last site today</option>
          {activeJobs.map(job => (
            <option key={job.booking_ref} value={job.booking_ref}>{job.booking_ref} — {job.job_title ?? job.job_type}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Travel to Next (min)</p>
          <input type="number" value={travelToNextMinutes} onChange={e => setTravelToNextMinutes(e.target.value)} placeholder="e.g. 20" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={lunchBreak} onChange={e => setLunchBreak(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-xs font-semibold text-gray-600">🍽 Lunch Break</span>
          </label>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">LTF Note (from Site Head)</p>
        <textarea rows={2} value={ltfNote} onChange={e => setLtfNote(e.target.value)} placeholder="e.g. Ready by 11:00 AM — waterproofing coat 2 complete" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none" />
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={status === 'loading'}
        className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-60"
      >
        {status === 'loading' ? 'Adding…' : '+ Add Slot to Route'}
      </button>
    </div>
  )
}
