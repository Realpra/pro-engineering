'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

// Admin add / edit / delete structure for milestone stage and sub-stage templates
// (owner's instruction, 30 Oct 2026: "create the structure for adding / editing existing /
// deleting"). Reuses the live tables milestone_stage_templates and milestone_substage_templates
// exactly as they are -- columns confirmed read-only against the live database on 30 Oct 2026.
// Both tables already have authenticated write policies (write_mst / write_msst), so no
// migration is needed for this file; the Admin check below decides who may change them.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type TemplateActionResult = { success: true } | { error: string }

// Postgres 23503 = a live job (or another record) still points at this template.
function friendly(error: { code?: string; message: string }): string {
  return error.code === '23503'
    ? 'This template is already used by a job, so it cannot be deleted. Deactivate it instead.'
    : error.message
}

const PATH = '/admin/milestones'

async function requireAdmin(): Promise<{ supabase: any; userId: string } | { error: string }> {
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { data: profile } = await supabase
    .from('users').select('platform_role').eq('id', user.id).maybeSingle()
  if (profile?.platform_role !== 'admin' && profile?.platform_role !== 'super_admin') {
    return { error: 'Only Admin can change templates.' }
  }
  return { supabase, userId: user.id }
}

// ─── Stage template: delete ─────────────────────────────────────────────────
// A stage that still has sub-stage templates cannot be deleted (the live foreign key would
// refuse it). Admin deletes or moves the sub-stages first, or deactivates the stage instead.
export async function deleteMilestoneStageTemplate(templateId: string): Promise<TemplateActionResult> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { count } = await ctx.supabase
    .from('milestone_substage_templates')
    .select('id', { count: 'exact', head: true })
    .eq('stage_template_id', templateId)
  if ((count ?? 0) > 0) {
    return { error: `This stage still has ${count} sub-stage template(s). Delete them first, or deactivate the stage instead.` }
  }
  const { error } = await ctx.supabase.from('milestone_stage_templates').delete().eq('id', templateId)
  if (error) return { error: friendly(error) }
  revalidatePath(PATH)
  return { success: true }
}

// ─── Sub-stage templates ────────────────────────────────────────────────────
export type SubstageTemplateInput = {
  substage_code: string
  substage_name: string
  substage_description: string
  sequence_order: number
  planned_day: number | null
  planned_hours: number | null
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  trade_type: string
  skill_level_required: string
  sector: string
  methodology_ref: string
  evidence_checklist: string[]
  supervisor_checklist: string[]
  subcoordinator_checklist: string[]
  coordinator_checklist: string[]
  quality_checklist: string[]
}

function substageColumns(d: SubstageTemplateInput) {
  const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean)
  return {
    substage_code: d.substage_code.trim(),
    substage_name: d.substage_name.trim(),
    substage_description: d.substage_description.trim() || null,
    sequence_order: d.sequence_order,
    planned_day: d.planned_day,
    planned_hours: d.planned_hours,
    skilled_workers_per_day: d.skilled_workers_per_day,
    unskilled_workers_per_day: d.unskilled_workers_per_day,
    trade_type: d.trade_type.trim() || null,
    skill_level_required: d.skill_level_required.trim() || null,
    sector: d.sector.trim() || null,
    methodology_ref: d.methodology_ref.trim() || null,
    evidence_checklist: clean(d.evidence_checklist),
    supervisor_checklist: clean(d.supervisor_checklist),
    subcoordinator_checklist: clean(d.subcoordinator_checklist),
    coordinator_checklist: clean(d.coordinator_checklist),
    quality_checklist: clean(d.quality_checklist),
  }
}

function validate(d: SubstageTemplateInput): string | null {
  if (!d.substage_code.trim()) return 'Sub-stage code is required (e.g. M1-A).'
  if (!d.substage_name.trim()) return 'Sub-stage name is required.'
  return null
}

export async function addSubstageTemplate(
  stageTemplateId: string,
  data: SubstageTemplateInput,
): Promise<TemplateActionResult> {
  const msg = validate(data)
  if (msg) return { error: msg }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase.from('milestone_substage_templates').insert({
    ...substageColumns(data),
    stage_template_id: stageTemplateId,
    is_active: true,
    created_by: ctx.userId,
  })
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function editSubstageTemplate(
  substageTemplateId: string,
  data: SubstageTemplateInput,
): Promise<TemplateActionResult> {
  const msg = validate(data)
  if (msg) return { error: msg }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('milestone_substage_templates')
    .update({ ...substageColumns(data), updated_at: new Date().toISOString() })
    .eq('id', substageTemplateId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function setSubstageTemplateActive(
  substageTemplateId: string,
  isActive: boolean,
): Promise<TemplateActionResult> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('milestone_substage_templates')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', substageTemplateId)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function deleteSubstageTemplate(substageTemplateId: string): Promise<TemplateActionResult> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('milestone_substage_templates').delete().eq('id', substageTemplateId)
  if (error) return { error: friendly(error) }
  revalidatePath(PATH)
  return { success: true }
}
