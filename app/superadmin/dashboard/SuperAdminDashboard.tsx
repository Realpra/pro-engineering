'use client'

import { useState } from 'react'
import {
  updatePremiumPolicy,
  updateContingencyPolicy,
  approvePremiumRequestAsSuperAdmin,
  rejectPremiumRequestAsSuperAdmin,
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
  tier: string
  max_contingency_pct: number
  admin_approval_limit_pct: number
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

type Tab = 'policy' | 'approvals' | 'history'

const VERTICALS = ['civil-engineering', 'interior-design', 'mep-services']
const CATEGORIES = ['turnkey', 'labour-only', 'material-supply']
const TIERS = ['budget', 'premium', 'luxury']

const TIER_COLORS: Record<string, string> = {
  budget:  'bg-gray-100 text-gray-600',
  premium: 'bg-blue-100 text-blue-700',
  luxury:  'bg-amber-100 text-amber-700',
}

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

export default function SuperAdminDashboard({
  premiumPolicies,
  contingencyPolicies,
  pendingApprovals,
  changeHistory,
}: {
  premiumPolicies: PremiumRow[]
  contingencyPolicies: ContingencyRow[]
  pendingApprovals: ApprovalRow[]
  changeHistory: ChangeLogRow[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('policy')

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
    const res = await updateContingencyPolicy(id, Number(editContingencyMax), Number(editContingencyLimit), editReason)
    if (res.success) {
      setContingencyRows(prev => prev.map(r => r.id === id ? {
        ...r,
        max_contingency_pct: Number(editContingencyMax),
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

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[#1F3864]/8 rounded-xl border border-[#1F3864]/10 w-fit">
        {([
          { id: 'policy', label: 'Policy Management' },
          { id: 'approvals', label: `Pending Approvals${pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ''}` },
          { id: 'history', label: 'Change History' },
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
              <p className="text-xs text-blue-200 mt-0.5">Max % without approval · Admin limit %</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Vertical</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Tier</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Max %</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Admin Limit %</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {VERTICALS.map(v => CATEGORIES.map(c => TIERS.map(t => {
                    const row = contingencyRows.find(r => r.vertical === v && r.job_category === c && r.tier === t)
                    if (!row) return null
                    const isEditing = editingContingencyId === row.id
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
                              min={0}
                              max={25}
                              step={0.5}
                              value={editContingencyMax}
                              onChange={e => setEditContingencyMax(e.target.value)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"
                            />
                          ) : (
                            `${row.max_contingency_pct}%`
                          )}
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
                            `${row.admin_approval_limit_pct}%`
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
                                setEditContingencyMax(String(row.max_contingency_pct))
                                setEditContingencyLimit(String(row.admin_approval_limit_pct))
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
                  })))}
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
    </div>
  )
}
