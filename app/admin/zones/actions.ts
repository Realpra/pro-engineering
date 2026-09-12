'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ZoneActionResult = { success: true } | { error: string }

const LOG_TABLE = 'policy_change_log'

async function logChange(
  supabase: any,
  entry: {
    table_name: string
    record_id: string
    field_name: string
    old_value: string
    new_value: string
    change_reason: string
    changed_by: string
  }
) {
  await supabase.from(LOG_TABLE).insert({ ...entry, changed_at: new Date().toISOString() })
}

// ─── ACTION 1 ───────────────────────────────────────────────────────────────
export async function activateZone(zoneId: string, adminUserId: string): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('geo_hierarchy')
    .update({ is_active: true, zone_proposal_status: 'active', updated_at: new Date().toISOString() })
    .eq('id', zoneId)
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 2 ───────────────────────────────────────────────────────────────
export async function deactivateZone(zoneId: string, adminUserId: string): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('geo_hierarchy')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', zoneId)
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 3 ───────────────────────────────────────────────────────────────
export async function updateZoneTrades(
  zoneId: string,
  adminUserId: string,
  trades: string[],
  skills: string[],
  jobTypes: string[]
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('geo_hierarchy')
    .update({ trades, skills, job_types: jobTypes, updated_at: new Date().toISOString() })
    .eq('id', zoneId)
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 3b — full zone edit (name/level/description/state/city/pincode + trades) ──
export type ZoneEditInput = {
  name: string
  level: string
  description: string
  state: string
  city: string
  pincode: string
  trades: string[]
  skills: string[]
  job_types: string[]
}

export async function updateZoneDetails(
  zoneId: string,
  adminUserId: string,
  data: ZoneEditInput
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('geo_hierarchy')
    .update({
      name: data.name,
      level: data.level,
      description: data.description || null,
      state: data.state || null,
      city: data.city || null,
      pincode: data.pincode || null,
      trades: data.trades,
      skills: data.skills,
      job_types: data.job_types,
      updated_at: new Date().toISOString(),
    })
    .eq('id', zoneId)
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 4 ───────────────────────────────────────────────────────────────
export async function approveRateCard(
  rateCardId: string,
  adminUserId: string,
  remarks: string
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()

  const { data: old, error: fetchErr } = await supabase
    .from('rate_card')
    .select('rate_change_status')
    .eq('id', rateCardId)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error } = await supabase
    .from('rate_card')
    .update({
      rate_change_status: 'approved',
      rate_change_remarks: remarks,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rateCardId)
  if (error) return { error: error.message }

  await logChange(supabase, {
    table_name: 'rate_card',
    record_id: rateCardId,
    field_name: 'rate_change_status',
    old_value: String(old?.rate_change_status ?? 'proposed'),
    new_value: 'approved',
    change_reason: remarks,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 5 ───────────────────────────────────────────────────────────────
export async function rejectRateCard(
  rateCardId: string,
  adminUserId: string,
  remarks: string
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()

  const { error } = await supabase
    .from('rate_card')
    .update({ rate_change_status: 'rejected', rate_change_remarks: remarks, updated_at: new Date().toISOString() })
    .eq('id', rateCardId)
  if (error) return { error: error.message }

  await logChange(supabase, {
    table_name: 'rate_card',
    record_id: rateCardId,
    field_name: 'rate_change_status',
    old_value: 'proposed',
    new_value: 'rejected',
    change_reason: remarks,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 6 ───────────────────────────────────────────────────────────────
export type CreateRateCardInput = {
  geo_id: string
  activity_code: string
  activity_name: string
  unit: string
  base_rate: number
  min_rate: number
  max_rate: number
  activity_type: string
  activity_skill: string
  activity_skill_level: string
  effective_from: string
}

export async function createRateCard(
  adminUserId: string,
  data: CreateRateCardInput
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()

  const { data: inserted, error } = await supabase
    .from('rate_card')
    .insert({
      geo_id: data.geo_id,
      activity_code: data.activity_code,
      activity_name: data.activity_name,
      unit: data.unit,
      base_rate: data.base_rate,
      min_rate: data.min_rate,
      max_rate: data.max_rate,
      activity_type: data.activity_type,
      activity_skill: data.activity_skill,
      activity_skill_level: data.activity_skill_level,
      effective_from: data.effective_from || null,
      is_active: true,
      rate_change_status: 'approved',
      rate_change_proposed_by: adminUserId,
      rate_change_proposed_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logChange(supabase, {
    table_name: 'rate_card',
    record_id: String(inserted?.id ?? ''),
    field_name: 'base_rate',
    old_value: 'new',
    new_value: String(data.base_rate),
    change_reason: 'New rate card created',
    changed_by: adminUserId,
  })

  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 7 ───────────────────────────────────────────────────────────────
export type EditRateCardInput = {
  base_rate: number
  min_rate: number
  max_rate: number
  activity_type: string
  activity_skill: string
  activity_skill_level: string
}

export async function editRateCard(
  rateCardId: string,
  adminUserId: string,
  data: EditRateCardInput,
  changeReason: string
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()

  const { data: old, error: fetchErr } = await supabase
    .from('rate_card')
    .select('base_rate')
    .eq('id', rateCardId)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error } = await supabase
    .from('rate_card')
    .update({
      base_rate: data.base_rate,
      min_rate: data.min_rate,
      max_rate: data.max_rate,
      activity_type: data.activity_type,
      activity_skill: data.activity_skill,
      activity_skill_level: data.activity_skill_level,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rateCardId)
  if (error) return { error: error.message }

  await logChange(supabase, {
    table_name: 'rate_card',
    record_id: rateCardId,
    field_name: 'base_rate',
    old_value: String(old?.base_rate ?? ''),
    new_value: String(data.base_rate),
    change_reason: changeReason,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 8 ───────────────────────────────────────────────────────────────
export async function deactivateRateCard(
  rateCardId: string,
  adminUserId: string,
  changeReason: string
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()

  const { error } = await supabase
    .from('rate_card')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', rateCardId)
  if (error) return { error: error.message }

  await logChange(supabase, {
    table_name: 'rate_card',
    record_id: rateCardId,
    field_name: 'is_active',
    old_value: 'true',
    new_value: 'false',
    change_reason: changeReason,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 9 / 10 / 11 ─────────────────────────────────────────────────────
async function decideZoneProposal(
  proposalId: string,
  adminUserId: string,
  remarks: string,
  decision: 'approved' | 'rejected' | 'deferred'
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('zone_proposals')
    .update({
      admin_decision: decision,
      admin_remarks: remarks,
      admin_decided_at: now,
      admin_decided_by: adminUserId,
      updated_at: now,
    })
    .eq('id', proposalId)
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

export async function approveZoneProposal(
  proposalId: string,
  adminUserId: string,
  remarks: string
): Promise<ZoneActionResult> {
  return decideZoneProposal(proposalId, adminUserId, remarks, 'approved')
}

export async function rejectZoneProposal(
  proposalId: string,
  adminUserId: string,
  remarks: string
): Promise<ZoneActionResult> {
  return decideZoneProposal(proposalId, adminUserId, remarks, 'rejected')
}

export async function deferZoneProposal(
  proposalId: string,
  adminUserId: string,
  remarks: string
): Promise<ZoneActionResult> {
  return decideZoneProposal(proposalId, adminUserId, remarks, 'deferred')
}

// ─── ACTION 12 — new zone proposal ──────────────────────────────────────────
export type ZoneProposalInput = {
  new_zone_name: string
  new_zone_justification: string
  old_zones_affected: string[]
  old_zones_changes: string
  super_admin_copy: boolean
}

export async function addZoneProposal(
  adminUserId: string,
  data: ZoneProposalInput
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase.from('zone_proposals').insert({
    new_zone_name: data.new_zone_name,
    new_zone_justification: data.new_zone_justification || null,
    old_zones_affected: data.old_zones_affected,
    old_zones_changes: data.old_zones_changes || null,
    super_admin_copy: data.super_admin_copy,
    proposed_by: adminUserId,
    proposed_at: new Date().toISOString(),
    admin_decision: 'pending',
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 13 — worker zone assignment inline edit ─────────────────────────
export async function updateWorkerZoneAssignment(
  assignmentId: string,
  adminUserId: string,
  data: { worker_type: string; job_type: string; assign_date: string }
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('worker_zone_assignments')
    .update({
      worker_type: data.worker_type,
      job_type: data.job_type,
      assign_date: data.assign_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── ACTION 14/15 — regions ─────────────────────────────────────────────────
export type RegionInput = {
  region_name: string
  region_code: string
  state: string
  description: string
}

export async function addRegion(adminUserId: string, data: RegionInput): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase.from('regions').insert({
    region_name: data.region_name,
    region_code: data.region_code,
    state: data.state || null,
    description: data.description || null,
    is_active: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

export async function updateRegion(
  regionId: string,
  adminUserId: string,
  data: RegionInput
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('regions')
    .update({
      region_name: data.region_name,
      region_code: data.region_code,
      state: data.state || null,
      description: data.description || null,
    })
    .eq('id', regionId)
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}

export async function setRegionActive(
  regionId: string,
  adminUserId: string,
  active: boolean
): Promise<ZoneActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase.from('regions').update({ is_active: active }).eq('id', regionId)
  if (error) return { error: error.message }
  revalidatePath('/admin/zones')
  return { success: true }
}
