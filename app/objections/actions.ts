'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

// Client invoice objections (owner, 31 Oct 2026, D30). Table client_invoice_objections
// (supabase/migrations/20261031_invoice_objections_and_visit_corrective_actions.sql); each
// level's factual remark is recorded in job_movement_log against the objection.

import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { logJobMovement } from '@/lib/jobMovementLog'
import { decidingRoleForJobValue, nextRole, OBJECTION_CHAIN, ROLE_LABEL, type ObjectionRole } from '@/lib/invoiceObjections'

const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'
function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

async function currentUser(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  return { id: user.id as string, role: (profile?.platform_role ?? '') as string }
}

// ── Client raises an objection ────────────────────────────────────────────────
export async function raiseInvoiceObjection(params: {
  bookingRef: string
  milestonePaymentId: string
  objectionType: string
  description: string
}): Promise<{ error?: string }> {
  if (params.description.trim().length < 10) return { error: 'Describe what is wrong with this invoice.' }
  const supabase: any = await createClient()
  const me = await currentUser(supabase)
  if (!me) return { error: 'Please sign in again.' }

  const admin: any = adminClient()
  const { data: job } = await admin.from('guest_enquiries')
    .select('id, booking_ref, client_user_id, site_incharge_id, supervisor_id')
    .eq('booking_ref', params.bookingRef).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!job) return { error: 'Job not found.' }
  if (me.role === 'client' && job.client_user_id !== me.id) return { error: 'This job is not on your account.' }

  const { data: ms } = await admin.from('milestone_payment_schedule')
    .select('id, milestone_code, payment_amount').eq('id', params.milestonePaymentId).maybeSingle()
  if (!ms) return { error: 'Invoice not found.' }

  // Job value = the accepted estimate's total (latest accepted, else latest sent).
  const { data: boqs } = await admin.from('boq_generated')
    .select('total_amount, status, client_accepted_at, created_at').eq('booking_ref', params.bookingRef)
    .neq('status', 'draft').order('created_at', { ascending: false })
  const accepted = (boqs ?? []).find((b: any) => b.client_accepted_at) ?? (boqs ?? [])[0]
  const jobValue = Number(accepted?.total_amount) || null

  const firstHolder: ObjectionRole = job.site_incharge_id ? 'site_incharge' : job.supervisor_id ? 'supervisor' : 'coordinator'

  const { data: row, error } = await admin.from('client_invoice_objections').insert({
    enquiry_id: job.id, booking_ref: job.booking_ref, milestone_payment_id: ms.id, milestone_code: ms.milestone_code,
    invoice_amount: ms.payment_amount, objection_type: params.objectionType, description: params.description.trim(),
    raised_by_user_id: me.id, job_value: jobValue, deciding_role: decidingRoleForJobValue(jobValue),
    holder_role: firstHolder,
  }).select('id').single()
  if (error) return { error: error.message }

  await logJobMovement(admin, {
    bookingRef: job.booking_ref, stage: 'payment', action: 'raised', itemType: 'client_invoice_objection', itemId: row.id,
    fromUserId: me.id, fromRole: 'client', toRole: firstHolder,
    remarks: `Client objected to ${ms.milestone_code} invoice: ${params.description.trim()}`,
  })
  revalidatePath(`/client/dashboard/${params.bookingRef}`)
  revalidatePath('/objections')
  return {}
}

// The objection is with my role and, for site/supervisor levels, on a job assigned to me.
async function loadForActor(supabase: any, admin: any, objectionId: string) {
  const me = await currentUser(supabase)
  if (!me) return { error: 'Not signed in.' as const }
  const { data: o } = await admin.from('client_invoice_objections').select('*').eq('id', objectionId).maybeSingle()
  if (!o) return { error: 'Objection not found.' as const }
  if (o.status !== 'open') return { error: 'This objection is already resolved.' as const }
  const actingRole = me.role === 'site_visit_manager' ? 'supervisor' : me.role
  if (actingRole !== o.holder_role) return { error: `This objection is with the ${ROLE_LABEL[o.holder_role as ObjectionRole]} now.` as const }
  if (actingRole === 'site_incharge' || actingRole === 'supervisor') {
    const { data: w } = await admin.from('workers').select('id').eq('auth_user_id', me.id).maybeSingle()
    const { data: job } = await admin.from('guest_enquiries').select('site_incharge_id, supervisor_id').eq('id', o.enquiry_id).maybeSingle()
    const assigned = actingRole === 'site_incharge' ? job?.site_incharge_id : job?.supervisor_id
    if (!w || assigned !== w.id) return { error: 'This job is not assigned to you.' as const }
  }
  return { me, o, actingRole: actingRole as ObjectionRole }
}

