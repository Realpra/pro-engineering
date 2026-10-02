// Shared demand-vs-supply capacity matrix: Trade (and optionally Skill
// Level) x Day, across every job in scope. Used by both the Admin and
// Superadmin allocation overview screens (2 Oct 2026) -- one real
// aggregation, not two competing implementations, per this project's own
// "search before create fresh" discipline.
//
// Demand comes straight from job_milestone_substages' own
// early_start_date/early_finish_date + skilled/unskilled_workers_per_day --
// the real work-program dates fixed at estimate approval. Supply comes from
// worker_day_slots, joined back to workers.trade/skill_level. No new field
// is needed for either half.

export type MatrixCell = { date: string; needed: number; assigned: number }
export type MatrixRow = { key: string; label: string; cells: MatrixCell[] }
export type MatrixResult = { rows: MatrixRow[]; days: string[] }

const SKILLED_LEVELS = new Set(['skilled', 'highly_skilled'])
const UNSKILLED_LEVELS = new Set(['unskilled', 'semi_skilled'])

type SubstageRow = {
  booking_ref: string
  trade_type: string | null
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  early_start_date: string | null
  early_finish_date: string | null
}
type WorkerRow = { id: string; trade: string | null; skill_level: string | null }
type SlotRow = { worker_id: string; slot_date: string; booking_ref: string }

function listDates(from: string, to: string, maxDays = 60): string[] {
  const dates: string[] = []
  const cur = new Date(`${from}T00:00:00Z`)
  const last = new Date(`${to}T00:00:00Z`)
  let i = 0
  while (cur.getTime() <= last.getTime() && i < maxDays) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
    i++
  }
  return dates
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCapacityMatrix(
  supabase: any,
  params: { fromDate: string; toDate: string; showSkillLevel: boolean; zone?: string | null },
): Promise<MatrixResult> {
  const days = listDates(params.fromDate, params.toDate)

  const { data: substagesData } = await supabase
    .from('job_milestone_substages')
    .select('booking_ref, trade_type, skilled_workers_per_day, unskilled_workers_per_day, early_start_date, early_finish_date, status')
    .not('status', 'in', '(completed,sent_back)')
    .not('early_start_date', 'is', null)
    .not('early_finish_date', 'is', null)
    .lte('early_start_date', params.toDate)
    .gte('early_finish_date', params.fromDate)

  let substages = (substagesData ?? []) as SubstageRow[]

  if (params.zone) {
    const refs = [...new Set(substages.map((s) => s.booking_ref))]
    const { data: jobsData } = refs.length > 0
      ? await supabase.from('guest_enquiries').select('booking_ref, zone').in('booking_ref', refs)
      : { data: [] as { booking_ref: string; zone: string | null }[] }
    const zoneByRef = new Map((jobsData ?? []).map((j: { booking_ref: string; zone: string | null }) => [j.booking_ref, j.zone]))
    substages = substages.filter((s) => zoneByRef.get(s.booking_ref) === params.zone)
  }

  const { data: workersData } = await supabase.from('workers').select('id, trade, skill_level').eq('is_active', true)
  const workerById = new Map((workersData ?? []).map((w: WorkerRow) => [w.id, w]))

  const { data: slotsData } = await supabase
    .from('worker_day_slots')
    .select('worker_id, slot_date, booking_ref')
    .gte('slot_date', params.fromDate)
    .lte('slot_date', params.toDate)

  let slots = (slotsData ?? []) as SlotRow[]
  if (params.zone) {
    const refs = new Set(substages.map((s) => s.booking_ref))
    slots = slots.filter((s) => refs.has(s.booking_ref))
  }

  const trades = [...new Set(substages.map((s) => s.trade_type).filter((t): t is string => !!t))].sort()
  const buckets: Array<'skilled' | 'unskilled' | undefined> = params.showSkillLevel ? ['skilled', 'unskilled'] : [undefined]

  const rows: MatrixRow[] = []
  for (const trade of trades) {
    for (const bucket of buckets) {
      const label = bucket ? `${trade} — ${bucket === 'skilled' ? 'Skilled' : 'Unskilled'}` : trade
      const key = bucket ? `${trade}::${bucket}` : trade
      const cells: MatrixCell[] = days.map((date) => {
        const activeSubstages = substages.filter(
          (s) => s.trade_type === trade && s.early_start_date! <= date && s.early_finish_date! >= date,
        )
        let needed = 0
        if (!bucket) {
          needed = activeSubstages.reduce((sum, s) => sum + (s.skilled_workers_per_day ?? 0) + (s.unskilled_workers_per_day ?? 0), 0)
        } else if (bucket === 'skilled') {
          needed = activeSubstages.reduce((sum, s) => sum + (s.skilled_workers_per_day ?? 0), 0)
        } else {
          needed = activeSubstages.reduce((sum, s) => sum + (s.unskilled_workers_per_day ?? 0), 0)
        }

        const assignedIds = new Set<string>()
        for (const s of slots) {
          if (s.slot_date !== date) continue
          const w = workerById.get(s.worker_id) as WorkerRow | undefined
          if (!w || w.trade !== trade) continue
          if (bucket === 'skilled' && !SKILLED_LEVELS.has(w.skill_level ?? '')) continue
          if (bucket === 'unskilled' && !UNSKILLED_LEVELS.has(w.skill_level ?? '')) continue
          assignedIds.add(s.worker_id)
        }
        return { date, needed, assigned: assignedIds.size }
      })
      rows.push({ key, label, cells })
    }
  }

  return { rows, days }
}
