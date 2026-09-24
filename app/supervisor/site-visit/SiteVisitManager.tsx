'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { initReport, saveScreen, submitReport, uploadSiteVisitPhoto, raiseDecision5 } from './actions'
import { submitExtraWork } from '../extra-works/actions'

interface SlotData {
  id: string
  slot_start: string | null
  slot_end: string | null
  site_id: string | null
  site_address: string | null
  milestone_id: string | null
  qip_template_id: string | null
  ltf_note: string | null
  slot_type: string | null
  work_start: string | null
  work_end: string | null
  visit_status: string | null
}

interface SubstageData {
  id: string
  substage_code: string
  substage_name: string
  milestone_code: string
  trade_type: string | null
  booking_ref: string
  status: string
  completion_pct: number | null
  supervisor_checklist: any
  evidence_checklist: any
  evidence_submitted: any
  is_critical_path: boolean
  planned_day: number | null
  planned_hours: number | null
  float_days: number | null
  early_start_date: string | null
  early_finish_date: string | null
}

interface ActiveJob {
  booking_ref: string
  job_title: string | null
  job_type: string | null
  zone: string | null
  district: string | null
}

interface Props {
  supervisorName: string
  supervisorId: string
  workerId: string
  bookingRef?: string
  slotData: SlotData | null
  substageData: SubstageData | null
  activeJobs: ActiveJob[]
}

const TOTAL_SCREENS = 21

// site_visit_reports column per screen (1-indexed screen number -> array index)
const SCREEN_COLUMNS = [
  'screen01_job_details',
  'screen02_scope_intent',
  'screen03_plumbing',
  'screen04_electrical',
  'screen05_waterproofing',
  'screen06_walls',
  'screen07_floors',
  'screen08_tiles',
  'screen09_fixtures',
  'screen10_ceiling',
  'screen11_logistics',
  'screen12_compliance',
  'screen13_measurements',
  'screen14_labour',
  'screen15_materials',
  'screen16_risk_flags',
  'screen17_risk_decisions',
  'screen18_milestones',
  'screen19_materials',
  'screen20_submit',
]

const DECISION_5_REASON_LABELS: Record<string, string> = {
  bad_quality: 'Bad Quality',
  not_as_per_design: 'Not as per Design',
  not_as_per_sequence: 'Not as per Trade Sequence',
  others: 'Other',
}

const DECISION_5_REMEDY_LABELS: Record<string, string> = {
  redo_complete: 'Redo Complete',
  redo_part: 'Redo Part Affected',
  create_substage_job: 'Create a Substage Job',
  others: 'Other',
}

const screenTitles = [
  'Check In',
  'Ground Feed',
  'Workers Present',
  'Safety Conditions',
  'PPE Compliance',
  'Hazard Check',
  'QIP Template',
  'Evidence Checklist',
  'Photo Upload',
  'Physical Completion',
  'Test Results',
  'Measurements',
  'Quality Check',
  'Risk Flags',
  'Client Decisions',
  'Field Notes',
  'Scope Change',
  'Payment Proposal',
  'SLA Confirmation',
  'Certificate',
  'Submit & Authorize',
]

