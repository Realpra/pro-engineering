import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCapacityMatrix } from '@/lib/capacityMatrix'
import CapacityMatrixView from './CapacityMatrixView'

function todayISO() { return new Date().toISOString().split('T')[0] }
function shiftDate(d: string, days: number) {
  const dt = new Date(`${d}T00:00:00`)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().split('T')[0]
}

// Admin-level Allocation Overview: the same Trade x Day capacity matrix
// Superadmin sees, but with the "crucial decision points" Superadmin
// doesn't need -- pending allocation escalations and client-discussion
// jobs needing expediting -- plus a Skill Level subdivision toggle
// (project owner's rule, 2 Oct 2026: "skill level in initial screens may
// clutter... total not sub-divide" at Superadmin, but Admin needs it for
// the actual decision work).
export default async function AdminAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; zone?: string; skill?: string }>
}) {
  const { from, to, zone: zoneParam, skill } = await searchParams
  const fromDate = from || todayISO()
  const toDate = to || shiftDate(fromDate, 6)
  const showSkillLevel = skill === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (!['admin', 'super_admin'].includes(profile?.platform_role ?? '')) redirect('/admin/dashboard')

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('zone')
    .eq('is_active', true)
  const zones = [...new Set((activeJobs ?? []).map((j) => j.zone).filter((z): z is string => !!z))].sort()
  const zone = zoneParam && zones.includes(zoneParam) ? zoneParam : null

  const matrix = await getCapacityMatrix(supabase, { fromDate, toDate, showSkillLevel, zone })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: escalationsData } = await (supabase as any)
    .from('worker_allocation_escalations')
    .select('id, booking_ref, trade, raised_at')
    .eq('status', 'pending')
    .order('raised_at', { ascending: true })

  const { data: clientRemarksRaw } = await supabase
    .from('estimate_client_responses')
    .select('id, booking_ref, response_type, responded_at, coordinator_actioned_at')
    .eq('response_type', 'review_requested')
    .is('coordinator_actioned_at', null)
    .order('responded_at', { ascending: true })
  const clientRemarksByRef = new Map<string, NonNullable<typeof clientRemarksRaw>[number]>()
  for (const r of clientRemarksRaw ?? []) {
    if (!clientRemarksByRef.has(r.booking_ref)) clientRemarksByRef.set(r.booking_ref, r)
  }
  const clientRemarks = Array.from(clientRemarksByRef.values())

  const zoneQS = zone ? `&zone=${encodeURIComponent(zone)}` : ''
  const skillQS = showSkillLevel ? '&skill=1' : ''
  const windowDays = Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-white/80 hover:text-white shrink-0" aria-label="Back to dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Allocation Overview</h1>
            <p className="text-blue-200 text-xs">Zone → Trade{showSkillLevel ? ' / Skill Level' : ''} → Day — demand vs. available, with decision points</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        <form method="get" className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">Zone</label>
            <select name="zone" defaultValue={zone ?? ''} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">All Zones</option>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">From</label>
            <input type="date" name="from" defaultValue={fromDate} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">To</label>
            <input type="date" name="to" defaultValue={toDate} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 pb-1.5">
            <input type="checkbox" name="skill" value="1" defaultChecked={showSkillLevel} />
            Subdivide by Skill Level
          </label>
          <button type="submit" className="bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-lg">Apply</button>
          <div className="flex gap-2 ml-auto">
            <Link href={`/admin/allocation?from=${shiftDate(fromDate, -windowDays)}&to=${shiftDate(toDate, -windowDays)}${zoneQS}${skillQS}`} className="text-xs font-bold text-[#2E74B5] border border-[#2E74B5]/30 px-3 py-2 rounded-lg">← Prev {windowDays}d</Link>
            <Link href={`/admin/allocation?from=${todayISO()}&to=${shiftDate(todayISO(), 6)}${zoneQS}${skillQS}`} className="text-xs font-bold text-[#2E74B5] border border-[#2E74B5]/30 px-3 py-2 rounded-lg">Today</Link>
            <Link href={`/admin/allocation?from=${shiftDate(fromDate, windowDays)}&to=${shiftDate(toDate, windowDays)}${zoneQS}${skillQS}`} className="text-xs font-bold text-[#2E74B5] border border-[#2E74B5]/30 px-3 py-2 rounded-lg">Next {windowDays}d →</Link>
          </div>
        </form>

        <CapacityMatrixView days={matrix.days} rows={matrix.rows} />

        <div className="grid md:grid-cols-2 gap-4">
          <section className="bg-white rounded-2xl border border-orange-200 p-4">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">
              Allocation Escalations Pending — {(escalationsData ?? []).length}
            </p>
            {(escalationsData ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {(escalationsData ?? []).map((e: { id: string; booking_ref: string; trade: string; raised_at: string }) => (
                  <div key={e.id} className="text-xs text-gray-700 bg-orange-50 rounded-lg px-3 py-2">
                    {e.booking_ref} — {e.trade} <span className="text-gray-400">· raised {new Date(e.raised_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
                <Link href="/admin/coordinators" className="text-xs font-semibold text-orange-700 underline">Resolve →</Link>
              </div>
            ) : (
              <p className="text-xs text-gray-400">None pending.</p>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-purple-200 p-4">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">
              Client Under Discussion — Needs Expediting — {clientRemarks.length}
            </p>
            {clientRemarks.length > 0 ? (
              <div className="space-y-1.5">
                {clientRemarks.map((r) => (
                  <Link key={r.booking_ref} href={`/admin/estimate/${r.booking_ref}`} className="block text-xs text-gray-700 bg-purple-50 rounded-lg px-3 py-2 hover:bg-purple-100">
                    <span className="font-semibold">{r.booking_ref}</span> <span className="text-gray-400">· client replied {new Date(r.responded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, awaiting closure</span>
                    <span className="text-purple-700 font-semibold"> · Close out →</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No jobs stuck in client negotiation.</p>
            )}
          </section>
        </div>

      </main>
    </div>
  )
}
