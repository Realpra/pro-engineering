'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

// Daily-visit corrective actions (owner, 31 Oct 2026, D27). Each problem a daily execution
// visit found is turned into an action by the Supervisor (or Site Visit Manager / Site Manager
// who took the visit): redo/attend -> direction to the Site Head; more resources -> request to
// the Coordinators; delay -> the Supervisor recasts it himself, or directs the Site Head to
// recast and send it back to him; other -> a note. Recorded in visit_corrective_actions
// (supabase/migrations/20261031_invoice_objections_and_visit_corrective_actions.sql).

import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { logJobMovement } from '@/lib/jobMovementLog'
import { recastForDelay } from '@/lib/scheduling-engine/recast'
import { isVisitRole } from '@/lib/visitRoles'

const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

// Supervisor's own session cannot read other users or write the scheduling tables, so recipient
// look-ups and the recast use the service-role client after the role check below.
function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export type CorrectiveActionInput = {
  reportId: string
  findingSource: 'checklist_no' | 'risk_flag' | 'other'
  findingText: string
  actionType: 'redo_attend' | 'more_resources' | 'delay' | 'other'
  direction: string
  delayDays?: number | null
  delayReasonCategory?: 'Client' | 'Project Reasons' | 'Beyond Control' | null
  recastBy?: 'supervisor' | 'site_head' | null
}

async function notify(admin: any, rows: { to: string; bookingRef: string; type: string; text: string; by: string; priority?: string }[]) {
  if (rows.length === 0) return
  await admin.from('site_instructions').insert(rows.map(r => ({
    booking_ref: r.bookingRef,
    instruction_type: r.type,
    instruction_category: 'site_instruction',
    priority: r.priority ?? 'high',
    instruction_text: r.text,
    issued_by: r.by,
    issued_to: r.to,
    issued_at: new Date().toISOString(),
    status: 'pending',
    is_active: true,
  })))
}

