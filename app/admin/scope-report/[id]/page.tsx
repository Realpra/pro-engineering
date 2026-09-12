import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ScopeReportView from './ScopeReportView'

export default async function ScopeReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: report, error } = await supabase
    .from('site_visit_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !report) notFound()

  // Parallel fetches: job, supervisor, reviews, submissions, auth user
  const [jobResult, workerResult, reviewsResult, submissionsResult, authResult] = await Promise.all([
    supabase
      .from('guest_enquiries')
      .select('booking_ref, job_title, zone, district, job_type')
      .eq('booking_ref', report.booking_ref)
      .maybeSingle(),
    supabase
      .from('workers')
      .select('id, full_name')
      .eq('id', report.supervisor_id)
      .maybeSingle(),
    supabase
      .from('report_reviews')
      .select('*')
      .eq('report_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('report_submissions')
      .select('*')
      .eq('report_id', id)
      .order('created_at', { ascending: true }),
    supabase.auth.getUser(),
  ])

  const job = jobResult.data
  const supervisor = workerResult.data
  const existingReviews = reviewsResult.data ?? []
  const submissions = submissionsResult.data ?? []

  // Resolve current user role from public.users via email
  let userRole: string | null = null
  let userId: string | null = null
  const authUser = authResult.data?.user
  if (authUser?.email) {
    const { data: userData } = await supabase
      .from('users')
      .select('platform_role, id')
      .eq('email', authUser.email)
      .single()
    userRole = userData?.platform_role ?? null
    userId = userData?.id ?? null
  }

  function fmtDateTime(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  const riskCount: number = (report as Record<string, unknown>).risk_flag_count as number ?? 0

  const reviewStatusLabel =
    (report as Record<string, unknown>).review_status === 'approved_for_estimate' ? 'Approved' :
    (report as Record<string, unknown>).review_status === 'returned_for_correction' ? 'Returned' :
    (report as Record<string, unknown>).review_status === 'coordinator_review' ? 'Coordinator Review' :
    (report as Record<string, unknown>).review_status === 'admin_review' ? 'Admin Review' :
    'Under Review'

  const reviewStatusClass =
    (report as Record<string, unknown>).review_status === 'approved_for_estimate' ? 'bg-green-400 text-green-900' :
    (report as Record<string, unknown>).review_status === 'returned_for_correction' ? 'bg-red-400 text-white' :
    (report as Record<string, unknown>).review_status === 'coordinator_review' ? 'bg-blue-300 text-blue-900' :
    (report as Record<string, unknown>).review_status === 'admin_review' ? 'bg-purple-300 text-purple-900' :
    'bg-amber-400 text-amber-900'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-[#1F3864] text-white px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/admin/dashboard" className="text-xs text-blue-200 hover:text-white mb-3 inline-block">
            ← Admin Dashboard / Scope Reports
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                  {String((report as Record<string, unknown>).booking_ref ?? '')}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${reviewStatusClass}`}>
                  {reviewStatusLabel}
                </span>
                {userRole && (
                  <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                    Viewing as: {userRole}
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold">
                {job?.job_title ?? 'Site Visit Report'}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-blue-200">
                {job?.zone && <span>{job.zone}{job.district ? `, ${job.district}` : ''}</span>}
                {supervisor?.full_name && <span>Supervisor: {supervisor.full_name}</span>}
                {(report as Record<string, unknown>).submitted_at && (
                  <span>Submitted: {fmtDateTime((report as Record<string, unknown>).submitted_at as string)}</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-blue-200 uppercase tracking-wide">Risk Flags</p>
              <p className={`text-2xl font-bold ${riskCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {riskCount}
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Link
              href={`/admin/estimate/${(report as Record<string, unknown>).booking_ref}`}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold border border-white/20 transition-colors"
            >
              Generate Estimate
            </Link>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Job Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[#1F3864] text-white">
            <p className="font-bold text-sm">Job Details</p>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            {[
              { label: 'Booking Ref', value: String((report as Record<string, unknown>).booking_ref ?? '—') },
              { label: 'Job Type', value: job?.job_type ?? '—' },
              { label: 'Zone', value: job?.zone ?? '—' },
              { label: 'District', value: job?.district ?? '—' },
              { label: 'Supervisor', value: supervisor?.full_name ?? '—' },
              { label: 'Screen Progress', value: `${(report as Record<string, unknown>).screen_progress ?? 0}/20` },
              { label: 'Report Created', value: fmtDateTime((report as Record<string, unknown>).created_at as string) },
              { label: 'Submitted', value: fmtDateTime((report as Record<string, unknown>).submitted_at as string) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <ScopeReportView
          report={report}
          job={job}
          supervisor={supervisor}
          userRole={userRole}
          userId={userId}
          existingReviews={existingReviews}
          submissions={submissions}
        />
      </div>
    </div>
  )
}
