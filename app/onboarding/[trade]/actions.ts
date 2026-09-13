'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { tradeName } from './utils'

function tradeCode(trade: string): string {
  const map: Record<string, string> = {
    mason:'MAS', plumber:'PLB', electrician:'ELC', waterproofer:'WTP',
    painter:'PNT', carpenter:'CRP', 'false-ceiling-installer':'FCI',
    helper:'HLP', supervisor:'SUP',
  }
  return map[trade.toLowerCase()] ?? 'WRK'
}

export async function submitWorkerRegistration(trade: string, data: {
  fullName: string; phone: string; email?: string; aadhaarLast4?: string; pan?: string
  state: string; district?: string; city?: string; pincode?: string; address?: string
  skillLevel: string; sector: string; labourType: string; employmentType: string
  secondaryTrades: string[]; yearsExperience?: string; jobsCompleted?: number
  zones: string[]; dailyWage?: number; hourlyRate?: number; isAvailable: boolean
  heightRestriction: boolean; dustRestriction: boolean; deploymentRestriction?: string
  teamName?: string; teamNumber?: string
  bocwRegistered: boolean; bocwNumber?: string; pfUan?: string; esicIp?: string
  bankAccount?: string; ifscCode?: string
  emergencyName?: string; emergencyPhone?: string
}) {
  try {
    const supabase = await createClient()
    const code = tradeCode(trade)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    const workerCode = `WRK-${code}-${year}-${rand}`

    const { data: row, error } = await supabase.from('workers').insert({
      full_name: data.fullName,
      phone: data.phone,
      aadhaar_last4: data.aadhaarLast4 ?? null,
      pan: data.pan ?? null,
      trade: tradeName(trade),
      skill_level: data.skillLevel,
      daily_wage_inr: data.dailyWage ?? null,
      hourly_rate: data.hourlyRate ?? null,
      state: data.state,
      district: data.district ?? null,
      is_bocw_registered: data.bocwRegistered,
      bocw_registration_number: data.bocwNumber ?? null,
      pf_uan: data.pfUan ?? null,
      esic_ip_number: data.esicIp ?? null,
      emergency_contact_name: data.emergencyName ?? null,
      emergency_contact_phone: data.emergencyPhone ?? null,
      bank_account_number: data.bankAccount ?? null,
      ifsc_code: data.ifscCode ?? null,
      approval_status: 'pending',
      is_active: true,
      is_available: data.isAvailable,
      sector: data.sector,
      labour_type: data.labourType,
      employment_classification: data.employmentType,
      secondary_trades: data.secondaryTrades,
      zones: data.zones,
      height_restriction: data.heightRestriction,
      dust_restriction: data.dustRestriction,
      deployment_restriction: data.deploymentRestriction ?? null,
      team_name: data.teamName ?? null,
      team_number: data.teamNumber ?? null,
      jobs_completed_in_trade: data.jobsCompleted ?? 0,
      worker_code: workerCode,
      profile_complete: false,
    }).select('id, worker_code').single()

    if (error) return { error: error.message }
    revalidatePath('/onboarding')
    return { success: true, workerId: row.id, workerCode: row.worker_code }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function createWorkerAuthAccount(email: string, phone: string, fullName: string, workerId: string) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return { error: 'Service key not configured' }
    const admin = createAdminClient('https://xhlpdbcrncpznrqpcrht.supabase.co', serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()
    const { data, error } = await admin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { full_name: fullName, email_verified: true }
    })
    if (error) return { error: error.message }
    const newId = data.user.id
    await admin.from('users').insert({ id: newId, email, full_name: fullName, platform_role: 'worker' })
    await admin.from('workers').update({ auth_user_id: newId, user_id: newId }).eq('id', workerId)
    return { success: true, userId: newId }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function checkPhoneExists(phone: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('workers').select('id').eq('phone', phone).maybeSingle()
  return { exists: !!data }
}
