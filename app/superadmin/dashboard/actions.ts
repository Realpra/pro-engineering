'use server'

import { createClient } from '@/lib/supabase/server'
import { applyApprovedPremium } from '@/lib/applyApprovedPremium'
import { logJobMovement } from '@/lib/jobMovementLog'
import { writePolicyChange } from '@/lib/policyChangeLog'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'super_admin') throw new Error('Access denied')
  return { supabase, user }
}

export async function updatePremiumPolicy(
  id: string,
  newPct: number,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireSuperAdmin()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from('platform_premium_policy')
      .select('premium_pct')
      .eq('id', id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [updateResult, logResult] = await Promise.all([
      (supabase as any)
        .from('platform_premium_policy')
        .update({ premium_pct: newPct, updated_at: new Date().toISOString() })
        .eq('id', id),
      writePolicyChange(supabase, {
        policyType: 'platform_premium_policy', recordId: id, field: 'premium_pct',
        oldValue: current?.premium_pct ?? null, newValue: newPct,
        reason, changedBy: user.id, changedByRole: 'super_admin',
      }),
    ])

    if (updateResult.error) return { success: false, error: updateResult.error.message }
    if (logResult.error) console.error('[updatePremiumPolicy] log error:', logResult.error)

    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateContingencyPolicy(
  id: string,
  newAdminLimitPct: number,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  // Owner, 31 Oct 2026: contingency % itself is Admin's repository value (edited on
  // /admin/policy). Super Admin sets the Admin Approval Limit (owner: 5%): up to it Admin
  // approves an estimate's contingency, above it Super Admin. The old version wrote
  // max_contingency_pct / admin_approval_limit_pct, neither of which existed live.
  try {
    const { supabase, user } = await requireSuperAdmin()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from('contingency_policy')
      .select('admin_approval_limit_pct')
      .eq('id', id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = await (supabase as any)
      .from('contingency_policy')
      .update({ admin_approval_limit_pct: newAdminLimitPct, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (updateResult.error) return { success: false, error: updateResult.error.message }

    await writePolicyChange(supabase, {
      policyType: 'contingency_policy', recordId: id, field: 'admin_approval_limit_pct',
      oldValue: current?.admin_approval_limit_pct ?? null, newValue: newAdminLimitPct,
      reason, changedBy: user.id, changedByRole: 'super_admin',
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function approvePremiumRequestAsSuperAdmin(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireSuperAdmin()

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
        status: 'approved_by_super_admin',
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
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function rejectPremiumRequestAsSuperAdmin(
  id: string,
  rejectionReason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireSuperAdmin()

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
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── TEMPLATE MANAGEMENT ──────────────────────────────
// NOTE: boq_sku_catalogue has no item_type/job_card_type/rate_* /is_risk_flag/
// is_mandatory columns in the live schema. Real columns used below: category
// ('labour'|'material'), unit, sequence_order, wastage_multiplier.

export async function updateBOQTemplate(
  skuCode: string,
  fields: { sku_name?: string; unit?: string; category?: string; sequence_order?: number; wastage_multiplier?: number },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('boq_sku_catalogue')
      .update({ ...fields })
      .eq('sku_code', skuCode)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleBOQTemplate(skuCode: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('boq_sku_catalogue')
      .update({ is_active: isActive })
      .eq('sku_code', skuCode)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateMilestoneTemplate(
  milestoneCode: string,
  fields: { milestone_name?: string; payment_percent?: number; planned_day?: number },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('milestone_stage_templates')
      .update({ ...fields })
      .eq('milestone_code', milestoneCode)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleMilestoneTemplate(milestoneCode: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('milestone_stage_templates')
      .update({ is_active: isActive })
      .eq('milestone_code', milestoneCode)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateChecklistTemplate(
  id: string,
  fields: { item_text?: string; sequence_order?: number },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('substage_checklist_templates')
      .update({ ...fields })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleChecklistTemplate(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('substage_checklist_templates')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── ROLE MANAGEMENT ──────────────────────────────────

export async function changeUserRole(userId: string, newRole: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('users')
      .update({ platform_role: newRole })
      .eq('id', userId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function suspendUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function reactivateUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireSuperAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('users')
      .update({ is_active: true })
      .eq('id', userId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
