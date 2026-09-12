'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { scheduleAssessment } from './actions'
import { reviewWorker, approveWorker, sendToAdmin, returnForCorrection } from './approvalActions'

export type Worker = {
  id: string
  full_name: string
  trade: string
  skill_level: string | null
  district: string | null
  sector: string | null
  is_active: boolean
  employment_classification: string | null
  phone: string | null
  approval_status: string | null
  correction_action: string | null
  created_at: string | null
}

export type WorkerAssessment = {
  slot_date: string
  module_code: string
}

function formatAssessmentDate(isoDate: string) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

type WorkerCompetency = {
  module_code: string
  declared: boolean
  mcq_passed: boolean | null
  score: number | null
}

const MODULE_NAMES: Record<string, string> = {
  M1: 'Tile Works',
  M2: 'Plastering',
  M3: 'Brickwork',
  M4: 'Flooring',
  M5: 'Kitchen and Countertop',
  M6: 'Emergency Leakage',
}

const MODULE_ORDER = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']

const SKILL_LABELS: Record<string, string> = {
  unskilled: 'Unskilled',
  semi_skilled: 'Semi-Skilled',
  skilled: 'Skilled',
  highly_skilled: 'Highly Skilled',
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  permanent: 'Permanent',
  contractual: 'Contractual',
  daily_wage: 'Daily Wage',
  piece_rate: 'Piece Rate',
  subcontractor: 'Subcontractor',
  self: 'Self',
}

const SKILL_STYLES: Record<string, string> = {
  unskilled: 'bg-gray-100 text-gray-600 border border-gray-200',
  semi_skilled: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  skilled: 'bg-blue-100 text-blue-700 border border-blue-200',
  highly_skilled: 'bg-purple-100 text-purple-700 border border-purple-200',
}

