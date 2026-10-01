'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Admin-editable Section C Skill Question Bank (project owner's decision, 2 Oct 2026:
// "the question bank shall be editable by admin. it will create the slot and full testing").
// Backed by trade_skill_questions' new authenticated WRITE RLS policy
// (20261002_worker_onboarding_tools_text_and_question_bank.sql) -- before this migration,
// only the service-role onboarding-reference-data reader could touch this table at all.

export type QuestionActionResult = { success: true } | { error: string }

export async function addTradeQuestion(
  trade: string,
  questionCode: string,
  questionText: string,
  displayOrder: number,
): Promise<QuestionActionResult> {
  const code = questionCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!code) return { error: 'Question code is required.' }
  if (!questionText.trim()) return { error: 'Question text is required.' }
  const supabase = await createClient()
  const { error } = await supabase.from('trade_skill_questions').insert({
    trade, question_code: code, question_text: questionText.trim(), display_order: displayOrder,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/trade-questions')
  return { success: true }
}

export async function updateTradeQuestion(
  id: string,
  questionText: string,
  displayOrder: number,
): Promise<QuestionActionResult> {
  if (!questionText.trim()) return { error: 'Question text is required.' }
  const supabase = await createClient()
  const { error } = await supabase.from('trade_skill_questions')
    .update({ question_text: questionText.trim(), display_order: displayOrder })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trade-questions')
  return { success: true }
}

export async function setTradeQuestionActive(id: string, isActive: boolean): Promise<QuestionActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('trade_skill_questions').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trade-questions')
  return { success: true }
}

export async function deleteTradeQuestion(id: string): Promise<QuestionActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('trade_skill_questions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trade-questions')
  return { success: true }
}
