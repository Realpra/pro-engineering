/* eslint-disable @typescript-eslint/no-explicit-any */
// Job movement log (owner, 31 Oct 2026) -- supabase/migrations/20261031_job_movement_log.sql.
// Every movement of a job between roles is written here, with the action taken.
//
// Writing a log row must never stop the person's own action: logJobMovement
// catches every failure and only reports it to the server console.

export type MovementStage =
  | 'request' | 'routing' | 'survey' | 'estimate' | 'premium'
  | 'client' | 'execution' | 'milestone' | 'scope_change'

export type MovementAction =
  | 'created' | 'forwarded' | 'approved' | 'returned' | 'rejected' | 'decided'
  | 'client_accepted' | 'client_rejected' | 'client_review'

export type MovementInput = {
  bookingRef?: string | null
  /** When only a sub-stage id is known, the job is looked up from it. */
  substageId?: string | null
  /** When only a site-visit report id is known, the job is looked up from it. */
  siteVisitReportId?: string | null
  /** When only a scope change or premium request id is known, the job is looked up from it. */
  scopeChangeRequestId?: string | null
  premiumRequestId?: string | null
  stage: MovementStage
  action: MovementAction
  itemType?: string | null
  itemId?: string | null
  /** Leave out to use the signed-in user and their role. */
  fromUserId?: string | null
  fromRole?: string | null
  toRole?: string | null
  toUserId?: string | null
  remarks?: string | null
}

// Owner's counting rules: a send-back for correction counts (the first is normal,
// the second makes the job pending); decisions and client acts never count; a client
// rejection or request for review re-runs the process and resets the count.
function countsAsReturn(stage: MovementStage, action: MovementAction): boolean {
  return action === 'returned' && (stage === 'survey' || stage === 'estimate' || stage === 'milestone' || stage === 'routing')
}

function resetsCount(stage: MovementStage, action: MovementAction): boolean {
  return stage === 'client' && (action === 'client_rejected' || action === 'client_review')
}

export async function logJobMovement(supabase: any, m: MovementInput): Promise<void> {
  try {
    let bookingRef = m.bookingRef ?? null
    if (!bookingRef && m.substageId) {
      const { data } = await supabase.from('job_milestone_substages').select('booking_ref').eq('id', m.substageId).maybeSingle()
      bookingRef = data?.booking_ref ?? null
    }
    if (!bookingRef && m.siteVisitReportId) {
      const { data } = await supabase.from('site_visit_reports').select('booking_ref').eq('id', m.siteVisitReportId).maybeSingle()
      bookingRef = data?.booking_ref ?? null
    }
    for (const [table, id] of [
      ['scope_change_requests', m.scopeChangeRequestId],
      ['premium_approval_requests', m.premiumRequestId],
    ] as const) {
      if (bookingRef || !id) continue
      const { data } = await supabase.from(table).select('booking_ref').eq('id', id).maybeSingle()
      bookingRef = data?.booking_ref ?? null
    }
    if (!bookingRef) {
      console.error('[jobMovementLog] no booking_ref for', m.stage, m.action)
      return
    }

    const { data: job } = await supabase
      .from('guest_enquiries').select('id').eq('booking_ref', bookingRef)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!job?.id) {
      console.error('[jobMovementLog] job not found:', bookingRef)
      return
    }

    let fromUserId = m.fromUserId ?? null
    let fromRole = m.fromRole ?? null
    if (fromUserId === null && m.fromUserId === undefined) {
      const { data: { user } } = await supabase.auth.getUser()
      fromUserId = user?.id ?? null
    }
    if (fromUserId && !fromRole) {
      const { data: profile } = await supabase.from('users').select('platform_role').eq('id', fromUserId).maybeSingle()
      fromRole = profile?.platform_role ?? null
    }

    const { error } = await supabase.from('job_movement_log').insert({
      enquiry_id: job.id,
      booking_ref: bookingRef,
      stage: m.stage,
      action: m.action,
      counts_as_return: countsAsReturn(m.stage, m.action),
      resets_return_count: resetsCount(m.stage, m.action),
      item_type: m.itemType ?? null,
      item_id: m.itemId ?? null,
      from_user_id: fromUserId,
      from_role: fromRole,
      to_role: m.toRole ?? null,
      to_user_id: m.toUserId ?? null,
      remarks: m.remarks?.trim() ? m.remarks.trim() : null,
    })
    if (error) console.error('[jobMovementLog] insert failed:', error.message)
  } catch (e) {
    console.error('[jobMovementLog] failed:', (e as Error).message)
  }
}

// ── reading ──────────────────────────────────────────────────────────────────

export type MovementRow = {
  id: string
  enquiry_id: string
  booking_ref: string
  stage: string
  action: string
  counts_as_return: boolean
  resets_return_count: boolean
  item_type: string | null
  item_id: string | null
  from_user_id: string | null
  from_role: string | null
  to_role: string | null
  to_user_id: string | null
  remarks: string | null
  created_at: string
}

/**
 * For one job's rows: the highest number of send-backs any single item has had
 * since the last client rejection/review. 2 or more = a pending job.
 */
export function maxReturnsOnOneItem(rows: MovementRow[]): number {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  let counts: Record<string, number> = {}
  for (const r of sorted) {
    if (r.resets_return_count) { counts = {}; continue }
    if (!r.counts_as_return) continue
    const key = `${r.stage}|${r.item_type ?? ''}|${r.item_id ?? ''}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.values(counts).reduce((m, n) => Math.max(m, n), 0)
}

export const PENDING_RETURN_THRESHOLD = 2

/** booking_ref -> pending? for every job that has log rows. */
export function pendingByJob(rows: MovementRow[]): Record<string, boolean> {
  const byJob: Record<string, MovementRow[]> = {}
  for (const r of rows) (byJob[r.booking_ref] ??= []).push(r)
  const out: Record<string, boolean> = {}
  for (const [ref, list] of Object.entries(byJob)) out[ref] = maxReturnsOnOneItem(list) >= PENDING_RETURN_THRESHOLD
  return out
}

/** A job is in execution once confirmed for execution (or its status says so). */
export function isInExecution(status: string | null | undefined, confirmedForExecutionAt: string | null | undefined): boolean {
  if (confirmedForExecutionAt) return true
  const s = String(status ?? '').toLowerCase()
  return s.includes('confirm') || s.includes('progress') || s.includes('work_started') || s.includes('milestone')
}

export type JobClass = 'pending' | 'new' | 'in_execution'

/** Owner's classification (31 Oct 2026): pending wins; otherwise new until execution. */
export function classifyJob(isPending: boolean, status: string | null | undefined, confirmedAt: string | null | undefined): JobClass {
  if (isPending) return 'pending'
  return isInExecution(status, confirmedAt) ? 'in_execution' : 'new'
}
