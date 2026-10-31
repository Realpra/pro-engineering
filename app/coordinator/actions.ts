'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logJobMovement } from '@/lib/jobMovementLog'

export async function assignStaff(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const booking_ref = formData.get('booking_ref') as string
  const supervisor_id = formData.get('supervisor_id') as string
  const site_incharge_id = formData.get('site_incharge_id') as string | null
  // site_incharge_id (Duplicate/Conflict #17, PENDING #16): Site Incharge is
  // permanently on-site for a job's duration; Supervisor only visits per his
  // own due schedule. The two are not the same relationship and must not
  // share one FK -- guest_enquiries.supervisor_id was the only column either
  // role's dashboard could scope by, until now.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('guest_enquiries')
    .update({
      supervisor_id: supervisor_id || null,
      ...(site_incharge_id !== null ? { site_incharge_id: site_incharge_id || null } : {}),
      is_active: true,
    })
    .eq('booking_ref', booking_ref)
  await logJobMovement(supabase, {
    bookingRef: booking_ref, stage: 'staff', action: 'assigned',
    remarks: [supervisor_id ? 'Supervisor assigned' : 'Supervisor cleared',
      site_incharge_id !== null ? (site_incharge_id ? 'Site Incharge assigned' : 'Site Incharge cleared') : null]
      .filter(Boolean).join('; '),
  })
  revalidatePath('/coordinator/jobs')
  revalidatePath('/coordinator/dashboard')
}
