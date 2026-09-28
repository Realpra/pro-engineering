'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// /supervisor/reports/new was confirmed dead (all 6 report types
// unreachable, PENDING #26) despite Coordinator's own reports page already
// being widened to read exactly these instruction_type values
// (safety_critical/method_improvement/payment_policy/methodology/
// special_site/execution -- app/coordinator/reports/page.tsx:31-34) with
// nothing anywhere ever writing them. This is the missing write side, not
// a new concept -- reuses site_instructions exactly as the read side
// already expects, no new table.
const TYPE_MAP: Record<string, string> = {
  method: 'method_improvement',
  payment: 'payment_policy',
  execution: 'execution',
  methodology: 'methodology',
  site: 'special_site',
  safety: 'safety_critical',
}

export async function submitSupervisorReport(params: {
  reportType: string
  bookingRef: string | null
  reportText: string
  supervisorUserId: string
}): Promise<{ error?: string }> {
  const instructionType = TYPE_MAP[params.reportType]
  if (!instructionType) return { error: 'Unknown report type.' }

  const supabase = await createClient()
  const { data: coordinators } = await supabase.from('users').select('id').eq('platform_role', 'coordinator')
  if (!coordinators || coordinators.length === 0) return { error: 'No coordinator recipient found.' }

  // Safety Critical routes to Coordinator + Admin (auto CC), per the label
  // already shown on the report-type card.
  const recipients = [...coordinators]
  if (instructionType === 'safety_critical') {
    const { data: admins } = await supabase.from('users').select('id').eq('platform_role', 'admin')
    recipients.push(...(admins ?? []))
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('site_instructions').insert(
    recipients.map(r => ({
      booking_ref: params.bookingRef,
      instruction_type: instructionType,
      instruction_category: 'report',
      priority: instructionType === 'safety_critical' ? 'critical' : 'medium',
      instruction_text: params.reportText,
      issued_by: params.supervisorUserId,
      issued_to: r.id,
      issued_at: now,
      status: 'pending',
      is_active: true,
    })),
  )
  if (error) return { error: error.message }

  revalidatePath('/supervisor/reports')
  return {}
}
