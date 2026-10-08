import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ChecklistPanel from './ChecklistPanel'
import EvidenceUpload from './EvidenceUpload'
import { updateSubstageStatus } from './actions'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function SubstageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'site_incharge') redirect('/login')

  const { data: sub } = await supabase
    .from('job_milestone_substages')
    .select('*')
    .eq('id', id)
    .single()

  if (!sub) notFound()

  // Get checklist templates for this substage
  const { data: templates } = await supabase
    .from('substage_checklist_templates')
    .select('item_text, item_type, trade_type, substage_code')
    .or(`substage_code.eq.${sub.substage_code},and(substage_code.is.null,trade_type.eq.${sub.trade_type}),and(substage_code.is.null,trade_type.is.null)`)
    .eq('is_active', true)
    .order('sequence_order', { ascending: true })

  // Build checklist merging templates with saved state
  const savedChecklist = (sub.site_checklist as any[]) ?? []
  const checklist = (templates ?? []).map(t => {
    const saved = savedChecklist.find((s: any) => s.item === t.item_text && s.type === t.item_type)
    return {
      item: t.item_text,
      type: t.item_type,
      checked: saved?.checked ?? false,
      checked_by: saved?.checked_by ?? null,
      checked_at: saved?.checked_at ?? null,
    }
  })

  const evidenceChecklist = (sub.site_evidence_checklist as any[]) ?? []
  const isCritical = sub.is_critical_path
  const isPartDay = sub.planned_hours && Number(sub.planned_hours) < 8
  const isMultiShift = sub.planned_hours && Number(sub.planned_hours) >= 15

  const statusColor = (s: string) => {
    if (s === 'completed') return 'bg-green-500/20 text-green-700 border-green-400/30'
    if (s === 'in_progress') return 'bg-blue-500/20 text-blue-700 border-blue-400/30'
    return 'bg-gray-100 text-gray-600 border-gray-300'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/site-incharge/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">{sub.substage_code}</p>
            <p className="text-white font-bold text-sm leading-tight truncate">{sub.milestone_code} — {sub.substage_name?.substring(0, 40)}{(sub.substage_name?.length ?? 0) > 40 ? '…' : ''}</p>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusColor(sub.status)}`}>
            {sub.status?.replace('_', ' ')}
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5 pb-8">

        {/* Critical Path Banner */}
        {isCritical && (
          <div className="bg-red-50 border border-red-300 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">🔴</span>
              <div>
                <p className="text-red-700 font-bold text-sm">CRITICAL ACTIVITY</p>
                <p className="text-red-600 text-xs mt-0.5">Must complete on time. Any delay shifts project handover date.</p>
                {sub.early_finish_date && (
                  <p className="text-red-700 font-semibold text-xs mt-1">Complete by: {formatDate(sub.early_finish_date)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Substage Details */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-[#1F3864] px-5 py-3">
            <p className="text-white font-bold text-sm">Substage Details</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 font-medium">Milestone</p>
                <p className="text-sm font-semibold text-gray-800">{sub.milestone_code}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Trade</p>
                <p className="text-sm font-semibold text-gray-800">{sub.trade_type ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Planned Day</p>
                <p className="text-sm font-semibold text-gray-800">Day {sub.planned_day}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Planned Hours</p>
                <p className="text-sm font-semibold text-gray-800">
                  {sub.planned_hours} hrs
                  {isPartDay ? ' ⚡ Part Day' : ''}
                  {isMultiShift ? ' 🔄 Multi-Shift' : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Time Slot</p>
                <p className="text-sm font-semibold text-gray-800">{sub.start_time_slot ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Skilled Workers</p>
                <p className="text-sm font-semibold text-gray-800">{sub.skilled_workers_per_day ?? '—'} per day</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Unskilled Workers</p>
                <p className="text-sm font-semibold text-gray-800">{sub.unskilled_workers_per_day ?? '—'} per day</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Float</p>
                <p className={`text-sm font-semibold ${Number(sub.float_days) === 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {sub.float_days ?? 0} days {Number(sub.float_days) === 0 ? '⚠ Zero Float' : ''}
                </p>
              </div>
            </div>

            {/* Schedule */}
            <div className="border-t border-gray-100 pt-3 space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Schedule</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Early Start</span>
                <span className="text-xs font-semibold text-gray-800">{formatDate(sub.early_start_date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Early Finish</span>
                <span className="text-xs font-semibold text-gray-800">{formatDate(sub.early_finish_date)}</span>
              </div>
              {sub.predecessor_substage_code && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Predecessor</span>
                  <span className="text-xs font-semibold text-gray-800">{sub.predecessor_substage_code} ({sub.dependency_type})</span>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</p>
                <p className="text-sm font-bold text-[#1F3864]">{sub.completion_pct ?? 0}%</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-[#2E74B5] h-2.5 rounded-full transition-all"
                  style={{ width: `${sub.completion_pct ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <ChecklistPanel
          substageId={id}
          checklist={checklist}
          userId={user.id}
        />

        {/* Evidence Upload */}
        {evidenceChecklist.length > 0 && (
          <EvidenceUpload
            substageId={id}
            evidenceChecklist={evidenceChecklist}
          />
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {sub.status === 'pending' && (
            <form action={async () => {
              'use server'
              await updateSubstageStatus(id, 'in_progress', 50)
            }}>
              <button
                type="submit"
                className="w-full bg-[#2E74B5] hover:bg-[#1F5C94] text-white font-bold py-4 px-6 rounded-2xl transition-colors shadow-sm"
              >
                Mark In Progress
              </button>
            </form>
          )}
          {(sub.status === 'pending' || sub.status === 'in_progress') && (
            <form action={async () => {
              'use server'
              await updateSubstageStatus(id, 'completed', 100)
            }}>
              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-2xl transition-colors shadow-sm"
              >
                Mark Complete
              </button>
            </form>
          )}
          {sub.status === 'completed' && (
            <div className="w-full bg-green-50 border border-green-200 text-green-700 font-bold py-4 px-6 rounded-2xl text-center">
              ✓ Completed — {sub.supervisor_submitted_at ? new Date(sub.supervisor_submitted_at).toLocaleDateString('en-GB') : ''}
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Timestamps</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Submitted</span>
            <span className="text-xs font-semibold text-gray-800">{sub.supervisor_submitted_at ? new Date(sub.supervisor_submitted_at).toLocaleString('en-GB') : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Reviewed</span>
            <span className="text-xs font-semibold text-gray-800">{sub.subcoordinator_reviewed_at ? new Date(sub.subcoordinator_reviewed_at).toLocaleString('en-GB') : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Approved</span>
            <span className="text-xs font-semibold text-gray-800">{sub.substage_approved_at ? new Date(sub.substage_approved_at).toLocaleString('en-GB') : '—'}</span>
          </div>
        </div>

      </main>
    </div>
  )
}