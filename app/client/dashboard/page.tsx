import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientDashboard from './ClientDashboard'

export default async function ClientDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Prefer full_name from public.users (keyed by id = auth user id, not email)
  const { data: userRecord } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const clientName =
    userRecord?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'Client'

  // Most recent active booking for this client — guest_enquiries links via contact_email
  const { data: booking } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district, status, service_model, created_at, preferred_start_date, contact_email, contact_name')
    .eq('contact_email', user.email)
    .not('status','in','(cancelled,completed)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  console.log('[client-dashboard] user:', user.email, 'booking:', booking?.booking_ref, 'status:', booking?.status)

  const bookingRef = booking?.booking_ref ?? null

  const [boqResult, responseResult, milestoneResult] = await Promise.all([
    bookingRef
      ? supabase
          .from('boq_generated')
          .select('*')
          .eq('booking_ref', bookingRef)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    bookingRef
      ? supabase
          .from('estimate_client_responses')
          .select('id, response_type, overall_remarks, responded_at')
          .eq('booking_ref', bookingRef)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; response_type: string; overall_remarks: string | null; responded_at: string }[] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookingRef
      ? (supabase as any)
          .from('milestone_payment_schedule')
          .select('milestone_code, milestone_name, payment_percent, payment_amount, trigger_condition, evidence_required, status')
          .eq('booking_ref', bookingRef)
          .order('milestone_number', { ascending: true })
      : Promise.resolve({ data: null }),
  ])

  console.log('[client-dashboard] boq:', boqResult.data?.id, 'lines:', boqResult.data?.line_items?.length)

  return (
    <ClientDashboard
      booking={booking ?? null}
      boq={boqResult.data ?? null}
      responseHistory={responseResult.data ?? []}
      clientName={clientName}
      milestoneSchedule={milestoneResult.data ?? null}
    />
  )
}
