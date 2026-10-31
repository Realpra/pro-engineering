import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import WorkerTabs from './WorkerTabs'
import type { Worker } from './WorkerCard'
import { AWAITING_ADMIN_STATUSES } from '@/lib/workerApprovalStatus'

export default async function AdminWorkersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'admin') redirect('/admin/dashboard')

  const { data: workersData } = await supabase
    .from('workers')
    .select('*')
    .order('created_at', { ascending: false })

  const workers = (workersData ?? []) as Worker[]
  const adminUserId = user.id
  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  const { data: usersData } = await supabase.from('users').select('id, full_name')
  const approverNames: Record<string, string> = {}
  for (const u of usersData ?? []) {
    if (u.id && u.full_name) approverNames[u.id] = u.full_name
  }

  const countBy = (statuses: string[]) =>
    workers.filter((w) => w.approval_status != null && statuses.includes(w.approval_status)).length

  // "Previously Approved" repointed from the dead legacy 'approved' value
  // (never written by any live code, confirmed PENDING #37) to the real
  // renewal-flag overlay built alongside this chain -- an admin_approved
  // worker flagged for a pending safety-license/certificate renewal.
  const adminApprovedWorkers = workers.filter((w) => w.approval_status === 'admin_approved')
  const renewalFlaggedCount = adminApprovedWorkers.filter((w) => !!w.admin_renewal_flag_reason).length

  const stats: { label: string; count: number; className: string }[] = [
    { label: 'Pending Approval', count: countBy(AWAITING_ADMIN_STATUSES), className: 'text-[#F97316]' },
    { label: 'Admin Approved', count: adminApprovedWorkers.length - renewalFlaggedCount, className: 'text-green-600' },
    { label: 'Flagged for Renewal', count: renewalFlaggedCount, className: 'text-teal-600' },
    { label: 'Returned / Rejected', count: countBy(['returned_for_correction', 'returned_to_subcoordinator', 'rejected']), className: 'text-red-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <header className="bg-[#1F3864]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="text-white/80 hover:text-white shrink-0"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Workers</h1>
            <p className="text-blue-200 text-xs">Final approval gate</p>
          </div>
          <p className="text-blue-200 text-xs shrink-0">{adminName}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <p className={`text-2xl font-bold ${s.className}`}>{s.count}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <WorkerTabs workers={workers} adminUserId={adminUserId} approverNames={approverNames} />
      </main>
    </div>
  )
}
