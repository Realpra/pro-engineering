import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'supervisor') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Supervisor'

  const reportTypes = [
    {
      type: 'method',
      icon: '🔧',
      label: 'Method Improvement Proposal',
      description: 'Propose a better way of executing work — sequence, technique, or tool',
      routes: 'Sub-Coordinator → Coordinator',
      color: 'border-blue-200 bg-blue-50',
      badge: 'bg-blue-100 text-blue-700',
    },
    {
      type: 'payment',
      icon: '💰',
      label: 'Payment Policy Proposal',
      description: 'Propose changes to payment terms, milestones, or release conditions',
      routes: 'Coordinator → Admin',
      color: 'border-purple-200 bg-purple-50',
      badge: 'bg-purple-100 text-purple-700',
    },
    {
      type: 'execution',
      icon: '📐',
      label: 'Method of Execution Report',
      description: 'Document the actual method used on site — deviations, decisions, sequence',
      routes: 'Coordinator',
      color: 'border-green-200 bg-green-50',
      badge: 'bg-green-100 text-green-700',
    },
    {
      type: 'methodology',
      icon: '📚',
      label: 'Methodology Report',
      description: 'Formal technical methodology for a trade or substage — for records and replication',
      routes: 'Coordinator → Admin',
      color: 'border-yellow-200 bg-yellow-50',
      badge: 'bg-yellow-100 text-yellow-700',
    },
    {
      type: 'site',
      icon: '📋',
      label: 'Special Site Report',
      description: 'Any special condition, observation, or finding on site requiring HQ attention',
      routes: 'Coordinator',
      color: 'border-gray-200 bg-gray-50',
      badge: 'bg-gray-100 text-gray-700',
    },
    {
      type: 'safety',
      icon: '⚠️',
      label: 'Safety Critical Report',
      description: 'Immediate safety risk, hazard, or incident on site — escalated automatically',
      routes: 'Coordinator + Admin (auto CC)',
      color: 'border-red-200 bg-red-50',
      badge: 'bg-red-100 text-red-700',
    },
  ]

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Special Reports</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* INFO */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <p className="text-white font-bold text-sm mb-1">Supervisor Reports & Proposals</p>
          <p className="text-blue-200 text-xs leading-relaxed">
            Supervisor can independently raise reports and proposals on method, safety, payment policy, 
            and site conditions. Each type routes through the appropriate approval chain.
          </p>
        </div>

        {/* REPORT TYPE CARDS */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Select Report Type
          </p>
          <div className="space-y-3">
            {reportTypes.map(r => (
              <Link
                key={r.type}
                href={`/supervisor/reports/new?type=${r.type}`}
                className={`block bg-white rounded-2xl border shadow-sm overflow-hidden active:opacity-90 transition-opacity`}
              >
                <div className={`px-5 py-4 border-b ${r.color}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{r.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{r.description}</p>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Routes to:</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.badge}`}>
                      {r.routes}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ACTIVE REPORTS */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Active Reports
          </p>
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">No reports submitted yet</p>
            <p className="text-gray-400 text-xs mt-1">Reports you submit will appear here with their approval status</p>
          </div>
        </section>

      </main>
    </div>
  )
}