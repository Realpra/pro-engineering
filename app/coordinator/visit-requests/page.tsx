import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import VisitRequestsPanel, { type VisitRequest, type SupervisorOption } from './VisitRequestsPanel'
import DeclinedVisitsPanel, { type DeclinedSlot } from './DeclinedVisitsPanel'

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

  const [{ data: requestsRaw }, { data: supervisors }, { data: declinedRaw }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('site_visit_requests')
      .select('id, booking_ref, visit_category, requested_date, requested_slot, requested_by_role, source, notes, status, created_at')
      .order('created_at', { ascending: false }),
    // supervisor_daily_routes.supervisor_id is a workers.id (confirmed
    // throughout app/supervisor/*, e.g. route/page.tsx's own workerRecord
    // lookup), NOT users.id -- this query previously sourced from `users`
    // (platform_role='supervisor'), so scheduleVisitRequest's insert below
    // would have silently written a users.id into a column every other
    // Supervisor page reads as a workers.id, the same class of mismatch
    // already documented for app/sub-coordinator/workers/page.tsx:226. Fixed
    // to match the confirmed-correct pattern (app/coordinator/jobs/page.tsx).
    supabase.from('workers').select('id, full_name').eq('trade', 'Supervisor').eq('is_active', true).order('full_name'),
    // Project owner's rule (29 Sep 2026): a supervisor's decline stays
    // "pending" until a higher role overrides it here (DeclinedVisitsPanel).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('supervisor_daily_routes')
      .select('id, scheduled_date, slot_start, slot_end, slot_type, site_id, decline_reason, declined_at, supervisor_id')
      .eq('visit_status', 'supervisor_declined')
      .is('override_confirmed_at', null)
      .order('declined_at', { ascending: false }),
  ])

  const requests = (requestsRaw ?? []) as VisitRequest[]
  const declinedSlots = (declinedRaw ?? []) as DeclinedSlot[]
  const bookingRefs = Array.from(new Set(requests.map(r => r.booking_ref)))

  const { data: jobs } = bookingRefs.length > 0
    ? await supabase.from('guest_enquiries').select('booking_ref, job_title, contact_name, zone, district').in('booking_ref', bookingRefs)
    : { data: [] }

  const jobMap = Object.fromEntries((jobs ?? []).map(j => [j.booking_ref, j]))

  const declinedSiteIds = Array.from(new Set(declinedSlots.map(s => s.site_id).filter((v): v is string => Boolean(v))))
  const { data: declinedSites } = declinedSiteIds.length > 0
    ? await supabase.from('guest_enquiries').select('id, booking_ref').in('id', declinedSiteIds)
    : { data: [] }
  const bookingRefBySiteId = Object.fromEntries((declinedSites ?? []).map(j => [j.id, j.booking_ref]))

  const supervisorNameById = Object.fromEntries((supervisors ?? []).map(s => [s.id, s.full_name ?? 'Supervisor']))

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

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-10 space-y-5">
        <DeclinedVisitsPanel
          slots={declinedSlots}
          bookingRefBySiteId={bookingRefBySiteId}
          supervisorNameById={supervisorNameById}
          overriddenByUserId={user.id}
        />
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
