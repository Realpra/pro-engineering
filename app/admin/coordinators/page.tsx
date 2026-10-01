import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CoordinatorsTabs, { type DriverUser, type GeoNode, type UnroutedJob } from './CoordinatorsTabs'

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

  const [{ data: driversData }, { data: geoData }, { data: jobsData }] = await Promise.all([
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
  ])

  const drivers = (driversData ?? []) as DriverUser[]
  const geo = (geoData ?? []) as GeoNode[]
  const unroutedJobs = (jobsData ?? []) as UnroutedJob[]

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
        <CoordinatorsTabs drivers={drivers} geo={geo} unroutedJobs={unroutedJobs} />
      </main>
    </div>
  )
}
