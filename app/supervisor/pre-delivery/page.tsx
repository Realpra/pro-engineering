import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import PreDeliveryForm from './PreDeliveryForm'
import { isVisitRole } from '@/lib/visitRoles'

export default async function PreDeliveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!isVisitRole(profile?.platform_role)) redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Supervisor'

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: completedJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('id, booking_ref, job_title, job_type')
        .eq('supervisor_id', workerRecord.id)
        .eq('status', 'milestone_review')
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/supervisor/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Pre-Delivery Assessment</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <p className="text-white font-bold text-sm mb-1">Pre-Delivery Inspection</p>
          <p className="text-xs text-blue-200">
            Inspect jobs awaiting handover, log snags, and flag conditional or blocked clearances to admin.
          </p>
        </div>

        {workerRecord ? (
          <PreDeliveryForm supervisorId={workerRecord.id} jobs={completedJobs ?? []} />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-8 text-center">
            <p className="text-gray-500 text-sm">No worker record linked to this account.</p>
          </div>
        )}
      </main>
    </div>
  )
}
