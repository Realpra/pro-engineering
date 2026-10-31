'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateBOQ } from '@/app/admin/estimate/[bookingRef]/actions'
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

// PENDING #18 (Session 59, confirmed): "generateBOQ is callable only from
// admin's own page... contradicting the confirmed business rule that
// Estimator/Sub-Coordinator(if labour source)/Supervisor(on first visit)
// can all draft an estimate." generateBOQ itself has no role check beyond
// authentication -- the "admin only" restriction was purely which page
// could reach it. Reused directly rather than duplicated.
export async function supervisorGenerateBOQ(
  bookingRef: string,
  tier: 'budget' | 'premium' | 'luxury',
): Promise<{ error?: string }> {
  const result = await generateBOQ(bookingRef, tier, 'LM')
  if (result.error) return { error: result.error }
  revalidatePath('/supervisor/estimate')
  return {}
}

export type EstimateAction = 'confirm' | 'revise' | 'modify'

// The full line-item editor (EstimateConsole.tsx, saveEstimate's
// LineItem[]/EstimateTotals shape) is Admin's own detailed editing tool --
// porting that whole UI into Supervisor's app is out of scope here.
// Instead this is a real, scoped recommendation: Supervisor's decision is
// recorded on the live boq_generated row and routed to Coordinator via the
// same site_instructions pattern already frozen this session, rather than
// a second competing line-item-editing surface.
export async function submitSupervisorEstimateReview(params: {
  bookingRef: string
  action: EstimateAction
  reason: string | null
  revisedAmount: number | null
  supervisorUserId: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: boq, error: fetchErr } = await supabase
    .from('boq_generated')
    .select('id')
    .eq('booking_ref', params.bookingRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!boq) return { error: 'No estimate exists yet for this job -- generate one first.' }

  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('boq_generated')
    .update({
      supervisor_review_action: params.action,
      supervisor_review_reason: params.reason,
      supervisor_review_amount: params.revisedAmount,
      supervisor_reviewed_by: params.supervisorUserId,
      supervisor_reviewed_at: now,
      updated_at: now,
    })
    .eq('id', boq.id)
  if (updateErr) return { error: updateErr.message }

  if (params.action !== 'confirm') {
    const { data: coordinators } = await adminClient().from('users').select('id').eq('platform_role', 'coordinator')
    if (coordinators && coordinators.length > 0) {
      await supabase.from('site_instructions').insert(
        coordinators.map(c => ({
          booking_ref: params.bookingRef,
          instruction_type: 'supervisor_estimate_review',
          instruction_category: 'report',
          priority: 'medium',
          instruction_text: `Supervisor ${params.action}s estimate for ${params.bookingRef}${params.revisedAmount ? ` -- suggested ₹${params.revisedAmount.toLocaleString('en-IN')}` : ''}: ${params.reason ?? '(no reason given)'}`,
          issued_to: c.id,
          issued_at: now,
          status: 'pending',
          is_active: true,
        })),
      )
    }
  }

  await logJobMovement(supabase, {
    bookingRef: params.bookingRef, stage: 'estimate',
    action: params.action === 'confirm' ? 'approved' : 'returned',
    itemType: 'boq_generated', itemId: boq.id,
    fromUserId: params.supervisorUserId, toRole: 'coordinator',
    remarks: [params.action, params.reason].filter(Boolean).join(': '),
  })
  revalidatePath('/supervisor/estimate')
  return {}
}
