'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function tradeCode(trade: string): string {
  const map: Record<string, string> = {
    mason: 'MAS', plumber: 'PLB', electrician: 'ELC',
    waterproofer: 'WTP', painter: 'PNT', carpenter: 'CRP',
    'false-ceiling-installer': 'FCI', helper: 'HLP', supervisor: 'SUP',
  }
  return map[trade.toLowerCase()] ?? 'WRK'
}

function tradeName(trade: string): string {
  const map: Record<string, string> = {
    mason: 'Mason', plumber: 'Plumber', electrician: 'Electrician',
    waterproofer: 'Waterproofer', painter: 'Painter', carpenter: 'Carpenter',
    'false-ceiling-installer': 'False Ceiling Installer', helper: 'Helper', supervisor: 'Supervisor',
  }
  return map[trade.toLowerCase()] ?? trade
}

export async function submitWorkerRegistration(trade: string, formData: {
  fullName: string; phone: string; email?: string; aadhaarLast4?: string
  state: string; district?: string; skillLevel: string; dailyWage?: number
  zones: string[]; employmentType: string; bocwRegistered: string
  bocwNumber?: string; bankAccount?: string; ifscCode?: string
  emergencyName?: string; emergencyPhone?: string
}) {
  try {
    const supabase = await createClient()
    const code = tradeCode(trade)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    const workerCode = `WRK-${code}-${year}-${rand}`
    const { data, error } = await supabase.from('workers').insert({
      full_name: formData.fullName,
      phone: formData.phone,
      trade: tradeName(trade),
      skill_level: formData.skillLevel,
      daily_wage_inr: formData.dailyWage ?? null,
      state: formData.state,
      district: formData.district ?? null,
      aadhaar_last4: formData.aadhaarLast4 ?? null,
      zones: formData.zones,
      employment_classification: formData.employmentType,
      is_bocw_registered: formData.bocwRegistered === 'yes',
      bocw_registration_number: formData.bocwNumber ?? null,
      bank_account_number: formData.bankAccount ?? null,
      ifsc_code: formData.ifscCode ?? null,
      emergency_contact_name: formData.emergencyName ?? null,
      emergency_contact_phone: formData.emergencyPhone ?? null,
      approval_status: 'pending',
      is_active: true,
      worker_code: workerCode,
      sector: 'civil',
      labour_type: trade === 'supervisor' ? 'supervisor' : trade === 'helper' ? 'support_labour' : 'skilled_trade',
    }).select('id, worker_code').single()
    if (error) return { error: error.message }
    revalidatePath('/onboarding')
    return { success: true, workerId: data.id, workerCode: data.worker_code }
  } catch (e: any) {
    return { error: e.message }
  }
}
