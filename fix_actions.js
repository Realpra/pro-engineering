const fs = require('fs')
let a = `'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
export const runtime = 'nodejs'
export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Could not get user' }
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).single()
  const role = profile?.platform_role
  if (role === 'super_admin') redirect('/superadmin/dashboard')
  else if (role === 'supervisor') redirect('/supervisor/dashboard')
  else if (role === 'client') redirect('/client/dashboard')
  else if (role === 'coordinator' || role === 'sub_coordinator' || role === 'admin') redirect('/admin/dashboard')
  else return { error: 'Role not recognised. Contact administrator.' }
}
`
fs.writeFileSync('app/login/actions.ts', a)
console.log('DONE')