import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCapacityMatrix } from '@/lib/capacityMatrix'
import { getJobTiers } from '@/lib/allocationPriority'
import CapacityMatrixView from '../../admin/allocation/CapacityMatrixView'
import SuperadminEscalations, { type SuperadminEscalation, type WorkerOption } from './SuperadminEscalations'

function todayISO() { return new Date().toISOString().split('T')[0] }
function shiftDate(d: string, days: number) {
  const dt = new Date(`${d}T00:00:00`)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().split('T')[0]
}

// Superadmin-level Allocation Overview: Trade ONLY (never subdivided by
// Skill Level -- the project owner's explicit rule, 2 Oct 2026: "skill
// level in initial screens may clutter, so skill status total not
// sub-divide into skill levels"), platform-wide, 7-day scrollable window
// with a From/To query. Plus the one decision only Superadmin can make:
// escalations Admin couldn't fill platform-wide either.
export default async function SuperadminAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const fromDate = from || todayISO()
  const toDate = to || shiftDate(fromDate, 6)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/superadmin/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.platform_role !== 'super_admin') redirect('/admin/dashboard')

  const matrix = await getCapacityMatrix(supabase, { fromDate, toDate, showSkillLevel: false, zone: null })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: escalationsData } = await (supabase as any)
    .from('worker_allocation_escalations')
    .select('id, booking_ref, substage_id, trade, remark, escalated_to_superadmin_remark, escalated_to_superadmin_at')
    .eq('status', 'escalated_to_superadmin')
    .order('escalated_to_superadmin_at', { ascending: true })
  const escalations = (escalationsData ?? []) as SuperadminEscalation[]

  const substageIds = [...new Set(escalations.map((e) => e.substage_id))]
  const { data: substagesForEscalations } = substageIds.length > 0
    ? await supabase.from('job_milestone_substages').select('id, substage_code').in('id', substageIds)
    : { data: [] as { id: string; substage_code: string }[] }
  const substageById = Object.fromEntries((substagesForEscalations ?? []).map((s) => [s.id, s]))

  const { data: allWorkersData } = await supabase
    .from('workers')
    .select('id, full_name, trade, skill_level, zones, daily_wage_inr')
    .eq('is_active', true)
    .in('approval_status', ['admin_approved', 'coordinator_approved'])
  const allWorkers = (allWorkersData ?? []) as WorkerOption[]

  const escalationTiers = await getJobTiers(supabase, [...new Set(escalations.map((e) => e.booking_ref))])

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

  const windowDays = Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/superadmin/dashboard" className="text-white/80 hover:text-white shrink-0" aria-label="Back to dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Allocation Overview</h1>
            <p className="text-blue-200 text-xs">Trade → Day, platform-wide — demand vs. available, every job in hand</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        <form method="get" className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">From</label>
            <input type="date" name="from" defaultValue={fromDate} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">To</label>
            <input type="date" name="to" defaultValue={toDate} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
          </div>
          <button type="submit" className="bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-lg">Apply</button>
          <div className="flex gap-2 ml-auto">
            <Link href={`/superadmin/allocation?from=${shiftDate(fromDate, -windowDays)}&to=${shiftDate(toDate, -windowDays)}`} className="text-xs font-bold text-[#2E74B5] border border-[#2E74B5]/30 px-3 py-2 rounded-lg">← Prev {windowDays}d</Link>
            <Link href={`/superadmin/allocation?from=${todayISO()}&to=${shiftDate(todayISO(), 6)}`} className="text-xs font-bold text-[#2E74B5] border border-[#2E74B5]/30 px-3 py-2 rounded-lg">Today</Link>
            <Link href={`/superadmin/allocation?from=${shiftDate(fromDate, windowDays)}&to=${shiftDate(toDate, windowDays)}`} className="text-xs font-bold text-[#2E74B5] border border-[#2E74B5]/30 px-3 py-2 rounded-lg">Next {windowDays}d →</Link>
          </div>
        </form>

        <CapacityMatrixView days={matrix.days} rows={matrix.rows} />

        <section>
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">
            Escalations Waiting on Superadmin — {escalations.length}
          </p>
          <SuperadminEscalations escalations={escalations} substageById={substageById} allWorkers={allWorkers} tiers={escalationTiers} />
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
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No jobs stuck in client negotiation.</p>
          )}
        </section>

      </main>
    </div>
  )
}
