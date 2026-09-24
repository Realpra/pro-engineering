import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteSurveyManager from './SiteSurveyManager'

// Flow (i) SITE SURVEY -- one-time, pre-estimate visit. See CLAUDE.md's
// PROCESS FLOW section and docs/SITE_VISIT_REBUILD_SPEC.md for why this is a
// separate route/flow from /supervisor/site-visit (Flow ii, the repeatable
// daily execution visit).
//
// Eligible roles today: supervisor, site_incharge -- both have a workers row
// (looked up by auth_user_id) that saveScreen/initReport use as "who filled
// this". admin/coordinator/sub_coordinator/superadmin were named by the
// project owner as roles that CAN be deputed for a survey, but none of them
// currently have a workers row in this codebase -- extending this page to
// them needs a decision on how to identify "who filled this" for a role with
// no workers profile (give them one, or move the actions off workers.id onto
// users.id) rather than guessing it here.
const ELIGIBLE_ROLES = ['supervisor', 'site_incharge']

export default async function SiteSurveyPage({
  params,
}: {
  params: Promise<{ bookingRef: string }>
}) {
  const { bookingRef } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !ELIGIBLE_ROLES.includes(profile.platform_role)) redirect('/login')

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!workerRecord) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <p className="text-gray-700 font-semibold mb-2">No worker profile found</p>
        <p className="text-gray-500 text-sm">
          Your account ({profile.platform_role}) has no linked worker record, so a
          site survey can&apos;t be attributed to you yet.
        </p>
      </div>
    )
  }

  const { data: enquiry } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district, contact_name, status')
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  if (!enquiry) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <p className="text-gray-700 font-semibold">Booking not found</p>
      </div>
    )
  }

  const { data: labourRateConfig } = await supabase
    .from('labour_rate_config')
    .select('activity, output_per_mason_per_day, curing_days_after, is_curing_locked, sequence_order, notes')

  const { data: existingReport } = await supabase
    .from('site_visit_reports')
    .select('id, status, submitted_at')
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  if (existingReport?.status === 'submitted') {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <p className="text-gray-700 font-semibold mb-2">Survey already submitted</p>
        <p className="text-gray-500 text-sm mb-6">
          The site survey for {bookingRef} was submitted
          {existingReport.submitted_at ? ` on ${new Date(existingReport.submitted_at).toLocaleDateString('en-GB')}` : ''}.
        </p>
        <Link href="/supervisor/dashboard" className="text-blue-600 text-sm font-semibold underline">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <SiteSurveyManager
      supervisorId={workerRecord.id}
      bookingRef={enquiry.booking_ref}
      jobTitle={enquiry.job_title ?? ''}
      jobType={enquiry.job_type ?? ''}
      zone={enquiry.zone ?? ''}
      district={enquiry.district ?? ''}
      clientName={enquiry.contact_name ?? ''}
      existingReportId={existingReport?.id ?? null}
      labourRateConfig={labourRateConfig ?? []}
    />
  )
}
