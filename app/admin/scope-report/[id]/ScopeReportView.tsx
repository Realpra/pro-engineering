'use client'

import { useState, useMemo, createContext, useContext, useCallback } from 'react'
import { saveReviewEdit, submitToNextLevel, saveCoordinatorNotes, approveAndSendToAdmin, returnToSubCoordinator, returnToSupervisor } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewEdit = {
  id: string
  report_id: string
  reviewer_id: string
  reviewer_role: string
  screen_number: number
  field_path: string
  original_value: string
  new_value: string
  reason: string
  created_at: string
}

type ReviewSubmission = {
  id: string
  report_id: string
  submitted_by: string
  submitted_role: string
  submitted_to_role: string
  submission_notes: string | null
  created_at: string
}

type Report = Record<string, unknown>
type Job = { job_title: string | null; zone: string | null; district: string | null; job_type: string | null } | null
type Supervisor = { full_name: string } | null

// ─── Review Context ───────────────────────────────────────────────────────────

type ReviewCtx = {
  reviewMap: Record<string, ReviewEdit[]>
  userRole: string | null
  userId: string | null
  reportId: string
  canEdit: boolean
  onSaved: (review: ReviewEdit) => void
}

const ReviewContext = createContext<ReviewCtx>({
  reviewMap: {}, userRole: null, userId: null,
  reportId: '', canEdit: false, onSaved: () => {},
})

function useReview() { return useContext(ReviewContext) }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEditHistory(reviewMap: Record<string, ReviewEdit[]>, fieldPath: string): ReviewEdit[] {
  return reviewMap[fieldPath] ?? []
}

function extractScreenNumber(fieldPath: string): number {
  const m = fieldPath.match(/screen(\d+)_/)
  return m ? parseInt(m[1], 10) : 0
}

function labelify(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
}

