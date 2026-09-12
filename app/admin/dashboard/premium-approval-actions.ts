'use server'

import { createClient } from '@/lib/supabase/server'

export async function approvePremiumRequestAsAdmin(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

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
  return { success: true }
}
