import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'

// This page was a confirmed fully-dead mockup (PENDING #26, reconfirmed by
// a full read this pass): every input uncontrolled, every button with no
// onClick, and no `scope_verification`-shaped table exists anywhere --
// live-only or migrated -- to have ever backed it.
//
// Per the schema-freeze methodology's step 4 ("if two things serve the
// same concept, keep one, don't let the other pass into the frozen
// contract"): this form's real content -- itemised scope of work, site
// visit verification, HQ estimate confirm/revise -- is the SAME concept
// the already-built, already-frozen Flow (i) Site Survey
// (/site-survey/[bookingRef], site_visit_reports) already covers with
// real structured fields and real persistence, plus generateBOQ for the
// estimate side. Dashboard even linked to both for the same job side by
// side. Rather than inventing a second, competing persistence layer for
// content already properly captured elsewhere (exactly how the worker-
// routing triplication and estimates/boq_generated duplication happened
// per this project's own history), this is rebuilt as a real status/entry
// page into the one already-frozen flow instead of a duplicate form.
export default async function ScopeVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'supervisor') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Supervisor'

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: activeJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('id, booking_ref, job_title, job_type, zone, district, status, address_line')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)
  const { data: surveys } = bookingRefs.length > 0
    ? await supabase
        .from('site_visit_reports')
        .select('booking_ref, status, submitted_at')
        .in('booking_ref', bookingRefs)
        .eq('report_type', 'site_survey')
    : { data: [] }
  const surveyByBooking = Object.fromEntries((surveys ?? []).map(s => [s.booking_ref, s]))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/supervisor/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Scope Surveys</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-xs text-blue-700">
            Scope of work, site verification, and estimate review all happen inside the Site Survey
            form for each job -- the single real place this data is captured and used downstream by
            BOQ generation. This page is your entry point into that, per job.
          </p>
        </div>

        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active Jobs</p>
          {(activeJobs ?? []).length > 0 ? (
            <div className="space-y-3">
              {(activeJobs ?? []).map(job => {
                const survey = surveyByBooking[job.booking_ref]
                const highlighted = ref === job.booking_ref
                return (
                  <div
                    key={job.booking_ref}
                    className={`bg-white rounded-2xl border shadow-sm px-5 py-4 ${highlighted ? 'border-[#2E74B5]' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 font-medium">{job.booking_ref}</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">{job.job_title ?? 'Active Job'}</p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {job.job_type} · {[job.zone, job.district].filter(Boolean).join(', ')}
                        </p>
                        {job.address_line && <p className="text-xs text-gray-400 mt-0.5">📍 {job.address_line}</p>}
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full border ${
                        survey?.status === 'submitted' ? 'bg-green-100 text-green-700 border-green-300'
                        : survey ? 'bg-orange-100 text-orange-700 border-orange-300'
                        : 'bg-gray-100 text-gray-500 border-gray-300'
                      }`}>
                        {survey?.status === 'submitted' ? '✓ Survey Submitted' : survey ? 'Survey In Progress' : 'Not Started'}
                      </span>
                    </div>
                    <Link
                      href={`/site-survey/${job.booking_ref}`}
                      className="block w-full bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl text-center"
                    >
                      {survey?.status === 'submitted' ? 'View Site Survey →' : survey ? 'Continue Site Survey →' : 'Start Site Survey →'}
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
              <p className="text-gray-400 text-sm">No active jobs assigned</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