export async function saveCorrectiveAction(input: CorrectiveActionInput): Promise<{ error?: string; note?: string }> {
  if (!input.findingText.trim()) return { error: 'The finding is missing.' }
  if (input.actionType !== 'delay' && !input.direction.trim()) return { error: 'Write the direction / note for this action.' }
  if (input.actionType === 'delay') {
    if (!input.delayDays || input.delayDays < 1) return { error: 'Enter the days lost.' }
    if (!input.delayReasonCategory) return { error: 'Choose the reason for the delay.' }
    if (!input.recastBy) return { error: 'Choose who recasts the milestone.' }
  }

  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  if (!isVisitRole(profile?.platform_role) && profile?.platform_role !== 'site_incharge') {
    return { error: 'Only the visiting Supervisor, Site Visit Manager or Site Manager can record corrective actions.' }
  }

  const admin: any = adminClient()
  const { data: report } = await admin.from('site_visit_reports').select('id, booking_ref').eq('id', input.reportId).maybeSingle()
  if (!report) return { error: 'Visit report not found.' }
  const { data: job } = await admin.from('guest_enquiries').select('id, site_incharge_id').eq('booking_ref', report.booking_ref)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!job) return { error: 'Job not found.' }

  const { data: row, error } = await supabase.from('visit_corrective_actions').insert({
    site_visit_report_id: report.id,
    enquiry_id: job.id,
    booking_ref: report.booking_ref,
    finding_source: input.findingSource,
    finding_text: input.findingText.trim(),
    action_type: input.actionType,
    direction: input.direction.trim() || null,
    delay_days: input.actionType === 'delay' ? input.delayDays : null,
    delay_reason_category: input.actionType === 'delay' ? input.delayReasonCategory : null,
    recast_by: input.actionType === 'delay' ? input.recastBy : null,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Recipients
  const { data: siteHead } = job.site_incharge_id
    ? await admin.from('workers').select('auth_user_id').eq('id', job.site_incharge_id).maybeSingle()
    : { data: null }
  const siteHeadUserId: string | null = siteHead?.auth_user_id ?? null
  const coordinators: string[] = ((await admin.from('users').select('id').eq('platform_role', 'coordinator')).data ?? []).map((u: any) => u.id)

  let note: string | undefined
  const ref = report.booking_ref
  const finding = input.findingText.trim()

  if (input.actionType === 'redo_attend') {
    if (siteHeadUserId) await notify(admin, [{ to: siteHeadUserId, bookingRef: ref, type: 'revised', by: user.id, text: `Redo / attend: ${finding} -- ${input.direction.trim()}` }])
    else note = 'No Site Head is assigned to this job, so the direction was recorded but not sent.'
  } else if (input.actionType === 'more_resources') {
    await notify(admin, coordinators.map(c => ({ to: c, bookingRef: ref, type: 'resource', by: user.id, text: `More resources needed on ${ref}: ${finding} -- ${input.direction.trim()}` })))
  } else if (input.actionType === 'delay' && input.recastBy === 'site_head') {
    if (siteHeadUserId) {
      await notify(admin, [{ to: siteHeadUserId, bookingRef: ref, type: 'revised', by: user.id,
        text: `Recast the milestone for a ${input.delayDays}-day delay (${input.delayReasonCategory}): ${finding}${input.direction.trim() ? ' -- ' + input.direction.trim() : ''}. Send the recast plan back to the Supervisor.` }])
    } else note = 'No Site Head is assigned to this job, so the recast request was recorded but not sent.'
  } else if (input.actionType === 'delay' && input.recastBy === 'supervisor') {
    // The Supervisor recasts it himself: the job's next open day slot is delayed and every later
    // day of the job shifts by the same days (Dynamic Scheduler recast).
    const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
    const { data: nextSlot } = await admin.from('task_ledger').select('slot_id')
      .eq('booking_ref', ref).eq('slot_status', 'Pending').gte('target_date', today)
      .order('target_date', { ascending: true }).limit(1).maybeSingle()
    if (nextSlot?.slot_id) {
      try {
        const res = await recastForDelay(admin, {
          affectedSlotId: nextSlot.slot_id, eventType: 'site_delay', daysLost: input.delayDays!,
          skillChanged: false, reasonCategory: input.delayReasonCategory!,
          reasonRemarks: `${finding}${input.direction.trim() ? ' -- ' + input.direction.trim() : ''}`,
          loggedByUserId: user.id,
        })
        note = `Recast done: ${res.insertedCount} slot(s) moved by ${input.delayDays} day(s). The Coordinator re-books workers for the moved days.`
        await notify(admin, coordinators.map(c => ({ to: c, bookingRef: ref, type: 'revised', by: user.id, priority: 'medium',
          text: `Supervisor recast ${ref} for a ${input.delayDays}-day delay (${input.delayReasonCategory}) -- review worker bookings for the moved days.` })))
      } catch (e) {
        note = `Recorded, but the recast failed: ${(e as Error).message}`
      }
    } else {
      note = 'This job has no scheduled day slots yet, so the delay was recorded and the Coordinators were told to recast.'
      await notify(admin, coordinators.map(c => ({ to: c, bookingRef: ref, type: 'revised', by: user.id,
        text: `Delay of ${input.delayDays} day(s) on ${ref} (${input.delayReasonCategory}): ${finding}. No day slots exist -- please recast the plan.` })))
    }
  }

  await logJobMovement(supabase, {
    bookingRef: ref,
    stage: input.actionType === 'delay' ? 'plan' : 'site_visit',
    action: input.actionType === 'delay' ? 'recast' : 'raised',
    itemType: 'visit_corrective_action', itemId: row.id, fromUserId: user.id,
    toRole: input.actionType === 'more_resources' ? 'coordinator'
      : (input.actionType === 'redo_attend' || input.recastBy === 'site_head') ? 'site_incharge' : null,
    remarks: `${({ redo_attend: 'Redo/attend', more_resources: 'More resources', delay: `Delay ${input.delayDays}d (${input.delayReasonCategory}), recast by ${input.recastBy === 'site_head' ? 'Site Head' : 'Supervisor'}`, other: 'Note' } as Record<string, string>)[input.actionType]}: ${finding}${input.direction.trim() ? ' -- ' + input.direction.trim() : ''}`,
  })

  revalidatePath(`/supervisor/site-visit/corrective/${input.reportId}`)
  return { note }
}

export async function markCorrectiveActionDone(actionId: string, reportId: string): Promise<{ error?: string }> {
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { error } = await supabase.from('visit_corrective_actions')
    .update({ status: 'done', done_at: new Date().toISOString(), done_by: user.id }).eq('id', actionId)
  if (error) return { error: error.message }
  revalidatePath(`/supervisor/site-visit/corrective/${reportId}`)
  return {}
}
