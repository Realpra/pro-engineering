'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  updatePremiumPolicy,
  updateContingencyPolicy,
  approvePremiumRequestAsSuperAdmin,
  rejectPremiumRequestAsSuperAdmin,
  updateBOQTemplate,
  toggleBOQTemplate,
  updateMilestoneTemplate,
  toggleMilestoneTemplate,
  updateChecklistTemplate,
  toggleChecklistTemplate,
  changeUserRole,
  suspendUser,
  reactivateUser,
} from './actions'

type PremiumRow = {
  id: string
  vertical: string
  job_category: string
  tier: string
  premium_pct: number
}

type ContingencyRow = {
  id: string
  vertical: string
  job_category: string
  job_type: string | null
  tier: string
  contingency_pct: number | null
  admin_approval_limit_pct: number | null
  geo_id: string | null
  effective_from: string | null
  is_active: boolean | null
}

type ApprovalRow = {
  id: string
  booking_ref: string
  boq_id: string | null
  requested_pct: number
  policy_pct: number
  boq_total: number | null
  reason: string | null
  status: string
  created_at: string
}

type ChangeLogRow = {
  id: string
  table_name: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  change_reason: string | null
  created_at: string
}

// ── Template Management row types ──
// NOTE: boq_sku_catalogue has no item_type/job_card_type/rate_*/is_risk_flag/
// is_mandatory columns in the live schema — adapted to the real columns.
type BOQTemplateRow = {
  sku_code: string
  sku_name: string
  category: string
  unit: string
  sequence_order: number
  wastage_multiplier: number
  applicable_tiers: string[]
  applicable_job_types: string[]
  is_active: boolean
}

type MilestoneTemplateRow = {
  milestone_code: string
  milestone_name: string
  milestone_number: number
  payment_percent: number
  planned_day: number
  trade_type: string | null
  sector: string | null
  is_active: boolean
}

type ChecklistTemplateRow = {
  id: string
  substage_code: string | null
  trade_type: string | null
  item_text: string
  item_type: string | null
  sequence_order: number
  is_active: boolean
}

// ── Role Management row types ──
type PlatformUserRow = {
  id: string
  full_name: string
  email: string
  platform_role: string
  created_at: string
  is_active: boolean
}

// ── Platform Analytics row types ──
type BookingRow = {
  booking_ref: string
  status: string
  zone: string | null
  job_type: string | null
  created_at: string
}

type WorkerRow = {
  id: string
  full_name: string
  trade: string
  skill_level: string
  approval_status: string
  is_active: boolean
  is_bocw_registered: boolean
  bocw_registration_number: string | null
  pf_uan: string | null
  esic_ip_number: string | null
}

// NOTE: boq_generated has no platform_premium_amount column — the real
// column is platform_fee.
type BOQGeneratedRow = {
  booking_ref: string
  total_amount: number
  platform_fee: number
  tier: string
  status: string
  created_at: string
}

// NOTE: geo_hierarchy has no zone_name/district/city/is_active columns in
// the live schema — real columns are id, name, type ('zone'|'city'), created_at.
type ZoneRow = {
  id: string
  name: string
  type: string
  created_at: string
}

type Tab = 'policy' | 'approvals' | 'history' | 'templates' | 'roles' | 'analytics' | 'compliance' | 'config' | 'audit'

const VERTICALS = ['civil-engineering', 'interior-design', 'mep-services']
const CATEGORIES = ['turnkey', 'labour-only', 'material-supply']
const TIERS = ['budget', 'premium', 'luxury']

const TIER_COLORS: Record<string, string> = {
  budget:  'bg-gray-100 text-gray-600',
  premium: 'bg-blue-100 text-blue-700',
  luxury:  'bg-amber-100 text-amber-700',
}

const PLATFORM_ROLES = [
  'super_admin', 'admin', 'coordinator', 'sub_coordinator',
  'supervisor', 'site_incharge', 'worker', 'client',
]

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'Final authority on all platform decisions. Approves payments above ₹5L, activates sectors, approves new zones and regions, overrides any decision.',
  admin: 'Approves payments ₹1L–₹5L. Approves platform premium and contingency. Configures BOCW and TDS rates. Manages workers and policies.',
  coordinator: 'Manages jobs end-to-end. Generates estimates, assigns supervisors, approves milestones, releases payments within coordinator limit.',
  sub_coordinator: 'Shift planning, route compilation, worker assignment, LTF feed management, dynamic instruction system.',
  supervisor: 'Site visits, QIP inspections, daily logs, scope verification, milestone gate submission.',
  site_incharge: 'On-site execution. Follows instructions, ticks checklist items, uploads evidence.',
  worker: 'Deployed to sites. Self-registered via onboarding flow. Assigned per trade and zone.',
  client: 'Books jobs, reviews estimates, accepts or rejects, makes milestone payments.',
}

const ESCALATION_RULES = [
  { name: 'Payment above ₹5,00,000', trigger: 'Payment amount exceeds ₹5,00,000', action: 'Super Admin approval required', roles: 'super_admin' },
  { name: 'Decision 5 Complete Redo', trigger: 'Decision 5 marked Complete Redo', action: 'Auto-escalate to Admin', roles: 'admin, super_admin' },
  { name: 'Safety Critical Instruction', trigger: 'Instruction flagged safety critical', action: 'Notify all roles immediately', roles: 'all' },
  { name: 'Worker Blacklist Risk Flag', trigger: 'Worker flagged for blacklist risk', action: 'Notify Admin', roles: 'admin' },
  { name: 'Scope Change above 20%', trigger: 'Scope change exceeds 20%', action: 'Notify Admin', roles: 'admin' },
]

const SLA_THRESHOLDS = [
  { name: 'Coordinator response to new booking', value: '24 hours' },
  { name: 'Supervisor site visit after confirmation', value: '3 days' },
  { name: 'Estimate delivery after site visit', value: '2 days' },
  { name: 'Payment release after milestone approval', value: '3 days' },
  { name: 'Worker assignment before job start', value: '48 hours' },
  { name: 'Admin response to payment above limit', value: '4 hours' },
]

