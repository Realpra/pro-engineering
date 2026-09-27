import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportForm from './ReportForm'

const LABELS: Record<string, string> = {
  method: 'Method Improvement Proposal',
  payment: 'Payment Policy Proposal',
  execution: 'Method of Execution Report',
  methodology: 'Methodology Report',
  site: 'Special Site Report',
  safety: 'Safety Critical Report',
}

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.platform_role !== 'supervisor') redirect('/login')

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: activeJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('booking_ref, job_title')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
    : { data: [] }

  const reportType = type && LABELS[type] ? type : 'site'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">New Report</p>
          <p className="text-white font-bold text-sm leading-tight">{LABELS[reportType]}</p>
        </div>
      </header>
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        <ReportForm
          reportType={reportType}
          reportLabel={LABELS[reportType]}
          supervisorUserId={user.id}
          activeJobs={activeJobs ?? []}
        />
      </main>
    </div>
  )
}
