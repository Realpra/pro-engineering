'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignStaff(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const booking_ref = formData.get('booking_ref') as string
  const supervisor_id = formData.get('supervisor_id') as string
  await supabase
    .from('guest_enquiries')
    .update({
      supervisor_id: supervisor_id || null,
      is_active: true,
    })
    .eq('booking_ref', booking_ref)
  revalidatePath('/coordinator/jobs')
  revalidatePath('/coordinator/dashboard')
}
