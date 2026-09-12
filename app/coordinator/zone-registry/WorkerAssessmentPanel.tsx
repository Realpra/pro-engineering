'use client'

import { useState } from 'react'

type Worker = {
  id: string
  full_name: string
  trade: string
  district: string | null
  skill_level: string
  phone: string | null
  average_rating: number | null
  total_deployments: number | null
  competency_m1: string | null
  competency_m2: string | null
  competency_m3: string | null
  competency_m4: string | null
  competency_m5: string | null
  competency_m6: string | null
  specialist_track_a: string | null
  specialist_track_b: string | null
  specialist_track_c: string | null
  specialist_track_d: string | null
  height_restriction: boolean | null
  dust_restriction: boolean | null
  deployment_restriction: string | null
  competency_remarks: string | null
  assessment_decision: string | null
}

type Zone = {
  id: string
  name: string
  short_code: string
}

type Props = {
  workers: Worker[]
  zones: Zone[]
  onAssign: (formData: FormData) => Promise<void>
  onAssessment: (formData: FormData) => Promise<void>
}

const modules = [
  { code: 'M1', key: 'competency_m1', label: 'Tile Works & Grouting' },
  { code: 'M2', key: 'competency_m2', label: 'Plastering & Patch Repair' },
  { code: 'M3', key: 'competency_m3', label: 'Brickwork & Masonry' },
  { code: 'M4', key: 'competency_m4', label: 'Flooring & Levelling' },
  { code: 'M5', key: 'competency_m5', label: 'Kitchen & Countertop' },
  { code: 'M6', key: 'competency_m6', label: 'Emergency Leakage & Damage' },
]

const tracks = [
  { code: 'A', key: 'specialist_track_a', label: 'Marble Stone' },
  { code: 'B', key: 'specialist_track_b', label: 'Structural Brickwork' },
  { code: 'C', key: 'specialist_track_c', label: 'Heavy Waterproofing' },
  { code: 'D', key: 'specialist_track_d', label: 'Premium Tiling' },
]

const levelColor = (l: string | null) => {
  if (l === 'L3') return 'bg-green-100 text-green-700 border-green-300'
  if (l === 'L2') return 'bg-blue-100 text-blue-700 border-blue-300'
  if (l === 'L1') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  if (l === 'L0') return 'bg-red-100 text-red-700 border-red-300'
  return 'bg-gray-100 text-gray-400 border-gray-200'
}

const skillBadge = (level: string) => {
  if (level === 'highly_skilled') return 'bg-green-100 text-green-700'
  if (level === 'skilled') return 'bg-blue-100 text-blue-700'
  if (level === 'semi_skilled') return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-500'
}

