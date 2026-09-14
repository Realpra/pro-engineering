import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientPaymentPage from './ClientPaymentPage'

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="text-[#1F3864] font-bold text-xl mb-4">PRO ENGINEERING</div>
        <div className="text-gray-800 font-semibold text-lg mb-2">{title}</div>
        <div className="text-gray-500 text-sm">{message}</div>
      </div>
    </div>
  )
}

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { booking_ref } = await searchParams
  const bookingRef = Array.isArray(booking_ref) ? booking_ref[0] : booking_ref

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/client/login')

  if (!bookingRef) {
    return <ErrorCard title="Missing Booking Reference" message="No booking reference was provided. Please return to your dashboard." />
  }

  const [bookingResult, boqResult, milestoneResult] = await Promise.all([
    supabase.from('guest_enquiries').select('*').eq('booking_ref', bookingRef).eq('client_user_id', user.id).single(),
    supabase
      .from('boq_generated')
      .select('*')
      .eq('booking_ref', bookingRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('milestone_payment_schedule')
      .select('*')
      .eq('booking_ref', bookingRef)
      .eq('milestone_code', 'M0')
      .maybeSingle(),
  ])

  if (bookingResult.error || !bookingResult.data || boqResult.error || !boqResult.data || milestoneResult.error || !milestoneResult.data) {
    return <ErrorCard title="Unable to Load Payment Details" message="We could not find this booking or its payment details. Please contact your coordinator." />
  }

  return (
    <ClientPaymentPage
      booking={bookingResult.data}
      boq={boqResult.data}
      milestone={milestoneResult.data}
    />
  )
}
