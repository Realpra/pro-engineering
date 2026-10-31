import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../../dashboard/SignOutButton'
import ApprovalActions from './ApprovalActions'
import { isVisitRole } from '@/lib/visitRoles'

// PENDING #25 -- see actions.ts for full context. Every "Review & Approve"
// link across Dashboard/Approvals/Inspections already points here; this is
// the real page that was missing.
export default async function SupervisorApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!isVisitRole(profile?.platform_role)) redirect('/login')

  const { data: substage } = await supabase
    .from('job_milestone_substages')
    .select(`id, substage_code, substage_name, milestone_code, trade_type, booking_ref,
      status, completion_pct, is_critical_path, supervisor_submitted_at,
      site_checklist, site_evidence_checklist, site_evidence_submitted,
      substage_approval_status, substage_approved_at, substage_rejection_reason`)
    .eq('id', id)
    .maybeSingle()

  if (!substage) notFound()

  const checklist = (substage.site_checklist as { label?: string; item?: string; checked?: boolean }[]) ?? []
  const evidence = (substage.site_evidence_checklist as { label?: string; item?: string }[]) ?? []
  const evidenceSubmitted = (substage.site_evidence_submitted as (string | boolean | null)[]) ?? []
  const alreadyDecided = substage.substage_approval_status === 'approved' || substage.substage_approval_status === 'rejected'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/supervisor/approvals" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">{substage.substage_code} · {substage.booking_ref}</p>
            <p className="text-white font-bold text-sm leading-tight truncate">{substage.substage_name}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-gray-400">Milestone</p><p className="font-semibold">{substage.milestone_code}</p></div>
            <div><p className="text-gray-400">Trade</p><p className="font-semibold">{substage.trade_type}</p></div>
            <div><p className="text-gray-400">Progress</p><p className="font-semibold">{substage.completion_pct ?? 0}%</p></div>
            <div><p className="text-gray-400">Status</p><p className="font-semibold capitalize">{substage.status?.replace('_', ' ')}</p></div>
          </div>
          {substage.is_critical_path && (
            <p className="text-xs font-bold text-red-500 mt-2">🔴 Critical Path — delay shifts handover date</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Submitted by Site Head: {substage.supervisor_submitted_at
              ? new Date(substage.supervisor_submitted_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
        </div>

        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Site Checklist</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {checklist.map((c, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-700">{c.label ?? c.item ?? `Item ${i + 1}`}</p>
                <span className={`text-xs font-bold ${c.checked ? 'text-green-600' : 'text-gray-300'}`}>{c.checked ? '✓' : '—'}</span>
              </div>
            ))}
            {checklist.length === 0 && <div className="px-5 py-5 text-center"><p className="text-gray-400 text-sm">No checklist items recorded</p></div>}
          </div>
        </section>

        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Evidence Submitted</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {evidence.map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-700">{e.label ?? e.item ?? `Evidence ${i + 1}`}</p>
                <span className={`text-xs font-bold ${evidenceSubmitted[i] ? 'text-green-600' : 'text-gray-300'}`}>
                  {evidenceSubmitted[i] ? '✓ Uploaded' : '— Missing'}
                </span>
              </div>
            ))}
            {evidence.length === 0 && <div className="px-5 py-5 text-center"><p className="text-gray-400 text-sm">No evidence items recorded</p></div>}
          </div>
        </section>

        {alreadyDecided ? (
          <div className={`rounded-2xl px-5 py-4 text-center ${substage.substage_approval_status === 'approved' ? 'bg-green-50 border border-green-300' : 'bg-gray-100 border border-gray-300'}`}>
            <p className={`text-sm font-bold ${substage.substage_approval_status === 'approved' ? 'text-green-700' : 'text-gray-600'}`}>
              {substage.substage_approval_status === 'approved' ? '✓ Approved — passed to Sub-Coordinator' : '↩ Sent Back'}
            </p>
            {substage.substage_rejection_reason && (
              <p className="text-xs text-gray-500 mt-1">{substage.substage_rejection_reason}</p>
            )}
          </div>
        ) : (
          <ApprovalActions substageId={substage.id} supervisorUserId={user.id} />
        )}

      </main>
    </div>
  )
}
