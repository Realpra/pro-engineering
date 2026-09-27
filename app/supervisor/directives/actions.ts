'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// The "Acknowledge Directive" button had no onClick anywhere -- no code path
// existed to move an instruction from 'pending' to 'acknowledged' for its
// recipient. This closes that gap.
export async function acknowledgeInstruction(instructionId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('site_instructions')
    .update({ status: 'acknowledged' })
    .eq('id', instructionId)
    .eq('issued_to', user.id)

  if (error) return { error: error.message }
  revalidatePath('/supervisor/directives')
  return {}
}
