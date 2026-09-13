'use server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function createWorkerAuthAccount(email: string, phone: string, fullName: string, trade: string, workerId: string) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return { error: 'Service key not configured' }
    const admin = createClient('https://xhlpdbcrncpznrqpcrht.supabase.co', serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: phone,
      email_confirm: true,
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
  const supabase = await createServerClient()
  const { data } = await supabase.from('workers').select('id').eq('phone', phone).maybeSingle()
  return { exists: !!data }
}

export async function checkEmailExists(email: string) {
  const supabase = await createServerClient()
  const { data } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
  return { exists: !!data }
}
