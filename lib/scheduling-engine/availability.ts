// Worker Supply Ledger — day-grain, ALWAYS derived fresh from real Task Ledger commitments,
// never hand-set. "Released capacity becomes visible to every open Task Ledger row platform-
// wide the moment it's recomputed — it is never silently reserved for the job that just lost
// it." (Phase E6 / C1 significance notes, flow document.)
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export type AvailabilityToken =
  | 'AVAILABLE_FULL_DAY'
  | 'AM_AVAILABLE_PM_BOOKED'
  | 'AM_BOOKED_PM_AVAILABLE'
  | 'BOOKED_FULL_DAY'
  | 'MARKED_UNAVAILABLE'

/** Pure: the same shift-window-set -> token rule used by deriveAndUpsertAvailability and the
 *  batch grid reader below, factored out once so both stay in agreement. */
function tokenFromWindows(isMarkedUnavailable: boolean, windows: Set<string>): AvailabilityToken {
  if (isMarkedUnavailable) return 'MARKED_UNAVAILABLE'
  if (windows.has('FULL_DAY') || (windows.has('AM') && windows.has('PM'))) return 'BOOKED_FULL_DAY'
  if (windows.has('AM')) return 'AM_BOOKED_PM_AVAILABLE'
  if (windows.has('PM')) return 'AM_AVAILABLE_PM_BOOKED'
  return 'AVAILABLE_FULL_DAY'
}

/**
 * Recomputes one worker's real availability for one date from their actual Task Ledger
 * commitments (never trusts a stale stored value), and upserts the result into
 * worker_supply_ledger so the row is there for anyone reading the ledger directly.
 * Returns the fresh token.
 */
export async function deriveAndUpsertAvailability(
  supabase: AnyClient,
  workerId: string,
  targetDate: string
): Promise<AvailabilityToken> {
  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .select('is_available')
    .eq('id', workerId)
    .maybeSingle()
  if (workerError) throw new Error(`deriveAndUpsertAvailability (worker): ${workerError.message}`)
  if (worker?.is_available === false) {
    await upsertLedgerRow(supabase, workerId, targetDate, 'MARKED_UNAVAILABLE')
    return 'MARKED_UNAVAILABLE'
  }

  const { data: commitments, error: taskError } = await supabase
    .from('task_ledger')
    .select('shift_window')
    .eq('assigned_worker_id', workerId)
    .eq('target_date', targetDate)
    .in('slot_status', ['Pending', 'Completed'])
  if (taskError) throw new Error(`deriveAndUpsertAvailability (task_ledger): ${taskError.message}`)

  const windows = new Set<string>((commitments ?? []).map((c: { shift_window: string }) => c.shift_window))
  const token = tokenFromWindows(false, windows)
  await upsertLedgerRow(supabase, workerId, targetDate, token)
  return token
}

/**
 * Day-by-day availability bars for a set of workers across a date range (10 Oct 2026
 * correction: "the display of available and required on the days on this job... shown in
 * above and below rows bars"). A pure batch READ, no upsert -- one query covering every
 * worker/date in range instead of deriveAndUpsertAvailability's one-worker-one-date loop, since
 * rendering N candidate rows x M days that way would be N*M round trips. Same token rule, same
 * meaning, just computed in memory from one fetch.
 */
