import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AllocationPanel, { type Substage, type WorkerOption, type ExistingSlot, type Escalation } from './AllocationPanel'

export default async function CoordinatorAllocatePage({
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

  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) redirect('/login')

  const { data: job } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, zone, district')
    .eq('booking_ref', bookingRef)
    .maybeSingle()
  if (!job) notFound()

  const [{ data: substagesData }, { data: workersData }, { data: slotsData }, { data: escalationsData }] = await Promise.all([
    supabase
      .from('job_milestone_substages')
      .select('id, substage_code, substage_name, milestone_code, trade_type, skilled_workers_per_day, unskilled_workers_per_day, planned_day, early_start_date, early_finish_date, status')
      .eq('booking_ref', bookingRef)
      .order('sequence_order', { ascending: true }),
    supabase
      .from('workers')
      .select('id, full_name, trade, skill_level, zones, daily_wage_inr, is_available')
      .eq('is_active', true)
      .eq('approval_status', 'admin_approved')
      .order('daily_wage_inr', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('worker_day_slots')
      .select('worker_id, slot_date, substage_code, status')
      .eq('booking_ref', bookingRef),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('worker_allocation_escalations')
      .select('id, substage_id, trade, skill_level_needed, remark, status, raised_at')
      .eq('booking_ref', bookingRef)
      .eq('status', 'pending'),
  ])

  const substages = (substagesData ?? []) as Substage[]
  const workers = (workersData ?? []) as WorkerOption[]
  const existingSlots = (slotsData ?? []) as ExistingSlot[]
  const escalations = (escalationsData ?? []) as Escalation[]

  const workerNameById = Object.fromEntries(workers.map(w => [w.id, w.full_name]))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/coordinator/jobs" className="text-white/80 hover:text-white shrink-0" aria-label="Back to jobs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Allocate Workers</h1>
            <p className="text-blue-200 text-xs">{bookingRef} — {job.job_title ?? ''} — {[job.zone, job.district].filter(Boolean).join(', ')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <AllocationPanel
          bookingRef={bookingRef}
          zone={job.zone}
          substages={substages}
          workers={workers}
          existingSlots={existingSlots}
          escalations={escalations}
          workerNameById={workerNameById}
        />
      </main>
    </div>
  )
}
