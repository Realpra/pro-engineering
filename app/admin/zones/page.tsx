import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ZoneTabs, {
  type Zone,
  type RateCard,
  type ZoneProposal,
  type WorkerAssignment,
  type WorkerLite,
  type Region,
  type JobTypeConfig,
} from './ZoneTabs'

export default async function AdminZonesPage() {
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
    { data: zonesData },
    { data: rateCardsData },
    { data: rateQueueData },
    { data: proposalsData },
    { data: assignmentsData },
    { data: workersData },
    { data: regionsData },
    { data: jobTypeConfigData },
  ] = await Promise.all([
    supabase.from('geo_hierarchy').select('*').order('level').order('name'),
    supabase.from('rate_card').select('*').order('geo_id').order('activity_name'),
    supabase.from('rate_card').select('*').eq('rate_change_status', 'proposed').order('rate_change_proposed_at', { ascending: false }),
    supabase.from('zone_proposals').select('*').order('proposed_at', { ascending: false }),
    supabase.from('worker_zone_assignments').select('*').order('created_at', { ascending: false }),
    supabase.from('workers').select('id, full_name, trade, skill_level, zones'),
    supabase.from('regions').select('*').order('region_name'),
    supabase.from('job_type_config').select('*').order('job_name'),
  ])

  const zones = (zonesData ?? []) as Zone[]
  const ratecards = (rateCardsData ?? []) as RateCard[]
  const rateCardQueue = (rateQueueData ?? []) as RateCard[]
  const zoneProposals = (proposalsData ?? []) as ZoneProposal[]
  const workerAssignments = (assignmentsData ?? []) as WorkerAssignment[]
  const workers = (workersData ?? []) as WorkerLite[]
  const regions = (regionsData ?? []) as Region[]
  const jobTypeConfigs = (jobTypeConfigData ?? []) as JobTypeConfig[]

  const zonesMap: Record<string, string> = {}
  for (const z of zones) zonesMap[z.id] = z.name ?? z.id

  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  const activeZoneCount = zones.filter((z) => z.is_active).length
  const rateCardCount = ratecards.filter((r) => r.is_active).length
  const pendingRateApprovals = rateCardQueue.length
  const pendingZoneProposals = zoneProposals.filter(
    (p) => !p.admin_decision || p.admin_decision === 'pending'
  ).length

  const stats: { label: string; count: number; className: string; badge?: boolean }[] = [
    { label: 'Active Zones', count: activeZoneCount, className: 'text-green-600' },
    { label: 'Rate Cards', count: rateCardCount, className: 'text-blue-600' },
    { label: 'Pending Rate Approvals', count: pendingRateApprovals, className: 'text-[#F97316]', badge: true },
    { label: 'Pending Zone Proposals', count: pendingZoneProposals, className: 'text-[#F97316]', badge: true },
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
            <h1 className="text-white font-bold text-lg leading-tight">Zones</h1>
            <p className="text-blue-200 text-xs">Zone management and rate card approvals</p>
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

        <ZoneTabs
          zones={zones}
          ratecards={ratecards}
          rateCardQueue={rateCardQueue}
          zoneProposals={zoneProposals}
          workerAssignments={workerAssignments}
          workers={workers}
          regions={regions}
          jobTypeConfigs={jobTypeConfigs}
          adminUserId={user.id}
        />
      </main>
    </div>
  )
}
