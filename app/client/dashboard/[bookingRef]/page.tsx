import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ClientDashboard from './ClientDashboard'

function AccessCard({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#1F3864] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        <h1 className="text-[#1F3864] text-2xl font-bold">PRO ENGINEERING</h1>
        <p className="text-gray-600 text-sm mt-4">{message}</p>
        <Link
          href="/client/login"
          className="inline-block mt-6 bg-[#1F3864] text-white font-bold px-6 py-3 rounded-xl"
        >
          Go to Login
        </Link>
      </div>
    </div>
  )
}

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ bookingRef: string }>
}) {
  const { bookingRef } = await params

  const supabase = await createClient()

  let accessGranted = false

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    const { data: match } = await supabase
      .from('guest_enquiries')
      .select('id')
      .eq('client_user_id', session.user.id)
      .eq('booking_ref', bookingRef)
      .maybeSingle()

    accessGranted = !!match
  }

  if (!accessGranted) {
    return <AccessCard message="Please sign in to view this dashboard." />
  }

  const [
    { data: enquiryData },
    { data: boqData },
    { data: milestonesData },
    { data: substagesData },
    { data: responseData },
    { data: scopeChangesData },
  ] = await Promise.all([
    supabase.from('guest_enquiries').select('*').eq('booking_ref', bookingRef).single(),
    supabase
      .from('boq_generated')
      .select('*')
      .eq('booking_ref', bookingRef)
      .neq('status', 'draft')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('milestone_payment_schedule')
      .select('*')
      .eq('booking_ref', bookingRef)
      .order('milestone_number', { ascending: true }),
    supabase
      .from('job_milestone_substages')
      .select('*')
      .eq('booking_ref', bookingRef)
      .order('milestone_code')
      .order('planned_day'),
    supabase
      .from('estimate_client_responses')
      .select('*')
      .eq('booking_ref', bookingRef)
      .order('responded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Execution-stage scope changes Admin has approved -- the client's own
    // decision on each (client_acceptance) is what actually triggers the
    // merge into the main estimate, see submitScopeChangeClientDecision.
    supabase
      .from('scope_change_requests')
      .select('*')
      .eq('booking_ref', bookingRef)
      .eq('admin_decision', 'approved')
      .order('admin_decided_at', { ascending: false }),
  ])

  if (!enquiryData) {
    return <AccessCard message="Booking not found." />
  }

  // There is no per-job Coordinator assignment anywhere in the live schema
  // (Coordinator has universal, unscoped access to every job -- confirmed
  // Session 59) -- only Supervisor is a real per-job FK on guest_enquiries.
  const { data: supervisor } = enquiryData.supervisor_id
    ? await supabase.from('workers').select('full_name').eq('id', enquiryData.supervisor_id).single()
    : { data: null as { full_name: string } | null }

  if (!boqData) {
    return (
      <div className="min-h-screen bg-[#1F3864] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <h1 className="text-[#1F3864] text-2xl font-bold">PRO ENGINEERING</h1>
          <p className="text-gray-600 text-sm mt-4">
            Your estimate is being prepared by your coordinator. Please check back soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ClientDashboard
      enquiry={enquiryData}
      boq={boqData}
      milestones={milestonesData ?? []}
      substages={substagesData ?? []}
      clientResponse={responseData ?? null}
      supervisor={supervisor ?? null}
      scopeChanges={scopeChangesData ?? []}
    />
  )
}
