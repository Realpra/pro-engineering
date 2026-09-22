import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ClientDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/client/login')

  const { data: bookings } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, zone, status, created_at, contact_name')
    .eq('client_user_id', user.id)
    .order('created_at', { ascending: false })

  if (!bookings || bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="text-[#1F3864] font-bold text-xl mb-4">PRO ENGINEERING</div>
          <div className="text-gray-800 font-semibold text-lg mb-2">No Project Found</div>
          <div className="text-gray-500 text-sm mb-6">We could not find any projects linked to your account. Please contact your coordinator.</div>
          <a href="/" className="text-[#1F3864] text-sm font-medium underline">Go to Home</a>
        </div>
      </div>
    )
  }

  if (bookings.length === 1) {
    redirect('/client/dashboard/' + bookings[0].booking_ref)
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    new: { label: 'New', color: 'bg-gray-100 text-gray-600' },
    confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
    site_visit: { label: 'Site Visit', color: 'bg-purple-100 text-purple-700' },
    estimate_sent: { label: 'Estimate Sent', color: 'bg-yellow-100 text-yellow-700' },
    estimate_accepted: { label: 'Estimate Accepted', color: 'bg-green-100 text-green-700' },
    in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Completed', color: 'bg-gray-100 text-gray-500' },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] py-6 px-4">
        <div className="text-white font-bold text-xl text-center">PRO ENGINEERING</div>
        <div className="text-blue-200 text-sm text-center mt-1">Select Your Project</div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-[#1F3864] font-bold text-lg mb-4">Your Projects</div>
        {bookings.map((booking) => {
          const status = statusConfig[booking.status] ?? { label: booking.status, color: 'bg-gray-100 text-gray-600' }
          return (
            <Link
              key={booking.booking_ref}
              href={'/client/dashboard/' + booking.booking_ref}
              className="block bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-[#1F3864] font-bold text-sm">{booking.booking_ref}</div>
                  <div className="text-gray-800 font-semibold text-base mt-1">{booking.job_title || 'Renovation Project'}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {booking.zone && (
                      <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {booking.zone}
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
                <div className="text-gray-400 text-xl ml-4">→</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
