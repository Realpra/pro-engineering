'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

// Same precedent as Supervisor's raiseSOS (app/supervisor/dashboard/actions.ts)
// -- Site Incharge's own session can't be assumed to read the users table
// beyond its own row, so recipient lookups need a service-role client.
function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

// PENDING #17: Site Incharge has always had a real, deliberate design need
// to "request more resources at day's end" (CLAUDE.md's PROCESS FLOW
// section) but no outbound channel anywhere -- site_instructions only ever
// flowed INTO Site Incharge (issued_to) from Sub-Coordinator, confirmed by
// grep. The natural recipient is Sub-Coordinator, but the project owner's
// explicit decision (29 Sep 2026) is not to build out the Sub-Coordinator
// role right now -- so this routes to Coordinator instead, exactly the same
// stopgap-to-Coordinator pattern already used for client_handover_
// dissatisfaction (PENDING #43). Reuses the fan-out-to-every-real-recipient
// shape already frozen this session (raiseSOS, sendSupervisorInstruction).
export async function requestResources(params: {
  bookingRef: string | null
  siteInchargeUserId: string
  note: string
}): Promise<{ error?: string }> {
  if (!params.note.trim()) return { error: 'Describe what you need.' }

  const supabase = await createClient()

  const { data: coordinators } = await adminClient().from('users').select('id').eq('platform_role', 'coordinator')
  if (!coordinators || coordinators.length === 0) return { error: 'No coordinator recipient found.' }

  const { error } = await supabase.from('site_instructions').insert(
    coordinators.map((c) => ({
      booking_ref: params.bookingRef,
      instruction_type: 'resource',
      instruction_category: 'site_instruction',
      priority: 'high',
      instruction_text: params.note.trim(),
      issued_by: params.siteInchargeUserId,
      issued_to: c.id,
      issued_at: new Date().toISOString(),
      status: 'pending',
      is_active: true,
    })),
  )
  if (error) return { error: error.message }
  revalidatePath('/site-incharge/dashboard')
  return {}
}

// ROOT GAP CONFIRMED (29 Sep 2026, by repo-wide grep): ltf_feeds is read in
// 4 places (app/sub-coordinator/dashboard, ltf, route pages) and updated
// once (rejectLtfFromRoute sets accountability_flag), but INSERTED nowhere
// in the entire codebase -- the "Site heads submit LTF feeds by 20:00 each
// evening" rule shown on Sub-Coordinator's own LTF page has never had a
// writer. This is that writer, on the actual Site Head role per the
// original design's own naming.
//
// CORRECTED 29 Sep 2026, live schema check: the first pass assumed a
// booking_ref column (copying app/sub-coordinator/ltf/page.tsx's own SELECT,
// which turns out to make the same wrong assumption -- that page has never
// been live-tested either, per the login being broken). information_schema
// confirms ltf_feeds' real columns: id, site_id, milestone_id, submitted_by,
// submitted_at, is_ready_tomorrow, target_time_slot, contractor_notes,
// accountability_flag, created_at -- no booking_ref at all. Site scoping is
// by site_id (a guest_enquiries.id UUID) only. One feed per site per day: a
// same-day resubmission updates the existing row rather than creating a
// duplicate, since no unique constraint can be assumed on this live-only,
// no-migration-file table (PENDING #20).
export async function submitLTF(params: {
  siteId: string
  siteInchargeUserId: string
  isReadyTomorrow: boolean
  targetTimeSlot: 'morning' | 'afternoon' | 'evening' | null
  contractorNotes: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const todayStart = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('ltf_feeds')
    .select('id')
    .eq('site_id', params.siteId)
    .gte('submitted_at', todayStart)
    .maybeSingle()

  const payload = {
    site_id: params.siteId,
    submitted_by: params.siteInchargeUserId,
    submitted_at: new Date().toISOString(),
    is_ready_tomorrow: params.isReadyTomorrow,
    target_time_slot: params.targetTimeSlot,
    contractor_notes: params.contractorNotes,
    accountability_flag: false,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = existing
    ? await (supabase as any).from('ltf_feeds').update(payload).eq('id', existing.id)
    : await (supabase as any).from('ltf_feeds').insert(payload)

  if (error) return { error: error.message }
  revalidatePath('/site-incharge/dashboard')
  return {}
}
