'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markSubstageComplete, assignWorkerToSubstage, removeWorkerFromSubstage } from './actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

type Props = {
  substage: AnyRecord
  supervisorId: string
  workersPool: AnyRecord[]
  zones: { id: string; name: string; level: string | null }[]
  trades: string[]
  jobZone: string | null
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function statusColor(s: string) {
  if (s === 'completed' || s === 'supervisor_submitted') return 'bg-green-100 text-green-700 border-green-300'
  if (s === 'in_progress') return 'bg-blue-100 text-blue-700 border-blue-300'
  return 'bg-gray-100 text-gray-500 border-gray-300'
}

function statusDot(s: string) {
  if (s === 'completed' || s === 'supervisor_submitted') return 'bg-green-500'
  if (s === 'in_progress') return 'bg-blue-500'
  return 'bg-gray-300'
}

export default function SubstageCard({ substage: s, supervisorId, workersPool, zones, trades, jobZone }: Props) {
  const router = useRouter()

  // site_checklist/site_evidence_* are the correctly-named columns (Site
  // Incharge is the only real writer) -- prefer them, falling back to the
  // legacy supervisor_-prefixed names for any row/query not yet migrated.
  const checklist: AnyRecord[] = Array.isArray(s.site_checklist) ? s.site_checklist : (Array.isArray(s.supervisor_checklist) ? s.supervisor_checklist : [])
  const checkedCount = checklist.filter(c => c.checked).length
  const checklistComplete = checklist.length === 0 || checkedCount === checklist.length
  const evidence: AnyRecord[] = Array.isArray(s.site_evidence_checklist) ? s.site_evidence_checklist : (Array.isArray(s.evidence_checklist) ? s.evidence_checklist : [])
  const evidenceSubmitted: AnyRecord[] = Array.isArray(s.site_evidence_submitted) ? s.site_evidence_submitted : (Array.isArray(s.evidence_submitted) ? s.evidence_submitted : [])
  const assignments: AnyRecord[] = Array.isArray(s.labour_assignments) ? s.labour_assignments : []
  const alreadyDone = s.status === 'supervisor_submitted' || s.status === 'completed'

  const [showWarning, setShowWarning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState(jobZone ?? '')
  const [selectedTrade, setSelectedTrade] = useState(s.trade_type ?? '')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [plannedDate, setPlannedDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [preInstruction, setPreInstruction] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignBusy, setAssignBusy] = useState(false)

  async function doMarkComplete() {
    setBusy(true)
    setError(null)
    const result = await markSubstageComplete(s.id)
    setBusy(false)
    setShowWarning(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  function handleMarkCompleteClick() {
    if (!checklistComplete) {
      setShowWarning(true)
    } else {
      doMarkComplete()
    }
  }

  const availableWorkers = workersPool.filter(w => {
    if (w.approval_status !== 'admin_approved' || w.is_available !== true) return false
    if (selectedZone && !(Array.isArray(w.zones) && w.zones.includes(selectedZone))) return false
    if (selectedTrade && w.trade !== selectedTrade) return false
    if (selectedSkill && w.skill_level !== selectedSkill) return false
    return true
  })

  function workerLookup(workerId: string) {
    return workersPool.find(w => w.id === workerId)
  }

  async function handleAssign() {
    if (!selectedWorkerId || !plannedDate) {
      setAssignError('Select a worker and planned date.')
      return
    }
    setAssignBusy(true)
    setAssignError(null)
    const result = await assignWorkerToSubstage(s.id, selectedWorkerId, plannedDate, preInstruction, supervisorId)
    setAssignBusy(false)
    if (result.error) {
      setAssignError(result.error)
    } else {
      setAddFormOpen(false)
      setSelectedWorkerId('')
      setPreInstruction('')
      router.refresh()
    }
  }

  async function handleRemove(workerId: string) {
    setAssignBusy(true)
    setAssignError(null)
    const result = await removeWorkerFromSubstage(s.id, workerId)
    setAssignBusy(false)
    if (result.error) {
      setAssignError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="px-5 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${statusDot(s.status)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400 font-medium">{s.substage_code}</p>
                {s.is_critical_path && <span className="text-xs font-bold text-red-500">🔴</span>}
              </div>
              <p className="text-sm font-semibold text-gray-800 leading-snug">{s.substage_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {s.trade_type} · Day {s.planned_day} · {s.planned_hours}hrs ·
                Float: <span className={Number(s.float_days) === 0 ? 'text-red-500 font-semibold' : ''}>{s.float_days ?? 0}d</span>
              </p>
            </div>
            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${statusColor(s.status)}`}>
              {s.status?.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1">
            <div className="bg-[#2E74B5] h-1 rounded-full" style={{ width: `${s.completion_pct ?? 0}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-400">{s.completion_pct ?? 0}% complete</p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {s.early_start_date && <span>{formatDate(s.early_start_date)}</span>}
              {s.supervisor_submitted_at && <span className="text-orange-500 font-semibold">Submitted</span>}
              {/* substage_approved_at is Admin's own correctly-named approval
                  timestamp (app/admin/milestones/actions.ts adminApproveSubstage).
                  coordinator_approved_at is a compat duplicate Admin's action
                  also writes, kept only because many other roles' pages still
                  read it -- prefer the real name here, falling back for any
                  older row saved before that column existed. */}
              {(s.substage_approved_at || s.coordinator_approved_at) && <span className="text-green-600 font-semibold">✓ Approved</span>}
            </div>
          </div>

          {/* CHECKLIST + MARK COMPLETE */}
          {checklist.length > 0 && (
            <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-600">
                Checklist: <span className="font-semibold">{checkedCount}/{checklist.length}</span>
                {' · '}Evidence: <span className="font-semibold">{evidenceSubmitted.filter(Boolean).length}/{evidence.length || 0}</span>
              </p>
            </div>
          )}

          {!alreadyDone && (
            <div className="mt-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleMarkCompleteClick}
                className="bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-60"
              >
                {busy ? 'Submitting...' : 'MARK COMPLETE'}
              </button>
            </div>
          )}

          {showWarning && (
            <div className="mt-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-amber-800">
                {checklist.length - checkedCount} checklist item{checklist.length - checkedCount !== 1 ? 's' : ''} not yet completed. Are you sure you want to proceed?
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={doMarkComplete}
                  className="bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-60"
                >
                  PROCEED ANYWAY
                </button>
                <button
                  type="button"
                  onClick={() => setShowWarning(false)}
                  className="border border-gray-300 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

          {/* ASSIGN WORKERS */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setAssignOpen(o => !o)}
              className="text-xs text-[#2E74B5] font-semibold"
            >
              👷 Assign Workers ({assignments.length}) {assignOpen ? '▲' : '▼'}
            </button>

            {assignOpen && (
              <div className="mt-2 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 space-y-3">
                {assignments.length > 0 ? (
                  <div className="space-y-2">
                    {assignments.map((a, idx) => {
                      const w = workerLookup(a.workerId)
                      return (
                        <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800">{w?.full_name ?? a.workerId}</p>
                            <p className="text-xs text-gray-400">
                              {w?.trade ?? '—'} · {w?.skill_level ?? '—'} · {formatDate(a.plannedDate)}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={assignBusy}
                            onClick={() => handleRemove(a.workerId)}
                            className="text-red-500 text-xs font-bold shrink-0 disabled:opacity-60"
                          >
                            REMOVE
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No workers assigned yet.</p>
                )}

                {!addFormOpen ? (
                  <button
                    type="button"
                    onClick={() => setAddFormOpen(true)}
                    className="text-xs bg-[#1F3864] text-white font-bold px-3 py-1.5 rounded-lg"
                  >
                    + ADD WORKER
                  </button>
                ) : (
                  <div className="space-y-2 bg-white rounded-lg border border-gray-200 p-3">
                    <select
                      value={selectedZone}
                      onChange={e => setSelectedZone(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50"
                    >
                      <option value="">Any zone</option>
                      {zones.map(z => (
                        <option key={z.id} value={z.name}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedTrade}
                      onChange={e => setSelectedTrade(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50"
                    >
                      <option value="">Any trade</option>
                      {trades.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedSkill}
                      onChange={e => setSelectedSkill(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50"
                    >
                      <option value="">Any skill level</option>
                      <option value="semi_skilled">Semi-Skilled</option>
                      <option value="skilled">Skilled</option>
                      <option value="highly_skilled">Highly Skilled</option>
                    </select>
                    <select
                      value={selectedWorkerId}
                      onChange={e => setSelectedWorkerId(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50"
                    >
                      <option value="">Select worker...</option>
                      {availableWorkers.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.full_name} — {w.trade} · {w.skill_level}
                        </option>
                      ))}
                    </select>
                    {availableWorkers.length === 0 && (
                      <p className="text-xs text-gray-400">No matching available workers.</p>
                    )}
                    <input
                      type="date"
                      value={plannedDate}
                      onChange={e => setPlannedDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50"
                    />
                    <textarea
                      value={preInstruction}
                      onChange={e => setPreInstruction(e.target.value)}
                      rows={2}
                      placeholder="Pre-instruction (optional — shown on worker's schedule)"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 resize-none"
                    />
                    {assignError && <p className="text-red-600 text-xs">{assignError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={assignBusy}
                        onClick={handleAssign}
                        className="bg-[#1F3864] text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-60"
                      >
                        {assignBusy ? 'Assigning...' : 'ASSIGN'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddFormOpen(false)}
                        className="border border-gray-300 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
