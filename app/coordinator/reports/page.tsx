import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function CoordinatorReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'coordinator') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Coordinator'

  // Fetch site instructions sent TO coordinator (reports from supervisor/sub-coordinator).
  // Previously only matched Admin's adminIssueDirective value set
  // (safety_critical/method_improvement/etc.) -- Sub-Coordinator's own
  // sendInstruction/chaseSiteHead/notifyCoordinator write a completely
  // disjoint set of instruction_type values (hold/expedite/revised/resource/
  // alert/chase/notification), so this inbox could never show anything
  // Sub-Coordinator actually sends (Duplicate/Conflict #21). Widened to cover
  // both value sets.
  const { data: reports } = await supabase
    .from('site_instructions')
    .select('id, instruction_type, priority, instruction_text, booking_ref, issued_at, status, issued_by')
    .in('instruction_type', [
      'safety_critical', 'method_improvement', 'payment_policy', 'methodology', 'special_site', 'execution',
      'hold', 'expedite', 'revised', 'resource', 'alert', 'chase', 'notification',
    ])
    .order('issued_at', { ascending: false })
    .limit(50)

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district')
    .eq('is_active', true)

  const { data: supervisors } = await supabase
    .from('users')
    .select('id, full_name, platform_role')
    .in('platform_role', ['supervisor', 'sub_coordinator'])

  const jobMap = Object.fromEntries((activeJobs ?? []).map(j => [j.booking_ref, j]))
  const userMap = Object.fromEntries((supervisors ?? []).map(s => [s.id, s]))

  const reportTypes = [
    {
      type: 'safety_critical',
      icon: '🚨',
      label: 'Safety Critical',
      desc: 'Immediate safety risk on site — auto CC to Admin',
      color: 'bg-red-100 text-red-700 border-red-300',
      headerColor: 'bg-red-600',
      urgent: true,
    },
    {
      type: 'method_improvement',
      icon: '💡',
      label: 'Method Improvement',
      desc: 'Supervisor proposes better method — coordinator reviews then Admin',
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      headerColor: 'bg-blue-600',
      urgent: false,
    },
    {
      type: 'payment_policy',
      icon: '💰',
      label: 'Payment Policy',
      desc: 'Payment policy issue raised — coordinator reviews then Admin',
      color: 'bg-orange-100 text-orange-700 border-orange-300',
      headerColor: 'bg-orange-500',
      urgent: false,
    },
    {
      type: 'execution',
      icon: '🏗',
      label: 'Execution Report',
      desc: 'Method of execution submitted by supervisor',
      color: 'bg-green-100 text-green-700 border-green-300',
      headerColor: 'bg-green-600',
      urgent: false,
    },
    {
      type: 'special_site',
      icon: '📍',
      label: 'Special Site Report',
      desc: 'Unusual site conditions or special circumstances',
      color: 'bg-purple-100 text-purple-700 border-purple-300',
      headerColor: 'bg-purple-600',
      urgent: false,
    },
    {
      type: 'methodology',
      icon: '📋',
      label: 'Methodology Report',
      desc: 'Methodology documentation — coordinator reviews then Admin',
      color: 'bg-gray-100 text-gray-600 border-gray-300',
      headerColor: 'bg-gray-600',
      urgent: false,
    },
  ]

  const safetyCritical = (reports ?? []).filter(r => r.instruction_type === 'safety_critical')
  const otherReports = (reports ?? []).filter(r => r.instruction_type !== 'safety_critical')

  const priorityBadge = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-700 border-red-300'
    if (p === 'high') return 'bg-orange-100 text-orange-700 border-orange-300'
    if (p === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-gray-100 text-gray-500 border-gray-200'
  }

  const getTypeInfo = (type: string) => reportTypes.find(t => t.type === type) ?? reportTypes[5]

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Reports Inbox</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className={`font-bold text-2xl ${safetyCritical.length > 0 ? 'text-red-400' : 'text-white'}`}>
                {safetyCritical.length}
              </p>
              <p className="text-blue-300 text-xs">Safety Critical</p>
            </div>
            <div>
              <p className="text-orange-400 font-bold text-2xl">{otherReports.length}</p>
              <p className="text-blue-300 text-xs">Other Reports</p>
            </div>
            <div>
              <p className="text-white font-bold text-2xl">{(reports ?? []).length}</p>
              <p className="text-blue-300 text-xs">Total</p>
            </div>
          </div>
        </div>

        {/* REPORT TYPES REFERENCE */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Report Types</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {reportTypes.map(rt => (
              <div key={rt.type} className="px-5 py-3 flex items-start gap-3">
                <span className="text-xl shrink-0">{rt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-800">{rt.label}</p>
                    {rt.urgent && <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Auto CC Admin</span>}
                  </div>
                  <p className="text-xs text-gray-400 leading-snug mt-0.5">{rt.desc}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${rt.color}`}>
                  {(reports ?? []).filter(r => r.instruction_type === rt.type).length}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* SAFETY CRITICAL — urgent */}
        {safetyCritical.length > 0 && (
          <section>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">
              🚨 Safety Critical — Auto CC Admin
            </p>
            <div className="space-y-3">
              {safetyCritical.map(r => {
                const job = r.booking_ref ? jobMap[r.booking_ref] : null
                const sender = userMap[r.issued_by]
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-red-300 shadow-sm overflow-hidden">
                    <div className="bg-red-600 px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-red-200 text-xs">{r.booking_ref} · Safety Critical</p>
                          {job && <p className="text-white font-bold text-sm mt-0.5">{job.job_title ?? job.job_type}</p>}
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${priorityBadge(r.priority)}`}>
                          {r.priority}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-sm text-gray-700 leading-snug">{r.instruction_text}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{sender?.full_name ?? 'Unknown'} · {sender?.platform_role?.replace(/_/g, ' ')}</span>
                        <span>{new Date(r.issued_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                          Forward to Admin
                        </button>
                        <button className="flex-1 bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl">
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* OTHER REPORTS */}
        {otherReports.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Reports Inbox</p>
            <div className="space-y-3">
              {otherReports.map(r => {
                const job = r.booking_ref ? jobMap[r.booking_ref] : null
                const sender = userMap[r.issued_by]
                const typeInfo = getTypeInfo(r.instruction_type)
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className={`${typeInfo.headerColor} px-5 py-3`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white/70 text-xs">{r.booking_ref} · {typeInfo.label}</p>
                          {job && <p className="text-white font-bold text-sm mt-0.5">{job.job_title ?? job.job_type}</p>}
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${priorityBadge(r.priority)}`}>
                          {r.priority}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-sm text-gray-700 leading-snug">{r.instruction_text}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{sender?.full_name ?? 'Unknown'} · {sender?.platform_role?.replace(/_/g, ' ')}</span>
                        <span>{new Date(r.issued_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                          Forward to Admin
                        </button>
                        <button className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl">
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* EMPTY */}
        {(reports ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-gray-500 font-semibold text-sm">No reports in inbox</p>
            <p className="text-gray-400 text-xs mt-1">Reports from supervisors and sub-coordinators will appear here</p>
          </div>
        )}

      </main>
    </div>
  )
}