'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logJobMovement } from '@/lib/jobMovementLog'

const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

// Supervisor is not staff under is_staff() (project owner's explicit
// decision, 28 Sep 2026) -- its own session can't read the users table
// beyond its own row, so recipient lookups need a service-role client.
// Matches the exact precedent already used for checkPhoneExists (Session 65).
function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

// "Site Head Not Ready" (SA-1 dashboard action, June log line 10465 area --
// supervisor arrives at a slot but the Site Incharge isn't present/ready).
// Reuses the existing supervisor_daily_routes.visit_status column (free
// text, no CHECK constraint -- confirmed by grep of every migration) rather
// than adding a new table for what is a single status flag.
export async function markSiteHeadNotReady(slotId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('supervisor_daily_routes')
    .update({ visit_status: 'site_head_not_ready' })
    .eq('id', slotId)
  if (error) return { error: error.message }
  await logJobMovement(supabase, {
    routeSlotId: slotId, stage: 'incident', action: 'raised', itemType: 'supervisor_daily_route', itemId: slotId,
    remarks: 'Site Head not ready at the visit',
  })
  revalidatePath('/supervisor/dashboard')
  return {}
}

// LTF -- correction (29 Sep 2026, project owner): the real-world source of
// "is this site ready for tomorrow" is Site Head, Supervisor, AND the
// Site Visit Manager form together -- not Site Incharge alone (the first
// pass at this only put the button on Site Incharge's dashboard). This is
// Supervisor's own direct submission (e.g. after a phone update from Site
// Head, without doing a full visit) -- SiteVisitManager's Screen 2 LTF-per-
// substage answers feed the same ltf_feeds table separately, at
// submitReport() time (see app/supervisor/site-visit/actions.ts).
//
// CORRECTED 29 Sep 2026, live schema check: no booking_ref column exists on
// ltf_feeds at all (confirmed via information_schema -- the real columns are
// site_id/milestone_id/submitted_by/submitted_at/is_ready_tomorrow/
// target_time_slot/contractor_notes/accountability_flag). Scoped by site_id
// only now. Also uses adminClient() (this file's own service-role helper) --
// a live test caught addSlotManually failing RLS under Supervisor's own
// session on the sibling supervisor_daily_routes table, and Supervisor is
// already documented elsewhere in this file as "not staff" under is_staff()
// with restricted table access, so this write doesn't risk finding out the
// same way twice.
export async function submitSupervisorLTF(params: {
  siteId: string
  supervisorUserId: string
  isReadyTomorrow: boolean
  targetTimeSlot: 'morning' | 'afternoon' | 'evening' | null
  contractorNotes: string | null
}): Promise<{ error?: string }> {
  const admin = adminClient()
  const todayStart = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'

  const { data: existing } = await admin
    .from('ltf_feeds')
    .select('id')
    .eq('site_id', params.siteId)
    .gte('submitted_at', todayStart)
    .maybeSingle()

  const payload = {
    site_id: params.siteId,
    submitted_by: params.supervisorUserId,
    submitted_at: new Date().toISOString(),
    is_ready_tomorrow: params.isReadyTomorrow,
    target_time_slot: params.targetTimeSlot,
    contractor_notes: params.contractorNotes,
    accountability_flag: false,
  }

  const { error } = existing
    ? await admin.from('ltf_feeds').update(payload).eq('id', existing.id)
    : await admin.from('ltf_feeds').insert(payload)

  if (error) return { error: error.message }
  revalidatePath('/supervisor/dashboard')
  return {}
}

// SOS (June log nav-bar spec: "SOS floating red button always visible
// during active job hours... cannot be disabled by anyone" -- confirmed
// not built anywhere in app/supervisor/, PENDING #28). Reuses the already-
// frozen site_instructions fan-out pattern from Session 67 (resolveRecipients
// in app/sub-coordinator/actions.ts) rather than a new table -- fans out one
// row per real admin user, priority='critical' (the same value Dashboard's
// own Layer 0 Override Banner already treats as top-priority).
export async function raiseSOS(params: {
  supervisorId: string
  supervisorUserId: string
  bookingRef: string | null
  note: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: admins } = await adminClient().from('users').select('id').eq('platform_role', 'admin')
  if (!admins || admins.length === 0) return { error: 'No admin recipient found to raise SOS to.' }

  const { error } = await supabase.from('site_instructions').insert(
    admins.map(a => ({
      booking_ref: params.bookingRef,
      instruction_type: 'sos',
      instruction_category: 'system_alert',
      priority: 'critical',
      instruction_text: params.note || 'SOS raised by supervisor -- immediate attention required.',
      issued_by: params.supervisorUserId,
      issued_to: a.id,
      issued_at: new Date().toISOString(),
      status: 'pending',
      is_active: true,
    })),
  )
  if (error) return { error: error.message }
  if (params.bookingRef) {
    await logJobMovement(supabase, {
      bookingRef: params.bookingRef, stage: 'incident', action: 'raised', fromUserId: params.supervisorUserId,
      toRole: 'admin', remarks: `SOS: ${params.note || 'immediate attention required'}`,
    })
  }
  revalidatePath('/supervisor/dashboard')
  return {}
}
