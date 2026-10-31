import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InstructionForm from './InstructionForm'
import { isVisitRole } from '@/lib/visitRoles'

export default async function SupervisorInstructionPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; substage?: string }>
}) {
  const { site, substage } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!isVisitRole(profile?.platform_role)) redirect('/login')

  let siteInchargeRecipient: { id: string; name: string } | null = null
  if (site) {
    const { data: enquiry } = await supabase
      .from('guest_enquiries')
      .select('site_incharge_id')
      .eq('booking_ref', site)
      .maybeSingle()
    if (enquiry?.site_incharge_id) {
      const { data: worker } = await supabase
        .from('workers')
        .select('auth_user_id, full_name')
        .eq('id', enquiry.site_incharge_id)
        .maybeSingle()
      if (worker?.auth_user_id) {
        siteInchargeRecipient = { id: worker.auth_user_id, name: worker.full_name ?? 'Site Incharge' }
      }
    }
  }

  const { data: subCoordinators } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('platform_role', 'sub_coordinator')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Send Instruction</p>
          <p className="text-white font-bold text-sm leading-tight">{site ?? 'No job selected'}</p>
        </div>
      </header>
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        {site ? (
          <InstructionForm
            bookingRef={site}
            substageCode={substage ?? null}
            supervisorUserId={user.id}
            siteIncharge={siteInchargeRecipient}
            subCoordinators={(subCoordinators ?? []).map(s => ({ id: s.id, name: s.full_name ?? 'Sub-Coordinator' }))}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">No job selected. Open this from a Critical Path Alert or Inspection.</p>
          </div>
        )}
      </main>
    </div>
  )
}