const PLATFORM_SETTINGS = [
  { label: 'Platform Name', value: 'Pro Engineering' },
  { label: 'Default Currency', value: 'INR' },
  { label: 'Default GST %', value: '18' },
  { label: 'Default BOCW Cess %', value: '1' },
  { label: 'Default TDS Rate %', value: '2' },
  { label: 'Admin Payment Approval Limit', value: '₹5,00,000' },
  { label: 'Coordinator Payment Approval Limit', value: '₹1,00,000' },
  { label: 'Max Scope Change Before Escalation', value: '20%' },
  { label: 'Platform Premium Default %', value: '12' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtInr(n: number | null) {
  if (n == null) return '—'
  return '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-2xl font-bold text-[#1F3864]">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center py-14 px-6 text-center">
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}

function SubTabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-[#1F3864]/8 rounded-lg border border-[#1F3864]/10 w-fit flex-wrap">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            active === t.id ? 'bg-[#1F3864] text-white shadow-sm' : 'text-[#1F3864] hover:bg-[#1F3864]/10'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function ActivateButton({ isActive, onClick }: { isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border ${
        isActive
          ? 'bg-red-100 text-red-700 border-red-300'
          : 'bg-green-100 text-green-700 border-green-300'
      }`}
    >
      {isActive ? 'Deactivate' : 'Activate'}
    </button>
  )
}

export default function SuperAdminDashboard({
  premiumPolicies,
  contingencyPolicies,
  pendingApprovals,
  changeHistory,
  boqTemplates,
  milestoneTemplates,
  checklistTemplates,
  platformUsers,
  allBookings,
  allWorkers,
  allBOQs,
  allZones,
}: {
  premiumPolicies: PremiumRow[]
  contingencyPolicies: ContingencyRow[]
  pendingApprovals: ApprovalRow[]
  changeHistory: ChangeLogRow[]
  boqTemplates: BOQTemplateRow[]
  milestoneTemplates: MilestoneTemplateRow[]
  checklistTemplates: ChecklistTemplateRow[]
  platformUsers: PlatformUserRow[]
  allBookings: BookingRow[]
  allWorkers: WorkerRow[]
  allBOQs: BOQGeneratedRow[]
  allZones: ZoneRow[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('policy')

  // ── Template Management state ──
  const [templateSubTab, setTemplateSubTab] = useState<'boq' | 'milestone' | 'checklist'>('boq')
  const [boqRows, setBoqRows] = useState<BOQTemplateRow[]>(boqTemplates)
  const [boqFilter, setBoqFilter] = useState<'all' | 'labour' | 'material'>('all')
  const [boqActiveOnly, setBoqActiveOnly] = useState(false)
  const [editingBoqSku, setEditingBoqSku] = useState<string | null>(null)
  const [boqEdit, setBoqEdit] = useState({ sku_name: '', unit: '', wastage_multiplier: '' })
  const [boqBusy, setBoqBusy] = useState(false)

  const [milestoneRows, setMilestoneRows] = useState<MilestoneTemplateRow[]>(milestoneTemplates)
  const [editingMilestoneCode, setEditingMilestoneCode] = useState<string | null>(null)
  const [milestoneEdit, setMilestoneEdit] = useState({ milestone_name: '', payment_percent: '', planned_day: '' })
  const [milestoneBusy, setMilestoneBusy] = useState(false)

  const [checklistRows, setChecklistRows] = useState<ChecklistTemplateRow[]>(checklistTemplates)
  const [checklistTradeFilter, setChecklistTradeFilter] = useState('all')
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null)
  const [checklistEdit, setChecklistEdit] = useState({ item_text: '', sequence_order: '' })
  const [checklistBusy, setChecklistBusy] = useState(false)

  // ── Role Management state ──
  const [roleSubTab, setRoleSubTab] = useState<'users' | 'config' | 'access'>('users')
  const [userRows, setUserRows] = useState<PlatformUserRow[]>(platformUsers)
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')
  const [userBusyId, setUserBusyId] = useState<string | null>(null)

  // ── Platform Analytics state ──
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'jobs' | 'workers' | 'revenue' | 'zones'>('jobs')

  // ── Compliance Oversight state ──
  const [complianceSubTab, setComplianceSubTab] = useState<'bocw' | 'pf_esic' | 'audit'>('bocw')

  // ── System Configuration state ──
  const [configSubTab, setConfigSubTab] = useState<'escalation' | 'sla' | 'settings'>('escalation')

  // ── Audit Log state ──
  const [auditTableFilter, setAuditTableFilter] = useState('all')

  // Policy editing state
  const [premiumRows, setPremiumRows] = useState<PremiumRow[]>(premiumPolicies)
  const [contingencyRows, setContingencyRows] = useState<ContingencyRow[]>(contingencyPolicies)
  const [editingPremiumId, setEditingPremiumId] = useState<string | null>(null)
  const [editPremiumPct, setEditPremiumPct] = useState('')
  const [editingContingencyId, setEditingContingencyId] = useState<string | null>(null)
  const [editContingencyMax, setEditContingencyMax] = useState('')
  const [editContingencyLimit, setEditContingencyLimit] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editMsg, setEditMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  // Approvals state
  const [approvalRows, setApprovalRows] = useState<ApprovalRow[]>(pendingApprovals)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approvalBusy, setApprovalBusy] = useState(false)
  const [approvalMsg, setApprovalMsg] = useState<Record<string, string>>({})

  async function savePremiumEdit(id: string) {
    if (!editReason.trim()) return
    setSaving(true)
    setEditMsg(null)
    const res = await updatePremiumPolicy(id, Number(editPremiumPct), editReason)
    if (res.success) {
      setPremiumRows(prev => prev.map(r => r.id === id ? { ...r, premium_pct: Number(editPremiumPct) } : r))
      setEditingPremiumId(null)
      setEditReason('')
      setEditMsg({ text: 'Premium rate updated.', ok: true })
    } else {
      setEditMsg({ text: res.error ?? 'Update failed', ok: false })
    }
    setSaving(false)
  }

  async function saveContingencyEdit(id: string) {
    if (!editReason.trim()) return
    setSaving(true)
    setEditMsg(null)
    const res = await updateContingencyPolicy(id, Number(editContingencyLimit), editReason)
    if (res.success) {
      setContingencyRows(prev => prev.map(r => r.id === id ? {
        ...r,
        admin_approval_limit_pct: Number(editContingencyLimit),
      } : r))
      setEditingContingencyId(null)
      setEditReason('')
      setEditMsg({ text: 'Contingency policy updated.', ok: true })
    } else {
      setEditMsg({ text: res.error ?? 'Update failed', ok: false })
    }
    setSaving(false)
  }

  async function approveRequest(id: string) {
    setApprovalBusy(true)
    const res = await approvePremiumRequestAsSuperAdmin(id)
    if (res.success) {
      setApprovalRows(prev => prev.filter(r => r.id !== id))
      setApprovalMsg(prev => ({ ...prev, [id]: 'Approved.' }))
    } else {
      setApprovalMsg(prev => ({ ...prev, [id]: res.error ?? 'Error' }))
    }
    setApprovalBusy(false)
  }

  async function rejectRequest(id: string) {
    if (!rejectReason.trim()) return
    setApprovalBusy(true)
    const res = await rejectPremiumRequestAsSuperAdmin(id, rejectReason)
    if (res.success) {
      setApprovalRows(prev => prev.filter(r => r.id !== id))
      setRejectingId(null)
      setRejectReason('')
    } else {
      setApprovalMsg(prev => ({ ...prev, [id]: res.error ?? 'Error' }))
    }
    setApprovalBusy(false)
  }

  // ── Template Management handlers ──
  async function saveBoqEdit(skuCode: string) {
    setBoqBusy(true)
    const res = await updateBOQTemplate(skuCode, {
      sku_name: boqEdit.sku_name,
      unit: boqEdit.unit,
      wastage_multiplier: Number(boqEdit.wastage_multiplier),
    })
    if (res.success) {
      setBoqRows(prev => prev.map(r => r.sku_code === skuCode
        ? { ...r, sku_name: boqEdit.sku_name, unit: boqEdit.unit, wastage_multiplier: Number(boqEdit.wastage_multiplier) }
        : r))
      setEditingBoqSku(null)
    }
    setBoqBusy(false)
  }

  async function toggleBoq(row: BOQTemplateRow) {
    setBoqBusy(true)
    const res = await toggleBOQTemplate(row.sku_code, !row.is_active)
    if (res.success) {
      setBoqRows(prev => prev.map(r => r.sku_code === row.sku_code ? { ...r, is_active: !r.is_active } : r))
    }
    setBoqBusy(false)
  }

  async function saveMilestoneEdit(code: string) {
    setMilestoneBusy(true)
    const res = await updateMilestoneTemplate(code, {
      milestone_name: milestoneEdit.milestone_name,
      payment_percent: Number(milestoneEdit.payment_percent),
      planned_day: Number(milestoneEdit.planned_day),
    })
    if (res.success) {
      setMilestoneRows(prev => prev.map(r => r.milestone_code === code
        ? { ...r, milestone_name: milestoneEdit.milestone_name, payment_percent: Number(milestoneEdit.payment_percent), planned_day: Number(milestoneEdit.planned_day) }
        : r))
      setEditingMilestoneCode(null)
    }
    setMilestoneBusy(false)
  }

  async function toggleMilestone(row: MilestoneTemplateRow) {
    setMilestoneBusy(true)
    const res = await toggleMilestoneTemplate(row.milestone_code, !row.is_active)
    if (res.success) {
      setMilestoneRows(prev => prev.map(r => r.milestone_code === row.milestone_code ? { ...r, is_active: !r.is_active } : r))
    }
    setMilestoneBusy(false)
  }

  async function saveChecklistEdit(id: string) {
    setChecklistBusy(true)
    const res = await updateChecklistTemplate(id, {
      item_text: checklistEdit.item_text,
      sequence_order: Number(checklistEdit.sequence_order),
    })
    if (res.success) {
      setChecklistRows(prev => prev.map(r => r.id === id
        ? { ...r, item_text: checklistEdit.item_text, sequence_order: Number(checklistEdit.sequence_order) }
        : r))
      setEditingChecklistId(null)
    }
    setChecklistBusy(false)
  }

  async function toggleChecklist(row: ChecklistTemplateRow) {
    setChecklistBusy(true)
    const res = await toggleChecklistTemplate(row.id, !row.is_active)
    if (res.success) {
      setChecklistRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
    }
    setChecklistBusy(false)
  }

  // ── Role Management handlers ──
  async function handleChangeRole(userId: string, newRole: string) {
    setUserBusyId(userId)
    const res = await changeUserRole(userId, newRole)
    if (res.success) {
      setUserRows(prev => prev.map(u => u.id === userId ? { ...u, platform_role: newRole } : u))
    }
    setUserBusyId(null)
  }

  async function handleSuspend(userId: string) {
    if (!confirm('Suspend this user?')) return
    setUserBusyId(userId)
    const res = await suspendUser(userId)
    if (res.success) {
      setUserRows(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u))
    }
    setUserBusyId(null)
  }

  async function handleReactivate(userId: string) {
    setUserBusyId(userId)
    const res = await reactivateUser(userId)
    if (res.success) {
      setUserRows(prev => prev.map(u => u.id === userId ? { ...u, is_active: true } : u))
    }
    setUserBusyId(null)
  }

  // ── Derived data ──
  const filteredBoq = boqRows.filter(r =>
    (boqFilter === 'all' || r.category === boqFilter) &&
    (!boqActiveOnly || r.is_active)
  )

  const checklistTrades = Array.from(new Set(checklistRows.map(r => r.trade_type).filter(Boolean))) as string[]
  const filteredChecklist = checklistRows.filter(r => checklistTradeFilter === 'all' || r.trade_type === checklistTradeFilter)

  const roleCounts = PLATFORM_ROLES.map(role => ({ role, count: userRows.filter(u => u.platform_role === role).length }))
  const filteredUsers = userRows.filter(u =>
    (userRoleFilter === 'all' || u.platform_role === userRoleFilter) &&
    (userStatusFilter === 'all' || (userStatusFilter === 'active' ? u.is_active : !u.is_active))
  )

  const jobsByStatus = Object.entries(
    allBookings.reduce((acc, b) => { acc[b.status] = (acc[b.status] ?? 0) + 1; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])
  const jobsByZone = Object.entries(
    allBookings.reduce((acc, b) => { const z = b.zone ?? 'Unassigned'; acc[z] = (acc[z] ?? 0) + 1; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])
  const jobsByType = Object.entries(
    allBookings.reduce((acc, b) => { const t = b.job_type ?? 'Unspecified'; acc[t] = (acc[t] ?? 0) + 1; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])
  const maxJobStatusCount = Math.max(1, ...jobsByStatus.map(([, c]) => c))
  const activeJobs = allBookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length
  const completedJobs = allBookings.filter(b => b.status === 'completed').length
  const pendingEstimateJobs = allBookings.filter(b => b.status === 'enquiry').length

  const workersByTrade = Object.entries(
    allWorkers.reduce((acc, w) => { acc[w.trade] = (acc[w.trade] ?? 0) + 1; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])
  const workersBySkill = Object.entries(
    allWorkers.reduce((acc, w) => { acc[w.skill_level] = (acc[w.skill_level] ?? 0) + 1; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])
  const approvedWorkers = allWorkers.filter(w => w.approval_status === 'coordinator_approved' || w.approval_status === 'admin_approved').length
  const pendingWorkers = allWorkers.filter(w => w.approval_status === 'pending').length
  const suspendedWorkers = allWorkers.filter(w => !w.is_active).length

  const totalBOQValue = allBOQs.reduce((s, b) => s + (b.total_amount ?? 0), 0)
  const totalPlatformFee = allBOQs.reduce((s, b) => s + (b.platform_fee ?? 0), 0)
  const avgBOQValue = allBOQs.length > 0 ? totalBOQValue / allBOQs.length : 0
  const boqByTier = Object.entries(
    allBOQs.reduce((acc, b) => {
      const t = b.tier ?? 'unspecified'
      if (!acc[t]) acc[t] = { count: 0, total: 0 }
      acc[t].count += 1
      acc[t].total += b.total_amount ?? 0
      return acc
    }, {} as Record<string, { count: number; total: number }>)
  )

  const bocwRegistered = allWorkers.filter(w => w.is_bocw_registered && w.bocw_registration_number)
  const bocwNotRegistered = allWorkers.filter(w => !w.is_bocw_registered)
  const bocwMissingNumber = allWorkers.filter(w => w.is_bocw_registered && !w.bocw_registration_number)

  const pfRegistered = allWorkers.filter(w => !!w.pf_uan)
  const esicRegistered = allWorkers.filter(w => !!w.esic_ip_number)
  const missingBoth = allWorkers.filter(w => !w.pf_uan && !w.esic_ip_number)

  const auditTables = Array.from(new Set(changeHistory.map(h => h.table_name)))
  const filteredAudit = changeHistory.filter(h => auditTableFilter === 'all' || h.table_name === auditTableFilter)

  return (
    <div className="space-y-6">
      <Link href="/superadmin/allocation" className="block bg-[#1F3864] rounded-xl px-5 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-white font-bold text-sm">Allocation Overview →</p>
          <p className="text-blue-200 text-xs">Trade × Day capacity matrix, platform-wide — escalations &amp; client closure</p>
        </div>
      </Link>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[#1F3864]/8 rounded-xl border border-[#1F3864]/10 w-fit flex-wrap">
        {([
          { id: 'policy', label: 'Policy Management' },
          { id: 'approvals', label: `Pending Approvals${pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ''}` },
          { id: 'history', label: 'Change History' },
          { id: 'templates', label: 'Template Management' },
          { id: 'roles', label: 'Role Management' },
          { id: 'analytics', label: 'Platform Analytics' },
          { id: 'compliance', label: 'Compliance Oversight' },
          { id: 'config', label: 'System Configuration' },
          { id: 'audit', label: 'Audit Log' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id ? 'bg-[#1F3864] text-white shadow-sm' : 'text-[#1F3864] hover:bg-[#1F3864]/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {editMsg && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-semibold ${
          editMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {editMsg.text}
        </div>
      )}

      {/* ── Policy Management tab ── */}
      {activeTab === 'policy' && (
        <div className="space-y-8">
          {/* Platform Premium table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-[#1F3864] text-white">
              <p className="font-bold text-sm">Platform Premium Policy</p>
              <p className="text-xs text-blue-200 mt-0.5">Per vertical × job category × tier</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Vertical</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Tier</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Premium %</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {VERTICALS.map(v => CATEGORIES.map(c => TIERS.map(t => {
                    const row = premiumRows.find(r => r.vertical === v && r.job_category === c && r.tier === t)
                    if (!row) return null
                    const isEditing = editingPremiumId === row.id
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 capitalize">{v.replace(/-/g, ' ')}</td>
                        <td className="px-4 py-3 text-gray-700 capitalize">{c.replace(/-/g, ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${TIER_COLORS[t]}`}>{t}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#1F3864]">
                          {isEditing ? (
                            <input
                              type="number"
                              min={1}
                              max={30}
                              step={0.5}
                              value={editPremiumPct}
                              onChange={e => setEditPremiumPct(e.target.value)}
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                            />
                          ) : (
                            `${row.premium_pct}%`
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5 items-end">
                              <input
                                type="text"
                                placeholder="Reason for change…"
                                value={editReason}
                                onChange={e => setEditReason(e.target.value)}
                                className="w-48 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={saving || !editReason.trim()}
                                  onClick={() => savePremiumEdit(row.id)}
                                  className="px-3 py-1 rounded-lg bg-[#1F3864] text-white text-xs font-bold hover:bg-[#162950] disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingPremiumId(null); setEditReason('') }}
                                  className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setEditingPremiumId(row.id); setEditPremiumPct(String(row.premium_pct)); setEditReason('') }}
                              className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contingency table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-[#1F3864] text-white">
              <p className="font-bold text-sm">Contingency Policy</p>
              <p className="text-xs text-blue-200 mt-0.5">Contingency % is set by Admin (Policy screen) · Admin approves up to the Admin limit %, Super Admin above it</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Vertical</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Job Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Tier</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Contingency %</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Admin Limit %</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contingencyRows.filter(r => r.is_active !== false).map(row => {
                    // One row per repository entry (job type and region included); the old
                    // vertical x category x tier grid showed only the first of 3 job types.
                    const v = row.vertical ?? ''
                    const c = row.job_category ?? ''
                    const t = row.tier ?? ''
                    const isEditing = editingContingencyId === row.id
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 capitalize">{v.replace(/-/g, ' ')}</td>
                        <td className="px-4 py-3 text-gray-700 capitalize">{c.replace(/-/g, ' ')}</td>
                        <td className="px-4 py-3 text-gray-700 capitalize">{(row.job_type ?? '—').replace(/-/g, ' ')}{row.geo_id ? ' · regional' : ''}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${TIER_COLORS[t]}`}>{t}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#1F3864]">
                          {row.contingency_pct == null ? '—' : `${row.contingency_pct}%`}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0}
                              max={30}
                              step={0.5}
                              value={editContingencyLimit}
                              onChange={e => setEditContingencyLimit(e.target.value)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                            />
                          ) : (
                            (row.admin_approval_limit_pct == null ? '—' : `${row.admin_approval_limit_pct}%`)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5 items-end">
                              <input
                                type="text"
                                placeholder="Reason…"
                                value={editReason}
                                onChange={e => setEditReason(e.target.value)}
                                className="w-40 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={saving || !editReason.trim()}
                                  onClick={() => saveContingencyEdit(row.id)}
                                  className="px-3 py-1 rounded-lg bg-[#1F3864] text-white text-xs font-bold hover:bg-[#162950] disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingContingencyId(null); setEditReason('') }}
                                  className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContingencyId(row.id)
                                setEditContingencyMax(String(row.contingency_pct ?? ''))
                                setEditContingencyLimit(String(row.admin_approval_limit_pct ?? ''))
                                setEditReason('')
                              }}
                              className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Approvals tab ── */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {approvalRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-[#1F3864]">No pending approvals</p>
              <p className="text-sm text-gray-400 mt-1">All premium override requests have been reviewed</p>
            </div>
          ) : (
            approvalRows.map(row => (
              <div key={row.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold text-[#2E74B5] bg-[#2E74B5]/10 px-2 py-0.5 rounded-md">
                        {row.booking_ref}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {row.requested_pct}% requested
                      </span>
                      <span className="text-xs text-gray-500">
                        policy: {row.policy_pct}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                      <span><span className="font-semibold">BOQ Total:</span> {fmtInr(row.boq_total)}</span>
                      <span><span className="font-semibold">Submitted:</span> {fmtDate(row.created_at)}</span>
                    </div>
                    {row.reason && (
                      <p className="text-xs text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2">
                        &ldquo;{row.reason}&rdquo;
                      </p>
                    )}
                    {approvalMsg[row.id] && (
                      <p className="text-xs font-semibold text-red-600 mt-2">{approvalMsg[row.id]}</p>
                    )}
                    {rejectingId === row.id && (
                      <div className="mt-3">
                        <textarea
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          rows={2}
                          placeholder="Rejection reason…"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            disabled={approvalBusy || !rejectReason.trim()}
                            onClick={() => rejectRequest(row.id)}
                            className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirm Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRejectingId(null); setRejectReason('') }}
                            className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {rejectingId !== row.id && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={approvalBusy}
                        onClick={() => approveRequest(row.id)}
                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(row.id)}
                        className="px-4 py-2 rounded-lg border-2 border-red-500 text-red-600 text-xs font-bold hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Change History tab ── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {changeHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <p className="text-sm text-gray-400">No policy changes recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Table</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Old</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">New</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Reason</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {changeHistory.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {log.table_name.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {JSON.stringify(log.old_value)}
                      </td>
                      <td className="px-4 py-3 text-[#1F3864] text-xs font-mono font-semibold">
                        {JSON.stringify(log.new_value)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs italic max-w-[200px] truncate">
                        {log.change_reason ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Template Management tab ── */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <SubTabs
            tabs={[
              { id: 'boq' as const, label: 'BOQ Templates' },
              { id: 'milestone' as const, label: 'Milestone Templates' },
              { id: 'checklist' as const, label: 'Checklist Templates' },
            ]}
            active={templateSubTab}
            onChange={setTemplateSubTab}
          />

          {templateSubTab === 'boq' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 p-1 bg-[#1F3864]/8 rounded-lg border border-[#1F3864]/10 w-fit">
                  {([
                    { id: 'all', label: 'All' },
                    { id: 'labour', label: 'Labour' },
                    { id: 'material', label: 'Material' },
                  ] as { id: typeof boqFilter; label: string }[]).map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setBoqFilter(f.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold ${boqFilter === f.id ? 'bg-[#1F3864] text-white' : 'text-[#1F3864] hover:bg-[#1F3864]/10'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <input type="checkbox" checked={boqActiveOnly} onChange={e => setBoqActiveOnly(e.target.checked)} />
                  Active Only
                </label>
              </div>

              {filteredBoq.length === 0 ? (
                <EmptyState text="No BOQ templates found" />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">SKU Code</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Name</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Category</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Unit</th>
                          <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Wastage ×</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Tiers</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredBoq.map(row => {
                          const isEditing = editingBoqSku === row.sku_code
                          return (
                            <tr key={row.sku_code} className={isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                              <td className="px-4 py-3 text-gray-700 font-mono text-xs">{row.sku_code}</td>
                              <td className="px-4 py-3 text-gray-700">
                                {isEditing ? (
                                  <input value={boqEdit.sku_name} onChange={e => setBoqEdit(v => ({ ...v, sku_name: e.target.value }))} className="w-40 border border-gray-200 rounded-lg px-2 py-1 text-xs" />
                                ) : row.sku_name}
                              </td>
                              <td className="px-4 py-3 text-gray-600 capitalize">{row.category}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {isEditing ? (
                                  <input value={boqEdit.unit} onChange={e => setBoqEdit(v => ({ ...v, unit: e.target.value }))} className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs" />
                                ) : row.unit}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600">
                                {isEditing ? (
                                  <input type="number" step={0.01} value={boqEdit.wastage_multiplier} onChange={e => setBoqEdit(v => ({ ...v, wastage_multiplier: e.target.value }))} className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right" />
                                ) : row.wastage_multiplier}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{(row.applicable_tiers ?? []).join(', ')}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                  {row.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <button type="button" disabled={boqBusy} onClick={() => saveBoqEdit(row.sku_code)} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#1F3864] text-white disabled:opacity-50">Save</button>
                                    <button type="button" onClick={() => setEditingBoqSku(null)} className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600">Cancel</button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => { setEditingBoqSku(row.sku_code); setBoqEdit({ sku_name: row.sku_name, unit: row.unit, wastage_multiplier: String(row.wastage_multiplier) }) }}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600"
                                    >
                                      Edit
                                    </button>
                                    <ActivateButton isActive={row.is_active} onClick={() => toggleBoq(row)} />
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {templateSubTab === 'milestone' && (
            milestoneRows.length === 0 ? (
              <EmptyState text="No milestone templates found" />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Code</th>
                        <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Name</th>
                        <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">#</th>
                        <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Payment %</th>
                        <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Day</th>
                        <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Trade</th>
                        <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Sector</th>
                        <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {milestoneRows.map(row => {
                        const isEditing = editingMilestoneCode === row.milestone_code
                        return (
                          <tr key={row.milestone_code} className={isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                            <td className="px-4 py-3 text-gray-700 font-mono text-xs">{row.milestone_code}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {isEditing ? (
                                <input value={milestoneEdit.milestone_name} onChange={e => setMilestoneEdit(v => ({ ...v, milestone_name: e.target.value }))} className="w-40 border border-gray-200 rounded-lg px-2 py-1 text-xs" />
                              ) : row.milestone_name}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">{row.milestone_number}</td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {isEditing ? (
                                <input type="number" step={0.5} value={milestoneEdit.payment_percent} onChange={e => setMilestoneEdit(v => ({ ...v, payment_percent: e.target.value }))} className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right" />
                              ) : `${row.payment_percent}%`}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {isEditing ? (
                                <input type="number" value={milestoneEdit.planned_day} onChange={e => setMilestoneEdit(v => ({ ...v, planned_day: e.target.value }))} className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right" />
                              ) : row.planned_day}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{row.trade_type ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{row.sector ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {row.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <button type="button" disabled={milestoneBusy} onClick={() => saveMilestoneEdit(row.milestone_code)} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#1F3864] text-white disabled:opacity-50">Save</button>
                                  <button type="button" onClick={() => setEditingMilestoneCode(null)} className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => { setEditingMilestoneCode(row.milestone_code); setMilestoneEdit({ milestone_name: row.milestone_name, payment_percent: String(row.payment_percent), planned_day: String(row.planned_day) }) }}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600"
                                  >
                                    Edit
                                  </button>
                                  <ActivateButton isActive={row.is_active} onClick={() => toggleMilestone(row)} />
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {templateSubTab === 'checklist' && (
            <div className="space-y-3">
              <select
                value={checklistTradeFilter}
                onChange={e => setChecklistTradeFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600"
              >
                <option value="all">All Trades</option>
                {checklistTrades.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              {filteredChecklist.length === 0 ? (
                <EmptyState text="No checklist templates found" />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Substage</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Trade</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Item Text</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Type</th>
                          <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Order</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredChecklist.map(row => {
                          const isEditing = editingChecklistId === row.id
                          return (
                            <tr key={row.id} className={isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                              <td className="px-4 py-3 text-gray-600 text-xs">{row.substage_code ?? '—'}</td>
                              <td className="px-4 py-3 text-gray-600">{row.trade_type ?? '—'}</td>
                              <td className="px-4 py-3 text-gray-700">
                                {isEditing ? (
                                  <input value={checklistEdit.item_text} onChange={e => setChecklistEdit(v => ({ ...v, item_text: e.target.value }))} className="w-56 border border-gray-200 rounded-lg px-2 py-1 text-xs" />
                                ) : row.item_text}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{row.item_type ?? '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-600">
                                {isEditing ? (
                                  <input type="number" value={checklistEdit.sequence_order} onChange={e => setChecklistEdit(v => ({ ...v, sequence_order: e.target.value }))} className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right" />
                                ) : row.sequence_order}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                  {row.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <button type="button" disabled={checklistBusy} onClick={() => saveChecklistEdit(row.id)} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#1F3864] text-white disabled:opacity-50">Save</button>
                                    <button type="button" onClick={() => setEditingChecklistId(null)} className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600">Cancel</button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => { setEditingChecklistId(row.id); setChecklistEdit({ item_text: row.item_text, sequence_order: String(row.sequence_order) }) }}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600"
                                    >
                                      Edit
                                    </button>
                                    <ActivateButton isActive={row.is_active} onClick={() => toggleChecklist(row)} />
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Role Management tab ── */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <SubTabs
            tabs={[
              { id: 'users' as const, label: 'Platform Users' },
              { id: 'config' as const, label: 'Role Config' },
              { id: 'access' as const, label: 'Access Log' },
            ]}
            active={roleSubTab}
            onChange={setRoleSubTab}
          />

          {roleSubTab === 'users' && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {roleCounts.map(rc => (
                  <span key={rc.role} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#1F3864]/10 text-[#1F3864]">
                    {rc.role.replace(/_/g, ' ')}: {rc.count}
                  </span>
                ))}
              </div>

              <div className="flex gap-3 flex-wrap items-center">
                <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600">
                  <option value="all">All Roles</option>
                  {PLATFORM_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
                <div className="flex gap-1 p-1 bg-[#1F3864]/8 rounded-lg border border-[#1F3864]/10 w-fit">
                  {([
                    { id: 'all', label: 'All' },
                    { id: 'active', label: 'Active' },
                    { id: 'suspended', label: 'Suspended' },
                  ] as { id: typeof userStatusFilter; label: string }[]).map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setUserStatusFilter(f.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold ${userStatusFilter === f.id ? 'bg-[#1F3864] text-white' : 'text-[#1F3864] hover:bg-[#1F3864]/10'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <EmptyState text="No platform users found" />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Name</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Email</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Role</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Joined</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700 font-semibold">{u.full_name}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                            <td className="px-4 py-3">
                              <select
                                value={u.platform_role}
                                disabled={userBusyId === u.id}
                                onChange={e => handleChangeRole(u.id, e.target.value)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 border-none"
                              >
                                {PLATFORM_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(u.created_at)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {u.is_active ? 'Active' : 'Suspended'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {u.is_active ? (
                                <button type="button" disabled={userBusyId === u.id} onClick={() => handleSuspend(u.id)} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-orange-100 text-orange-700 disabled:opacity-50">
                                  Suspend
                                </button>
                              ) : (
                                <button type="button" disabled={userBusyId === u.id} onClick={() => handleReactivate(u.id)} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-green-100 text-green-700 disabled:opacity-50">
                                  Reactivate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {roleSubTab === 'config' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLATFORM_ROLES.map(role => (
                <div key={role} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                  <p className="text-sm font-bold text-[#1F3864] capitalize mb-1.5">{role.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              ))}
            </div>
          )}

          {roleSubTab === 'access' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Showing all recorded changes (last 7 days filter not applicable — change log has no per-row actor timestamp filter beyond what's shown).</p>
              {changeHistory.length === 0 ? (
                <EmptyState text="No access log entries" />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Timestamp</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Table Changed</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {changeHistory
                          .filter(h => new Date(h.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)
                          .map(h => (
                            <tr key={h.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(h.created_at)}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{h.table_name.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs italic">{h.change_reason ?? '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Platform Analytics tab ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <SubTabs
            tabs={[
              { id: 'jobs' as const, label: 'Jobs' },
              { id: 'workers' as const, label: 'Workers' },
              { id: 'revenue' as const, label: 'Revenue' },
              { id: 'zones' as const, label: 'Zones' },
            ]}
            active={analyticsSubTab}
            onChange={setAnalyticsSubTab}
          />

          {analyticsSubTab === 'jobs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total" value={allBookings.length} />
                <StatCard label="Active" value={activeJobs} />
                <StatCard label="Completed" value={completedJobs} />
                <StatCard label="Pending Estimate" value={pendingEstimateJobs} />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">Jobs by Status</div>
                <div className="divide-y divide-gray-100">
                  {jobsByStatus.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">No data</div> : jobsByStatus.map(([status, count]) => (
                    <div key={status} className="px-4 py-3 flex items-center gap-3">
                      <span className="w-32 text-sm text-gray-700 capitalize shrink-0">{status}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                        <div className="bg-[#1F3864] h-2.5 rounded-full" style={{ width: `${(count / maxJobStatusCount) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-[#1F3864] w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">Jobs by Zone</div>
                  <table className="w-full text-sm"><tbody className="divide-y divide-gray-100">
                    {jobsByZone.map(([zone, count]) => (
                      <tr key={zone}><td className="px-4 py-2.5 text-gray-700">{zone}</td><td className="px-4 py-2.5 text-right font-bold text-[#1F3864]">{count}</td></tr>
                    ))}
                  </tbody></table>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">Jobs by Type</div>
                  <table className="w-full text-sm"><tbody className="divide-y divide-gray-100">
                    {jobsByType.map(([type, count]) => (
                      <tr key={type}><td className="px-4 py-2.5 text-gray-700">{type}</td><td className="px-4 py-2.5 text-right font-bold text-[#1F3864]">{count}</td></tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            </div>
          )}

          {analyticsSubTab === 'workers' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total" value={allWorkers.length} />
                <StatCard label="Approved" value={approvedWorkers} />
                <StatCard label="Pending" value={pendingWorkers} />
                <StatCard label="Suspended" value={suspendedWorkers} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">By Trade</div>
                  <table className="w-full text-sm"><tbody className="divide-y divide-gray-100">
                    {workersByTrade.map(([trade, count]) => (
                      <tr key={trade}><td className="px-4 py-2.5 text-gray-700 capitalize">{trade}</td><td className="px-4 py-2.5 text-right font-bold text-[#1F3864]">{count}</td></tr>
                    ))}
                  </tbody></table>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">By Skill Level</div>
                  <table className="w-full text-sm"><tbody className="divide-y divide-gray-100">
                    {workersBySkill.map(([skill, count]) => (
                      <tr key={skill}><td className="px-4 py-2.5 text-gray-700 capitalize">{skill.replace(/_/g, ' ')}</td><td className="px-4 py-2.5 text-right font-bold text-[#1F3864]">{count}</td></tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            </div>
          )}

          {analyticsSubTab === 'revenue' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total BOQs" value={allBOQs.length} />
                <StatCard label="Total Value" value={fmtInr(totalBOQValue)} />
                <StatCard label="Avg Value" value={fmtInr(avgBOQValue)} />
                <StatCard label="Total Platform Fee" value={fmtInr(totalPlatformFee)} />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">By Tier</div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100"><th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Tier</th><th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Count</th><th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Total Value</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {boqByTier.map(([tier, agg]) => (
                      <tr key={tier}>
                        <td className="px-4 py-2.5 capitalize"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-600'}`}>{tier}</span></td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{agg.count}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[#1F3864]">{fmtInr(agg.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {analyticsSubTab === 'zones' && (
            allZones.length === 0 ? <EmptyState text="No zones found" /> : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Type</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {allZones.map(z => (
                      <tr key={z.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{z.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${z.type === 'zone' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{z.type}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* ── Compliance Oversight tab ── */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          <SubTabs
            tabs={[
              { id: 'bocw' as const, label: 'BOCW' },
              { id: 'pf_esic' as const, label: 'PF and ESIC' },
              { id: 'audit' as const, label: 'Audit Trail' },
            ]}
            active={complianceSubTab}
            onChange={setComplianceSubTab}
          />

          {complianceSubTab === 'bocw' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="BOCW Registered" value={bocwRegistered.length} />
                <StatCard label="Not Registered" value={bocwNotRegistered.length} />
                <StatCard label="Missing Number" value={bocwMissingNumber.length} />
              </div>

              {[
                { title: 'Registered', rows: bocwRegistered, cols: ['full_name', 'trade', 'bocw_registration_number'] as (keyof WorkerRow)[], headers: ['Name', 'Trade', 'BOCW Number'] },
                { title: 'Not Registered', rows: bocwNotRegistered, cols: ['full_name', 'trade', 'skill_level'] as (keyof WorkerRow)[], headers: ['Name', 'Trade', 'Skill Level'] },
                { title: 'Missing Number', rows: bocwMissingNumber, cols: ['full_name', 'trade'] as (keyof WorkerRow)[], headers: ['Name', 'Trade'] },
              ].map(section => (
                <div key={section.title} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{section.title}</span>
                    <button
                      type="button"
                      onClick={() => downloadCSV(`bocw-${section.title.toLowerCase().replace(/ /g, '-')}.csv`, section.rows as unknown as Record<string, unknown>[])}
                      className="text-xs font-semibold px-3 py-1 rounded-lg border border-gray-300 text-gray-600"
                    >
                      Export CSV
                    </button>
                  </div>
                  {section.rows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No rows</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-100">{section.headers.map(h => <th key={h} className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {section.rows.map((w, i) => (
                          <tr key={i}>{section.cols.map(c => <td key={c} className="px-4 py-2.5 text-gray-700">{String(w[c] ?? '—')}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}

          {complianceSubTab === 'pf_esic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="PF Registered" value={pfRegistered.length} />
                <StatCard label="ESIC Registered" value={esicRegistered.length} />
                <StatCard label="Missing Both" value={missingBoth.length} />
              </div>

              {[
                { title: 'PF', rows: pfRegistered, cols: ['full_name', 'trade', 'pf_uan'] as (keyof WorkerRow)[], headers: ['Name', 'Trade', 'PF UAN'] },
                { title: 'ESIC', rows: esicRegistered, cols: ['full_name', 'trade', 'esic_ip_number'] as (keyof WorkerRow)[], headers: ['Name', 'Trade', 'ESIC IP Number'] },
                { title: 'Missing Both', rows: missingBoth, cols: ['full_name', 'trade'] as (keyof WorkerRow)[], headers: ['Name', 'Trade'] },
              ].map(section => (
                <div key={section.title} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{section.title}</span>
                    <button
                      type="button"
                      onClick={() => downloadCSV(`${section.title.toLowerCase().replace(/ /g, '-')}.csv`, section.rows as unknown as Record<string, unknown>[])}
                      className="text-xs font-semibold px-3 py-1 rounded-lg border border-gray-300 text-gray-600"
                    >
                      Export CSV
                    </button>
                  </div>
                  {section.rows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No rows</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-100">{section.headers.map(h => <th key={h} className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {section.rows.map((w, i) => (
                          <tr key={i}>{section.cols.map(c => <td key={c} className="px-4 py-2.5 text-gray-700">{String(w[c] ?? '—')}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}

          {complianceSubTab === 'audit' && (
            changeHistory.length === 0 ? <EmptyState text="No audit trail entries" /> : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Timestamp</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Table</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Old Value</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">New Value</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Reason</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {changeHistory.map(h => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(h.created_at)}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{h.table_name.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">{JSON.stringify(h.old_value)}</td>
                          <td className="px-4 py-3 text-[#1F3864] text-xs font-mono font-semibold">{JSON.stringify(h.new_value)}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs italic">{h.change_reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ── System Configuration tab ── */}
      {activeTab === 'config' && (
        <div className="space-y-4">
          <SubTabs
            tabs={[
              { id: 'escalation' as const, label: 'Escalation Rules' },
              { id: 'sla' as const, label: 'SLA Thresholds' },
              { id: 'settings' as const, label: 'Platform Settings' },
            ]}
            active={configSubTab}
            onChange={setConfigSubTab}
          />

          {configSubTab === 'escalation' && (
            <div className="space-y-3">
              {ESCALATION_RULES.map(rule => (
                <div key={rule.name} className="bg-white rounded-2xl border-2 border-[#1F3864]/20 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-bold text-[#1F3864]">{rule.name}</p>
                      <p className="text-xs text-gray-500 mt-1"><span className="font-semibold">Trigger:</span> {rule.trigger}</p>
                      <p className="text-xs text-gray-500 mt-0.5"><span className="font-semibold">Action:</span> {rule.action}</p>
                      <p className="text-xs text-gray-500 mt-0.5"><span className="font-semibold">Roles Notified:</span> {rule.roles}</p>
                    </div>
                    <span className="text-xs font-bold text-[#1F3864] bg-[#1F3864]/10 px-2 py-1 rounded-full whitespace-nowrap">Platform Configured</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {configSubTab === 'sla' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SLA_THRESHOLDS.map(t => (
                <div key={t.name} className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{t.name}</p>
                    <p className="text-lg font-bold text-[#1F3864] mt-1">{t.value}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">Platform Default</span>
                </div>
              ))}
            </div>
          )}

          {configSubTab === 'settings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {PLATFORM_SETTINGS.map(s => (
                <StatCard key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Audit Log tab ── */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <select value={auditTableFilter} onChange={e => setAuditTableFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600">
              <option value="all">All Tables</option>
              {auditTables.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <button
              type="button"
              onClick={() => downloadCSV('audit-log.csv', filteredAudit.map(h => ({
                timestamp: h.created_at,
                table: h.table_name,
                old_value: JSON.stringify(h.old_value),
                new_value: JSON.stringify(h.new_value),
                reason: h.change_reason ?? '',
              })))}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600"
            >
              Export CSV
            </button>
          </div>

          {filteredAudit.length === 0 ? (
            <EmptyState text="No audit log entries" />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Timestamp</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Table</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Old Value</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">New Value</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Reason</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAudit.map(h => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(h.created_at)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{h.table_name.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{truncate(JSON.stringify(h.old_value), 60)}</td>
                        <td className="px-4 py-3 text-[#1F3864] text-xs font-mono font-semibold">{truncate(JSON.stringify(h.new_value), 60)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs italic">{h.change_reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
