import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ReportTabs, {
  type Instruction,
  type AuditLog,
  type SiteLog,
  type WastageLog,
  type PiTracker,
} from './ReportTabs'

export default async function AdminReportsPage() {
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
    { data: instructionsData },
    { data: auditData },
    { data: escalatedLogsData },
    { data: recentLogsData },
    { data: wastageData },
    { data: piData },
    { data: enquiriesData },
  ] = await Promise.all([
    supabase.from('site_instructions').select('*').order('issued_at', { ascending: false }),
    supabase.from('concern_audit_log').select('*').order('timestamp', { ascending: false }).limit(100),
    supabase.from('daily_site_logs').select('*').eq('escalate_to_admin', true).order('log_date', { ascending: false }),
    supabase.from('daily_site_logs').select('*').order('log_date', { ascending: false }).limit(50),
    supabase.from('client_wastage_log').select('*').order('wastage_date', { ascending: false }),
    supabase.from('pi_tracker').select('*').order('pi_score', { ascending: false }),
    supabase.from('guest_enquiries').select('booking_ref, full_name'),
  ])

  const instructions = (instructionsData ?? []) as Instruction[]
  const auditLogs = (auditData ?? []) as AuditLog[]
  const wastageLogs = (wastageData ?? []) as WastageLog[]
  const piTrackers = (piData ?? []) as PiTracker[]

  const escalated = (escalatedLogsData ?? []) as SiteLog[]
  const escalatedIds = new Set(escalated.map((l) => l.id))
  const siteLogs: SiteLog[] = [
    ...escalated,
    ...((recentLogsData ?? []) as SiteLog[]).filter((l) => !escalatedIds.has(l.id)),
  ]

  const clientMap: Record<string, string> = {}
  for (const e of enquiriesData ?? []) {
    if (e?.booking_ref) clientMap[e.booking_ref] = e.full_name ?? '—'
  }

  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  const unacknowledgedCount = instructions.filter((i) => !i.admin_acknowledged_at).length
  const escalatedLogCount = siteLogs.filter((l) => l.escalate_to_admin === true).length
  const penaltiesPendingCount = wastageLogs.filter((w) => w.penalty_approved_at == null).length

  const stats: { label: string; count: number; className: string }[] = [
    { label: 'Unacknowledged Instructions', count: unacknowledgedCount, className: 'text-[#F97316]' },
    { label: 'Escalated Site Logs', count: escalatedLogCount, className: 'text-red-600' },
    { label: 'Wastage Penalties Pending', count: penaltiesPendingCount, className: 'text-amber-600' },
    { label: 'PI Trackers', count: piTrackers.length, className: 'text-blue-600' },
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
            <h1 className="text-white font-bold text-lg leading-tight">Reports</h1>
            <p className="text-blue-200 text-xs">Safety, methodology and platform intelligence</p>
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

        <ReportTabs
          instructions={instructions}
          auditLogs={auditLogs}
          siteLogs={siteLogs}
          wastageLogs={wastageLogs}
          piTrackers={piTrackers}
          clientMap={clientMap}
          adminUserId={user.id}
        />
      </main>
    </div>
  )
}