// ── A level adds its factual remark and moves it up ───────────────────────────
export async function forwardInvoiceObjection(objectionId: string, factualRemark: string): Promise<{ error?: string }> {
  if (!factualRemark.trim()) return { error: 'Write the factual position before moving it up.' }
  const supabase: any = await createClient()
  const admin: any = adminClient()
  const ctx = await loadForActor(supabase, admin, objectionId)
  if ('error' in ctx) return { error: ctx.error }
  const { me, o, actingRole } = ctx
  if (actingRole === o.deciding_role) return { error: 'You are the deciding level for this objection -- decide it instead.' }

  // Skip levels with no one assigned on this job (e.g. no Supervisor yet).
  let to = nextRole(actingRole)
  const { data: job } = await admin.from('guest_enquiries').select('supervisor_id').eq('id', o.enquiry_id).maybeSingle()
  if (to === 'supervisor' && !job?.supervisor_id) to = nextRole('supervisor')
  if (!to || OBJECTION_CHAIN.indexOf(to) > OBJECTION_CHAIN.indexOf(o.deciding_role)) to = o.deciding_role

  const { error } = await admin.from('client_invoice_objections')
    .update({ holder_role: to, updated_at: new Date().toISOString() }).eq('id', objectionId)
  if (error) return { error: error.message }
  await logJobMovement(admin, {
    bookingRef: o.booking_ref, stage: 'payment', action: 'forwarded', itemType: 'client_invoice_objection', itemId: objectionId,
    fromUserId: me.id, fromRole: actingRole, toRole: to, remarks: factualRemark.trim(),
  })
  revalidatePath('/objections')
  return {}
}

// ── The deciding level admits (invoice revised) or clarifies, and replies to the client ──
export async function decideInvoiceObjection(params: {
  objectionId: string
  resolution: 'admitted' | 'clarified'
  revisedAmount: number | null
  replyToClient: string
}): Promise<{ error?: string }> {
  if (!params.replyToClient.trim()) return { error: 'Write the reply to the client.' }
  if (params.resolution === 'admitted' && (params.revisedAmount == null || params.revisedAmount < 0)) {
    return { error: 'Enter the corrected invoice amount.' }
  }
  const supabase: any = await createClient()
  const admin: any = adminClient()
  const ctx = await loadForActor(supabase, admin, params.objectionId)
  if ('error' in ctx) return { error: ctx.error }
  const { me, o, actingRole } = ctx
  if (actingRole !== o.deciding_role) return { error: `Only the ${ROLE_LABEL[o.deciding_role as ObjectionRole]} decides this objection.` }

  const now = new Date().toISOString()
  const { error } = await admin.from('client_invoice_objections').update({
    status: 'resolved', resolution: params.resolution,
    revised_amount: params.resolution === 'admitted' ? params.revisedAmount : null,
    reply_to_client: params.replyToClient.trim(), resolved_by: me.id, resolved_at: now, updated_at: now,
  }).eq('id', params.objectionId)
  if (error) return { error: error.message }

  // Admitted: the milestone invoice itself is corrected.
  if (params.resolution === 'admitted' && o.milestone_payment_id) {
    const { error: msErr } = await admin.from('milestone_payment_schedule')
      .update({ payment_amount: params.revisedAmount, updated_at: now }).eq('id', o.milestone_payment_id)
    if (msErr) return { error: `Decision saved, but the invoice amount could not be updated: ${msErr.message}` }
  }

  await logJobMovement(admin, {
    bookingRef: o.booking_ref, stage: 'payment', action: 'decided', itemType: 'client_invoice_objection', itemId: params.objectionId,
    fromUserId: me.id, fromRole: actingRole, toRole: 'client',
    remarks: params.resolution === 'admitted'
      ? `Objection admitted -- invoice revised from ${o.invoice_amount} to ${params.revisedAmount}: ${params.replyToClient.trim()}`
      : `Objection clarified, invoice unchanged: ${params.replyToClient.trim()}`,
  })
  revalidatePath('/objections')
  revalidatePath(`/client/dashboard/${o.booking_ref}`)
  return {}
}
