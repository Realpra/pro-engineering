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
}

export async function submitExtraWork(
  supervisorId: string,
  data: SubmitExtraWorkInput,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { error: insertErr } = await supabase.from('scope_change_requests').insert({
    booking_ref: data.booking_ref,
    change_type: 'addition',
    change_status: 'submitted',
    raised_by_role: 'supervisor',
    trigger_type: data.trigger_type,
    client_request: data.trigger_type === 'client_demand' ? data.client_request ?? data.description : null,
    supervisor_rough_estimate: data.rough_items,
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

  revalidatePath('/supervisor/extra-works')
  return { success: true }
}
