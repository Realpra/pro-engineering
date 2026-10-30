'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

// Admin-editable quality test repository (owner's decision D13, 30 Oct 2026): tests are
// job-specific; Admin sets them per sector and per job, and can edit, add or delete them.
// Reuses the live QIP tables (qip_templates = a test, qip_template_checks = its steps/questions).
// Needs supabase/migrations/20261030_admin_structure_quality_tests.sql (adds the missing columns
// and the access rules -- without it these tables cannot be read or written by the app).

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ANSWER_TYPE_VALUES } from './answerTypes'

export type QualityTestResult = { success: true } | { error: string }

const PATH = '/admin/quality-tests'

async function requireAdmin(): Promise<{ supabase: any } | { error: string }> {
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { data: profile } = await supabase
    .from('users').select('platform_role').eq('id', user.id).maybeSingle()
  if (profile?.platform_role !== 'admin' && profile?.platform_role !== 'super_admin') {
    return { error: 'Only Admin can change quality tests.' }
  }
  return { supabase }
}

function friendly(error: { code?: string; message: string }): string {
  return error.code === '23503'
    ? 'This test is already used in a site report, so it cannot be deleted. Deactivate it instead.'
    : error.message
}

const textOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

// ─── Tests ──────────────────────────────────────────────────────────────────
export type TestInput = {
  template_name: string
  template_code: string
  version: string
  job_type: string
  vertical: string
  sector: string
  milestone_code: string
  milestone_number: number | null
  substage_code: string
  description: string
  hold_hours: number | null
}

function testColumns(d: TestInput) {
  return {
    template_name: d.template_name.trim(),
    template_code: textOrNull(d.template_code),
    version: textOrNull(d.version),
    job_type: textOrNull(d.job_type),
    vertical: textOrNull(d.vertical),
    sector: textOrNull(d.sector),
    milestone_code: textOrNull(d.milestone_code),
    milestone_number: d.milestone_number,
    substage_code: textOrNull(d.substage_code),
    description: textOrNull(d.description),
    hold_hours: d.hold_hours,
  }
}

export async function addQualityTest(data: TestInput): Promise<QualityTestResult> {
  if (!data.template_name.trim()) return { error: 'Test name is required.' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase.from('qip_templates').insert({ ...testColumns(data), is_active: true })
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function editQualityTest(id: string, data: TestInput): Promise<QualityTestResult> {
  if (!data.template_name.trim()) return { error: 'Test name is required.' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('qip_templates')
    .update({ ...testColumns(data), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function setQualityTestActive(id: string, isActive: boolean): Promise<QualityTestResult> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('qip_templates')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// Deletes the test and its steps. Refused (with a plain message) if any site report already
// recorded a result against it -- those records are kept.
export async function deleteQualityTest(id: string): Promise<QualityTestResult> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error: checksErr } = await ctx.supabase.from('qip_template_checks').delete().eq('template_id', id)
  if (checksErr) return { error: friendly(checksErr) }
  const { error } = await ctx.supabase.from('qip_templates').delete().eq('id', id)
  if (error) return { error: friendly(error) }
  revalidatePath(PATH)
  return { success: true }
}

// ─── Steps / questions ──────────────────────────────────────────────────────
export type StepInput = {
  check_number: string
  sequence_order: number
  check_description: string
  answer_type: string
  options: string[]
  unit: string
  minimum_standard: string
  evidence_type: string
  is_mandatory: boolean
}

function stepColumns(d: StepInput) {
  return {
    check_number: textOrNull(d.check_number),
    sequence_order: d.sequence_order,
    check_description: d.check_description.trim(),
    answer_type: d.answer_type,
    options: d.options.map((o) => o.trim()).filter(Boolean),
    unit: textOrNull(d.unit),
    minimum_standard: textOrNull(d.minimum_standard),
    evidence_type: textOrNull(d.evidence_type),
    is_mandatory: d.is_mandatory,
  }
}

function validateStep(d: StepInput): string | null {
  if (!d.check_description.trim()) return 'Question text is required.'
  if (!ANSWER_TYPE_VALUES.includes(d.answer_type)) return 'Choose an answer type.'
  if (d.answer_type === 'options' && d.options.filter((o) => o.trim()).length < 2) {
    return 'An options question needs at least two options (one per line).'
  }
  return null
}

export async function addTestStep(templateId: string, data: StepInput): Promise<QualityTestResult> {
  const msg = validateStep(data)
  if (msg) return { error: msg }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('qip_template_checks')
    .insert({ ...stepColumns(data), template_id: templateId, is_active: true })
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function editTestStep(id: string, data: StepInput): Promise<QualityTestResult> {
  const msg = validateStep(data)
  if (msg) return { error: msg }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('qip_template_checks')
    .update({ ...stepColumns(data), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function setTestStepActive(id: string, isActive: boolean): Promise<QualityTestResult> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('qip_template_checks')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function deleteTestStep(id: string): Promise<QualityTestResult> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase.from('qip_template_checks').delete().eq('id', id)
  if (error) return { error: friendly(error) }
  revalidatePath(PATH)
  return { success: true }
}