export default function SiteVisitManager({
  supervisorName,
  supervisorId,
  workerId,
  bookingRef: bookingRefProp,
  slotData,
  substageData,
  activeJobs,
}: Props) {
  const [screen, setScreen] = useState(1)
  const [reportId, setReportId] = useState<string | null>(null)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({})
  const [form, setForm] = useState({
    // S01
    checkedIn: false,
    checkInTime: '',
    // S02
    siteHeadName: '',
    siteHeadNote: '',
    ltfConfirmed: false,
    // S03
    workersPresent: '',
    workersPlanned: '',
    attendanceMatch: '',
    // S04
    ppeInUse: '',
    siteAccessClear: '',
    noHazards: '',
    workersCountMatch: '',
    // S05
    hardHat: '',
    safetyShoes: '',
    gloves: '',
    eyeProtection: '',
    harness: '',
    // S06
    riskType: '',
    riskDescription: '',
    riskSeverity: '',
    riskFlagged: false,
    // S07
    labCode: '',
    templateId: '',
    subMilestoneConfirmed: false,
    // S08
    evidenceItems: [] as { label: string; confirmed: boolean; notes: string }[],
    // S09
    photosUploaded: [] as { label: string; uploaded: boolean; url?: string }[],
    // S10
    workDoneAsDescribed: '',
    photosCorrect: '',
    testResultsOk: '',
    noSnags: '',
    readyForNext: '',
    // S11
    pressureTestValue: '',
    holdTimeMinutes: '',
    slopeMeasurement: '',
    otherTestNotes: '',
    // S12
    actualDimensions: '',
    siteConditions: '',
    varianceFromPlan: '',
    // S13
    materialGradeMatch: '',
    brandMatch: '',
    quantityMatch: '',
    tradeSequenceCorrect: '',
    applicationMethodCorrect: '',
    workmanshipQuality: '',
    // S14
    riskFlagType: '',
    riskFlagDesc: '',
    riskFlagSeverity: '',
    // S15
    clientDecisionsPending: '',
    scopeChangeTriggerB: false,
    // S16
    fieldNotes: '',
    // S17
    scopeChangeTrigger: '',
    scopeChangeDesc: '',
    scopeChangeTechnicalReason: '',
    scopeChangeCostImpact: '',
    // S18
    paymentDecision: '',
    releasePercent: '',
    partialReleaseReason: '',
    rectificationItems: '',
    materialLossEstimate: '',
    holdReason: '',
    revisedTimeline: '',
    rejectionWhyReason: '' as '' | 'bad_quality' | 'not_as_per_design' | 'not_as_per_sequence' | 'others',
    rejectionWhyOther: '',
    rejectionRemedy: '' as '' | 'redo_complete' | 'redo_part' | 'create_substage_job' | 'others',
    rejectionRemedyOther: '',
    // S19
    submissionTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    slaBlock: '',
    // S20
    certificateSigned: false,
    // S21
    submitted: false,
  })

  const update = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const progressPct = Math.round((screen / TOTAL_SCREENS) * 100)

  const site = slotData?.site_id ?? substageData?.booking_ref ?? 'Site TBC'
  const address = slotData?.site_address ?? ''
  const templateId = slotData?.qip_template_id ?? substageData?.substage_code ?? '—'
  const ltfNote = slotData?.ltf_note ?? ''
  const bookingRef = bookingRefProp || substageData?.booking_ref || slotData?.site_id || 'unknown-site'
  const jobTitle = activeJobs.find(j => j.booking_ref === bookingRef)?.job_title ?? site
  // One supervisor_daily_routes slot (or, lacking that, the substage) = one visit.
  // Without this, every visit to the same booking collapsed into one shared row.
  const visitSlotId = slotData?.id ?? substageData?.id ?? null

  useEffect(() => {
    if (!workerId || workerId === '' || !bookingRef || bookingRef === '' || bookingRef === 'unknown-site') return
    initReport(workerId, bookingRef, jobTitle, visitSlotId).then(({ reportId, error }) => {
      if (reportId) setReportId(reportId)
    })
  }, [workerId, bookingRef, jobTitle, visitSlotId])

  const next = async () => {
    if (reportId && screen <= SCREEN_COLUMNS.length) {
      await saveScreen(reportId, screen, SCREEN_COLUMNS[screen - 1], form)
    }
    setScreen(s => Math.min(s + 1, TOTAL_SCREENS))
  }
  const back = () => setScreen(s => Math.max(s - 1, 1))

  async function handlePhotoUpload(idx: number, itemLabel: string, file: File) {
    setUploadingIdx(idx)
    setUploadErrors(prev => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadSiteVisitPhoto(bookingRef, `photo-upload-${itemLabel}-${idx}`, fd)
      if (result.error) {
        setUploadErrors(prev => ({ ...prev, [idx]: result.error as string }))
      } else {
        const updated = [...form.photosUploaded]
        updated[idx] = { label: itemLabel, uploaded: true, url: result.url }
        update('photosUploaded', updated)
      }
    } catch (e) {
      setUploadErrors(prev => ({ ...prev, [idx]: e instanceof Error ? e.message : 'Upload failed' }))
    } finally {
      setUploadingIdx(null)
    }
  }

  // Checklist from substage
  const evidenceChecklist = (substageData?.evidence_checklist as any[]) ?? []
  const supervisorChecklist = (substageData?.supervisor_checklist as any[]) ?? []

  const radioGroup = (name: string, value: string, options: string[], onChange: (v: string) => void) => (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )

  const checkRow = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-gray-100 last:border-0">
      <p className="text-sm font-medium text-gray-700 flex-1">{label}</p>
      {radioGroup(label, value, ['Yes', 'No', 'N/A'], onChange)}
    </div>
  )

  const inputField = (label: string, value: string, onChange: (v: string) => void, placeholder = '', type = 'text') => (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
      />
    </div>
  )

  const textArea = (label: string, value: string, onChange: (v: string) => void, placeholder = '', rows = 3) => (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
      />
    </div>
  )

  const renderScreen = () => {
    switch (screen) {

      // ─── SCREEN 1 — CHECK IN ───────────────────────────────────────────
      case 1: return (
        <div className="space-y-5">
          {substageData?.is_critical_path && (
            <div className="bg-red-50 border border-red-300 rounded-2xl px-5 py-4">
              <p className="text-red-700 font-bold text-sm">🔴 CRITICAL PATH SUBSTAGE</p>
              <p className="text-red-600 text-xs mt-1">Any delay shifts client handover date. Inspect and approve today.</p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Site Details</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Site / Booking</span><span className="font-semibold">{site}</span></div>
              {address && <div className="flex justify-between"><span className="text-gray-400">Address</span><span className="font-semibold text-right max-w-[60%]">{address}</span></div>}
              {substageData && <div className="flex justify-between"><span className="text-gray-400">Substage</span><span className="font-semibold">{substageData.substage_code}</span></div>}
              {substageData && <div className="flex justify-between"><span className="text-gray-400">Trade</span><span className="font-semibold">{substageData.trade_type}</span></div>}
              {slotData?.slot_start && <div className="flex justify-between"><span className="text-gray-400">Slot</span><span className="font-semibold">{slotData.slot_start} → {slotData.slot_end}</span></div>}
            </div>
          </div>
          {ltfNote && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
              <p className="text-xs text-gray-400 font-medium mb-1">LTF Note from Site Head</p>
              <p className="text-sm text-green-800 font-semibold">"{ltfNote}"</p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">GPS Check In</p>
            <p className="text-xs text-gray-400">Tap Check In to record GPS-verified arrival at site</p>
            <button
              onClick={() => {
                update('checkedIn', true)
                update('checkInTime', new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
              }}
              className={`w-full py-4 rounded-2xl font-bold text-sm transition-colors ${form.checkedIn ? 'bg-green-600 text-white' : 'bg-[#1F3864] text-white'}`}
            >
              {form.checkedIn ? `✓ Checked In — ${form.checkInTime}` : 'Check In — GPS Verify'}
            </button>
          </div>
        </div>
      )

      // ─── SCREEN 2 — GROUND FEED ────────────────────────────────────────
      case 2: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            {inputField('Site Head / Skill Head Name', form.siteHeadName, v => update('siteHeadName', v), 'Name of person briefing you...')}
            {textArea('Site Head Report / Notes', form.siteHeadNote, v => update('siteHeadNote', v), 'What did the Site Head report — progress, issues, readiness...')}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">LTF Status Confirmed?</p>
              {radioGroup('ltf', form.ltfConfirmed ? 'Yes' : 'No', ['Yes', 'No'], v => update('ltfConfirmed', v === 'Yes'))}
            </div>
          </div>
        </div>
      )

      // ─── SCREEN 3 — WORKERS PRESENT ───────────────────────────────────
      case 3: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            {inputField('Workers Present (actual count)', form.workersPresent, v => update('workersPresent', v), 'e.g. 3', 'number')}
            {inputField('Workers Planned (from deployment)', form.workersPlanned, v => update('workersPlanned', v), 'e.g. 3', 'number')}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Attendance Matches Deployment Plan?</p>
              {radioGroup('attendance', form.attendanceMatch, ['Yes', 'No — Short', 'No — Extra'], v => update('attendanceMatch', v))}
            </div>
            {form.attendanceMatch.startsWith('No') && (
              textArea('Reason for Mismatch', '', () => {}, 'Explain attendance discrepancy...', 2)
            )}
          </div>
        </div>
      )

      // ─── SCREEN 4 — SAFETY CONDITIONS ─────────────────────────────────
      case 4: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {checkRow('PPE in use by all workers', form.ppeInUse, v => update('ppeInUse', v))}
            {checkRow('Site access clear and safe', form.siteAccessClear, v => update('siteAccessClear', v))}
            {checkRow('No hazardous conditions observed', form.noHazards, v => update('noHazards', v))}
            {checkRow('Workers count matches deployment plan', form.workersCountMatch, v => update('workersCountMatch', v))}
          </div>
          {(form.noHazards === 'No') && (
            <div className="bg-red-50 border border-red-300 rounded-2xl px-5 py-4">
              <p className="text-red-700 font-bold text-sm mb-2">⚠ Hazard Identified</p>
              {textArea('Describe Hazard', '', () => {}, 'Describe the hazard in detail...', 3)}
            </div>
          )}
        </div>
      )

      // ─── SCREEN 5 — PPE COMPLIANCE ────────────────────────────────────
      case 5: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {checkRow('Hard Hat', form.hardHat, v => update('hardHat', v))}
            {checkRow('Safety Shoes', form.safetyShoes, v => update('safetyShoes', v))}
            {checkRow('Gloves', form.gloves, v => update('gloves', v))}
            {checkRow('Eye Protection', form.eyeProtection, v => update('eyeProtection', v))}
            {checkRow('Safety Harness (if working at height)', form.harness, v => update('harness', v))}
          </div>
        </div>
      )

      // ─── SCREEN 6 — HAZARD CHECK ──────────────────────────────────────
      case 6: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Risk Type</p>
              {radioGroup('riskType', form.riskType, ['Safety', 'Quality', 'Structural', 'Client', 'None'], v => update('riskType', v))}
            </div>
            {form.riskType !== 'None' && form.riskType !== '' && (
              <>
                {textArea('Risk Description', form.riskDescription, v => update('riskDescription', v), 'Describe the risk in detail...')}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Severity</p>
                  {radioGroup('severity', form.riskSeverity, ['Low', 'Medium', 'High', 'Critical'], v => update('riskSeverity', v))}
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={form.riskFlagged} onChange={e => update('riskFlagged', e.target.checked)} className="w-4 h-4" />
                  <p className="text-sm font-medium text-gray-700">Flag to Coordinator immediately</p>
                </div>
              </>
            )}
          </div>
        </div>
      )

      // ─── SCREEN 7 — QIP TEMPLATE ──────────────────────────────────────
      case 7: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            {inputField('LAB Code Confirmed', form.labCode || substageData?.substage_code || '', v => update('labCode', v), 'e.g. LAB-WPF-01')}
            {inputField('QIP Template ID', form.templateId || templateId, v => update('templateId', v), 'e.g. TMP-PLM-01-REV01')}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.subMilestoneConfirmed}
                onChange={e => update('subMilestoneConfirmed', e.target.checked)}
                className="w-4 h-4"
              />
              <p className="text-sm font-medium text-gray-700">Sub-milestone being inspected confirmed</p>
            </div>
            {substageData && (
              <div className="bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-blue-700 mb-2">Substage Details</p>
                <div className="space-y-1 text-xs text-blue-600">
                  <p>Code: {substageData.substage_code}</p>
                  <p>Name: {substageData.substage_name}</p>
                  <p>Milestone: {substageData.milestone_code}</p>
                  <p>Trade: {substageData.trade_type}</p>
                  <p>Float: {substageData.float_days ?? 0} days</p>
                  {substageData.is_critical_path && <p className="text-red-600 font-bold">🔴 Critical Path</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )

      // ─── SCREEN 8 — EVIDENCE CHECKLIST ────────────────────────────────
      case 8: return (
        <div className="space-y-4">
          <div className="bg-[#1F3864] rounded-2xl px-5 py-3">
            <p className="text-white font-bold text-sm">Element C — Evidence Checklist</p>
            <p className="text-blue-200 text-xs mt-0.5">Sub-stage specific — not generic</p>
          </div>
          {evidenceChecklist.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {evidenceChecklist.map((item: any, idx: number) => (
                <div key={idx} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 mt-0.5 shrink-0"
                      onChange={() => {
                        const updated = [...(form.evidenceItems.length ? form.evidenceItems : evidenceChecklist.map((e: any) => ({ label: e.label ?? e, confirmed: false, notes: '' })))]
                        if (updated[idx]) updated[idx].confirmed = !updated[idx].confirmed
                        update('evidenceItems', updated)
                      }}
                      checked={form.evidenceItems[idx]?.confirmed ?? false}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">{item.label ?? item}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
              <p className="text-xs text-gray-400">No evidence checklist loaded from substage. Enter manually:</p>
              {['Before photo — site condition', 'During photo — work in progress', 'After photo — completed work', 'Test result photo (if applicable)'].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input type="checkbox" className="w-4 h-4 shrink-0" />
                  <p className="text-sm font-medium text-gray-700">{item}</p>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3">
            <p className="text-xs text-gray-500">
              {form.evidenceItems.filter(e => e.confirmed).length} of {evidenceChecklist.length || 4} items confirmed
            </p>
          </div>
        </div>
      )

      // ─── SCREEN 9 — PHOTO UPLOAD ──────────────────────────────────────
      case 9: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {(evidenceChecklist.length > 0 ? evidenceChecklist : ['Before photo', 'During photo', 'After photo']).map((item: any, idx: number) => {
              const label = item.label ?? item
              const uploaded = form.photosUploaded[idx]
              const isUploading = uploadingIdx === idx
              const uploadError = uploadErrors[idx]
              return (
                <div key={idx} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0">📷</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 mb-2">{label}</p>

                      {uploaded?.uploaded && uploaded.url && (
                        <div className="mb-2">
                          <img
                            src={uploaded.url}
                            alt={label}
                            className="w-full max-w-[220px] h-32 object-cover rounded-xl border border-gray-200"
                          />
                        </div>
                      )}

                      {uploaded?.uploaded ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                          ✓ Uploaded
                        </span>
                      ) : isUploading ? (
                        <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-500 text-xs font-bold px-4 py-2 rounded-xl">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Uploading…
                        </span>
                      ) : (
                        <label className="inline-flex items-center gap-2 bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                          📸 Upload Photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (file) handlePhotoUpload(idx, label, file)
                            }}
                          />
                        </label>
                      )}

                      {uploadError && (
                        <p className="text-red-600 text-xs mt-2">{uploadError}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )

      // ─── SCREEN 10 — PHYSICAL COMPLETION ─────────────────────────────
      case 10: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {checkRow('Work done as described in substage?', form.workDoneAsDescribed, v => update('workDoneAsDescribed', v))}
            {checkRow('Evidence photos correct and match actual?', form.photosCorrect, v => update('photosCorrect', v))}
            {checkRow('Test results within specification?', form.testResultsOk, v => update('testResultsOk', v))}
            {checkRow('No snags or defects observed?', form.noSnags, v => update('noSnags', v))}
            {checkRow('Ready for next substage to commence?', form.readyForNext, v => update('readyForNext', v))}
          </div>
          {form.noSnags === 'No' && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4">
              {textArea('Describe Snags / Defects', '', () => {}, 'List all snags observed...')}
            </div>
          )}
        </div>
      )

      // ─── SCREEN 11 — TEST RESULTS ─────────────────────────────────────
      case 11: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            {inputField('Pressure Test Value (bar)', form.pressureTestValue, v => update('pressureTestValue', v), 'e.g. 10', 'number')}
            {inputField('Hold Time (minutes)', form.holdTimeMinutes, v => update('holdTimeMinutes', v), 'e.g. 30', 'number')}
            {inputField('Slope Measurement (%)', form.slopeMeasurement, v => update('slopeMeasurement', v), 'e.g. 1.5', 'number')}
            {textArea('Other Test Notes', form.otherTestNotes, v => update('otherTestNotes', v), 'Any other numeric test results...')}
          </div>
        </div>
      )

      // ─── SCREEN 12 — MEASUREMENTS ─────────────────────────────────────
      case 12: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            {textArea('Actual Dimensions Recorded', form.actualDimensions, v => update('actualDimensions', v), 'Record actual measurements taken on site...')}
            {textArea('Site Conditions Noted', form.siteConditions, v => update('siteConditions', v), 'Describe current site conditions...')}
            {textArea('Variance from Plan (if any)', form.varianceFromPlan, v => update('varianceFromPlan', v), 'Note any deviations from the planned scope...')}
          </div>
        </div>
      )

      // ─── SCREEN 13 — QUALITY CHECK ────────────────────────────────────
      case 13: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Material Specification Check</p>
            </div>
            {checkRow('Material grade matches BOQ?', form.materialGradeMatch, v => update('materialGradeMatch', v))}
            {checkRow('Brand / standard matches?', form.brandMatch, v => update('brandMatch', v))}
            {checkRow('Quantity on site matches requirement?', form.quantityMatch, v => update('quantityMatch', v))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Method of Working Check</p>
            </div>
            {checkRow('Trade sequence correct?', form.tradeSequenceCorrect, v => update('tradeSequenceCorrect', v))}
            {checkRow('Application method correct?', form.applicationMethodCorrect, v => update('applicationMethodCorrect', v))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Overall Workmanship Quality</p>
            {radioGroup('quality', form.workmanshipQuality, ['Acceptable', 'Needs Minor Rework', 'Needs Major Rework'], v => update('workmanshipQuality', v))}
          </div>
        </div>
      )

      // ─── SCREEN 14 — RISK FLAGS ───────────────────────────────────────
      case 14: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Risk Flag Type</p>
              {radioGroup('riskFlagType', form.riskFlagType, ['Safety', 'Quality', 'Structural', 'Client', 'None'], v => update('riskFlagType', v))}
            </div>
            {form.riskFlagType !== 'None' && form.riskFlagType !== '' && (
              <>
                {textArea('Risk Description', form.riskFlagDesc, v => update('riskFlagDesc', v), 'Describe the risk in detail...')}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Severity</p>
                  {radioGroup('flagSeverity', form.riskFlagSeverity, ['Low', 'Medium', 'High', 'Critical'], v => update('riskFlagSeverity', v))}
                </div>
                {form.riskFlagSeverity === 'Critical' && (
                  <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
                    <p className="text-red-700 text-xs font-bold">Critical risk — will be auto-escalated to Coordinator on submit</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )

      // ─── SCREEN 15 — CLIENT DECISIONS ────────────────────────────────
      case 15: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            {textArea('Client Decisions Pending', form.clientDecisionsPending, v => update('clientDecisionsPending', v), 'List any items awaiting client confirmation...')}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.scopeChangeTriggerB}
                onChange={e => {
                  update('scopeChangeTriggerB', e.target.checked)
                  if (e.target.checked) {
                    update('scopeChangeTrigger', 'Trigger B — Client Demand')
                    if (!form.scopeChangeDesc) update('scopeChangeDesc', form.clientDecisionsPending)
                  }
                }}
                className="w-4 h-4"
              />
              <p className="text-sm font-medium text-gray-700">Client has raised a scope change request (Trigger B)</p>
            </div>
            {form.scopeChangeTriggerB && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                <p className="text-yellow-700 text-xs font-bold mb-1">Trigger B — Client Demand</p>
                <p className="text-yellow-600 text-xs">Routes: Client → Trade Skill Head → Coordinator → Client (YES/NO)</p>
                <p className="text-yellow-600 text-xs mt-0.5">Original baseline stays active until client accepts</p>
              </div>
            )}
          </div>
        </div>
      )

      // ─── SCREEN 16 — FIELD NOTES ──────────────────────────────────────
      case 16: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            {textArea('Supervisor Field Notes', form.fieldNotes, v => update('fieldNotes', v), 'Record any observations, findings, or notes from this site visit...', 8)}
          </div>
        </div>
      )

      // ─── SCREEN 17 — SCOPE CHANGE ─────────────────────────────────────
      case 17: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Scope Change Trigger</p>
              {radioGroup('scopeTrigger', form.scopeChangeTrigger, ['Trigger A — My Technical Recommendation', 'Trigger B — Client Demand', 'No Scope Change'], v => update('scopeChangeTrigger', v))}
            </div>
            {form.scopeChangeTrigger && !form.scopeChangeTrigger.startsWith('No') && (
              <>
                {textArea('Description of Change', form.scopeChangeDesc, v => update('scopeChangeDesc', v), 'Describe the proposed scope change...')}
                {textArea('Technical Reason / Justification', form.scopeChangeTechnicalReason, v => update('scopeChangeTechnicalReason', v), 'Why is this change needed?')}
                {inputField('Estimated Cost Impact (₹)', form.scopeChangeCostImpact, v => update('scopeChangeCostImpact', v), 'e.g. 12000', 'number')}
                <div className="bg-blue-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-blue-700 font-semibold">
                    {form.scopeChangeTrigger.startsWith('Trigger A')
                      ? 'Routes: Supervisor → Trade Skill Head → Coordinator → Client'
                      : 'Routes: Client → Trade Skill Head → Coordinator → Client'}
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">Original baseline stays active until client accepts</p>
                </div>
              </>
            )}
          </div>
        </div>
      )

      // ─── SCREEN 18 — PAYMENT PROPOSAL ────────────────────────────────
      case 18: return (
        <div className="space-y-4">
          <div className="bg-[#1F3864] rounded-2xl px-5 py-3">
            <p className="text-white font-bold text-sm">Payment Decision</p>
            <p className="text-blue-200 text-xs mt-0.5">Supervisor recommends — Coordinator approves final release</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {[
              { value: '1', label: 'Decision 1 — Full Release', desc: '100% · All evidence confirmed · No defects', color: 'text-green-700' },
              { value: '2', label: 'Decision 2 — Partial Release · Rectification Pending', desc: '70-90% · Minor items to correct · No demolition', color: 'text-blue-700' },
              { value: '3', label: 'Decision 3 — Partial Release · Redo Required', desc: '40-70% · Portion must be redone', color: 'text-yellow-700' },
              { value: '4', label: 'Decision 4 — Hold · Rework with Material Loss', desc: '0% · Demolition required · Material loss', color: 'text-orange-700' },
              { value: '5', label: 'Decision 5 — Reject · Complete Redo', desc: '0% · Fundamental defect · Admin notified', color: 'text-red-700' },
            ].map(d => (
              <label key={d.value} className="flex items-start gap-4 px-5 py-4 cursor-pointer active:bg-gray-50">
                <input
                  type="radio"
                  name="payment"
                  value={d.value}
                  checked={form.paymentDecision === d.value}
                  onChange={() => update('paymentDecision', d.value)}
                  className="w-4 h-4 mt-0.5 shrink-0"
                />
                <div>
                  <p className={`text-sm font-bold ${d.color}`}>{d.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{d.desc}</p>
                </div>
              </label>
            ))}
          </div>
          {form.paymentDecision === '2' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
              {inputField('Release % (70-90)', form.releasePercent, v => update('releasePercent', v), 'e.g. 80', 'number')}
              {textArea('Rectification Items', form.rectificationItems, v => update('rectificationItems', v), 'List items to be rectified...')}
              {textArea('Reasons for Partial Release', form.partialReleaseReason, v => update('partialReleaseReason', v), 'Why is release partial rather than full...')}
            </div>
          )}
          {form.paymentDecision === '3' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
              {inputField('Release % (40-70)', form.releasePercent, v => update('releasePercent', v), 'e.g. 60', 'number')}
              {textArea('Redo Items', form.rectificationItems, v => update('rectificationItems', v), 'What needs to be redone...')}
            </div>
          )}
          {form.paymentDecision === '4' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
              {inputField('Material Loss Estimate (₹)', form.materialLossEstimate, v => update('materialLossEstimate', v), 'e.g. 15000', 'number')}
              {textArea('Substages Affected', form.rectificationItems, v => update('rectificationItems', v), 'Which substages are affected...')}
              {textArea('Revised Timeline', form.revisedTimeline, v => update('revisedTimeline', v), 'New estimated completion...')}
              {textArea('Reasons for Holding Release', form.holdReason, v => update('holdReason', v), 'Why is release being held...')}
            </div>
          )}
          {form.paymentDecision === '5' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Why Rejected</p>
                <div className="space-y-2">
                  {([
                    { value: 'bad_quality', label: 'Bad Quality' },
                    { value: 'not_as_per_design', label: 'Not as per Design' },
                    { value: 'not_as_per_sequence', label: 'Not as per Trade Sequence' },
                    { value: 'others', label: 'Others' },
                  ] as const).map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rejectionWhyReason"
                        checked={form.rejectionWhyReason === opt.value}
                        onChange={() => update('rejectionWhyReason', opt.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {form.rejectionWhyReason === 'others' && (
                  <div className="mt-2">
                    {inputField('Specify Reason', form.rejectionWhyOther, v => update('rejectionWhyOther', v), 'Describe why rejected...')}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">What to Do</p>
                <div className="space-y-2">
                  {([
                    { value: 'redo_complete', label: 'Redo Complete' },
                    { value: 'redo_part', label: 'Redo Part Affected' },
                    { value: 'create_substage_job', label: 'Create a Substage Job' },
                    { value: 'others', label: 'Others' },
                  ] as const).map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rejectionRemedy"
                        checked={form.rejectionRemedy === opt.value}
                        onChange={() => update('rejectionRemedy', opt.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {form.rejectionRemedy === 'others' && (
                  <div className="mt-2">
                    {inputField('Specify Remedy', form.rejectionRemedyOther, v => update('rejectionRemedyOther', v), 'Describe what should be done...')}
                  </div>
                )}
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs text-red-700 font-semibold">Admin will be notified to confirm this Decision 5 case</p>
              </div>
            </div>
          )}
        </div>
      )

      // ─── SCREEN 19 — SLA CONFIRMATION ────────────────────────────────
      case 19: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-600">Submission Time</p>
              <p className="text-lg font-bold text-[#1F3864]">{form.submissionTime}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">SLA Block</p>
              {radioGroup('sla', form.slaBlock, ['Forenoon receipt → Act same afternoon', 'Afternoon receipt → Act next morning 09:00', 'Next afternoon (final block)'], v => update('slaBlock', v))}
            </div>
            <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1 text-xs text-blue-600">
              <p className="font-bold text-blue-700">SLA Rules</p>
              <p>• Received before noon → Act same afternoon</p>
              <p>• Received after noon → Act next morning by 09:00</p>
              <p>• Below ₹25,000 → 75% same half day · 25% next half day</p>
            </div>
          </div>
        </div>
      )

      // ─── SCREEN 20 — CERTIFICATE ──────────────────────────────────────
      case 20: return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border-2 border-[#1F3864]/20 shadow-sm overflow-hidden">
            <div className="bg-[#1F3864] px-5 py-4 text-center">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Pro Engineering</p>
              <p className="text-white font-bold text-base">Supervisor Field Certificate</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700 leading-relaxed italic text-center">
                  "I, <span className="font-bold text-[#1F3864]">{supervisorName}</span>, certify that I have physically visited{' '}
                  <span className="font-bold">{site}</span>, verified the work in{' '}
                  <span className="font-bold">{substageData?.substage_code ?? templateId}</span>,
                  reviewed all evidence submitted by the Site Head, and confirm the work is{' '}
                  <span className="font-bold">{form.paymentDecision === '1' ? 'complete' : 'partially complete'}</span> as of{' '}
                  <span className="font-bold">{new Date().toLocaleDateString('en-GB')}</span>."
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400">Supervisor</p>
                  <p className="font-bold text-gray-800">{supervisorName}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400">Date</p>
                  <p className="font-bold text-gray-800">{new Date().toLocaleDateString('en-GB')}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400">Time</p>
                  <p className="font-bold text-gray-800">{form.submissionTime}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400">Decision</p>
                  <p className="font-bold text-gray-800">Decision {form.paymentDecision || '—'}</p>
                </div>
              </div>
              <button
                onClick={() => update('certificateSigned', true)}
                className={`w-full py-4 rounded-2xl font-bold text-sm transition-colors ${form.certificateSigned ? 'bg-green-600 text-white' : 'bg-[#1F3864] text-white'}`}
              >
                {form.certificateSigned ? '✓ Certificate Signed' : 'Sign & Submit Certificate'}
              </button>
            </div>
          </div>
        </div>
      )

      // ─── SCREEN 21 — SUBMIT & AUTHORIZE ──────────────────────────────
      case 21: return (
        <div className="space-y-4">
          {!form.submitted ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Summary</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">Site</span><span className="font-semibold">{site}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Check In</span><span className="font-semibold">{form.checkInTime || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Site Head</span><span className="font-semibold">{form.siteHeadName || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Workers</span><span className="font-semibold">{form.workersPresent || '—'} present</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Payment Decision</span><span className="font-semibold">Decision {form.paymentDecision || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Certificate</span><span className={`font-semibold ${form.certificateSigned ? 'text-green-600' : 'text-orange-500'}`}>{form.certificateSigned ? '✓ Signed' : 'Not signed'}</span></div>
                </div>
              </div>
              <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
                <p className="text-white font-bold text-sm mb-2">AUTHORIZE & APPROVE</p>
                <p className="text-blue-200 text-xs mb-4">Tapping this button simultaneously triggers:</p>
                <div className="space-y-2 text-xs text-blue-300 mb-4">
                  <p>✓ Milestone escrow release</p>
                  <p>✓ Safety ticket to labour app</p>
                  <p>✓ Client facilitation request</p>
                </div>
                <button
                  onClick={async () => {
                    if (reportId) await submitReport(reportId)
                    if (form.scopeChangeTrigger && !form.scopeChangeTrigger.startsWith('No')) {
                      await submitExtraWork(workerId, {
                        booking_ref: bookingRef,
                        trigger_type: form.scopeChangeTrigger.startsWith('Trigger A') ? 'technical_recommendation' : 'client_demand',
                        client_request: form.scopeChangeTrigger.startsWith('Trigger B') ? (form.clientDecisionsPending || form.scopeChangeDesc) : null,
                        description: form.scopeChangeDesc,
                        justification: form.scopeChangeTechnicalReason,
                        rough_items: form.scopeChangeCostImpact
                          ? [{ description: form.scopeChangeDesc || 'Scope change', qty: 1, unit: 'lot', amount: Number(form.scopeChangeCostImpact) || 0 }]
                          : [],
                      })
                    }
                    if (form.paymentDecision === '5') {
                      const reason = form.rejectionWhyReason === 'others'
                        ? form.rejectionWhyOther
                        : DECISION_5_REASON_LABELS[form.rejectionWhyReason] ?? ''
                      const remedy = form.rejectionRemedy === 'others'
                        ? form.rejectionRemedyOther
                        : DECISION_5_REMEDY_LABELS[form.rejectionRemedy] ?? ''
                      await raiseDecision5(bookingRef, substageData?.milestone_code ?? null, supervisorName, reason, remedy)
                    }
                    update('submitted', true)
                  }}
                  className="w-full bg-white text-[#1F3864] font-bold py-4 rounded-2xl text-sm"
                >
                  AUTHORIZE & APPROVE →
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-green-300 shadow-sm px-5 py-8 text-center">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-green-700 font-bold text-lg">Site Visit Submitted</p>
              <p className="text-gray-500 text-sm mt-1">Report submitted · Escrow triggered · Safety ticket sent</p>
              <p className="text-gray-400 text-xs mt-1">Status: scope_report_submitted</p>
              <Link
                href="/supervisor/dashboard"
                className="inline-block mt-4 bg-[#1F3864] text-white text-xs font-bold px-5 py-2.5 rounded-xl"
              >
                Back to Dashboard
              </Link>
            </div>
          )}
        </div>
      )

      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* HEADER */}
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/supervisor/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
              Screen {screen} of {TOTAL_SCREENS} — {screenTitles[screen - 1]}
            </p>
            <p className="text-white font-bold text-sm leading-tight truncate">{site}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-white/20 h-1">
          <div className="bg-white h-1 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      {/* SCREEN TITLE */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <p className="text-lg font-bold text-[#1F3864]">{screenTitles[screen - 1]}</p>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{screen}/{TOTAL_SCREENS}</span>
        </div>
      </div>

      {/* SCREEN CONTENT */}
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-32">
        {renderScreen()}
      </main>

      {/* NAVIGATION */}
      {!form.submitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
          <div className="flex gap-3 max-w-lg mx-auto">
            {screen > 1 && (
              <button
                onClick={back}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold py-3 rounded-2xl text-sm"
              >
                ← Back
              </button>
            )}
            {screen < TOTAL_SCREENS && (
              <button
                onClick={next}
                className="flex-1 bg-[#1F3864] text-white font-bold py-3 rounded-2xl text-sm"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  )
}