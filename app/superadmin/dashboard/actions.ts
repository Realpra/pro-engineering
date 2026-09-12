'use server'

import { createClient } from '@/lib/supabase/server'

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
      (supabase as any)
        .from('policy_change_log')
        .insert({
          table_name: 'platform_premium_policy',
          record_id: id,
          changed_by: user.id,
          old_value: { premium_pct: current?.premium_pct },
          new_value: { premium_pct: newPct },
          change_reason: reason,
        }),
    ])

    if (updateResult.error) return { success: false, error: updateResult.error.message }
    if (logResult.error) console.error('[updatePremiumPolicy] log error:', logResult.error.message)

    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateContingencyPolicy(
  id: string,
  newMaxPct: number,
  newAdminLimitPct: number,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireSuperAdmin()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from('contingency_policy')
      .select('max_contingency_pct, admin_approval_limit_pct')
      .eq('id', id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [updateResult, logResult] = await Promise.all([
      (supabase as any)
        .from('contingency_policy')
        .update({
          max_contingency_pct: newMaxPct,
          admin_approval_limit_pct: newAdminLimitPct,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id),
      (supabase as any)
        .from('policy_change_log')
        .insert({
          table_name: 'contingency_policy',
          record_id: id,
          changed_by: user.id,
          old_value: { max_contingency_pct: current?.max_contingency_pct, admin_approval_limit_pct: current?.admin_approval_limit_pct },
          new_value: { max_contingency_pct: newMaxPct, admin_approval_limit_pct: newAdminLimitPct },
          change_reason: reason,
        }),
    ])

    if (updateResult.error) return { success: false, error: updateResult.error.message }
    if (logResult.error) console.error('[updateContingencyPolicy] log error:', logResult.error.message)

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
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
