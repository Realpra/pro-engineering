import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import VisitRequestsPanel, { type VisitRequest, type SupervisorOption } from './VisitRequestsPanel'

export default async function VisitRequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Coordinator'
  const loggedByRole: 'coordinator' | 'admin' = profile?.platform_role === 'coordinator' ? 'coordinator' : 'admin'

  const [{ data: requestsRaw }, { data: supervisors }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('site_visit_requests')
      .select('id, booking_ref, visit_category, requested_date, requested_slot, requested_by_role, source, notes, status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('users').select('id, full_name').eq('platform_role', 'supervisor').order('full_name'),
  ])

  const requests = (requestsRaw ?? []) as VisitRequest[]
  const bookingRefs = Array.from(new Set(requests.map(r => r.booking_ref)))

  const { data: jobs } = bookingRefs.length > 0
    ? await supabase.from('guest_enquiries').select('booking_ref, job_title, contact_name, zone, district').in('booking_ref', bookingRefs)
    : { data: [] }

  const jobMap = Object.fromEntries((jobs ?? []).map(j => [j.booking_ref, j]))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/coordinator/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Visit Requests</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-10">
        <VisitRequestsPanel
          requests={requests}
          jobMap={jobMap}
          supervisors={(supervisors ?? []) as SupervisorOption[]}
          loggedByUserId={user.id}
          loggedByRole={loggedByRole}
        />
      </main>
    </div>
  )
}
