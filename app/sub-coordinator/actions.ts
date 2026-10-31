'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logJobMovement } from '@/lib/jobMovementLog'

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
  const { data: userData } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle()
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
      instruction_category: 'site_instruction',
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
  await logJobMovement(supabase, {
    substageId, stage: 'milestone', action: 'returned',
    itemType: 'job_milestone_substage', itemId: substageId, toRole: 'site_incharge', remarks,
  })
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
  await logJobMovement(supabase, {
    substageId, stage: 'milestone', action: 'forwarded',
    itemType: 'job_milestone_substage', itemId: substageId, toRole: 'coordinator',
  })
  revalidatePath('/sub-coordinator/approvals')
  return { success: true }
}

export async function addLtfToRoute(formData: FormData) {
  const supabase = await createClient()
  const ltf_feed_id = formData.get('ltf_feed_id') as string
  const site_id = formData.get('site_id') as string
  const scheduled_date = formData.get('scheduled_date') as string
  const slot_start = formData.get('slot_start') as string
  const slot_end = formData.get('slot_end') as string

  // Who visits is a different question from who filed the LTF feed (Site
  // Incharge end-of-day report or Supervisor's own inspection -- either is a
  // valid trigger, per the project owner). The job's real assigned
  // Supervisor already lives on guest_enquiries.supervisor_id -- this is the
  // exact lookup app/api/cron/ltf-route-compile/route.ts already does
  // correctly for the automatic path; this manual button now matches it
  // instead of reusing the feed's submitted_by (a users.id from whichever
  // role submitted, never the right id-space for this column).
  const { data: enquiry, error: enquiryError } = await supabase
    .from('guest_enquiries')
    .select('supervisor_id')
    .eq('id', site_id)
    .maybeSingle()
  if (enquiryError) return { error: enquiryError.message }
  if (!enquiry?.supervisor_id) return { error: 'This job has no assigned Supervisor yet -- assign one before adding to route.' }

  const { error } = await supabase.from('supervisor_daily_routes').insert({
    supervisor_id: enquiry.supervisor_id,
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
  const { data: userData } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle()
  const booking_ref = formData.get('booking_ref') as string
  const issued_to = formData.get('issued_to') as string
  const { error } = await supabase.from('site_instructions').insert({
    booking_ref,
    instruction_type: 'chase',
    instruction_category: 'site_instruction',
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
  const { data: userData } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle()
  const booking_ref = formData.get('booking_ref') as string
  const message = formData.get('message') as string
  const coordinator_id = formData.get('coordinator_id') as string
  const { error } = await supabase.from('site_instructions').insert({
    booking_ref,
    instruction_type: 'notification',
    instruction_category: 'site_instruction',
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
  const { data: userData } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle()
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
    // Supervisor's own assignWorkerToSubstage already populates this same
    // column (current_job_booking_ref) alongside current_substage_id as the
    // canonical human-readable "what job is this worker on" field -- extend
    // this path to populate it too, instead of leaving it only ever set by
    // one of the two assignment paths.
    current_job_booking_ref: booking_ref,
  }).eq('id', worker_id)
  await logJobMovement(supabase, {
    bookingRef: booking_ref, stage: 'deployment', action: 'assigned', fromUserId: user.id,
    itemType: 'worker', itemId: worker_id, remarks: `Worker scheduled for ${shift_date}${role ? ' as ' + role : ''}`,
  })
  revalidatePath('/sub-coordinator/workers')
  return { success: true }
}

// Worker onboarding approval chain, Sub-Coordinator's first step (project
// owner's confirmed design, 1 Oct 2026): recommend a newly self-onboarded
// worker forward to Coordinator, or return it for correction. "Returning is
// open to all" reviewing roles -- this is the same returned_for_correction
// value Admin's own return action already writes, so any role's return
// lands in the same, single returned queue.
export async function recommendWorkerOnboarding(workerId: string, remark: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('workers').update({
    approval_status: 'sub_coordinator_reviewed',
    sub_coordinator_recommendation: remark || null,
  }).eq('id', workerId)
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/workers')
  return {}
}

export async function returnWorkerOnboarding(workerId: string, reason: string): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: 'Explain what needs correcting.' }
  const supabase = await createClient()
  const { error } = await supabase.from('workers').update({
    approval_status: 'returned_for_correction',
    correction_action: reason.trim(),
  }).eq('id', workerId)
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/workers')
  return {}
}

// E7-iii (WorkersTable_Review workbook, 1 Oct 2026, "Completing an existing returned
// worker"): staff fill in missing fields for a worker reached by phone/WhatsApp/email
// after a return, upload one evidence photo/PDF, and record how the data was obtained.
// Re-enters the normal onboarding pipeline at sub_coordinator_reviewed, same as a fresh
// recommend -- not a second, competing approval path.
export type CompleteReturnedWorkerInput = {
  phone?: string; aadhaarLast4?: string; bocwRegistered?: boolean; bocwNumber?: string
  bankAccount?: string; ifscCode?: string; reference1Name?: string; reference1Phone?: string
  otherCorrections?: string
}

export async function uploadCorrectionEvidence(workerId: string, base64Data: string, fileName: string): Promise<{ error?: string; path?: string }> {
  const supabase = await createClient()
  const matches = base64Data.match(/^data:(.+);base64,(.+)$/)
  if (!matches) return { error: 'Invalid file data' }
  const contentType = matches[1]
  const buffer = Buffer.from(matches[2], 'base64')
  const ext = fileName.split('.').pop() || 'jpg'
  const path = `${workerId}/correction-evidence-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('worker-selfies').upload(path, buffer, { contentType, upsert: true })
  if (uploadError) return { error: uploadError.message }
  return { path }
}

export async function completeReturnedWorker(
  workerId: string,
  fields: CompleteReturnedWorkerInput,
  howObtained: string,
  evidencePath: string | null,
  staffUserId: string,
): Promise<{ error?: string }> {
  if (!howObtained.trim()) return { error: 'Record how this information was obtained (WhatsApp/phone/email).' }
  const supabase = await createClient()

  const updates: Record<string, unknown> = {
    approval_status: 'sub_coordinator_reviewed',
    correction_evidence_note: howObtained.trim(),
    correction_completed_by: staffUserId,
    correction_completed_at: new Date().toISOString(),
  }
  if (evidencePath) updates.correction_evidence_url = evidencePath
  if (fields.phone) updates.phone = fields.phone
  if (fields.aadhaarLast4) updates.aadhaar_last4 = fields.aadhaarLast4
  if (fields.bocwRegistered !== undefined) updates.is_bocw_registered = fields.bocwRegistered
  if (fields.bocwNumber) updates.bocw_registration_number = fields.bocwNumber
  if (fields.bankAccount) updates.bank_account_number = fields.bankAccount
  if (fields.ifscCode) updates.ifsc_code = fields.ifscCode
  if (fields.reference1Name) updates.reference_1_name = fields.reference1Name
  if (fields.reference1Phone) updates.reference_1_phone = fields.reference1Phone
  if (fields.otherCorrections) updates.sub_coordinator_recommendation = fields.otherCorrections.trim()

  const { error } = await supabase.from('workers').update(updates).eq('id', workerId)
  if (error) return { error: error.message }
  revalidatePath('/sub-coordinator/workers')
  revalidatePath('/coordinator/workers')
  return {}
}