// ─── Shared badge components ──────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        active
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-red-100 text-red-700 border border-red-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function SkillBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-gray-400">—</span>
  const key = level.toLowerCase()
  const styles = SKILL_STYLES[key] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${styles}`}>
      {SKILL_LABELS[key] ?? level}
    </span>
  )
}

function ApprovalStatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const configs: Record<string, { label: string; className: string }> = {
    pending: {
      label: 'Awaiting Review',
      className: 'bg-amber-100 text-amber-700 border border-amber-200',
    },
    sub_coordinator_reviewed: {
      label: 'Sub-Coordinator Reviewed',
      className: 'bg-blue-100 text-blue-700 border border-blue-200',
    },
    returned_for_correction: {
      label: 'Returned for Correction',
      className: 'bg-orange-100 text-orange-700 border border-orange-200',
    },
    pending_admin_approval: {
      label: 'Awaiting Admin Approval',
      className: 'bg-purple-100 text-purple-700 border border-purple-200',
    },
  }
  const config = configs[status]
  if (!config) return null
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  )
}

function DeploymentBadge({ row }: { row: WorkerCompetency }) {
  if (!row.declared) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">
        Not Declared
      </span>
    )
  }
  if (row.score === 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Cleared
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
      Assessment Needed
    </span>
  )
}

function ScheduledBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      Assessment Scheduled
    </span>
  )
}

function SchedulingForm({
  workerId,
  moduleCode,
  onScheduled,
  onCancel,
}: {
  workerId: string
  moduleCode: string
  onScheduled: (moduleCode: string) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState('')
  const [timeSlot, setTimeSlot] = useState<'morning' | 'afternoon' | null>(null)
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([])
  const [trainerName, setTrainerName] = useState('')
  const [loadingTrainers, setLoadingTrainers] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const [timeSlotError, setTimeSlotError] = useState<string | null>(null)
  const [trainerError, setTrainerError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('trainers')
      .select('id, name')
      .eq('is_active', true)
      .contains('specialisation', [moduleCode])
      .then(({ data, error }) => {
        if (error) console.error('Trainer fetch error:', error)
        if (!error && data && data.length > 0) {
          setTrainers(data)
          setTrainerName(data[0].name)
          setLoadingTrainers(false)
        } else {
          supabase
            .from('trainers')
            .select('id, name')
            .eq('is_active', true)
            .then(({ data: allData, error: allError }) => {
              if (allError) console.error('Trainer fallback fetch error:', allError)
              const list = allData ?? []
              setTrainers(list)
              if (list.length > 0) setTrainerName(list[0].name)
              setLoadingTrainers(false)
            })
        }
      })
  }, [moduleCode])

  const formValid =
    date.length > 0 &&
    timeSlot !== null &&
    trainerName !== '' &&
    trainers.length > 0

  async function handleConfirm() {
    setDateError(null)
    setTimeSlotError(null)
    setTrainerError(null)
    setSubmitError(null)

    let valid = true
    if (!date) { setDateError('Please select a date.'); valid = false }
    if (!timeSlot) { setTimeSlotError('Please select a time slot.'); valid = false }
    if (!trainerName) { setTrainerError('Please select a trainer.'); valid = false }
    if (!valid) return

    const slotTime = timeSlot === 'morning' ? '09:00:00' : '14:00:00'
    const supabase = createClient()

    const { data: slotConflict, error: slotErr } = await supabase
      .from('assessment_slots')
      .select('id')
      .eq('slot_date', date)
      .eq('slot_time', slotTime)
      .eq('assessor_name', trainerName)

    if (slotErr) { setSubmitError(slotErr.message); return }
    if ((slotConflict?.length ?? 0) > 0) {
      setSubmitError('This trainer is already booked at this date and time. Choose differently.')
      return
    }

    const { data: bookingDup, error: bookingErr } = await supabase
      .from('assessment_bookings')
      .select('id')
      .eq('worker_id', workerId)
      .eq('module_code', moduleCode)

    if (bookingErr) { setSubmitError(bookingErr.message); return }
    if ((bookingDup?.length ?? 0) > 0) {
      setSubmitError('Assessment already scheduled for this module.')
      return
    }

    setSubmitting(true)
    try {
      await scheduleAssessment(workerId, moduleCode, date, timeSlot!, trainerName)
      onScheduled(moduleCode)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to schedule')
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-gray-200 space-y-2.5">
      <p className="text-xs font-semibold text-gray-600">Schedule Assessment</p>

      {/* Date */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Date</label>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().split('T')[0]}
          onChange={e => { setDate(e.target.value); setDateError(null) }}
          className={`w-full border rounded-lg p-2 bg-white text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-900 ${dateError ? 'border-red-400' : 'border-gray-300'}`}
        />
        {dateError && <p className="text-xs text-red-600 mt-0.5">{dateError}</p>}
      </div>

      {/* Time slot — two large buttons */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Time Slot</label>
        <div className="flex gap-2">
          {([
            { label: 'Morning 9AM', slot: 'morning' as const },
            { label: 'Afternoon 2PM', slot: 'afternoon' as const },
          ]).map(({ label, slot }) => (
            <button
              key={slot}
              type="button"
              onClick={() => { setTimeSlot(slot); setTimeSlotError(null) }}
              className={`flex-1 text-sm py-2.5 rounded-md font-semibold transition-colors ${
                timeSlot === slot
                  ? 'bg-blue-900 text-white'
                  : 'bg-white border-2 border-blue-900 text-blue-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {timeSlotError && <p className="text-xs text-red-600 mt-0.5">{timeSlotError}</p>}
      </div>

      {/* Trainer dropdown */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Trainer</label>
        {loadingTrainers ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 py-1.5">
            <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading trainers…
          </div>
        ) : (
          <select
            value={trainerName}
            onChange={e => { setTrainerName(e.target.value); setTrainerError(null) }}
            disabled={trainers.length === 0}
            className={`w-full border rounded-lg p-2 bg-white text-sm cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 ${trainerError ? 'border-red-400' : 'border-gray-300'}`}
          >
            {trainers.length === 0 ? (
              <option value="">No qualified trainer available</option>
            ) : (
              trainers.map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))
            )}
          </select>
        )}
        {trainerError && <p className="text-xs text-red-600 mt-0.5">{trainerError}</p>}
      </div>

      {submitError && <p className="text-xs text-red-600">{submitError}</p>}

      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || !formValid}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-md transition-colors ${
            formValid && !submitting
              ? 'bg-blue-900 text-white cursor-pointer hover:bg-blue-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {submitting && (
            <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {submitting ? 'Scheduling…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Panel sub-components ─────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-[#2E74B5] mt-6 mb-1 pb-1 border-b-2 border-[#2E74B5]/20">
      {title}
    </h3>
  )
}

