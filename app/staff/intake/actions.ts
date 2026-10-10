'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const STAFF_ROLES = ['super_admin', 'admin', 'coordinator', 'sub_coordinator']
const STATUSES = ['new', 'contacted', 'approved', 'rejected']

export async function updatePartnerStatus(
  partnerId: string,
  status: string,
  staffNote: string,
): Promise<{ success?: true; error?: string }> {
  if (!STATUSES.includes(status)) return { error: 'Unknown status.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  if (!STAFF_ROLES.includes(profile?.platform_role ?? '')) return { error: 'Not permitted for this role.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('supply_partners')
    .update({
      status,
      staff_note: staffNote.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', partnerId)
  if (error) return { error: error.message }

  revalidatePath('/staff/intake')
  return { success: true }
}
