'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// /supervisor/instruction was confirmed dead (PENDING #26) despite being
// linked from Dashboard's Critical Path Alerts and the Inspections page --
// Supervisor's outbound counterpart to the Directives inbox this tab also
// covers. Reuses the exact site_instructions insert shape already frozen
// this session for Sub-Coordinator's own instruction-sending action.
export async function sendSupervisorInstruction(params: {
  bookingRef: string
  substageCode: string | null
  recipientId: string
  instructionType: 'hold' | 'expedite' | 'revised' | 'resource' | 'alert'
  priority: 'critical' | 'high' | 'medium' | 'low'
  instructionText: string
  supervisorUserId: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: enquiry } = await supabase
    .from('guest_enquiries')
    .select('id')
    .eq('booking_ref', params.bookingRef)
    .maybeSingle()

  const { error } = await supabase.from('site_instructions').insert({
    enquiry_id: enquiry?.id ?? null,
    booking_ref: params.bookingRef,
    substage_code: params.substageCode,
    instruction_type: params.instructionType,
    priority: params.priority,
    instruction_text: params.instructionText,
    issued_by: params.supervisorUserId,
    issued_to: params.recipientId,
    issued_at: new Date().toISOString(),
    status: 'pending',
    is_active: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/supervisor/instruction')
  return {}
}
