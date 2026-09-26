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

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'worker'
}

export async function submitWorkerRegistration(trade: string, data: {
  fullName: string; phone: string; email?: string; aadhaarLast4?: string; pan?: string
  gender?: string; dob?: string; whatsappSame: boolean; whatsappPhone?: string
  state: string; district?: string; city?: string; pincode?: string; address?: string
  skill_level: string; sector: string; labour_type: string; employment_type: string
  secondaryTrades: string[]; years_experience?: string; jobs_completed?: number
  zones: string[]; daily_wage?: number; hourly_rate?: number; is_available: boolean
  height_restriction: boolean; dustRestriction: boolean; deploymentRestriction?: string
  team_name?: string; teamNumber?: string
  bocwRegistered: boolean; bocw_number?: string; pf_uan?: string; esic_ip?: string
  bank_account?: string; ifsc_code?: string
  emergency_name?: string; emergency_phone?: string
}) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = serviceKey
      ? createAdminClient('https://xhlpdbcrncpznrqpcrht.supabase.co', serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
      : createAdminClient('https://xhlpdbcrncpznrqpcrht.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const code = tradeCode(trade)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    const workerCode = `WRK-${code}-${year}-${rand}`

    const { data: row, error } = await supabase.from('workers').insert({
      full_name: data.fullName,
      phone: data.phone,
      email: data.email ?? null,
      aadhaar_last4: data.aadhaarLast4 ?? null,
      pan: data.pan ?? null,
      gender: data.gender ?? null,
      dob: data.dob ?? null,
      whatsapp_same: data.whatsappSame,
      whatsapp_phone: data.whatsappSame ? null : (data.whatsappPhone ?? null),
      trade: tradeName(trade),
      skill_level: data.skill_level,
      daily_wage_inr: data.daily_wage ?? null,
      hourly_rate: data.hourly_rate ?? null,
      state: data.state,
      district: data.district ?? null,
      city: data.city ?? null,
      pincode: data.pincode ?? null,
      address: data.address ?? null,
      years_experience: data.years_experience ?? null,
      is_bocw_registered: data.bocwRegistered,
      bocw_registration_number: data.bocw_number ?? null,
      pf_uan: data.pf_uan ?? null,
      esic_ip_number: data.esic_ip ?? null,
      emergency_contact_name: data.emergency_name ?? null,
      emergency_contact_phone: data.emergency_phone ?? null,
      bank_account_number: data.bank_account ?? null,
      ifsc_code: data.ifsc_code ?? null,
      approval_status: 'pending',
      is_active: true,
      is_available: data.is_available,
      sector: data.sector,
      labour_type: data.labour_type,
      employment_classification: data.employment_type,
      secondary_trades: data.secondaryTrades,
      zones: data.zones,
      height_restriction: data.height_restriction,
      dust_restriction: data.dustRestriction,
      deployment_restriction: data.deploymentRestriction ?? null,
      team_name: data.team_name ?? null,
      team_number: data.teamNumber ?? null,
      jobs_completed_in_trade: data.jobs_completed ?? 0,
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

// Dev/beta-stage login convention (agreed with project owner, Session 65): each worker gets
// its own real auth.users row (never shared) with a systematically generated, always-valid
// login email (independent of whatever contact email the worker typed on Screen 1), paired
// with one universal password across all worker accounts, so staff can log in as any worker
// during testing without depending on real email delivery. This is real, functioning account
// creation — not a placeholder — every value written here is genuine and actually works.
const WORKER_DEV_LOGIN_PASSWORD = 'Worker2026'

export async function createWorkerAuthAccount(trade: string, fullName: string, workerId: string, workerCode: string) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return { error: 'Service key not configured' }
    const admin = createAdminClient('https://xhlpdbcrncpznrqpcrht.supabase.co', serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const numbering = workerCode.split('-').pop() ?? '0000'
    const loginEmail = `${slugify(fullName)}_${slugify(tradeName(trade))}_${numbering}@proengineering.in`
    const { data, error } = await admin.auth.admin.createUser({
      email: loginEmail, password: WORKER_DEV_LOGIN_PASSWORD, email_confirm: true,
      user_metadata: { full_name: fullName, worker_code: workerCode }
    })
    if (error) return { error: error.message }
    const newId = data.user.id
    const { error: usersError } = await admin.from('users').insert({
      id: newId, email: loginEmail, full_name: fullName, platform_role: 'worker'
    })
    if (usersError) return { error: usersError.message }
    const { error: updateError } = await admin.from('workers')
      .update({ auth_user_id: newId, user_id: newId, login_email: loginEmail })
      .eq('id', workerId)
    if (updateError) return { error: updateError.message }
    return { success: true, userId: newId, loginEmail }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function checkPhoneExists(phone: string) {
  // Uses the service-role client, not the anon client: workers has no anon SELECT policy
  // (only anon INSERT, for the public registration form), so the anon client silently saw
  // zero rows for every phone number and this check never actually caught a duplicate.
  // Opening a public anon SELECT policy on workers would expose every worker's phone/bank/
  // Aadhaar data — the service-role bypass avoids that while making the check real.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = serviceKey
    ? createAdminClient('https://xhlpdbcrncpznrqpcrht.supabase.co', serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : await createClient()
  const { data } = await supabase.from('workers').select('id').eq('phone', phone).maybeSingle()
  return { exists: !!data }
}
