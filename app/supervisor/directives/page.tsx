import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import AcknowledgeButton from './AcknowledgeButton'
import { isVisitRole } from '@/lib/visitRoles'

export default async function DirectivesPage() {
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

  const { data: pending } = await supabase
    .from('site_instructions')
    .select('id, instruction_type, priority, instruction_text, issued_at, status')
    .eq('issued_to', user.id)
    .eq('status', 'pending')
    .order('issued_at', { ascending: false })

  const { data: acknowledged } = await supabase
    .from('site_instructions')
    .select('id, instruction_type, priority, instruction_text, issued_at, status')
    .eq('issued_to', user.id)
    .eq('status', 'acknowledged')
    .order('issued_at', { ascending: false })
    .limit(10)

  const instructionIcon = (type: string) => {
    if (type === 'hold') return '🔴'
    if (type === 'expedite') return '🟠'
    if (type === 'revised') return '🟡'
    if (type === 'resource') return '🟢'
    return '⚠️'
  }

  const priorityBadge = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-700 border-red-300'
    if (p === 'high') return 'bg-orange-100 text-orange-700 border-orange-300'
    if (p === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-blue-100 text-blue-700 border-blue-300'
  }

  const typeLabel = (type: string) => {
    if (type === 'hold') return 'Hold — Stop Work'
    if (type === 'expedite') return 'Expedite — Speed Up'
    if (type === 'revised') return 'Revised — Change Plan'
    if (type === 'resource') return 'Resource — Add/Remove'
    return 'Alert — Attention'
  }

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">HQ Directives</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-orange-400 font-bold text-2xl">{(pending ?? []).length}</p>
              <p className="text-blue-300 text-xs">Pending — Action Required</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{(acknowledged ?? []).length}</p>
              <p className="text-blue-300 text-xs">Acknowledged</p>
            </div>
          </div>
        </div>

        {/* PENDING DIRECTIVES */}
        {(pending ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
              ⚡ Pending — Acknowledge Required
            </p>
            <div className="space-y-3">
              {(pending ?? []).map(d => (
                <div key={d.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${d.priority === 'critical' ? 'border-red-300' : 'border-orange-200'}`}>
                  {/* Header */}
                  <div className={`px-5 py-3 border-b ${d.priority === 'critical' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{instructionIcon(d.instruction_type)}</span>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{typeLabel(d.instruction_type)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(d.issued_at).toLocaleString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-bold uppercase px-2.5 py-1 rounded-full border ${priorityBadge(d.priority)}`}>
                        {d.priority}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-5 py-4 space-y-3">
                    <p className="text-sm text-gray-800 leading-relaxed font-medium">{d.instruction_text}</p>

                    {/* Action required based on type */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600">
                      {d.instruction_type === 'hold' && (
                        <p>⛔ Stop all work on the specified substage immediately. Do not proceed until further notice from Coordinator.</p>
                      )}
                      {d.instruction_type === 'expedite' && (
                        <p>⚡ Prioritise this substage. Coordinate with Site Head to accelerate completion. Report progress to Coordinator by EOD.</p>
                      )}
                      {d.instruction_type === 'revised' && (
                        <p>🔄 Review the revised plan and communicate changes to Site Head and Site Incharge immediately.</p>
                      )}
                      {d.instruction_type === 'resource' && (
                        <p>👷 Coordinate with Sub-Coordinator to action the resource change. Confirm deployment in daily log.</p>
                      )}
                      {d.instruction_type === 'alert' && (
                        <p>⚠️ Review and take appropriate action. Respond to Coordinator if action taken.</p>
                      )}
                    </div>

                    <AcknowledgeButton instructionId={d.id} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* NO PENDING */}
        {(pending ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-8 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-gray-600 font-semibold text-sm">No pending directives</p>
            <p className="text-gray-400 text-xs mt-1">All HQ instructions have been acknowledged</p>
          </div>
        )}

        {/* ACKNOWLEDGED HISTORY */}
        {(acknowledged ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Recently Acknowledged
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(acknowledged ?? []).map(d => (
                <div key={d.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{instructionIcon(d.instruction_type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${priorityBadge(d.priority)}`}>
                          {d.priority}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">{d.instruction_type.replace('_', ' ')}</span>
                        <span className="text-xs text-green-600 font-semibold">✓ Acknowledged</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-snug">{d.instruction_text}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(d.issued_at).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* DIRECTIVE TYPES REFERENCE */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Directive Types Reference
          </p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {[
              { icon: '🔴', type: 'Hold', desc: 'Stop work immediately on specified substage' },
              { icon: '🟠', type: 'Expedite', desc: 'Accelerate work — report progress EOD' },
              { icon: '🟡', type: 'Revise', desc: 'Change to plan — communicate to site team' },
              { icon: '🟢', type: 'Resource', desc: 'Add or remove worker — coordinate with Sub-Coord' },
              { icon: '⚠️', type: 'Alert', desc: 'Attention required — assess and respond' },
            ].map(item => (
              <div key={item.type} className="px-5 py-3 flex items-center gap-3">
                <span className="text-lg shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-700">{item.type}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}