export default function WorkerAssessmentPanel({ workers, zones, onAssign, onAssessment }: Props) {
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [decisionOverride, setDecisionOverride] = useState<'accepted' | 'rejected' | 'returned' | null>(null)
  const [remarks, setRemarks] = useState('')
  const [competency, setCompetency] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const selectedWorker = workers.find(w => w.id === selectedWorkerId) ?? null

  // Use override if set, else use existing saved decision
  const existingDecision = selectedWorker?.assessment_decision as 'accepted' | 'rejected' | 'returned' | null
  const effectiveDecision = decisionOverride ?? existingDecision

  const getLevel = (key: string): string | null => {
    if (competency[key] !== undefined && competency[key] !== '') return competency[key]
    return (selectedWorker as any)?.[key] ?? null
  }

  const handleWorkerChange = (id: string) => {
    setSelectedWorkerId(id)
    setDecisionOverride(null)
    setRemarks('')
    setCompetency({})
    setSaved(false)
  }

  const handleAssessmentSubmit = async () => {
    if (!selectedWorkerId || !effectiveDecision) return
    setSaving(true)
    const fd = new FormData()
    fd.append('worker_id', selectedWorkerId)
    fd.append('assessment_decision', effectiveDecision)
    fd.append('competency_remarks', remarks || selectedWorker?.competency_remarks || '')
    modules.forEach(m => {
      const val = competency[m.key]
      if (val) fd.append(m.key, val)
    })
    tracks.forEach(t => {
      const val = competency[t.key]
      if (val) fd.append(t.key, val)
    })
    await onAssessment(fd)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-4">

      {/* WORKER SELECTOR */}
      <div className="bg-white rounded-2xl border border-[#2E74B5]/30 shadow-sm overflow-hidden">
        <div className="bg-[#2E74B5] px-5 py-3">
          <p className="text-white font-bold text-sm">Worker Assessment + Zone Assignment</p>
          <p className="text-blue-200 text-xs mt-0.5">Select worker → Review assessment → Accept/Reject → Assign to zone</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Select Worker</p>
          <select
            value={selectedWorkerId}
            onChange={e => handleWorkerChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
          >
            <option value="">Select worker...</option>
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.full_name} — {w.trade} ({w.district ?? 'No zone'})
                {w.assessment_decision === 'accepted' ? ' ✓' : w.assessment_decision === 'rejected' ? ' ✗' : w.assessment_decision === 'returned' ? ' ↩' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ASSESSMENT PANEL */}
      {selectedWorker && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* WORKER PROFILE */}
          <div className="bg-[#1F3864] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-bold text-base">{selectedWorker.full_name}</p>
                <p className="text-blue-300 text-xs mt-0.5">{selectedWorker.trade} · {selectedWorker.district ?? 'No zone'}</p>
                {selectedWorker.phone && <p className="text-blue-300 text-xs mt-0.5">📞 {selectedWorker.phone}</p>}
              </div>
              <div className="text-right">
                <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-lg ${skillBadge(selectedWorker.skill_level)}`}>
                  {selectedWorker.skill_level?.replace(/_/g, ' ')}
                </span>
                <div className="flex gap-3 mt-2 text-xs text-blue-300">
                  <span>⭐ {selectedWorker.average_rating ? Number(selectedWorker.average_rating).toFixed(1) : '—'}</span>
                  <span>{selectedWorker.total_deployments ?? 0} jobs</span>
                </div>
                {existingDecision && (
                  <span className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                    existingDecision === 'accepted' ? 'bg-green-100 text-green-700' :
                    existingDecision === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {existingDecision === 'accepted' ? '✓ Previously Accepted' :
                     existingDecision === 'rejected' ? '✗ Previously Rejected' :
                     '↩ Previously Returned'}
                  </span>
                )}
              </div>
            </div>
            {(selectedWorker.height_restriction || selectedWorker.dust_restriction || selectedWorker.deployment_restriction) && (
              <div className="mt-3 pt-3 border-t border-blue-400/30 space-y-1">
                {selectedWorker.height_restriction && <p className="text-red-300 text-xs">⚠️ Height restriction — ground level only</p>}
                {selectedWorker.dust_restriction && <p className="text-red-300 text-xs">⚠️ Dust restriction — N95 mandatory</p>}
                {selectedWorker.deployment_restriction && <p className="text-red-300 text-xs">⚠️ {selectedWorker.deployment_restriction}</p>}
              </div>
            )}
          </div>

          <div className="px-5 py-4 space-y-4">

            {/* PREVIOUS REMARKS */}
            {selectedWorker.competency_remarks && !remarks && (
              <div className="bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-blue-700 mb-1">Previous Assessment Remarks</p>
                <p className="text-xs text-blue-600">{selectedWorker.competency_remarks}</p>
              </div>
            )}

            {/* COMPETENCY — M1 to M6 */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">Competency Assessment — Core Modules</p>
              <p className="text-xs text-gray-400 mb-3">Coordinator asks, observes, rates. Tap to update level.</p>
              <div className="space-y-2">
                {modules.map(m => {
                  const current = getLevel(m.key)
                  return (
                    <div key={m.code} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#2E74B5] w-6 shrink-0">{m.code}</span>
                      <span className="text-xs text-gray-600 flex-1 leading-snug">{m.label}</span>
                      <div className="flex gap-1 shrink-0">
                        {['L0', 'L1', 'L2', 'L3'].map(l => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setCompetency(prev => ({ ...prev, [m.key]: prev[m.key] === l ? '' : l }))}
                            className={`w-9 h-8 rounded-lg border text-xs font-bold transition-colors ${
                              current === l
                                ? levelColor(l) + ' border-current'
                                : 'bg-white border-gray-200 text-gray-400'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* SPECIALIST TRACKS */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">Specialist Tracks</p>
              <div className="space-y-2">
                {tracks.map(t => {
                  const current = getLevel(t.key)
                  return (
                    <div key={t.code} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-green-600 w-6 shrink-0">{t.code}</span>
                      <span className="text-xs text-gray-600 flex-1">{t.label}</span>
                      <div className="flex gap-1 shrink-0">
                        {['locked', 'unlocked', 'certified'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCompetency(prev => ({ ...prev, [t.key]: prev[t.key] === s ? '' : s }))}
                            className={`px-2 h-7 rounded-lg border text-xs font-semibold transition-colors ${
                              current === s
                                ? s === 'certified' ? 'bg-green-100 text-green-700 border-green-300'
                                  : s === 'unlocked' ? 'bg-blue-100 text-blue-700 border-blue-300'
                                  : 'bg-gray-100 text-gray-500 border-gray-300'
                                : 'bg-white border-gray-200 text-gray-300'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">Camera gate: unlocked after 3 jobs in specialist scope</p>
            </div>

            {/* ASSESSMENT DECISION */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">Assessment Decision</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'accepted', label: '✓ Accept', active: 'bg-green-600 text-white', inactive: 'bg-green-50 text-green-700 border border-green-300' },
                  { key: 'returned', label: '↩ Return', active: 'bg-orange-500 text-white', inactive: 'bg-orange-50 text-orange-700 border border-orange-300' },
                  { key: 'rejected', label: '✗ Reject', active: 'bg-red-600 text-white', inactive: 'bg-red-50 text-red-700 border border-red-300' },
                ].map(d => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDecisionOverride(d.key as any)}
                    className={`py-2.5 rounded-xl text-xs font-bold ${effectiveDecision === d.key ? d.active : d.inactive}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* REMARKS */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">
                Coordinator Remarks {effectiveDecision === 'rejected' || effectiveDecision === 'returned' ? '(required)' : '(optional)'}
              </p>
              <textarea
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={selectedWorker.competency_remarks ?? "Assessment notes — competency observations, reasons for decision..."}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
              />
            </div>

            {/* SAVE ASSESSMENT */}
            <button
              type="button"
              onClick={handleAssessmentSubmit}
              disabled={!effectiveDecision || saving}
              className={`w-full py-3 rounded-xl text-xs font-bold ${
                effectiveDecision && !saving ? 'bg-[#1F3864] text-white' : 'bg-gray-200 text-gray-400'
              }`}
            >
              {saving ? 'Saving...' : saved ? '✓ Assessment Saved' : 'Save Assessment'}
            </button>

            {/* ZONE ASSIGNMENT — only if accepted */}
            {effectiveDecision === 'accepted' && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-bold text-green-700">✓ Accepted — Assign to Zone</p>
                <form action={onAssign} className="space-y-3">
                  <input type="hidden" name="worker_id" value={selectedWorkerId} />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">Assign to Zone</p>
                    <select name="zone_name" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                      <option value="">Select zone...</option>
                      {zones.map(z => (
                        <option key={z.id} value={z.name}>{z.name} ({z.short_code})</option>
                      ))}
                    </select>
                    <input type="hidden" name="zone_short_code" value="" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Primary Zone?</p>
                      <select name="is_primary" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                        <option value="true">Yes — Primary</option>
                        <option value="false">No — Secondary</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Travel Mode</p>
                      <select name="travel_mode" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                        <option value="own_two_wheeler">🛵 Two-Wheeler</option>
                        <option value="public_transport">🚌 Public Transport</option>
                        <option value="bicycle">🚲 Bicycle</option>
                        <option value="on_foot">🚶 On Foot</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">Max Travel Time</p>
                    <select name="max_travel_minutes" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl text-sm">
                    Confirm Zone Assignment
                  </button>
                </form>
              </div>
            )}

            {/* RETURNED MESSAGE */}
            {effectiveDecision === 'returned' && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center">
                <p className="text-xs font-bold text-orange-700">Returned to Sub-Coordinator</p>
                <p className="text-xs text-orange-600 mt-1">Worker will be re-screened and resubmitted</p>
              </div>
            )}

            {/* REJECTED MESSAGE */}
            {effectiveDecision === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
                <p className="text-xs font-bold text-red-700">Worker Rejected</p>
                <p className="text-xs text-red-600 mt-1">Not assigned to any zone · Sub-coordinator notified</p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}