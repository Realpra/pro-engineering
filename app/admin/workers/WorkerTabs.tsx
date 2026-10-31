'use client'

import { useState } from 'react'
import WorkerCard, { type Worker, type WorkerCardMode } from './WorkerCard'
import { AWAITING_ADMIN_STATUSES } from '@/lib/workerApprovalStatus'

type TabDef = {
  key: string
  label: string
  statuses: string[]
  mode: WorkerCardMode
  showBadge?: boolean
  // Optional extra predicate beyond approval_status -- used by
  // "Flagged for Renewal", which is an overlay on admin_approved, not a
  // separate status (project owner's confirmed design, 1 Oct 2026; replaces
  // the "Previously Approved" tab that keyed on a legacy 'approved' value
  // never written by any live code -- PENDING #37, resolved here).
  extra?: (w: Worker) => boolean
}

const TABS: TabDef[] = [
  { key: 'pending', label: 'Pending Approval', statuses: AWAITING_ADMIN_STATUSES, mode: 'pending', showBadge: true },
  { key: 'admin_approved', label: 'Admin Approved', statuses: ['admin_approved'], mode: 'approved', extra: (w) => !w.admin_renewal_flag_reason },
  { key: 'renewal_flagged', label: 'Flagged for Renewal', statuses: ['admin_approved'], mode: 'approved', extra: (w) => !!w.admin_renewal_flag_reason },
  { key: 'returned', label: 'Returned / Rejected', statuses: ['returned_for_correction', 'returned_to_subcoordinator', 'rejected'], mode: 'returned' },
  { key: 'pending_coordinator', label: 'Pending Coordinator', statuses: ['pending', 'sub_coordinator_reviewed'], mode: 'pending_coordinator' },
  { key: 'reassessment', label: 'Re-Assessment', statuses: ['returned_for_reassessment'], mode: 'reassessment' },
]

function inTab(worker: Worker, tab: TabDef): boolean {
  if (worker.approval_status == null || !tab.statuses.includes(worker.approval_status)) return false
  if (tab.extra && !tab.extra(worker)) return false
  return true
}

export default function WorkerTabs({
  workers,
  adminUserId,
  approverNames,
}: {
  workers: Worker[]
  adminUserId: string
  approverNames?: Record<string, string>
}) {
  const [activeTab, setActiveTab] = useState('pending')
  const active = TABS.find((t) => t.key === activeTab) ?? TABS[0]
  const visible = workers.filter((w) => inTab(w, active))

  return (
    <div>
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => {
          const count = workers.filter((w) => inTab(w, t)).length
          const isActive = t.key === activeTab
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[#1F3864] text-white'
                  : 'bg-white text-[#1F3864] border border-[#1F3864] hover:bg-[#1F3864]/5'
              }`}
            >
              {t.label}
              {t.showBadge && count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${
                    isActive ? 'bg-white text-[#F97316]' : 'bg-[#F97316] text-white'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Cards */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((w) => (
            <WorkerCard
              key={w.id}
              worker={w}
              adminUserId={adminUserId}
              mode={active.mode}
              approverName={w.approved_by ? approverNames?.[w.approved_by] : null}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No workers in this category</p>
        </div>
      )}
    </div>
  )
}
