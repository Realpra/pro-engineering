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

export type ExtraWorkRoughItem = {
  description: string
  qty: number
  unit: string
  amount: number
}

export type SubmitExtraWorkInput = {
  booking_ref: string
  trigger_type: 'technical_recommendation' | 'client_demand'
  client_request: string | null
  description: string
  justification: string
  rough_items: ExtraWorkRoughItem[]
  timeline_impact_days: number
}

// SA-10 spec (June log line 10503-10507): "description (minimum 50
// characters enforced)... If cost impact above ₹5,000 or timeline above
// 2 days: Coordinator auto-notified alongside Sub-Coordinator." Neither
// was enforced before -- the description had no length check, and no
// timeline field existed at all.
const MIN_DESCRIPTION_LENGTH = 50
const COST_NOTIFY_THRESHOLD = 5000
const TIMELINE_NOTIFY_THRESHOLD_DAYS = 2

export async function submitExtraWork(
  supervisorId: string,
  data: SubmitExtraWorkInput,
): Promise<{ success?: true; error?: string }> {
  if (data.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    return { error: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (currently ${data.description.trim().length}).` }
  }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const costImpact = data.rough_items.reduce((sum, it) => sum + it.amount, 0)
  // Live check this session (not assumed): app/admin/scope's ScopeTabs.tsx and
  // app/admin/milestones' MilestoneTabs.tsx already read cost_impact_additions/
  // cost_impact_deletions/cost_impact_net/proposed_additions on this table --
  // a real, pre-existing, richer cost model this action never populated (per
  // app/admin/milestones/page.tsx's own comment: "Supervisor's own
  // submitExtraWork never populates cost_impact_net at all", Duplicate/
  // Conflict #15). This flow only ever proposes additions (never deletions),
  // so net = additions. timeline_impact_days is a real pre-existing INTEGER
  // column (confirmed live -- a decimal silently rounds), rounded here too so
  // the stored value always matches what the UI enforces.
  const timelineImpactDays = Math.round(data.timeline_impact_days)
  const proposedAdditions = data.rough_items.map(it => ({
    description: it.description,
    qty: it.qty,
    unit: it.unit,
    amount: it.amount,
  }))

  const { error: insertErr } = await supabase.from('scope_change_requests').insert({
    booking_ref: data.booking_ref,
    change_type: 'addition',
    change_status: 'submitted',
    raised_by_role: 'supervisor',
    trigger_type: data.trigger_type,
    client_request: data.trigger_type === 'client_demand' ? data.client_request ?? data.description : null,
    supervisor_rough_estimate: data.rough_items,
    proposed_additions: proposedAdditions,
    cost_impact_additions: costImpact,
    cost_impact_deletions: 0,
    cost_impact_net: costImpact,
    timeline_impact_days: timelineImpactDays,
    justification_cos: data.justification,
    supervisor_submitted_at: now,
    requested_at: now,
    requested_by: supervisorId,
  })

  if (insertErr) return { error: insertErr.message }

  const { error: enquiryErr } = await supabase
    .from('guest_enquiries')
    .update({ status: 'scope_change_pending' })
    .eq('booking_ref', data.booking_ref)

  if (enquiryErr) return { error: enquiryErr.message }

  // "Coordinator auto-notified alongside Sub-Coordinator" -- Sub-Coordinator
  // already reaches this via their own scope_change_requests queue; this
  // adds the missing Coordinator notification specifically when either
  // threshold is crossed, via the same site_instructions pattern already
  // frozen this session.
  if (costImpact > COST_NOTIFY_THRESHOLD || timelineImpactDays > TIMELINE_NOTIFY_THRESHOLD_DAYS) {
    const { data: coordinators } = await adminClient().from('users').select('id').eq('platform_role', 'coordinator')
    if (coordinators && coordinators.length > 0) {
      await supabase.from('site_instructions').insert(
        coordinators.map(c => ({
          booking_ref: data.booking_ref,
          instruction_type: 'scope_change_threshold_breach',
          instruction_category: 'system_alert',
          priority: 'high',
          instruction_text: `Scope change on ${data.booking_ref} exceeds threshold -- cost impact ₹${costImpact.toLocaleString('en-IN')}, timeline impact ${timelineImpactDays} day(s).`,
          issued_to: c.id,
          issued_at: now,
          status: 'pending',
          is_active: true,
        })),
      )
    }
  }

  await logJobMovement(supabase, {
    bookingRef: data.booking_ref, stage: 'scope_change', action: 'raised', toRole: 'coordinator',
    remarks: `${data.trigger_type === 'client_demand' ? 'Client requested' : 'Site demands'}: ${data.description.trim()}`,
  })
  revalidatePath('/supervisor/extra-works')
  return { success: true }
}
