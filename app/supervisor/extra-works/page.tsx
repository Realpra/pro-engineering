import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import ExtraWorksForm from './ExtraWorksForm'
import { isVisitRole } from '@/lib/visitRoles'

export default async function ExtraWorksPage() {
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

  const { data: activeJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('id, booking_ref, job_title, job_type, zone, district')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Extra Works</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* INFO */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <p className="text-white font-bold text-sm mb-1">Extra Works & Client Requests</p>
          <div className="space-y-1 text-xs text-blue-200">
            <p>• Safety arisisings — escalate immediately to Coordinator</p>
            <p>• Client requests — Trigger B → Trade Skill Head → Coordinator → Client</p>
            <p>• Supervisor technical recommendation — Trigger A → same chain</p>
            <p>• Original baseline stays active until client accepts change</p>
          </div>
        </div>

        {workerRecord ? (
          <ExtraWorksForm supervisorId={workerRecord.id} jobs={activeJobs ?? []} />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-8 text-center">
            <p className="text-gray-500 text-sm">No worker record linked to this account.</p>
          </div>
        )}

        {/* ROUTING INFO */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Approval Routing
          </p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-green-700 mb-2">Trigger A — Supervisor Technical Recommendation</p>
              <p className="text-xs text-gray-600">Supervisor → Trade Skill Head → Coordinator → Client (YES/NO)</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-yellow-700 mb-2">Trigger B — Client Demand</p>
              <p className="text-xs text-gray-600">Client (via app) → Trade Skill Head → Coordinator → Client (YES/NO)</p>
            </div>
            <div className="px-5 py-3 bg-gray-50">
              <p className="text-xs text-gray-500">Both paths converge at Trade Skill Head assessment</p>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}