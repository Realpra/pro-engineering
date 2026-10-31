'use server'

import { createClient } from '@/lib/supabase/server'
import { applyApprovedPremium } from '@/lib/applyApprovedPremium'
import { logJobMovement } from '@/lib/jobMovementLog'

export async function approvePremiumRequestAsAdmin(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: request, error: fetchErr } = await (supabase as any)
    .from('premium_approval_requests')
    .select('booking_ref, boq_id, requested_pct')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { success: false, error: fetchErr.message }
  if (!request) return { success: false, error: 'Premium approval request not found' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('premium_approval_requests')
    .update({
      status: 'approved_by_admin',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  // PENDING #15 re-link: the approval is now real, not just a status flip.
  const applyResult = await applyApprovedPremium(supabase, request.boq_id, request.booking_ref, request.requested_pct)
  if (applyResult.error) return { success: false, error: `Approved, but failed to apply to the live estimate: ${applyResult.error}` }
  await logJobMovement(supabase, {
    bookingRef: request.booking_ref, stage: 'premium', action: 'decided',
    itemType: 'premium_approval_request', itemId: id, fromUserId: user.id,
    remarks: `Premium ${request.requested_pct}% approved`,
  })

  return { success: true }
}

export async function rejectPremiumRequestAsAdmin(
  id: string,
  rejectionReason: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('premium_approval_requests')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  await logJobMovement(supabase, {
    premiumRequestId: id, stage: 'premium', action: 'decided',
    itemType: 'premium_approval_request', itemId: id, fromUserId: user.id,
    remarks: `Premium rejected: ${rejectionReason}`,
  })
  return { success: true }
}
