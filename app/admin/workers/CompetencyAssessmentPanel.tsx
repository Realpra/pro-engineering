'use client'

import { useEffect, useState } from 'react'
import { getWorkerCompetency, getTrainersForModule, scheduleAssessmentForWorker, type CompetencyRow } from './actions'

const MODULE_LABELS: Record<string, string> = {
  M1: 'Tile Works', M2: 'Plastering', M3: 'Brickwork',
  M4: 'Flooring', M5: 'Kitchen and Countertop', M6: 'Emergency Leakage',
}
const MODULE_ORDER = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']

function ScheduleRow({ workerId, moduleCode }: { workerId: string; moduleCode: string }) {
  const [open, setOpen] = useState(false)
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([])
  const [loadingTrainers, setLoadingTrainers] = useState(false)
  const [date, setDate] = useState('')
  const [timeSlot, setTimeSlot] = useState<'morning' | 'afternoon' | ''>('')
  const [trainerName, setTrainerName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function startOpen() {
    setOpen(true)
    setLoadingTrainers(true)
    getTrainersForModule(moduleCode).then((list) => {
      setTrainers(list)
      if (list.length > 0) setTrainerName(list[0].name)
      setLoadingTrainers(false)
    })
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    const res = await scheduleAssessmentForWorker(workerId, moduleCode, date, timeSlot as 'morning' | 'afternoon', trainerName)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setDone(true)
    setOpen(false)
  }

  if (done) return <p className="text-xs text-green-700">✓ Assessment scheduled for {MODULE_LABELS[moduleCode]}.</p>

  if (!open) {
    return (
      <button type="button" onClick={startOpen} className="text-xs font-bold text-[#2E74B5] hover:underline">
        Schedule Assessment →
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 mt-1">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-1.5 text-xs" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setTimeSlot('morning')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${timeSlot === 'morning' ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'border-gray-300 text-gray-600'}`}>Morning 9AM</button>
        <button type="button" onClick={() => setTimeSlot('afternoon')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${timeSlot === 'afternoon' ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'border-gray-300 text-gray-600'}`}>Afternoon 2PM</button>
      </div>
      {loadingTrainers ? (
        <p className="text-xs text-gray-400">Loading trainers…</p>
      ) : (
        <select value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-1.5 text-xs">
          {trainers.length === 0 && <option value="">No active trainers</option>}
          {trainers.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={busy || !date || !timeSlot || !trainerName}
          className="flex-1 bg-[#2E74B5] text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
        >
          {busy ? 'Booking…' : 'Confirm Booking'}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function CompetencyAssessmentPanel({ workerId }: { workerId: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<CompetencyRow[] | null>(null)

  function toggle() {
    if (!open && rows === null) {
      getWorkerCompetency(workerId).then(setRows)
    }
    setOpen((o) => !o)
  }

  const byModule: Record<string, CompetencyRow | undefined> = Object.fromEntries((rows ?? []).map((r) => [r.module_code, r]))

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button type="button" onClick={toggle} className="text-xs font-bold text-gray-600 uppercase tracking-wide">
        {open ? '▾' : '▸'} Competency Matrix
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {rows === null ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (
            MODULE_ORDER.map((code) => {
              const r = byModule[code]
              const needsAssessment = !r || r.mcq_passed !== true
              return (
                <div key={code} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-700">{code} — {MODULE_LABELS[code]}</span>
                    <span className="text-[11px] text-gray-500">
                      {r?.declared ? 'Declared' : 'Not declared'} · MCQ {r?.mcq_passed === true ? 'Passed' : r?.mcq_passed === false ? 'Failed' : '—'}{r?.score != null ? ` (${r.score})` : ''}
                    </span>
                  </div>
                  {needsAssessment && <ScheduleRow workerId={workerId} moduleCode={code} />}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