export async function getAvailabilityGrid(
  supabase: AnyClient,
  params: { workerIds: string[]; startDate: string; endDate: string }
): Promise<Map<string, Map<string, AvailabilityToken>>> {
  const grid = new Map<string, Map<string, AvailabilityToken>>()
  if (params.workerIds.length === 0) return grid

  const { data: workers, error: workersError } = await supabase
    .from('workers')
    .select('id, is_available')
    .in('id', params.workerIds)
  if (workersError) throw new Error(`getAvailabilityGrid (workers): ${workersError.message}`)
  const unavailableById = new Map<string, boolean>(
    (workers ?? []).map((w: { id: string; is_available: boolean | null }) => [w.id, w.is_available === false])
  )

  const { data: commitments, error: taskError } = await supabase
    .from('task_ledger')
    .select('assigned_worker_id, target_date, shift_window')
    .in('assigned_worker_id', params.workerIds)
    .gte('target_date', params.startDate)
    .lte('target_date', params.endDate)
    .in('slot_status', ['Pending', 'Completed'])
  if (taskError) throw new Error(`getAvailabilityGrid (task_ledger): ${taskError.message}`)

  const windowsByWorkerDate = new Map<string, Set<string>>()
  for (const c of (commitments ?? []) as { assigned_worker_id: string; target_date: string; shift_window: string }[]) {
    const key = `${c.assigned_worker_id}::${c.target_date}`
    if (!windowsByWorkerDate.has(key)) windowsByWorkerDate.set(key, new Set())
    windowsByWorkerDate.get(key)!.add(c.shift_window)
  }

  const dates: string[] = []
  for (let d = new Date(params.startDate); d <= new Date(params.endDate); d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }

  for (const workerId of params.workerIds) {
    const byDate = new Map<string, AvailabilityToken>()
    const isUnavailable = unavailableById.get(workerId) ?? false
    for (const date of dates) {
      const windows = windowsByWorkerDate.get(`${workerId}::${date}`) ?? new Set<string>()
      byDate.set(date, tokenFromWindows(isUnavailable, windows))
    }
    grid.set(workerId, byDate)
  }
  return grid
}

async function upsertLedgerRow(
  supabase: AnyClient,
  workerId: string,
  targetDate: string,
  token: AvailabilityToken
) {
  const { error } = await supabase
    .from('worker_supply_ledger')
    .upsert(
      { worker_id: workerId, target_date: targetDate, availability_token: token, updated_at: new Date().toISOString() },
      { onConflict: 'worker_id,target_date' }
    )
  if (error) throw new Error(`upsertLedgerRow: ${error.message}`)
}

/** True only if the worker can take a NEW booking of the given shift_window on this date. */
export function tokenAllowsBooking(token: AvailabilityToken, shiftWindow: 'AM' | 'PM' | 'FULL_DAY'): boolean {
  if (token === 'MARKED_UNAVAILABLE' || token === 'BOOKED_FULL_DAY') return false
  if (token === 'AVAILABLE_FULL_DAY') return true
  if (shiftWindow === 'FULL_DAY') return false
  if (token === 'AM_BOOKED_PM_AVAILABLE') return shiftWindow === 'PM'
  if (token === 'AM_AVAILABLE_PM_BOOKED') return shiftWindow === 'AM'
  return false
}

/**
 * Candidate pool for a slot: active workers of the right trade, in the given zones (own zone
 * or an adjoining zone's donor pool), filtered to those whose freshly-derived availability
 * actually allows this shift_window — never a stale stored flag.
 */
export async function findAvailableCandidates(
  supabase: AnyClient,
  params: { trade: string; zones: string[]; targetDate: string; shiftWindow: 'AM' | 'PM' | 'FULL_DAY' }
): Promise<{ id: string; full_name: string; skill_grade: number | null; jobs_completed: number | null }[]> {
  const { data: pool, error } = await supabase
    .from('workers')
    .select('id, full_name, skill_grade, zones, is_available, jobs_completed')
    .eq('trade', params.trade)
    .eq('is_available', true)
    .overlaps('zones', params.zones)
  if (error) throw new Error(`findAvailableCandidates: ${error.message}`)

  const candidates: { id: string; full_name: string; skill_grade: number | null; jobs_completed: number | null }[] = []
  for (const w of pool ?? []) {
    const token = await deriveAndUpsertAvailability(supabase, w.id, params.targetDate)
    if (tokenAllowsBooking(token, params.shiftWindow)) {
      candidates.push({ id: w.id, full_name: w.full_name, skill_grade: w.skill_grade, jobs_completed: w.jobs_completed })
    }
  }
  // Secondary ranking within one deviance level (every candidate here already shares the
  // same skill_grade, filtered by the caller): more completed jobs first -- the one
  // already-captured Quality & Track Record field (Worker Onboarding, Screen 3) that
  // distinguishes otherwise-identical-grade candidates without inventing a new field or a
  // new business rule. Ties (including null) keep a stable order by worker id.
  candidates.sort((a, b) => {
    const diff = (b.jobs_completed ?? 0) - (a.jobs_completed ?? 0)
    if (diff !== 0) return diff
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return candidates
}
