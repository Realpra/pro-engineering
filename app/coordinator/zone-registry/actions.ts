'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addZone(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) return

  const name = (formData.get('zone_name') as string)?.trim()
  const shortCode = (formData.get('short_code') as string)?.trim().toUpperCase()
  const district = (formData.get('district') as string)?.trim()

  if (!name || !shortCode || !district) return
  if (!/^[A-Z0-9]{2,6}$/.test(shortCode)) return

  const { data: existingName } = await supabase
    .from('geo_hierarchy')
    .select('id')
    .ilike('name', name)
    .maybeSingle()
  if (existingName) return

  const { data: existingCode } = await supabase
    .from('geo_hierarchy')
    .select('id')
    .ilike('short_code', shortCode)
    .maybeSingle()
  if (existingCode) return

  await supabase
    .from('geo_hierarchy')
    .insert({
      name,
      level: 'sector',
      short_code: shortCode,
      is_active: true,
    })

  revalidatePath('/coordinator/zone-registry')
}

export async function saveWorkerAssessment(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) return

  const workerId = (formData.get('worker_id') as string)?.trim()
  if (!workerId) return

  const decision = (formData.get('assessment_decision') as string)?.trim()
  const remarks = (formData.get('competency_remarks') as string)?.trim()

  const updatePayload: Record<string, any> = {
    assessment_decision: decision || null,
    competency_remarks: remarks || null,
    competency_assessed_by: user.id,
    competency_assessed_at: new Date().toISOString(),
  }

  const moduleKeys = ['competency_m1','competency_m2','competency_m3','competency_m4','competency_m5','competency_m6']
  const trackKeys = ['specialist_track_a','specialist_track_b','specialist_track_c','specialist_track_d']

  for (const key of [...moduleKeys, ...trackKeys]) {
    const val = formData.get(key) as string
    if (val) updatePayload[key] = val
  }

  // Update approval status based on decision. 'accepted' pushes straight to
  // pending_admin_approval (matching sendToAdmin's own value in
  // app/admin/dashboard/approvalActions.ts) rather than stopping at coordinator_approved --
  // this assessment screen is a single decision point with no separate "send to admin" step,
  // so accepting here IS agreeing to push the worker on to the next level (Worker Onboarding
  // freeze, Session 65). Previously this left Track-2-approved workers permanently stuck,
  // invisible to any admin_approved-gated worker picker.
  if (decision === 'accepted') {
    updatePayload.approval_status = 'pending_admin_approval'
  } else if (decision === 'rejected') {
    updatePayload.approval_status = 'rejected'
  } else if (decision === 'returned') {
    updatePayload.approval_status = 'returned_to_subcoordinator'
  }

  await supabase
    .from('workers')
    .update(updatePayload)
    .eq('id', workerId)

  revalidatePath('/coordinator/zone-registry')
  revalidatePath('/coordinator/workers')
  revalidatePath('/sub-coordinator/workers')
}

export async function assignWorkerToZone(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['coordinator', 'admin', 'super_admin', 'sub_coordinator'].includes(profile?.platform_role ?? '')) return

  const workerId = (formData.get('worker_id') as string)?.trim()
  const zoneName = (formData.get('zone_name') as string)?.trim()
  const zoneShortCode = (formData.get('zone_short_code') as string)?.trim()
  const isPrimary = formData.get('is_primary') === 'true'
  const travelMode = (formData.get('travel_mode') as string)?.trim() || 'public_transport'
  const maxTravelMinutes = parseInt(formData.get('max_travel_minutes') as string) || 60

  if (!workerId || !zoneName) return

  const { data: worker } = await supabase
    .from('workers')
    .select('id, is_active')
    .eq('id', workerId)
    .maybeSingle()
  if (!worker?.is_active) return

  const { data: zone } = await supabase
    .from('geo_hierarchy')
    .select('id, name, short_code')
    .ilike('name', zoneName)
    .maybeSingle()
  if (!zone) return

  if (isPrimary) {
    await supabase
      .from('worker_zone_assignments')
      .update({ is_primary: false })
      .eq('worker_id', workerId)
      .eq('is_primary', true)
  }

  const { data: existing } = await supabase
    .from('worker_zone_assignments')
    .select('id')
    .eq('worker_id', workerId)
    .eq('zone_name', zoneName)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('worker_zone_assignments')
      .update({
        is_primary: isPrimary,
        travel_mode: travelMode,
        max_travel_minutes: maxTravelMinutes,
        assigned_by: user.id,
        assigned_by_role: profile?.platform_role,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('worker_zone_assignments')
      .insert({
        worker_id: workerId,
        zone_name: zoneName,
        zone_short_code: zoneShortCode || zone.short_code,
        is_primary: isPrimary,
        travel_mode: travelMode,
        max_travel_minutes: maxTravelMinutes,
        assigned_by: user.id,
        assigned_by_role: profile?.platform_role,
        is_active: true,
      })
  }

  if (isPrimary) {
    await supabase
      .from('workers')
      .update({ district: zoneName })
      .eq('id', workerId)
  }

  revalidatePath('/coordinator/zone-registry')
  revalidatePath('/sub-coordinator/workers')
}

export async function removeWorkerFromZone(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['coordinator', 'admin', 'super_admin'].includes(profile?.platform_role ?? '')) return

  const assignmentId = (formData.get('assignment_id') as string)?.trim()
  if (!assignmentId) return

  await supabase
    .from('worker_zone_assignments')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', assignmentId)

  revalidatePath('/coordinator/zone-registry')
}