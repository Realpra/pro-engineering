/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isVisitRole } from '@/lib/visitRoles'
import { extractVisitFindings, mergeVisitForm, VISIT_FORM_COLUMNS } from '@/lib/visitFindings'
import CorrectiveActionsForm, { type SavedAction } from './CorrectiveActionsForm'

// Daily-visit corrective actions (owner, 31 Oct 2026, D27): a daily visit never sends the job
// back to survey; each problem it found becomes a corrective action here.
export default async function CorrectiveActionsPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  const role = profile?.platform_role ?? ''
  if (!isVisitRole(role) && role !== 'site_incharge') redirect('/login')

  const { data: report } = await supabase
    .from('site_visit_reports')
    .select(['id', 'booking_ref', 'report_type', 'submitted_at', ...VISIT_FORM_COLUMNS].join(', '))
    .eq('id', reportId)
    .maybeSingle()
  if (!report) redirect(role === 'site_incharge' ? '/site-incharge/dashboard' : '/supervisor/dashboard')

  const findings = extractVisitFindings(mergeVisitForm(report, VISIT_FORM_COLUMNS))
  const { data: saved } = await supabase
    .from('visit_corrective_actions')
    .select('id, finding_source, finding_text, action_type, direction, delay_days, delay_reason_category, recast_by, status, created_at')
    .eq('site_visit_report_id', reportId)
    .order('created_at', { ascending: true })

  const backHref = role === 'site_incharge' ? '/site-incharge/dashboard' : '/supervisor/dashboard'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={backHref} className="text-white/80 hover:text-white" aria-label="Back">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-lg leading-tight">Corrective Actions</h1>
            <p className="text-blue-200 text-xs">{report.booking_ref} · daily visit findings</p>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-gray-500">
          The job stays where it is in its work plan. For each problem found on this visit, choose what
          happens next: redo/attend (direction to the Site Head), more resources (request to the
          Coordinator), delay (you recast the milestone, or direct the Site Head to recast and send it to
          you), or another note.
        </p>
        <CorrectiveActionsForm
          reportId={reportId}
          findings={findings}
          saved={(saved ?? []) as SavedAction[]}
        />
      </main>
    </div>
  )
}
