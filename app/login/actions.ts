'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
export async function loginAction(formData: FormData) {
  try {
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
    else if (role === 'sub_coordinator') redirect('/sub-coordinator/dashboard')
    else if (role === 'site_incharge') redirect('/site-incharge/dashboard')
    else if (role === 'client') redirect('/client/dashboard')
    else if (role === 'coordinator') redirect('/coordinator/dashboard')
    else if (role === 'admin') redirect('/admin/dashboard')
    else return { error: 'Role not recognised. Contact administrator.' }
  } catch(e) {
    if (isRedirectError(e)) throw e
    return { error: 'Login failed. Please try again.' }
  }
}