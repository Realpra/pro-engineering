import { createClient } from '@/lib/supabase/server'
import ClientPaymentPage from './ClientPaymentPage'

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { booking_ref } = await searchParams
  const bookingRef = Array.isArray(booking_ref) ? booking_ref[0] : booking_ref

  const supabase = await createClient()

  const [bookingResult, boqResult, milestoneResult] = await Promise.all([
    bookingRef
      ? supabase.from('guest_enquiries').select('*').eq('booking_ref', bookingRef).single()
      : Promise.resolve({ data: null }),
    bookingRef
      ? supabase
          .from('boq_generated')
          .select('*')
          .eq('booking_ref', bookingRef)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookingRef
      ? (supabase as any)
          .from('milestone_payment_schedule')
          .select('*')
          .eq('booking_ref', bookingRef)
          .eq('milestone_code', 'M0')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <ClientPaymentPage
      booking={bookingResult.data}
      boq={boqResult.data}
      milestone={milestoneResult.data}
    />
  )
}
