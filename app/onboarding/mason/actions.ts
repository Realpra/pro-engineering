'use server'

import { createClient } from '@/lib/supabase/server'

export async function submitWorker(
  formData: FormData
): Promise<{ error?: string; workerId?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('workers').insert({
    full_name:                 formData.get('full_name') as string,
    aadhaar_last4:             formData.get('aadhaar_last4') as string,
    phone:                     formData.get('phone') as string,
    bank_account_number:       formData.get('bank_account_number') as string,
    ifsc_code:                 formData.get('ifsc_code') as string,
    district:                  formData.get('district') as string,
    profile_photo:             (formData.get('photo_path') as string) || null,
    trade:                     'Mason',
    sector:                    'civil',
    state:                     'Uttar Pradesh',
    is_active:                 false,
    approval_status:           'pending',
    skill_level:               'semi_skilled',
    labour_type:               'skilled_trade',
    employment_classification: 'self',
  }).select('id').single()

  if (error) return { error: error.message }
  return { workerId: data.id }
}

export async function resubmitWorker(workerId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workers')
    .update({
      approval_status: 'pending',
      correction_action: null,
      approved_at: null,
    })
    .eq('id', workerId)

  if (error) return { error: error.message }
  return {}
}

export async function saveCompetency(
  workerId: string,
  entries: {
    module_code: string
    declared: boolean
    mcq_passed: boolean | null
    score: number | null
  }[]
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const rows = entries.map(e => ({
    worker_id:  workerId,
    module_code: e.module_code,
    declared:   e.declared,
    mcq_passed: e.mcq_passed,
    score:      e.score,
  }))

  const { error } = await supabase.from('worker_competency').insert(rows)
  if (error) return { error: error.message }
  return {}
}
