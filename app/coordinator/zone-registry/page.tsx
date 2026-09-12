import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { addZone, assignWorkerToZone, saveWorkerAssessment } from './actions'
import WorkerAssessmentPanel from './WorkerAssessmentPanel'

export default async function CoordinatorZoneRegistryPage() {
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

  const { data: workers } = await supabase
    .from('workers')
    .select(`id, full_name, trade, district, is_available, is_active,
      skill_level, phone, average_rating, total_deployments, approval_status,
      competency_m1, competency_m2, competency_m3, competency_m4, competency_m5, competency_m6,
      specialist_track_a, specialist_track_b, specialist_track_c, specialist_track_d,
      height_restriction, dust_restriction, deployment_restriction,
      competency_remarks, assessment_decision`)
    .eq('is_active', true)
    .order('trade', { ascending: true })
    .order('full_name', { ascending: true })

  const { data: zoneAssignments } = await supabase
    .from('worker_zone_assignments')
    .select('id, worker_id, zone_name, is_primary, travel_mode, max_travel_minutes, assigned_by_role')
    .eq('is_active', true)
    .order('zone_name', { ascending: true })

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district, status, is_active')
    .eq('is_active', true)
    .order('zone', { ascending: true })

  const { data: geoZones } = await supabase
    .from('geo_hierarchy')
    .select('id, name, level, short_code, is_active')
    .eq('level', 'sector')
    .order('name', { ascending: true })

  const workerMap = Object.fromEntries((workers ?? []).map(w => [w.id, w]))

  const assignmentsByZone = new Map<string, typeof zoneAssignments>()
  for (const a of zoneAssignments ?? []) {
    if (!assignmentsByZone.has(a.zone_name)) assignmentsByZone.set(a.zone_name, [])
    assignmentsByZone.get(a.zone_name)!.push(a)
  }

  const jobsByZone = new Map<string, typeof activeJobs>()
  for (const j of activeJobs ?? []) {
    const zone = j.zone ?? j.district ?? 'Unknown'
    if (!jobsByZone.has(zone)) jobsByZone.set(zone, [])
    jobsByZone.get(zone)!.push(j)
  }

  const geoZoneNames = new Set((geoZones ?? []).map(g => g.name))
  const allZoneNames = [...new Set([
    ...geoZoneNames,
    ...Array.from(assignmentsByZone.keys()),
    ...Array.from(jobsByZone.keys()),
  ])].sort()

  const rateCard = [
    { activity: 'Demolition — Floor', code: 'DEM-FL', unit: 'sqft', rate: 35 },
    { activity: 'Demolition — Wall', code: 'DEM-WL', unit: 'sqft', rate: 28 },
    { activity: 'Waterproofing', code: 'WPF', unit: 'sqft', rate: 130 },
    { activity: 'Floor Screed', code: 'SCR-FL', unit: 'sqft', rate: 45 },
    { activity: 'Wall Tiling', code: 'TIL-WL', unit: 'sqft', rate: 165 },
    { activity: 'Floor Tiling', code: 'TIL-FL', unit: 'sqft', rate: 185 },
    { activity: 'Grouting', code: 'GRT', unit: 'sqft', rate: 25 },
    { activity: 'Wall Plastering', code: 'PLS-WL', unit: 'sqft', rate: 38 },
    { activity: 'Plumbing Reroute', code: 'PLB-RRT', unit: 'job', rate: 6400 },
    { activity: 'Electrical Points', code: 'ELC-PT', unit: 'point', rate: 1800 },
    { activity: 'Fixture Fitting', code: 'FIX-FT', unit: 'unit', rate: 2200 },
    { activity: 'Supervision', code: 'SUP-DY', unit: 'day', rate: 1100 },
  ]

  const skillBadge = (level: string) => {
    if (level === 'highly_skilled') return 'bg-green-100 text-green-700'
    if (level === 'skilled') return 'bg-blue-100 text-blue-700'
    if (level === 'semi_skilled') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-500'
  }

  const travelModeLabel = (mode: string) => {
    if (mode === 'own_two_wheeler') return '🛵'
    if (mode === 'bicycle') return '🚲'
    if (mode === 'public_transport') return '🚌'
    if (mode === 'on_foot') return '🚶'
    return '—'
  }

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Zone Registry</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-white font-bold text-2xl">{allZoneNames.length}</p>
              <p className="text-blue-300 text-xs">Active Zones</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{(workers ?? []).length}</p>
              <p className="text-blue-300 text-xs">Workers</p>
            </div>
            <div>
              <p className="text-orange-400 font-bold text-2xl">{(activeJobs ?? []).length}</p>
              <p className="text-blue-300 text-xs">Active Jobs</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30 text-center">
            <p className="text-blue-200 text-xs">The Nest Zone Cost Database · Same zone first · Nearby zone fallback</p>
          </div>
        </div>

        {/* ADD ZONE FORM */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Add New Zone</p>
          <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden">
            <div className="bg-[#1F3864] px-5 py-3">
              <p className="text-white font-bold text-sm">Register Zone</p>
              <p className="text-blue-300 text-xs mt-0.5">Added to The Nest Zone Cost Database</p>
            </div>
            <form action={addZone} className="px-5 py-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Zone Name</p>
                <input
                  name="zone_name"
                  type="text"
                  placeholder="e.g. Noida Sector 65"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Short Code</p>
                  <input
                    name="short_code"
                    type="text"
                    placeholder="e.g. S65"
                    required
                    maxLength={6}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 uppercase"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">District / Region</p>
                  <input
                    name="district"
                    type="text"
                    placeholder="e.g. Noida"
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                  />
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl px-4 py-2.5">
                <p className="text-xs text-blue-600">Rate card inherited from parent region · Admin approves rate changes</p>
              </div>
              <button type="submit" className="w-full bg-[#1F3864] text-white font-bold py-3.5 rounded-xl text-sm">
                + Add Zone
              </button>
            </form>
          </div>
        </section>

        {/* WORKER ASSESSMENT + ZONE ASSIGNMENT — client component */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Worker Assessment & Zone Assignment</p>
          <WorkerAssessmentPanel
            workers={(workers ?? []) as any}
            zones={(geoZones ?? []) as any}
            onAssign={assignWorkerToZone}
            onAssessment={saveWorkerAssessment}
          />
        </section>

        {/* ZONE BREAKDOWN */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Zone Breakdown</p>
          <div className="space-y-4">
            {allZoneNames.map(zone => {
              const zoneWorkerAssignments = assignmentsByZone.get(zone) ?? []
              const zoneJobs = jobsByZone.get(zone) ?? []
              const geoZone = (geoZones ?? []).find(g => g.name === zone)
              const primaryWorkers = zoneWorkerAssignments.filter(a => a.is_primary)
              const secondaryWorkers = zoneWorkerAssignments.filter(a => !a.is_primary)
              const availableCount = zoneWorkerAssignments.filter(a => workerMap[a.worker_id]?.is_available).length

              return (
                <div key={zone} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-[#1F3864] px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white font-bold text-sm">{zone}</p>
                        {geoZone && <p className="text-blue-300 text-xs mt-0.5">Code: {geoZone.short_code}</p>}
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-300 font-semibold">{availableCount} avail</span>
                        <span className="text-blue-300">·</span>
                        <span className="text-orange-300 font-semibold">{zoneJobs.length} jobs</span>
                        <span className="text-blue-300">·</span>
                        <span className="text-blue-200 font-semibold">{zoneWorkerAssignments.length} workers</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3 space-y-3">
                    {primaryWorkers.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 mb-1.5">Primary</p>
                        <div className="space-y-1.5">
                          {primaryWorkers.map(a => {
                            const w = workerMap[a.worker_id]
                            if (!w) return null
                            return (
                              <div key={a.id} className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${skillBadge(w.skill_level)}`}>
                                  {w.skill_level?.split('_')[0]}
                                </span>
                                <span className="text-xs font-semibold text-gray-700 flex-1">{w.full_name}</span>
                                <span className="text-xs text-gray-400">{w.trade}</span>
                                <span className="text-xs">{travelModeLabel(a.travel_mode)}</span>
                                <span className="text-xs text-gray-400">{a.max_travel_minutes}m</span>
                                <span className={`text-xs font-bold ${w.is_available ? 'text-green-600' : 'text-red-500'}`}>
                                  {w.is_available ? '●' : '○'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {secondaryWorkers.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 mb-1.5">Secondary</p>
                        <div className="space-y-1.5">
                          {secondaryWorkers.map(a => {
                            const w = workerMap[a.worker_id]
                            if (!w) return null
                            return (
                              <div key={a.id} className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${skillBadge(w.skill_level)}`}>
                                  {w.skill_level?.split('_')[0]}
                                </span>
                                <span className="text-xs text-gray-500 flex-1">{w.full_name}</span>
                                <span className="text-xs text-gray-400">{w.trade}</span>
                                <span className="text-xs">{travelModeLabel(a.travel_mode)}</span>
                                <span className={`text-xs font-bold ${w.is_available ? 'text-green-600' : 'text-red-500'}`}>
                                  {w.is_available ? '●' : '○'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {zoneWorkerAssignments.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-1">No workers assigned to this zone</p>
                    )}
                    {zoneJobs.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-400 mb-1.5">Active Jobs</p>
                        {zoneJobs.map(j => (
                          <div key={j.booking_ref} className="flex items-center gap-2 py-0.5">
                            <span className="text-xs text-gray-400">{j.booking_ref}</span>
                            <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{j.job_title ?? j.job_type}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              j.status === 'milestone_review' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'
                            }`}>{j.status?.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* RATE CARD */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">The Nest — Zone Rate Card</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-[#2E74B5] px-5 py-3">
              <p className="text-white font-bold text-sm">Noida Sectors 62 · 63 · 64</p>
              <p className="text-blue-200 text-xs mt-0.5">Standard rates · Admin approves changes · Effective: 2026</p>
            </div>
            <div className="divide-y divide-gray-100">
              {rateCard.map(r => (
                <div key={r.code} className="px-5 py-2.5 flex items-center gap-3">
                  <span className="text-xs font-bold text-[#2E74B5] w-16 shrink-0">{r.code}</span>
                  <span className="text-xs text-gray-700 flex-1">{r.activity}</span>
                  <span className="text-xs text-gray-400 w-10 text-center shrink-0">{r.unit}</span>
                  <span className="text-xs font-bold text-gray-800 w-16 text-right shrink-0">₹{r.rate.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">Rate changes require Admin approval · Coordinator proposes · Admin approves</p>
            </div>
          </div>
        </section>

        {/* ZONE RULES */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Zone Assignment Rules</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-2 text-xs text-gray-600">
            <p>• <span className="font-bold">Same zone first</span> — primary zone workers matched before others</p>
            <p>• <span className="font-bold">Nearby zone fallback</span> — secondary zone workers used if primary unavailable</p>
            <p>• <span className="font-bold">Multiple zones</span> — workers can cover up to 3 zones (1 primary + 2 secondary)</p>
            <p>• <span className="font-bold">Travel mode</span> — used for shift schedule and route calculation</p>
            <p>• <span className="font-bold">Max travel time</span> — used for zone fallback matching engine</p>
            <p>• <span className="font-bold">Primary zone mirrors</span> — to workers.district for backward compatibility</p>
          </div>
        </section>

      </main>
    </div>
  )
}