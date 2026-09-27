'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// issued_to previously accepted literal sentinel strings ('all_supervisors',
// 'site_incharge', 'site_head') verbatim -- but every reader (Supervisor's
// directives page, Site Incharge's dashboard) does an exact
// .eq('issued_to', <that specific user's id>) match, so a broadcast sent to
// one of those 3 options was inserted into the table but permanently
// unreachable by any recipient's UI. Fan out into one real row per actual
// recipient instead. 'site_head' is treated as 'site_incharge' -- this
// codebase has no separate site_head platform_role; CLAUDE.md and the
// original design logs use "Site Head" as the real-world name for the
// site_incharge role throughout (e.g. Screen 2's "Site Head Name" field).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveRecipients(supabase: any, issuedTo: string | null): Promise<string[]> {
  if (!issuedTo) return []
  if (issuedTo === 'all_supervisors') {
    const { data } = await supabase.from('users').select('id').eq('platform_role', 'supervisor')
    return (data ?? []).map((u: { id: string }) => u.id)
  }
  if (issuedTo === 'site_incharge' || issuedTo === 'site_head') {
    const { data } = await supabase.from('users').select('id').eq('platform_role', 'site_incharge')
    return (data ?? []).map((u: { id: string }) => u.id)
  }
  return [issuedTo]
}

export async function sendInstruction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: userData } = await supabase.from('users').select('id').eq('auth_user_id', user.id).single()
  const booking_ref = formData.get('booking_ref') as string
  const substage_code = formData.get('substage_code') as string | null
  const instruction_type = formData.get('instruction_type') as string
  const priority = formData.get('priority') as string
  const subject = formData.get('subject') as string | null
  const instruction_text = formData.get('instruction_text') as string
  const issued_to = formData.get('issued_to') as string | null
  const { data: enquiry } = await supabase.from('guest_enquiries').select('id').eq('booking_ref', booking_ref).single()

  const recipients = await resolveRecipients(supabase, issued_to)
  if (recipients.length === 0) return { error: 'No matching recipients found for the selected audience.' }

  const { error } = await supabase.from('site_instructions').insert(
    recipients.map((recipientId) => ({
      enquiry_id: enquiry?.id ?? null,
      booking_ref,
      substage_code: substage_code || null,
      instruction_type,
      priority,
      subject: subject || null,
      instruction_text,
      issued_by: userData?.id ?? null,
      issued_to: recipientId,
      issued_at: new Date().toISOString(),
      // Every reader (Supervisor/Site Incharge) filters status='pending' for
      // new, unactioned instructions -- every writer here previously
      // inserted 'active', a value nothing ever transitions out of, so new
      // instructions satisfied neither the pending nor acknowledged filter
      // and never appeared to their recipients.
      status: 'pending',
      is_active: true,
    })),
  )
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/dashboard')
  revalidatePath('/sub-coordinator/instructions')
  return { success: true }
}

export async function sendBackSubstage(substageId: string, remarks: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('job_milestone_substages').update({
    status: 'sent_back',
    platform_remarks: remarks,
    subcoordinator_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', substageId)
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/approvals')
  return { success: true }
}

export async function approveSubstageToCoordinator(substageId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('job_milestone_substages').update({
    status: 'subcoordinator_approved',
    subcoordinator_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', substageId)
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/approvals')
  return { success: true }
}

export async function addLtfToRoute(formData: FormData) {
  const supabase = await createClient()
  const ltf_feed_id = formData.get('ltf_feed_id') as string
  const supervisor_id = formData.get('supervisor_id') as string
  const site_id = formData.get('site_id') as string
  const scheduled_date = formData.get('scheduled_date') as string
  const slot_start = formData.get('slot_start') as string
  const slot_end = formData.get('slot_end') as string
  const { error } = await supabase.from('supervisor_daily_routes').insert({
    supervisor_id,
    site_id,
    ltf_feed_id,
    scheduled_date,
    slot_start,
    slot_end,
    visit_status: 'scheduled',
    route_confirmed: false,
    planned_by: 'sub-coordinator',
    created_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/ltf')
  revalidatePath('/sub-coordinator/route')
  return { success: true }
}

export async function rejectLtfFromRoute(ltfId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('ltf_feeds').update({
    accountability_flag: true,
  }).eq('id', ltfId)
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/ltf')
  return { success: true }
}

export async function chaseSiteHead(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: userData } = await supabase.from('users').select('id').eq('auth_user_id', user.id).single()
  const booking_ref = formData.get('booking_ref') as string
  const issued_to = formData.get('issued_to') as string
  const { error } = await supabase.from('site_instructions').insert({
    booking_ref,
    instruction_type: 'chase',
    priority: 'high',
    instruction_text: 'Chase: Please submit LTF feed update immediately.',
    issued_by: userData?.id ?? null,
    issued_to,
    issued_at: new Date().toISOString(),
    status: 'pending',
    is_active: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/ltf')
  return { success: true }
}

export async function notifyCoordinator(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: userData } = await supabase.from('users').select('id').eq('auth_user_id', user.id).single()
  const booking_ref = formData.get('booking_ref') as string
  const message = formData.get('message') as string
  const coordinator_id = formData.get('coordinator_id') as string
  const { error } = await supabase.from('site_instructions').insert({
    booking_ref,
    instruction_type: 'notification',
    priority: 'medium',
    instruction_text: message,
    issued_by: userData?.id ?? null,
    issued_to: coordinator_id,
    issued_at: new Date().toISOString(),
    status: 'pending',
    is_active: true,
    target_audience: 'coordinator',
  })
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/ltf')
  return { success: true }
}

export async function addRouteSlotManually(formData: FormData) {
  const supabase = await createClient()
  const supervisor_id = formData.get('supervisor_id') as string
  const site_id = formData.get('site_id') as string
  const scheduled_date = formData.get('scheduled_date') as string
  const slot_start = formData.get('slot_start') as string
  const slot_end = formData.get('slot_end') as string
  const slot_type = formData.get('slot_type') as string
  const ltf_note = formData.get('ltf_note') as string | null
  const { error } = await supabase.from('supervisor_daily_routes').insert({
    supervisor_id,
    site_id,
    scheduled_date,
    slot_start,
    slot_end,
    slot_type: slot_type || 'inspection',
    ltf_note: ltf_note || null,
    visit_status: 'scheduled',
    route_confirmed: false,
    planned_by: 'sub-coordinator',
    created_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/route')
  return { success: true }
}

export async function assignWorkerToJob(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: userData } = await supabase.from('users').select('id').eq('auth_user_id', user.id).single()
  const worker_id = formData.get('worker_id') as string
  const booking_ref = formData.get('booking_ref') as string
  const shift_date = formData.get('shift_date') as string
  const role = formData.get('role') as string
  const { data: enquiry } = await supabase.from('guest_enquiries').select('id').eq('booking_ref', booking_ref).single()
  const { error } = await supabase.from('worker_shift_schedule').insert({
    worker_id,
    enquiry_id: enquiry?.id ?? null,
    booking_ref,
    shift_date,
    role,
    status: 'scheduled',
    created_by: userData?.id ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  await supabase.from('workers').update({
    is_available: false,
    current_job_id: enquiry?.id ?? null,
  }).eq('id', worker_id)
  revalidatePath('/sub-coordinator/workers')
  return { success: true }
}
