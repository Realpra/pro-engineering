import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ScopeTabs, {
  type Assessment,
  type ScopeChange,
  type PiTracker,
} from './ScopeTabs'

export default async function AdminScopePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'admin') redirect('/admin/dashboard')

  const [
    { data: assessmentsData },
    { data: scopeChangesData },
    { data: piData },
    { data: enquiries },
  ] = await Promise.all([
    supabase.from('pre_delivery_assessment').select('*').order('created_at', { ascending: false }),
    supabase.from('scope_change_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('pi_tracker').select('*').order('pi_score', { ascending: false }),
    supabase
      .from('guest_enquiries')
      .select('id, booking_ref, contact_name, full_name, job_title, zone, status'),
  ])

  const assessments = (assessmentsData ?? []) as Assessment[]
  const scopeChanges = (scopeChangesData ?? []) as ScopeChange[]
  const piTrackers = (piData ?? []) as PiTracker[]

  const clientMap: Record<string, string> = {}
  for (const e of enquiries ?? []) {
    if (e?.booking_ref) {
      clientMap[e.booking_ref] = e.contact_name ?? e.full_name ?? '—'
    }
  }

  const adminUserId = user.id
  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  const pendingHandovers = assessments.filter(
    (a) => a.supervisor_flagged_to_admin === true && a.admin_decision == null
  ).length
  const pendingScopeChanges = scopeChanges.filter((c) => c.admin_decision == null).length
  const piTrackersTotal = piTrackers.length
  const blacklistRisk = piTrackers.filter((p) => p.pi_category === 'blacklist_risk').length

  const stats: { label: string; count: number; className: string }[] = [
    {
      label: 'Pending Handovers',
      count: pendingHandovers,
      className: pendingHandovers > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      label: 'Pending Scope Changes',
      count: pendingScopeChanges,
      className: pendingScopeChanges > 0 ? 'text-[#F97316]' : 'text-gray-400',
    },
    { label: 'PI Trackers', count: piTrackersTotal, className: 'text-blue-600' },
    {
      label: 'Blacklist Risk',
      count: blacklistRisk,
      className: blacklistRisk > 0 ? 'text-red-900' : 'text-gray-400',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="text-white/80 hover:text-white shrink-0"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Scope</h1>
            <p className="text-blue-200 text-xs">Pre-delivery, scope changes and performance index</p>
          </div>
          <p className="text-blue-200 text-xs shrink-0">{adminName}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <p className={`text-2xl font-bold ${s.className}`}>{s.count}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <ScopeTabs
          assessments={assessments}
          scopeChanges={scopeChanges}
          piTrackers={piTrackers}
          clientMap={clientMap}
          adminUserId={adminUserId}
        />
      </main>
    </div>
  )
}
