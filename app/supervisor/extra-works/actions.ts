'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  const { error: insertErr } = await supabase.from('scope_change_requests').insert({
    booking_ref: data.booking_ref,
    change_type: 'addition',
    change_status: 'submitted',
    raised_by_role: 'supervisor',
    trigger_type: data.trigger_type,
    client_request: data.trigger_type === 'client_demand' ? data.client_request ?? data.description : null,
    supervisor_rough_estimate: data.rough_items,
    cost_impact_amount: costImpact,
    timeline_impact_days: data.timeline_impact_days,
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
  if (costImpact > COST_NOTIFY_THRESHOLD || data.timeline_impact_days > TIMELINE_NOTIFY_THRESHOLD_DAYS) {
    const { data: coordinators } = await supabase.from('users').select('id').eq('platform_role', 'coordinator')
    if (coordinators && coordinators.length > 0) {
      await supabase.from('site_instructions').insert(
        coordinators.map(c => ({
          booking_ref: data.booking_ref,
          instruction_type: 'scope_change_threshold_breach',
          priority: 'high',
          instruction_text: `Scope change on ${data.booking_ref} exceeds threshold -- cost impact ₹${costImpact.toLocaleString('en-IN')}, timeline impact ${data.timeline_impact_days} day(s).`,
          issued_to: c.id,
          issued_at: now,
          status: 'pending',
          is_active: true,
        })),
      )
    }
  }

  revalidatePath('/supervisor/extra-works')
  return { success: true }
}
