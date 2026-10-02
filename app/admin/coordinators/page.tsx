import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getJobTiers } from '@/lib/allocationPriority'
import { getSectorNamesServedByZones } from '@/lib/zoneCoverage'
import CoordinatorsTabs, { type DriverUser, type GeoNode, type UnroutedJob, type Escalation, type WorkerOption } from './CoordinatorsTabs'

export default async function AdminCoordinatorsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['admin', 'super_admin'].includes(profile?.platform_role ?? '')) redirect('/admin/dashboard')

  const [{ data: driversData }, { data: geoData }, { data: jobsData }, { data: escalationsData }, { data: allWorkersData }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, platform_role, coverage_states, coverage_zones')
      .in('platform_role', ['coordinator', 'sub_coordinator'])
      .order('platform_role')
      .order('full_name'),
    supabase
      .from('geo_hierarchy')
      .select('id, name, level, is_active')
      .eq('is_active', true)
      .in('level', ['state', 'zone'])
      .order('level')
      .order('name'),
    supabase
      .from('guest_enquiries')
      .select('booking_ref, job_title, contact_name, zone, district, created_at')
      .is('driving_role', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('worker_allocation_escalations')
      .select('id, booking_ref, substage_id, trade, skill_level_needed, remark, raised_at')
      .eq('status', 'pending')
      .order('raised_at', { ascending: true }),
    supabase
      .from('workers')
      .select('id, full_name, trade, skill_level, zones, daily_wage_inr')
      .eq('is_active', true)
      .in('approval_status', ['admin_approved', 'coordinator_approved']),
  ])

  const drivers = (driversData ?? []) as DriverUser[]
  const geo = (geoData ?? []) as GeoNode[]
  const unroutedJobs = (jobsData ?? []) as UnroutedJob[]
  const escalations = (escalationsData ?? []) as Escalation[]
  const allWorkers = (allWorkersData ?? []) as WorkerOption[]

  const substageIds = [...new Set(escalations.map(e => e.substage_id))]
  const { data: substagesForEscalations } = substageIds.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select('id, substage_code, substage_name')
        .in('id', substageIds)
    : { data: [] as { id: string; substage_code: string; substage_name: string }[] }
  const substageById = Object.fromEntries((substagesForEscalations ?? []).map(s => [s.id, s]))

  // Job "category" (general/premium/higher) = boq_generated.tier, reused
  // as-is -- escalations are shown highest-tier-first, same priority rule
  // as the Coordinator's own Command Center.
  const escalationTiers = await getJobTiers(supabase, [...new Set(escalations.map(e => e.booking_ref))])

  // coverage_zones holds ZONE-level names; guest_enquiries.zone holds
  // SECTOR-level names -- resolved here, once per driver, through the real
  // geo_zone_sector_coverage table, instead of the plain-string
  // coverage_zones.includes(job.zone) comparison RouteJobRow used to make
  // (confirmed real bug, same root cause as the Coordinator Command Center
  // fix, 2 Oct 2026).
  const coveredSectorsByDriver: Record<string, string[]> = Object.fromEntries(
    await Promise.all(
      drivers.map(async (d): Promise<[string, string[]]> => [d.id, [...(await getSectorNamesServedByZones(supabase, d.coverage_zones ?? []))]]),
    ),
  )

  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-white/80 hover:text-white shrink-0" aria-label="Back to dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Coordinators</h1>
            <p className="text-blue-200 text-xs">Zone coverage &amp; new-job routing</p>
          </div>
          <p className="text-blue-200 text-xs shrink-0">{adminName}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <CoordinatorsTabs
          drivers={drivers}
          geo={geo}
          unroutedJobs={unroutedJobs}
          escalations={escalations}
          escalationTiers={escalationTiers}
          substageById={substageById}
          allWorkers={allWorkers}
          coveredSectorsByDriver={coveredSectorsByDriver}
        />
      </main>
    </div>
  )
}