// ─── Worker detail panel ──────────────────────────────────────────────────────

function WorkerPanel({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [competency, setCompetency] = useState<WorkerCompetency[]>([])
  const [loadingComp, setLoadingComp] = useState(true)
  const [schedulingModule, setSchedulingModule] = useState<string | null>(null)
  const [scheduledModules, setScheduledModules] = useState<Set<string>>(new Set())
  const [localScheduled, setLocalScheduled] = useState<string[]>([])

  useEffect(() => {
    setLoadingComp(true)
    setSchedulingModule(null)
    const supabase = createClient()
    Promise.all([
      supabase
        .from('worker_competency')
        .select('module_code, declared, mcq_passed, score')
        .eq('worker_id', worker.id)
        .order('module_code'),
      supabase
        .from('assessment_bookings')
        .select('module_code')
        .eq('worker_id', worker.id),
    ]).then(([compRes, bookingsRes]) => {
      setCompetency(compRes.data ?? [])
      setScheduledModules(new Set((bookingsRes.data ?? []).map(b => b.module_code)))
      setLoadingComp(false)
    })
  }, [worker.id])

  const sectorLabel = worker.sector
    ? worker.sector.charAt(0).toUpperCase() + worker.sector.slice(1)
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="bg-[#1F3864] px-6 py-5 flex items-start justify-between shrink-0">
        <div>
          <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-1">
            Worker Profile
          </p>
          <h2 className="text-white font-bold text-lg leading-tight">{worker.full_name}</h2>
          <p className="text-blue-300 text-xs mt-1 capitalize">{worker.trade}</p>
        </div>
        <button
          onClick={onClose}
          className="text-blue-300 hover:text-white transition-colors ml-4 mt-0.5 p-1 rounded-lg hover:bg-white/10"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status row */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
        <ActiveBadge active={worker.is_active} />
        {worker.skill_level && (
          <>
            <span className="text-gray-300">·</span>
            <SkillBadge level={worker.skill_level} />
          </>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <SectionHeader title="Worker Details" />
        <DetailRow label="Full Name" value={worker.full_name} />
        <DetailRow label="Trade" value={<span className="capitalize">{worker.trade}</span>} />
        <DetailRow label="Zone" value={worker.district} />
        <DetailRow label="Skill Level" value={<SkillBadge level={worker.skill_level} />} />
        <DetailRow label="Phone" value={worker.phone} />
        <DetailRow label="Sector" value={sectorLabel} />
        <DetailRow label="Status" value={<ActiveBadge active={worker.is_active} />} />

        {/* Competency matrix */}
        <SectionHeader title="Competency Matrix" />

        {loadingComp ? (
          <div className="py-8 flex justify-center">
            <svg className="w-5 h-5 animate-spin text-[#2E74B5]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : competency.length === 0 ? (
          <div className="mt-3 py-6 rounded-xl bg-gray-50 border border-gray-200 text-center">
            <p className="text-sm text-gray-500 font-medium">No competency data recorded</p>
            <p className="text-xs text-gray-400 mt-1">Worker skipped this step during registration</p>
          </div>
        ) : (
          <div className="space-y-2.5 mt-3">
            {MODULE_ORDER.map(code => {
              const row = competency.find(c => c.module_code === code)
              if (!row) return null
              const isAssessmentNeeded = row.declared && row.score !== 1
              const isScheduled = scheduledModules.has(code) || localScheduled.includes(code)
              return (
                <div
                  key={code}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#1F3864] text-white text-xs font-bold shrink-0">
                        {code}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {MODULE_NAMES[code] ?? code}
                      </span>
                    </div>
                    <div className="ml-2 shrink-0 flex flex-wrap items-center justify-end gap-1.5">
                      {isScheduled ? <ScheduledBadge /> : <DeploymentBadge row={row} />}
                      {isAssessmentNeeded && !isScheduled && schedulingModule !== code && (
                        <button
                          onClick={() => setSchedulingModule(code)}
                          className="text-xs font-medium text-[#2E74B5] hover:text-[#1F3864] border border-[#2E74B5] hover:border-[#1F3864] px-2 py-0.5 rounded-md transition-colors whitespace-nowrap"
                        >
                          Schedule Assessment
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>
                      Declared:{' '}
                      <span className={row.declared ? 'text-green-600 font-semibold' : 'text-gray-400 font-medium'}>
                        {row.declared ? 'Yes' : 'No'}
                      </span>
                    </span>
                    {row.declared && (
                      <>
                        <span>
                          MCQ:{' '}
                          <span
                            className={
                              row.mcq_passed === true
                                ? 'text-green-600 font-semibold'
                                : row.mcq_passed === false
                                ? 'text-red-600 font-semibold'
                                : 'text-gray-400'
                            }
                          >
                            {row.mcq_passed === true
                              ? 'Passed'
                              : row.mcq_passed === false
                              ? 'Failed'
                              : '—'}
                          </span>
                        </span>
                        <span>
                          Score:{' '}
                          <span className="font-semibold text-gray-700">
                            {row.score ?? '—'}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                  {schedulingModule === code && (
                    <SchedulingForm
                      workerId={worker.id}
                      moduleCode={code}
                      onScheduled={(scheduledCode) => {
                        setLocalScheduled(prev => [...prev, scheduledCode])
                        setSchedulingModule(null)
                      }}
                      onCancel={() => setSchedulingModule(null)}
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

// ─── Pending approval card ────────────────────────────────────────────────────

const RETURN_REASONS: { label: string; action: string }[] = [
  {
    label: 'Aadhaar details incomplete or mismatch — resubmit Aadhaar',
    action: 'Please resubmit your Aadhaar details. Ensure the number and name match your card exactly.',
  },
  {
    label: 'BOCW card missing — upload BOCW card to proceed',
    action: 'Please upload your BOCW (Building and Other Construction Workers) registration card to proceed.',
  },
  {
    label: 'Bank account not verified — resubmit correct account details',
    action: 'Please resubmit correct bank account details. Ensure the account number and IFSC code are accurate.',
  },
  {
    label: 'Phone number not reachable — update contact number',
    action: 'Please update your contact number. Your registered phone number is currently unreachable.',
  },
  {
    label: 'Reference check pending — provide valid reference contact',
    action: 'Please provide a valid reference contact. Your registration requires a verifiable reference.',
  },
  {
    label: 'Competency declarations incomplete — complete all module declarations',
    action: 'Please complete all module competency declarations in your profile.',
  },
  {
    label: 'Safety induction not completed — complete safety induction',
    action: 'Please complete the mandatory safety induction before your registration can be approved.',
  },
  {
    label: 'Duplicate registration detected — contact coordinator',
    action: 'A duplicate registration has been detected. Please contact your coordinator to resolve this.',
  },
  {
    label: 'Zone not currently active for this trade — await zone activation',
    action: 'Your zone is not currently active for this trade. Please await zone activation or contact your coordinator.',
  },
  {
    label: 'Other',
    action: '',
  },
]

function PendingWorkerCard({
  worker,
  currentUserId,
  platformRole,
  onRefresh,
}: {
  worker: Worker
  currentUserId: string | null
  platformRole: string
  onRefresh: () => void
}) {
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const [selectedReasonIdx, setSelectedReasonIdx] = useState(-1)
  const [otherDetails, setOtherDetails] = useState('')
  const [correctionAction, setCorrectionAction] = useState('')
  const [resubmissionAllowed, setResubmissionAllowed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = busy || !currentUserId

  function handleReasonChange(idx: number) {
    setSelectedReasonIdx(idx)
    setCorrectionAction(idx >= 0 ? RETURN_REASONS[idx].action : '')
    setOtherDetails('')
  }

  function closeForm() {
    setReturnFormOpen(false)
    setSelectedReasonIdx(-1)
    setOtherDetails('')
    setCorrectionAction('')
    setResubmissionAllowed(true)
    setError(null)
  }

  async function handleReview() {
    if (!currentUserId) return
    setBusy(true)
    setError(null)
    const res = await reviewWorker(worker.id, currentUserId)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    onRefresh()
  }

  async function handleApprove() {
    if (!currentUserId) return
    setBusy(true)
    setError(null)
    const res = await approveWorker(worker.id, currentUserId)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    onRefresh()
  }

  async function handleSendToAdmin() {
    if (!currentUserId) return
    setBusy(true)
    setError(null)
    const res = await sendToAdmin(worker.id, currentUserId)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    onRefresh()
  }

  async function handleReturn() {
    if (!currentUserId || selectedReasonIdx < 0) return
    const isOther = RETURN_REASONS[selectedReasonIdx].label === 'Other'
    if (isOther && !otherDetails.trim()) return
    const fullReason = isOther
      ? `Other — ${otherDetails.trim()}`
      : RETURN_REASONS[selectedReasonIdx].label
    setBusy(true)
    setError(null)
    const res = await returnForCorrection(worker.id, fullReason, correctionAction.trim(), resubmissionAllowed, currentUserId)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    onRefresh()
  }

  const formattedDate = worker.created_at
    ? new Date(worker.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  const isOther = selectedReasonIdx >= 0 && RETURN_REASONS[selectedReasonIdx].label === 'Other'
  const canConfirm = selectedReasonIdx >= 0 && (!isOther || otherDetails.trim().length > 0) && !busy

  // Role-based button visibility
  const showReviewBtn =
    (platformRole === 'sub_coordinator' || platformRole === 'super_admin') &&
    (worker.approval_status === 'pending' || worker.approval_status === 'returned_for_correction')

  const showApproveBtn =
    platformRole !== 'sub_coordinator' && (
      (worker.approval_status === 'sub_coordinator_reviewed' && platformRole !== 'admin') ||
      (worker.approval_status === 'pending_admin_approval' &&
        (platformRole === 'admin' || platformRole === 'super_admin'))
    )

  // Separate "Send to Admin" button — coordinator or super_admin reviewing a skilled worker
  const showSendToAdminBtn =
    (platformRole === 'coordinator' || platformRole === 'super_admin') &&
    worker.approval_status === 'sub_coordinator_reviewed' &&
    worker.skill_level !== 'unskilled'

  const approveLabel =
    platformRole === 'admin' ||
    (platformRole === 'super_admin' && worker.approval_status === 'pending_admin_approval')
      ? 'Admin Approve'
      : 'Approve — Unskilled Labour'

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-gray-900">{worker.full_name}</p>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">{worker.trade} · {worker.district ?? '—'}</p>
        </div>
        <ApprovalStatusBadge status={worker.approval_status} />
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3">
        <span>Phone: <span className="font-medium text-gray-800">{worker.phone ?? '—'}</span></span>
        <span>Applied: <span className="font-medium text-gray-800">{formattedDate}</span></span>
      </div>

      {worker.correction_action && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Correction Required</p>
          <p className="text-xs text-amber-900">{worker.correction_action}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {showReviewBtn && (
          <button
            type="button"
            onClick={handleReview}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send to Coordinator
          </button>
        )}
        {showApproveBtn && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {approveLabel}
          </button>
        )}
        {showSendToAdminBtn && (
          <button
            type="button"
            onClick={handleSendToAdmin}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send to Admin
          </button>
        )}
        <button
          type="button"
          onClick={() => returnFormOpen ? closeForm() : setReturnFormOpen(true)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Return for Correction
        </button>
      </div>

      {returnFormOpen && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">

          {/* Section 1 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              1. Return reason <span className="text-red-500">*</span>
            </p>
            <select
              value={selectedReasonIdx}
              onChange={e => handleReasonChange(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
            >
              <option value={-1} disabled>Select a reason…</option>
              {RETURN_REASONS.map((r, i) => (
                <option key={i} value={i}>{r.label}</option>
              ))}
            </select>
            {isOther && (
              <input
                type="text"
                value={otherDetails}
                onChange={e => setOtherDetails(e.target.value)}
                placeholder="Briefly describe the issue…"
                className="mt-2 w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            )}
          </div>

          {/* Section 2 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              2. Correction action required
              <span className="ml-1 text-gray-400 font-normal normal-case tracking-normal">(shown to worker)</span>
            </p>
            <textarea
              value={correctionAction}
              onChange={e => setCorrectionAction(e.target.value)}
              placeholder="Describe what the worker needs to do…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none"
            />
          </div>

          {/* Section 3 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              3. Resubmission allowed
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResubmissionAllowed(true)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  resubmissionAllowed
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-green-500 hover:text-green-700'
                }`}
              >
                Yes — allow resubmission
              </button>
              <button
                type="button"
                onClick={() => setResubmissionAllowed(false)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  !resubmissionAllowed
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-red-500 hover:text-red-700'
                }`}
              >
                No — permanent rejection
              </button>
            </div>
            {!resubmissionAllowed && (
              <p className="text-xs text-red-600 mt-1.5">
                Worker will be permanently rejected and cannot resubmit.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleReturn}
              disabled={!canConfirm}
              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'Submitting…' : 'Confirm Return'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!returnFormOpen && error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

export default function WorkersTable({
  activeWorkers,
  pendingWorkers,
  workerAssessments = {},
  platformRole = 'coordinator',
}: {
  activeWorkers: Worker[]
  pendingWorkers: Worker[]
  workerAssessments?: Record<string, WorkerAssessment>
  platformRole?: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Worker | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  const close = useCallback(() => setSelected(null), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected])

  return (
    <>
      {/* Pending Approval section */}
      {pendingWorkers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-base font-bold text-amber-700">Pending Approval</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
              {pendingWorkers.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingWorkers.map(worker => (
              <PendingWorkerCard
                key={worker.id}
                worker={worker}
                currentUserId={currentUserId}
                platformRole={platformRole}
                onRefresh={() => router.refresh()}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active workers table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1F3864] text-white text-left">
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Full Name</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Trade</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Skill Level</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">District</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Sector</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Employment</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Next Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeWorkers.length > 0 ? (
                activeWorkers.map((worker) => (
                  <tr
                    key={worker.id}
                    onClick={() => setSelected(worker)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 text-gray-900 font-semibold whitespace-nowrap">
                      {worker.full_name}
                    </td>
                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap capitalize">
                      {worker.trade}
                    </td>
                    <td className="px-4 py-3.5">
                      <SkillBadge level={worker.skill_level} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                      {worker.district ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap capitalize">
                      {worker.sector ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                      {worker.employment_classification
                        ? (EMPLOYMENT_LABELS[worker.employment_classification] ?? worker.employment_classification)
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <ActiveBadge active={worker.is_active} />
                        {workerAssessments[worker.id] && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                            Assessment Scheduled
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                      {workerAssessments[worker.id] ? (
                        <span className="text-gray-700">
                          {formatAssessmentDate(workerAssessments[worker.id].slot_date)}
                          <span className="text-gray-400 ml-1">· {workerAssessments[worker.id].module_code}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="font-medium text-gray-500">No active workers</p>
                    <p className="text-xs mt-1">Workers approved by a coordinator will appear here</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel overlay */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          selected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          onClick={close}
        />

        {/* Slide-in panel */}
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
            selected ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selected && (
            <WorkerPanel key={selected.id} worker={selected} onClose={close} />
          )}
        </div>
      </div>
    </>
  )
}
