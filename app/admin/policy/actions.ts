'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PolicyActionResult = { success: true } | { error: string }

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
  await supabase.from(LOG_TABLE).insert({
    ...entry,
    changed_at: new Date().toISOString(),
  })
}

// ─── ACTION 1 ────────────────────────────────────────────────────────────────
export async function updatePlatformPremium(
  id: string,
  adminUserId: string,
  newRatePct: number,
  changeReason: string
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { data: old, error: fetchErr } = await supabase
    .from('platform_premium_policy')
    .select('premium_pct')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error: updErr } = await supabase
    .from('platform_premium_policy')
    .update({ premium_pct: newRatePct, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return { error: updErr.message }

  await logChange(supabase, {
    table_name: 'platform_premium_policy',
    record_id: id,
    field_name: 'premium_pct',
    old_value: String(old?.premium_pct ?? ''),
    new_value: String(newRatePct),
    change_reason: changeReason,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 2 ────────────────────────────────────────────────────────────────
export async function deactivatePlatformPremium(
  id: string,
  adminUserId: string,
  changeReason: string
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { data: old, error: fetchErr } = await supabase
    .from('platform_premium_policy')
    .select('is_active')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error: updErr } = await supabase
    .from('platform_premium_policy')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return { error: updErr.message }

  await logChange(supabase, {
    table_name: 'platform_premium_policy',
    record_id: id,
    field_name: 'is_active',
    old_value: String(old?.is_active ?? 'true'),
    new_value: 'false',
    change_reason: changeReason,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 3 ────────────────────────────────────────────────────────────────
export async function addPlatformPremium(
  adminUserId: string,
  vertical: string,
  jobCategory: string,
  ratePct: number
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { data: inserted, error: insErr } = await supabase
    .from('platform_premium_policy')
    .insert({
      vertical,
      job_category: jobCategory,
      premium_pct: ratePct,
      is_active: true,
      set_by: adminUserId,
    })
    .select('id')
    .single()
  if (insErr) return { error: insErr.message }

  await logChange(supabase, {
    table_name: 'platform_premium_policy',
    record_id: String(inserted?.id ?? ''),
    field_name: 'premium_pct',
    old_value: 'new',
    new_value: String(ratePct),
    change_reason: 'New platform premium policy added',
    changed_by: adminUserId,
  })

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 4 ────────────────────────────────────────────────────────────────
export async function updateContingency(
  id: string,
  adminUserId: string,
  maxPct: number,
  adminApprovalLimitPct: number,
  changeReason: string
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { data: old, error: fetchErr } = await supabase
    .from('contingency_policy')
    .select('contingency_pct, max_deviation_pct')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error: updErr } = await supabase
    .from('contingency_policy')
    .update({
      contingency_pct: maxPct,
      max_deviation_pct: adminApprovalLimitPct,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updErr) return { error: updErr.message }

  if (String(old?.contingency_pct ?? '') !== String(maxPct)) {
    await logChange(supabase, {
      table_name: 'contingency_policy',
      record_id: id,
      field_name: 'contingency_pct',
      old_value: String(old?.contingency_pct ?? ''),
      new_value: String(maxPct),
      change_reason: changeReason,
      changed_by: adminUserId,
    })
  }

  if (String(old?.max_deviation_pct ?? '') !== String(adminApprovalLimitPct)) {
    await logChange(supabase, {
      table_name: 'contingency_policy',
      record_id: id,
      field_name: 'max_deviation_pct',
      old_value: String(old?.max_deviation_pct ?? ''),
      new_value: String(adminApprovalLimitPct),
      change_reason: changeReason,
      changed_by: adminUserId,
    })
  }

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 5 ────────────────────────────────────────────────────────────────
export async function deactivateContingency(
  id: string,
  adminUserId: string,
  changeReason: string
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { data: old, error: fetchErr } = await supabase
    .from('contingency_policy')
    .select('is_active')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error: updErr } = await supabase
    .from('contingency_policy')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return { error: updErr.message }

  await logChange(supabase, {
    table_name: 'contingency_policy',
    record_id: id,
    field_name: 'is_active',
    old_value: String(old?.is_active ?? 'true'),
    new_value: 'false',
    change_reason: changeReason,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 6 ────────────────────────────────────────────────────────────────
export async function updatePaymentPolicy(
  id: string,
  adminUserId: string,
  coordinatorLimit: number,
  adminLimit: number,
  notes: string
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { data: old, error: fetchErr } = await supabase
    .from('payment_policy')
    .select('coordinator_limit, admin_limit')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error: updErr } = await supabase
    .from('payment_policy')
    .update({
      coordinator_limit: coordinatorLimit,
      admin_limit: adminLimit,
      notes,
    })
    .eq('id', id)
  if (updErr) return { error: updErr.message }

  if (String(old?.coordinator_limit ?? '') !== String(coordinatorLimit)) {
    await logChange(supabase, {
      table_name: 'payment_policy',
      record_id: id,
      field_name: 'coordinator_limit',
      old_value: String(old?.coordinator_limit ?? ''),
      new_value: String(coordinatorLimit),
      change_reason: notes || 'Payment threshold updated',
      changed_by: adminUserId,
    })
  }

  if (String(old?.admin_limit ?? '') !== String(adminLimit)) {
    await logChange(supabase, {
      table_name: 'payment_policy',
      record_id: id,
      field_name: 'admin_limit',
      old_value: String(old?.admin_limit ?? ''),
      new_value: String(adminLimit),
      change_reason: notes || 'Payment threshold updated',
      changed_by: adminUserId,
    })
  }

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 7 ────────────────────────────────────────────────────────────────
export type ComplianceConfigInput = {
  compliance_type: string
  compliance_name: string
  applicable_job_types: string[]
  applicable_sectors: string[]
  rate_pct: number | null
  threshold_value: number | null
  unit: string
  legal_reference: string
  notes: string
  effective_from: string
}

export async function addComplianceConfig(
  adminUserId: string,
  data: ComplianceConfigInput
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { data: inserted, error: insErr } = await supabase
    .from('compliance_config')
    .insert({
      compliance_type: data.compliance_type,
      compliance_name: data.compliance_name,
      applicable_job_types: data.applicable_job_types,
      applicable_sectors: data.applicable_sectors,
      rate_pct: data.rate_pct,
      threshold_value: data.threshold_value,
      unit: data.unit,
      legal_reference: data.legal_reference,
      notes: data.notes,
      effective_from: data.effective_from || null,
      is_active: true,
      created_by: adminUserId,
    })
    .select('id')
    .single()
  if (insErr) return { error: insErr.message }

  await logChange(supabase, {
    table_name: 'compliance_config',
    record_id: String(inserted?.id ?? ''),
    field_name: 'compliance_name',
    old_value: 'new',
    new_value: data.compliance_name,
    change_reason: 'New compliance config added',
    changed_by: adminUserId,
  })

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 8 ────────────────────────────────────────────────────────────────
export async function deactivateComplianceConfig(
  id: string,
  adminUserId: string,
  changeReason: string
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { error: updErr } = await supabase
    .from('compliance_config')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return { error: updErr.message }

  await logChange(supabase, {
    table_name: 'compliance_config',
    record_id: id,
    field_name: 'is_active',
    old_value: 'true',
    new_value: 'false',
    change_reason: changeReason,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 9 ────────────────────────────────────────────────────────────────
export type BusinessRuleInput = {
  rule_name: string
  rule_category: string
  rule_value: string
  applies_to: string
  effective_from: string
  notes: string
}

export async function addBusinessRule(
  adminUserId: string,
  data: BusinessRuleInput
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { data: inserted, error: insErr } = await supabase
    .from('business_rules_config')
    .insert({
      rule_name: data.rule_name,
      rule_category: data.rule_category,
      rule_value: data.rule_value,
      applies_to: data.applies_to,
      effective_from: data.effective_from || null,
      notes: data.notes,
      is_active: true,
      created_by: adminUserId,
    })
    .select('id')
    .single()
  if (insErr) return { error: insErr.message }

  await logChange(supabase, {
    table_name: 'business_rules_config',
    record_id: String(inserted?.id ?? ''),
    field_name: 'rule_name',
    old_value: 'new',
    new_value: data.rule_name,
    change_reason: 'New business rule added',
    changed_by: adminUserId,
  })

  revalidatePath('/admin/policy')
  return { success: true }
}

// ─── ACTION 10 ───────────────────────────────────────────────────────────────
export async function deactivateBusinessRule(
  id: string,
  adminUserId: string,
  changeReason: string
): Promise<PolicyActionResult> {
  const supabase: any = await createClient()

  const { error: updErr } = await supabase
    .from('business_rules_config')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return { error: updErr.message }

  await logChange(supabase, {
    table_name: 'business_rules_config',
    record_id: id,
    field_name: 'is_active',
    old_value: 'true',
    new_value: 'false',
    change_reason: changeReason,
    changed_by: adminUserId,
  })

  revalidatePath('/admin/policy')
  return { success: true }
}
