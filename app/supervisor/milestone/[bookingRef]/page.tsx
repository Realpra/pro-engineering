export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MilestoneEvidencePage from './MilestoneEvidencePage'

export default async function Page({
  params,
}: {
  params: Promise<{ bookingRef: string }>
}) {
  const { bookingRef } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supervisor/login')

  const { data: worker } = await supabase
    .from('workers')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestones } = await (supabase as any)
    .from('milestone_payment_schedule')
    .select('*')
    .eq('booking_ref', bookingRef)
    .order('milestone_number')

  const { data: booking } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, status, contact_name')
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  return (
    <MilestoneEvidencePage
      booking={booking}
      milestones={milestones ?? []}
      worker={worker}
      bookingRef={bookingRef}
    />
  )
}