function fmtVal(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') {
    if (val.trim() === '') return '—'
    return val.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  if (Array.isArray(val)) return `${val.length} items`
  return String(val)
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function roleBadgeCls(role: string): string {
  const map: Record<string, string> = {
    'sub-coordinator': 'bg-purple-100 text-purple-800',
    coordinator: 'bg-blue-100 text-blue-800',
    admin: 'bg-[#1F3864]/10 text-[#1F3864]',
    supervisor: 'bg-gray-100 text-gray-700',
  }
  return map[role] ?? 'bg-gray-100 text-gray-700'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOPE_OPTION_LABELS: Record<string, Record<string, string>> = {
  renovationType: { full: 'Full Renovation', partial: 'Partial Renovation', 'full-bathroom': 'Full Bathroom', 'wet-area': 'Wet Area Only' },
  tilesScope: { 'replace-all': 'Replace All', 'replace-floor-only': 'Floor Only', 'replace-walls-only': 'Walls Only', 'retain-all': 'Retain All' },
  fixturesScope: { 'replace-all': 'Replace All', 'replace-selected': 'Replace Selected', 'retain-all': 'Retain All' },
  plumbingScope: { reroute: 'Reroute Required', retain: 'Retain Existing' },
  electricalScope: { 'add-change': 'Add or Change Points', retain: 'Retain Existing' },
  ceilingScope: { renovate: 'Renovate Ceiling', retain: 'Retain Ceiling', 'false-ceiling': 'False Ceiling', 'paint-only': 'Paint Only', 'no-work': 'No Work' },
  geyserScope: { replace: 'Replace Unit', retain: 'Retain', 'new-point-only': 'New Point Only', 'not-applicable': 'N/A' },
}

const SCOPE_FIELDS = [
  'renovationType', 'tilesScope', 'fixturesScope',
  'plumbingScope', 'electricalScope', 'ceilingScope', 'geyserScope',
]

const SCOPE_FIELD_LABELS: Record<string, string> = {
  renovationType: 'Renovation Type', tilesScope: 'Tiles Scope', fixturesScope: 'Fixtures Scope',
  plumbingScope: 'Plumbing Scope', electricalScope: 'Electrical Scope',
  ceilingScope: 'Ceiling Scope', geyserScope: 'Geyser Scope',
}

const COND_SCREENS = [
  { col: 'screen03_ceiling', name: 'Ceiling', badge: '03' },
  { col: 'screen04_walls', name: 'Walls', badge: '04' },
  { col: 'screen05_floors', name: 'Floors', badge: '05' },
  { col: 'screen06_plumbing', name: 'Plumbing', badge: '06' },
  { col: 'screen07_electrical', name: 'Electrical', badge: '07' },
  { col: 'screen08_waterproofing', name: 'Waterproofing', badge: '08' },
  { col: 'screen09_demolition', name: 'Demolition', badge: '09' },
  { col: 'screen10_tiles', name: 'Tiles', badge: '10' },
  { col: 'screen11_fixtures', name: 'Fixtures', badge: '11' },
  { col: 'screen12_logistics', name: 'Logistics', badge: '12' },
  { col: 'screen13_compliance', name: 'Compliance', badge: '13' },
]

const MEAS_ROWS = [
  { key: 'bathroomLength', label: 'Length', unit: 'ft' },
  { key: 'bathroomWidth', label: 'Width', unit: 'ft' },
  { key: 'bathroomHeight', label: 'Ceiling Height', unit: 'ft' },
  { key: 'floorArea', label: 'Floor Area', unit: 'sq ft' },
  { key: 'wallAreaNorth', label: 'North Wall', unit: 'sq ft' },
  { key: 'wallAreaSouth', label: 'South Wall', unit: 'sq ft' },
  { key: 'wallAreaEast', label: 'East Wall', unit: 'sq ft' },
  { key: 'wallAreaWest', label: 'West Wall', unit: 'sq ft' },
  { key: 'totalWallArea', label: 'Total Wall Area', unit: 'sq ft' },
  { key: 'ceilingArea', label: 'Ceiling Area', unit: 'sq ft' },
]

const LABOUR_ROWS = [
  { key: 'demolitionDays', label: 'Demolition' },
  { key: 'plumbingDays', label: 'Plumbing' },
  { key: 'electricalDays', label: 'Electrical' },
  { key: 'waterproofingDays', label: 'Waterproofing' },
  { key: 'floorScreedDays', label: 'Floor Screed' },
  { key: 'tilingFloorDays', label: 'Tiling – Floors' },
  { key: 'tilingWallsDays', label: 'Tiling – Walls' },
  { key: 'groutingDays', label: 'Grouting' },
  { key: 'fixtureFittingDays', label: 'Fixture Fitting' },
]

const MAT_ROWS = [
  { key: 'floorTiles', label: 'Floor Tiles', unit: 'sq ft' },
  { key: 'wallTiles', label: 'Wall Tiles', unit: 'sq ft' },
  { key: 'floorAdhesiveBags', label: 'Floor Adhesive', unit: 'bags' },
  { key: 'wallAdhesiveBags', label: 'Wall Adhesive', unit: 'bags' },
  { key: 'groutKg', label: 'Grout', unit: 'kg' },
  { key: 'waterproofingKg', label: 'Waterproofing Compound', unit: 'kg' },
  { key: 'cementBags', label: 'Cement', unit: 'bags' },
  { key: 'sandCft', label: 'Sand', unit: 'cu ft' },
]

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, badge, children }: {
  title: string; badge?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#1F3864] text-white text-left">
        <span className="font-bold text-sm">{title}</span>
        <div className="flex items-center gap-2">
          {badge}
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

// ─── EditableField ────────────────────────────────────────────────────────────

function EditableField({ fieldPath, label, originalValue, multiline = false }: {
  fieldPath: string; label: string; originalValue: string; multiline?: boolean
}) {
  const { reviewMap, userRole, userId, reportId, canEdit, onSaved } = useReview()

  const history = getEditHistory(reviewMap, fieldPath)
  const currentValue = history.length > 0 ? history[history.length - 1].new_value : originalValue
  const isEdited = history.length > 0
  const lastEditor = isEdited ? history[history.length - 1].reviewer_role : null

  const [isEditing, setIsEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setEditValue(currentValue)
    setReason('')
    setError(null)
    setIsEditing(true)
  }

  async function handleSave() {
    if (!reason.trim()) return
    setSaving(true); setError(null)
    const screenNum = extractScreenNumber(fieldPath)
    const result = await saveReviewEdit(reportId, screenNum, fieldPath, currentValue, editValue, reason)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    onSaved({
      id: result.id ?? crypto.randomUUID(),
      report_id: reportId,
      reviewer_id: userId ?? '',
      reviewer_role: userRole ?? '',
      screen_number: screenNum,
      field_path: fieldPath,
      original_value: currentValue,
      new_value: editValue,
      reason,
      created_at: new Date().toISOString(),
    })
    setIsEditing(false)
  }

  return (
    <div className="py-2.5 border-b border-gray-100 last:border-b-0">
      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">{label}</p>

      {isEditing ? (
        <div className="space-y-2">
          {multiline ? (
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3}
              className="w-full rounded-lg border border-[#2E74B5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/30 resize-none" />
          ) : (
            <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
              className="w-full rounded-lg border border-[#2E74B5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/30" />
          )}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for change (required)" rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/20" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={saving || !reason.trim()}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                saving || !reason.trim() ? 'bg-gray-200 text-gray-400' : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}>
              {saving ? 'Saving…' : 'Save Change'}
            </button>
            <button type="button" onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold break-words ${isEdited ? 'text-amber-800' : 'text-gray-800'}`}>
                {fmtVal(currentValue)}
              </p>
              {isEdited && lastEditor && (
                <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${roleBadgeCls(lastEditor)}`}>
                  Edited by {lastEditor}
                </span>
              )}
            </div>
            <div className="flex gap-1 shrink-0 mt-0.5">
              {canEdit && (
                <button type="button" onClick={startEdit}
                  className="text-[10px] font-bold text-amber-700 border border-amber-300 bg-amber-50 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors">
                  Edit
                </button>
              )}
              {history.length > 0 && (
                <button type="button" onClick={() => setShowHistory((h) => !h)}
                  className="text-[10px] text-gray-500 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                  History {showHistory ? '▲' : '▼'}
                </button>
              )}
            </div>
          </div>

          {showHistory && (
            <div className="mt-2 pl-3 border-l-2 border-amber-200 space-y-1.5">
              <p className="text-xs text-gray-500">
                <span className="font-semibold">Supervisor (original):</span>{' '}
                <span className="text-gray-600">{fmtVal(originalValue)}</span>
              </p>
              {history.map((edit) => (
                <div key={edit.id} className="text-xs">
                  <span className={`font-bold px-1.5 py-0.5 rounded-full text-[10px] ${roleBadgeCls(edit.reviewer_role)}`}>
                    {edit.reviewer_role}
                  </span>
                  {' '}changed to{' '}
                  <span className="font-semibold text-amber-700">{fmtVal(edit.new_value)}</span>
                  {' — '}
                  <span className="text-gray-500 italic">{edit.reason}</span>
                  {' — '}
                  <span className="text-gray-400">{fmtDateTime(edit.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ApprovedField (read-only with history) ───────────────────────────────────

function ApprovedField({ fieldPath, label, originalValue }: {
  fieldPath: string; label: string; originalValue: string
}) {
  const { reviewMap } = useReview()
  const history = getEditHistory(reviewMap, fieldPath)
  const finalValue = history.length > 0 ? history[history.length - 1].new_value : originalValue
  const isEdited = history.length > 0

  return (
    <div className={`py-2 ${isEdited ? 'pl-3 border-l-2 border-amber-300' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-gray-500 shrink-0">{label}</p>
        <p className={`text-sm font-semibold text-right break-words ${isEdited ? 'text-amber-800' : 'text-gray-800'}`}>
          {fmtVal(finalValue)}
        </p>
      </div>
      {isEdited && (
        <div className="mt-1 space-y-0.5">
          <p className="text-[10px] text-gray-400">
            Original (Supervisor): {fmtVal(originalValue)}
          </p>
          {history.map((edit) => (
            <p key={edit.id} className="text-[10px] text-gray-500">
              {'→ '}
              <span className={`font-bold px-1 rounded-full ${roleBadgeCls(edit.reviewer_role)}`}>
                {edit.reviewer_role}
              </span>
              {': '}
              <span className="text-amber-700 font-semibold">{fmtVal(edit.new_value)}</span>
              {' — '}
              <span className="italic">{edit.reason}</span>
              {' — '}
              <span className="text-gray-400">{fmtDateTime(edit.created_at)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Approved report section title ────────────────────────────────────────────

function ApprTitle({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-bold text-[#1F3864] uppercase tracking-widest border-b-2 border-[#1F3864]/20 pb-1 mb-3 mt-5 first:mt-0">
      {title}
    </h2>
  )
}

// ─── Condition card ───────────────────────────────────────────────────────────

function ConditionCard({ col, name, badge, data }: {
  col: string; name: string; badge: string
  data: Record<string, unknown> | null
}) {
  const riskFlags: string[] = Array.isArray(data?.riskFlags) ? (data!.riskFlags as string[]) : []
  const notesVal = data?.notes as string | null | undefined
  const entries = data
    ? Object.entries(data).filter(([k]) => k !== 'photoUrls' && k !== 'riskFlags' && k !== 'notes')
    : []

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 last:mb-0">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className="w-6 h-6 rounded bg-[#1F3864] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
          {badge}
        </span>
        <span className="text-xs font-bold text-gray-700">{name}</span>
        {riskFlags.length > 0 && (
          <span className="ml-auto text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            {riskFlags.length} flag{riskFlags.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!data ? (
        <p className="px-4 py-3 text-xs text-gray-400 italic">Not recorded</p>
      ) : (
        <div className="px-4">
          {entries.map(([key, val]) => (
            <EditableField
              key={key}
              fieldPath={`${col}.${key}`}
              label={labelify(key)}
              originalValue={String(val ?? '')}
            />
          ))}

          {riskFlags.length > 0 && (
            <div className="py-2 border-b border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2">Risk Flags</p>
              {riskFlags.map((flag, i) => (
                <EditableField
                  key={i}
                  fieldPath={`${col}.riskFlags.${i}`}
                  label={`Flag ${i + 1}`}
                  originalValue={flag}
                  multiline
                />
              ))}
            </div>
          )}

          {notesVal != null && (
            <EditableField
              fieldPath={`${col}.notes`}
              label="Notes"
              originalValue={notesVal}
              multiline
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Coordinator Actions (Section 8) ─────────────────────────────────────────

const SECTION_OPTIONS = [
  'Scope Intent',
  'Site Conditions',
  'Measurements',
  'Labour Schedule',
  'Risk Flag Decisions',
  'Timeline',
  'Materials',
]

const SCREEN_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1)

function CoordinatorActions({ initialNotes, initialStatus, bookingRef }: {
  initialNotes: string | null
  initialStatus: string | null
  bookingRef: string
}) {
  const { reportId, userRole } = useReview()

  const [notes, setNotes] = useState(initialNotes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  // Which inline form is open: null | 'approve' | 'return-sub' | 'return-supervisor'
  const [activeAction, setActiveAction] = useState<null | 'approve' | 'return-sub' | 'return-supervisor'>(null)

  // result state — initialised from DB status so already-actioned reports show the banner
  const [actionResult, setActionResult] = useState<string | null>(() => {
    if (initialStatus === 'approved_for_estimate') return 'approved'
    if (initialStatus === 'returned_to_sub_coordinator') return 'returned-sub'
    if (initialStatus === 'returned_to_supervisor') return 'returned-supervisor'
    return null
  })

  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Return-to-sub form state
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [subReason, setSubReason] = useState('')

  // Return-to-supervisor form state
  const [selectedScreens, setSelectedScreens] = useState<number[]>([])
  const [revisitType, setRevisitType] = useState<'full' | 'specific'>('full')
  const [supervisorReason, setSupervisorReason] = useState('')

  async function handleSaveNotes() {
    setSavingNotes(true); setNotesSaved(false); setNotesError(null)
    const result = await saveCoordinatorNotes(reportId, notes)
    setSavingNotes(false)
    if (result.error) { setNotesError(result.error); return }
    setNotesSaved(true); setTimeout(() => setNotesSaved(false), 3000)
  }

  function toggleSection(s: string) {
    setSelectedSections((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  function toggleScreen(n: number) {
    setSelectedScreens((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n])
  }

  async function handleApprove() {
    setSubmitting(true); setActionError(null)
    const result = await approveAndSendToAdmin(reportId, notes)
    setSubmitting(false)
    if (result.error) { setActionError(result.error); return }
    setActiveAction(null)
    setActionResult('approved')
  }

  async function handleReturnToSub() {
    if (!subReason.trim()) { setActionError('Reason is required.'); return }
    setSubmitting(true); setActionError(null)
    const result = await returnToSubCoordinator(reportId, subReason.trim(), selectedSections, notes, bookingRef)
    setSubmitting(false)
    if (result.error) { setActionError(result.error); return }
    setActiveAction(null)
    setActionResult('returned-sub')
  }

  async function handleReturnToSupervisor() {
    if (!supervisorReason.trim()) { setActionError('Reason is required.'); return }
    if (revisitType === 'specific' && selectedScreens.length === 0) {
      setActionError('Select at least one screen, or choose Full Re-visit.'); return
    }
    setSubmitting(true); setActionError(null)
    const result = await returnToSupervisor(reportId, supervisorReason.trim(), selectedScreens, revisitType, notes, bookingRef)
    setSubmitting(false)
    if (result.error) { setActionError(result.error); return }
    setActiveAction(null)
    setActionResult('returned-supervisor')
  }

  const isCoordinator = userRole === 'coordinator'

  return (
    <div className="space-y-4">
      {/* Notes textarea — always visible */}
      <div className="space-y-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Coordinator notes for estimator or supervisor…"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
        />
        {notesError && (
          <p className="text-xs text-red-600">{notesError}</p>
        )}
        <button
          type="button"
          onClick={handleSaveNotes}
          disabled={savingNotes}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            savingNotes ? 'bg-gray-200 text-gray-400' : notesSaved ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {savingNotes ? 'Saving…' : notesSaved ? '✓ Notes Saved' : 'Save Notes'}
        </button>
      </div>

      {/* Action result banner */}
      {actionResult === 'approved' && (
        <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <p className="text-sm font-semibold text-green-800">Report approved and sent to Admin for estimate generation.</p>
        </div>
      )}
      {actionResult === 'returned-sub' && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm font-semibold text-amber-800">Report returned to Sub-Coordinator for corrections.</p>
        </div>
      )}
      {actionResult === 'returned-supervisor' && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm font-semibold text-red-800">Report returned to Supervisor for site re-visit.</p>
        </div>
      )}

      {/* Action buttons — only for coordinator, only when no action taken yet */}
      {isCoordinator && !actionResult && (
        <div className="space-y-3">

          {/* APPROVE */}
          {activeAction !== 'approve' ? (
            <button
              type="button"
              onClick={() => { setActiveAction('approve'); setActionError(null) }}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-[#1F3864] text-white hover:bg-[#162950] transition-colors"
            >
              Approve and Send to Admin
            </button>
          ) : (
            <div className="rounded-xl border-2 border-[#1F3864] p-4 space-y-3">
              <p className="text-sm font-semibold text-[#1F3864]">Confirm: Approve and send this report to Admin for estimate generation?</p>
              {actionError && <p className="text-xs text-red-600">{actionError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#1F3864] text-white disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Yes, Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveAction(null); setActionError(null) }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* RETURN TO SUB-COORDINATOR */}
          {activeAction !== 'return-sub' ? (
            <button
              type="button"
              onClick={() => { setActiveAction('return-sub'); setActionError(null) }}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Return to Sub-Coordinator
            </button>
          ) : (
            <div className="rounded-xl border-2 border-amber-500 p-4 space-y-4">
              <p className="text-sm font-semibold text-amber-800">Return to Sub-Coordinator for corrections</p>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Which sections need correction?</p>
                <div className="space-y-1.5">
                  {SECTION_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSection(s)}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedSections.includes(s)
                          ? 'bg-amber-100 text-amber-900 font-semibold'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        selectedSections.includes(s) ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                      }`}>
                        {selectedSections.includes(s) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Reason for return <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                  rows={3}
                  placeholder="Describe what needs to be corrected…"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                />
              </div>

              {actionError && <p className="text-xs text-red-600">{actionError}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReturnToSub}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white disabled:opacity-50"
                >
                  {submitting ? 'Returning…' : 'Confirm Return'}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveAction(null); setActionError(null); setSubReason(''); setSelectedSections([]) }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* RETURN TO SUPERVISOR */}
          {activeAction !== 'return-supervisor' ? (
            <button
              type="button"
              onClick={() => { setActiveAction('return-supervisor'); setActionError(null) }}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Return to Supervisor for Site Re-visit
            </button>
          ) : (
            <div className="rounded-xl border-2 border-red-500 p-4 space-y-4">
              <p className="text-sm font-semibold text-red-800">Return to Supervisor for Site Re-visit</p>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Re-visit type</p>
                <div className="flex gap-2">
                  {(['full', 'specific'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRevisitType(t)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
                        revisitType === t
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-red-300'
                      }`}
                    >
                      {t === 'full' ? 'Full Re-visit' : 'Specific Screens'}
                    </button>
                  ))}
                </div>
              </div>

              {revisitType === 'specific' && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Which screens need to be re-done?</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {SCREEN_NUMBERS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleScreen(n)}
                        className={`py-2 rounded-lg text-xs font-bold border-2 transition-colors ${
                          selectedScreens.includes(n)
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Reason for return <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={supervisorReason}
                  onChange={(e) => setSupervisorReason(e.target.value)}
                  rows={3}
                  placeholder="Describe what needs to be corrected at site…"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-400/40"
                />
              </div>

              {actionError && <p className="text-xs text-red-600">{actionError}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReturnToSupervisor}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white disabled:opacity-50"
                >
                  {submitting ? 'Returning…' : 'Confirm Return'}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveAction(null); setActionError(null); setSupervisorReason(''); setSelectedScreens([]); setRevisitType('full') }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Approved Report ──────────────────────────────────────────────────────────

function ApprovedReport({ report, job, supervisor, reviews, submissions }: {
  report: Report; job: Job; supervisor: Supervisor
  reviews: ReviewEdit[]; submissions: ReviewSubmission[]
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = report as any
  const sortedReviews = [...reviews].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const scopeIntent = r.screen02_scope_intent as Record<string, string> | null
  const measurements = r.screen14_measurements as Record<string, unknown> | null
  const labour = r.screen15_labour as Record<string, unknown> | null
  const risks = r.screen17_risk_decisions as {
    flags: { description: string; source: string; selectedRemedy: string | null; clientAcceptsRisk: boolean; clientNote: string | null }[]
    notes: string | null
  } | null
  const timeline = r.screen16_timeline as {
    proposedStartDate: string | null; estimatedCompletionDate: string | null
    totalWorkingDays: number; totalCalendarDays: number
    entries: { activityName: string; activity: string; supervisorDays: number; curingDays: number; isOverridden: boolean }[]
  } | null
  const materials = r.screen19_materials as Record<string, unknown> | null

  return (
    <div id="approved-report" className="bg-white">
      {/* Print button */}
      <div className="flex justify-end mb-4 print:hidden">
        <button type="button" onClick={() => window.print()}
          className="px-4 py-2 rounded-xl bg-[#1F3864] text-white text-sm font-bold hover:bg-[#162950]">
          Download / Print PDF
        </button>
      </div>

      {/* Header */}
      <div className="bg-[#1F3864] text-white rounded-xl p-5 mb-6">
        <p className="text-[10px] text-blue-200 uppercase tracking-widest mb-1">Scope Report</p>
        <h1 className="text-lg font-bold mb-3">{job?.job_title ?? 'Site Visit Report'}</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          {[
            ['Booking Ref', String(r.booking_ref ?? '—')],
            ['Zone / District', `${job?.zone ?? '—'}${job?.district ? ` / ${job.district}` : ''}`],
            ['Supervisor', supervisor?.full_name ?? '—'],
            ['Submitted', fmtDateTime(r.submitted_at)],
            ['Status', String(r.status ?? '—').replace(/_/g, ' ')],
            ['Risk Flags', String(r.risk_flag_count ?? 0)],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <p className="text-blue-200">{lbl}</p>
              <p className="font-bold capitalize">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scope Intent */}
      {scopeIntent && (
        <>
          <ApprTitle title="Scope Intent" />
          <div className="divide-y divide-gray-100">
            {SCOPE_FIELDS.map((field) => (
              <ApprovedField
                key={field}
                fieldPath={`screen02_scope_intent.${field}`}
                label={SCOPE_FIELD_LABELS[field]}
                originalValue={scopeIntent[field] ?? ''}
              />
            ))}
          </div>
        </>
      )}

      {/* Site Conditions */}
      <ApprTitle title="Site Conditions" />
      {COND_SCREENS.map(({ col, name, badge }) => {
        const data = r[col] as Record<string, unknown> | null
        if (!data) return null
        const entries = Object.entries(data).filter(([k]) => k !== 'photoUrls' && k !== 'riskFlags' && k !== 'notes')
        const flags = Array.isArray(data.riskFlags) ? (data.riskFlags as string[]) : []
        return (
          <div key={col} className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded bg-[#1F3864] flex items-center justify-center text-white text-[10px] font-bold shrink-0">{badge}</span>
              <p className="text-xs font-bold text-gray-700">{name}</p>
            </div>
            <div className="pl-8 divide-y divide-gray-100 border border-gray-100 rounded-xl px-3">
              {entries.map(([key, val]) => (
                <ApprovedField key={key} fieldPath={`${col}.${key}`} label={labelify(key)} originalValue={String(val ?? '')} />
              ))}
              {flags.map((flag, i) => (
                <ApprovedField key={i} fieldPath={`${col}.riskFlags.${i}`} label={`Risk Flag ${i + 1}`} originalValue={flag} />
              ))}
              {!!data.notes && (
                <ApprovedField fieldPath={`${col}.notes`} label="Notes" originalValue={String(data.notes)} />
              )}
            </div>
          </div>
        )
      })}

      {/* Measurements */}
      {measurements && (
        <>
          <ApprTitle title="Measurements" />
          <div className="divide-y divide-gray-100">
            {MEAS_ROWS.map(({ key, label, unit }) =>
              measurements[key] != null ? (
                <ApprovedField key={key} fieldPath={`screen14_measurements.${key}`} label={`${label} (${unit})`} originalValue={String(measurements[key])} />
              ) : null
            )}
          </div>
        </>
      )}

      {/* Labour */}
      {labour && (
        <>
          <ApprTitle title="Labour Schedule" />
          <div className="divide-y divide-gray-100">
            {LABOUR_ROWS.map(({ key, label }) =>
              labour[key] != null ? (
                <ApprovedField key={key} fieldPath={`screen15_labour.${key}`} label={`${label} (days)`} originalValue={String(labour[key])} />
              ) : null
            )}
          </div>
          <div className="flex gap-6 mt-3 pt-3 border-t border-gray-200">
            <div><p className="text-[10px] text-gray-400 uppercase">Working Days</p><p className="text-lg font-bold text-[#1F3864]">{String(labour.totalWorkingDays ?? '—')}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Calendar Days</p><p className="text-lg font-bold text-[#1F3864]">{String(labour.totalCalendarDays ?? '—')}</p></div>
          </div>
        </>
      )}

      {/* Risk Decisions */}
      {risks && risks.flags && risks.flags.length > 0 && (
        <>
          <ApprTitle title="Risk Flag Decisions" />
          <div className="space-y-3">
            {risks.flags.map((flag, i) => (
              <div key={i} className={`rounded-xl border p-3 ${flag.clientAcceptsRisk ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <p className={`text-sm font-semibold mb-1 ${flag.clientAcceptsRisk ? 'text-red-800' : 'text-green-800'}`}>{flag.description}</p>
                <p className="text-xs text-gray-500 mb-2">{flag.source}</p>
                <ApprovedField
                  fieldPath={`screen17_risk_decisions.flags.${i}.selectedRemedy`}
                  label="Decision"
                  originalValue={flag.selectedRemedy ?? ''}
                />
                {flag.clientNote && <p className="text-xs text-gray-500 italic mt-1">&ldquo;{flag.clientNote}&rdquo;</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Timeline */}
      {timeline && (
        <>
          <ApprTitle title="Timeline" />
          <div className="divide-y divide-gray-100 mb-3">
            <ApprovedField fieldPath="screen16_timeline.proposedStartDate" label="Proposed Start" originalValue={timeline.proposedStartDate ?? ''} />
            <ApprovedField fieldPath="screen16_timeline.estimatedCompletionDate" label="Est. Completion" originalValue={timeline.estimatedCompletionDate ?? ''} />
          </div>
          {(timeline.entries ?? []).map((entry, i) => (
            <ApprovedField key={i}
              fieldPath={`screen16_timeline.entries.${i}.supervisorDays`}
              label={`${entry.activityName ?? entry.activity} (days)`}
              originalValue={String(entry.supervisorDays)}
            />
          ))}
          <div className="flex gap-6 mt-3 pt-3 border-t border-gray-200">
            <div><p className="text-[10px] text-gray-400 uppercase">Working Days</p><p className="text-lg font-bold text-[#1F3864]">{timeline.totalWorkingDays}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase">Calendar Days</p><p className="text-lg font-bold text-[#1F3864]">{timeline.totalCalendarDays}</p></div>
          </div>
        </>
      )}

      {/* Materials */}
      {materials && (
        <>
          <ApprTitle title="Materials" />
          <div className="divide-y divide-gray-100">
            {MAT_ROWS.map(({ key, label, unit }) =>
              materials[key] != null && Number(materials[key]) > 0 ? (
                <ApprovedField key={key} fieldPath={`screen19_materials.${key}`} label={`${label} (${unit})`} originalValue={String(materials[key])} />
              ) : null
            )}
          </div>
        </>
      )}

      {/* Audit Trail */}
      <ApprTitle title="Review Audit Trail" />
      {sortedReviews.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No edits recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                {['When', 'Role', 'Field', 'Original', 'Changed To', 'Reason'].map((h) => (
                  <th key={h} className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedReviews.map((rev) => (
                <tr key={rev.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{fmtDateTime(rev.created_at)}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-1.5 py-0.5 rounded-full font-bold ${roleBadgeCls(rev.reviewer_role)}`}>{rev.reviewer_role}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[10px] text-gray-600 max-w-[160px] truncate">{rev.field_path}</td>
                  <td className="py-2 pr-3 text-gray-400 line-through">{rev.original_value || '—'}</td>
                  <td className="py-2 pr-3 text-amber-700 font-semibold">{rev.new_value}</td>
                  <td className="py-2 text-gray-500 italic">{rev.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submission History */}
      <ApprTitle title="Submission History" />
      {submissions.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No submissions yet.</p>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => (
            <div key={sub.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleBadgeCls(sub.submitted_role)}`}>{sub.submitted_role}</span>
                  <span className="text-xs text-gray-400">→</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleBadgeCls(sub.submitted_to_role)}`}>{sub.submitted_to_role}</span>
                </div>
                {sub.submission_notes && <p className="text-xs text-gray-500 italic">{sub.submission_notes}</p>}
              </div>
              <p className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">{fmtDateTime(sub.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScopeReportView({
  report, job, supervisor, userRole, userId, existingReviews, submissions: initialSubmissions,
}: {
  report: Report; job: Job; supervisor: Supervisor
  userRole: string | null; userId: string | null
  existingReviews: ReviewEdit[]
  submissions: ReviewSubmission[]
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = report as any
  const reportId = String(r.id)

  const [tab, setTab] = useState<'review' | 'approved'>('review')
  const [reviews, setReviews] = useState<ReviewEdit[]>(existingReviews)
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>(initialSubmissions)
  const [submitNotes, setSubmitNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<boolean>(() => {
    const status = String(r.status ?? '')
    if (userRole === 'sub-coordinator') return status === 'coordinator_review' || status === 'admin_review'
    if (userRole === 'coordinator') return status === 'admin_review'
    return false
  })

  const reviewMap = useMemo<Record<string, ReviewEdit[]>>(() => {
    const map: Record<string, ReviewEdit[]> = {}
    for (const rev of reviews) {
      if (!map[rev.field_path]) map[rev.field_path] = []
      map[rev.field_path].push(rev)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.created_at.localeCompare(b.created_at))
    }
    return map
  }, [reviews])

  const canEdit = (userRole === 'coordinator' || userRole === 'sub-coordinator') && !submitted

  const handleSaved = useCallback((review: ReviewEdit) => {
    setReviews((prev) => [...prev, review])
  }, [])

  const ctxValue = useMemo<ReviewCtx>(() => ({
    reviewMap, userRole, userId, reportId, canEdit, onSaved: handleSaved,
  }), [reviewMap, userRole, userId, reportId, canEdit, handleSaved])

  async function handleSubmit() {
    if (!userRole) return
    setSubmitting(true); setSubmitError(null)
    const result = await submitToNextLevel(reportId, userRole, submitNotes)
    setSubmitting(false)
    if (result.error) { setSubmitError(result.error); return }
    setSubmissions((prev) => [...prev, {
      id: crypto.randomUUID(),
      report_id: reportId,
      submitted_by: userId ?? '',
      submitted_role: userRole,
      submitted_to_role: userRole === 'sub-coordinator' ? 'coordinator' : 'admin',
      submission_notes: submitNotes || null,
      created_at: new Date().toISOString(),
    }])
    setSubmitted(true)
  }

  // Data
  const scopeIntent = r.screen02_scope_intent as Record<string, string> | null
  const measurements = r.screen14_measurements as Record<string, unknown> | null
  const labour = r.screen15_labour as Record<string, unknown> | null
  const risks = r.screen17_risk_decisions as {
    flags: { description: string; source: string; manual: boolean; selectedRemedy: string | null; clientAcceptsRisk: boolean; clientNote: string | null }[]
    notes: string | null; flagCount: number; acceptsRiskCount: number
  } | null
  const timeline = r.screen16_timeline as {
    proposedStartDate: string | null; estimatedCompletionDate: string | null
    totalWorkingDays: number; totalCalendarDays: number; overrideCount: number
    entries: { activityName: string; activity: string; yardstickDays: number; supervisorDays: number; curingDays: number; isCuringLocked: boolean; isOverridden: boolean; overrideReason: string | null }[]
  } | null
  const materials = r.screen19_materials as Record<string, unknown> | null
  const clientScope = r.screen18_client_scope as {
    confirmedCount: number; changedCount: number; deferredCount: number
  } | null

  const totalCondFlags = COND_SCREENS.reduce((acc, s) => {
    const d = r[s.col] as Record<string, unknown> | null
    return acc + (Array.isArray(d?.riskFlags) ? (d!.riskFlags as unknown[]).length : 0)
  }, 0)

  return (
    <ReviewContext.Provider value={ctxValue}>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['review', 'approved'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === t ? 'bg-[#1F3864] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t === 'review' ? 'Review Mode' : 'Approved Report'}
          </button>
        ))}
      </div>

      {/* ── REVIEW MODE ────────────────────────────────────────────────── */}
      {tab === 'review' && (
        <div className="space-y-4">
          {submitted && (
            <div className="px-5 py-3 rounded-xl bg-green-50 border border-green-200">
              <p className="text-sm font-bold text-green-700">
                ✓ Report submitted and locked — no further edits permitted.
              </p>
            </div>
          )}

          {/* 1. Scope Intent */}
          <Section title="1. Scope Intent">
            {!scopeIntent ? (
              <p className="text-sm text-gray-400 italic">Not recorded</p>
            ) : (
              <>
                {SCOPE_FIELDS.map((field) => (
                  <EditableField
                    key={field}
                    fieldPath={`screen02_scope_intent.${field}`}
                    label={SCOPE_FIELD_LABELS[field]}
                    originalValue={scopeIntent[field] ?? ''}
                  />
                ))}
                {clientScope && (
                  <div className="pt-3 mt-3 border-t border-gray-100 flex gap-4">
                    <span className="text-xs text-green-700 font-semibold">{clientScope.confirmedCount} confirmed</span>
                    <span className="text-xs text-amber-700 font-semibold">{clientScope.changedCount} changed</span>
                    <span className="text-xs text-gray-500 font-semibold">{clientScope.deferredCount} deferred</span>
                  </div>
                )}
              </>
            )}
          </Section>

          {/* 2. Site Conditions */}
          <Section title="2. Site Conditions (Screens 3–13)"
            badge={totalCondFlags > 0
              ? <span className="text-xs font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">{totalCondFlags} flag{totalCondFlags !== 1 ? 's' : ''}</span>
              : undefined}>
            {COND_SCREENS.map(({ col, name, badge }) => (
              <ConditionCard
                key={col}
                col={col}
                name={name}
                badge={badge}
                data={r[col] as Record<string, unknown> | null}
              />
            ))}
          </Section>

          {/* 3. Measurements */}
          <Section title="3. Measurements">
            {!measurements ? (
              <p className="text-sm text-gray-400 italic">Not recorded</p>
            ) : (
              MEAS_ROWS.map(({ key, label, unit }) =>
                measurements[key] != null ? (
                  <EditableField
                    key={key}
                    fieldPath={`screen14_measurements.${key}`}
                    label={`${label} (${unit})`}
                    originalValue={String(measurements[key])}
                  />
                ) : null
              )
            )}
          </Section>

          {/* 4. Labour Schedule */}
          <Section title="4. Labour Schedule">
            {!labour ? (
              <p className="text-sm text-gray-400 italic">Not recorded</p>
            ) : (
              <>
                {LABOUR_ROWS.map(({ key, label }) =>
                  labour[key] != null ? (
                    <EditableField
                      key={key}
                      fieldPath={`screen15_labour.${key}`}
                      label={`${label} (days)`}
                      originalValue={String(labour[key])}
                    />
                  ) : null
                )}
                <div className="flex gap-6 pt-3 mt-2 border-t border-gray-100">
                  <div><p className="text-[10px] text-gray-400 uppercase">Total Working</p><p className="text-lg font-bold text-[#1F3864]">{String(labour.totalWorkingDays ?? '—')} days</p></div>
                  <div><p className="text-[10px] text-gray-400 uppercase">Total Calendar</p><p className="text-lg font-bold text-[#1F3864]">{String(labour.totalCalendarDays ?? '—')} days</p></div>
                </div>
              </>
            )}
          </Section>

          {/* 5. Risk Flag Decisions */}
          <Section title="5. Risk Flag Decisions"
            badge={risks && risks.flagCount > 0
              ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${risks.acceptsRiskCount > 0 ? 'bg-red-400 text-white' : 'bg-green-400 text-green-900'}`}>
                  {risks.flagCount} flag{risks.flagCount !== 1 ? 's' : ''}
                </span>
              : undefined}>
            {!risks || !risks.flags || risks.flags.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No risk flags recorded</p>
            ) : (
              <div className="space-y-3">
                {risks.flags.map((flag, i) => (
                  <div key={i} className={`rounded-xl border p-4 ${flag.clientAcceptsRisk ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-start gap-2 mb-3">
                      <span className={`mt-0.5 shrink-0 ${flag.clientAcceptsRisk ? 'text-red-500' : 'text-green-600'}`}>
                        {flag.clientAcceptsRisk ? '⚠' : '✓'}
                      </span>
                      <div>
                        <p className={`text-sm font-semibold ${flag.clientAcceptsRisk ? 'text-red-800' : 'text-green-800'}`}>{flag.description}</p>
                        <p className={`text-xs mt-0.5 ${flag.clientAcceptsRisk ? 'text-red-500' : 'text-green-600'}`}>{flag.source}{flag.manual ? ' · Manual' : ''}</p>
                      </div>
                    </div>
                    <EditableField
                      fieldPath={`screen17_risk_decisions.flags.${i}.selectedRemedy`}
                      label="Client Decision / Remedy"
                      originalValue={flag.selectedRemedy ?? ''}
                    />
                    {flag.clientNote && <p className="mt-2 text-xs text-gray-600 italic">&ldquo;{flag.clientNote}&rdquo;</p>}
                  </div>
                ))}
                {risks.notes && (
                  <EditableField
                    fieldPath="screen17_risk_decisions.notes"
                    label="Overall Notes"
                    originalValue={risks.notes}
                    multiline
                  />
                )}
              </div>
            )}
          </Section>

          {/* 6. Timeline */}
          <Section title="6. Timeline">
            {!timeline ? (
              <p className="text-sm text-gray-400 italic">Not recorded</p>
            ) : (
              <>
                <EditableField fieldPath="screen16_timeline.proposedStartDate" label="Proposed Start Date" originalValue={timeline.proposedStartDate ?? ''} />
                <EditableField fieldPath="screen16_timeline.estimatedCompletionDate" label="Est. Completion Date" originalValue={timeline.estimatedCompletionDate ?? ''} />
                {timeline.overrideCount > 0 && (
                  <p className="text-xs text-amber-700 font-semibold my-2">
                    ⚠ {timeline.overrideCount} supervisor override{timeline.overrideCount > 1 ? 's' : ''}
                  </p>
                )}
                {(timeline.entries ?? []).map((entry, i) => (
                  <EditableField
                    key={i}
                    fieldPath={`screen16_timeline.entries.${i}.supervisorDays`}
                    label={`${entry.activityName ?? entry.activity} — days`}
                    originalValue={String(entry.supervisorDays)}
                  />
                ))}
                <div className="flex gap-6 pt-3 mt-2 border-t border-gray-100">
                  <div><p className="text-[10px] text-gray-400 uppercase">Working Days</p><p className="text-lg font-bold text-[#1F3864]">{timeline.totalWorkingDays}</p></div>
                  <div><p className="text-[10px] text-gray-400 uppercase">Calendar Days</p><p className="text-lg font-bold text-[#1F3864]">{timeline.totalCalendarDays}</p></div>
                </div>
              </>
            )}
          </Section>

          {/* 7. Materials */}
          <Section title="7. Materials">
            {!materials ? (
              <p className="text-sm text-gray-400 italic">Not recorded</p>
            ) : (
              MAT_ROWS.map(({ key, label, unit }) =>
                materials[key] != null && Number(materials[key]) > 0 ? (
                  <EditableField
                    key={key}
                    fieldPath={`screen19_materials.${key}`}
                    label={`${label} (${unit})`}
                    originalValue={String(materials[key])}
                  />
                ) : null
              )
            )}
          </Section>

          {/* 8. Coordinator Review Notes */}
          <Section title="8. Coordinator Review Notes">
            <CoordinatorActions
              initialNotes={r.coordinator_notes as string | null}
              initialStatus={r.review_status as string | null}
              bookingRef={String(r.booking_ref ?? '')}
            />
          </Section>

          {/* Submit button */}
          {(userRole === 'sub-coordinator' || userRole === 'coordinator') && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                  {userRole === 'sub-coordinator' ? 'Submit to Coordinator' : 'Approve and Send to Admin'}
                </p>
                <p className="text-xs text-gray-400">
                  {userRole === 'sub-coordinator'
                    ? 'Forwards this reviewed report to coordinator for final approval.'
                    : 'Sends the finalised report to admin for estimate generation.'}
                </p>
              </div>
              {!submitted && (
                <textarea value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} rows={2}
                  placeholder="Optional notes for next reviewer…"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40" />
              )}
              {submitError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}
              {submitted ? (
                <div className="px-4 py-4 rounded-xl bg-green-50 border border-green-200 text-center">
                  <p className="text-sm font-bold text-green-700">✓ Submitted — report is locked</p>
                  <p className="text-xs text-green-600 mt-0.5">Switch to the Approved Report tab for the final document.</p>
                </div>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className={`w-full py-4 rounded-xl text-sm font-bold transition-colors ${submitting ? 'bg-gray-200 text-gray-400' : 'bg-[#1F3864] text-white hover:bg-[#162950]'}`}>
                  {submitting ? 'Submitting…'
                    : userRole === 'sub-coordinator' ? 'Submit to Coordinator'
                    : 'Approve and Send to Admin'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── APPROVED REPORT ────────────────────────────────────────────── */}
      {tab === 'approved' && (
        <ApprovedReport
          report={report}
          job={job}
          supervisor={supervisor}
          reviews={reviews}
          submissions={submissions}
        />
      )}
    </ReviewContext.Provider>
  )
}
