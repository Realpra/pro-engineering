'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
export async function loginAction(formData: FormData) {
  try {
    console.log('[login] email:', formData.get('email'))
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    console.log('[login] signIn result:', JSON.stringify(error))
    if (error) return { error: error.message }
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[login] user id:', user?.id)
    if (!user) return { error: 'Could not get user' }
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('platform_role')
      .eq('id', user.id)
      .maybeSingle()
    console.log('[login] profile:', JSON.stringify(profile))
    if (profileError) {
      console.error('loginAction: platform_role lookup failed for user', user.id, profileError)
      return { error: 'Could not verify account role. Please try again or contact administrator.' }
    }
    const role = profile?.platform_role?.trim()
    console.log('[login] role:', role)
    if (role === 'super_admin') redirect('/superadmin/dashboard')
    else if (role === 'supervisor') redirect('/supervisor/dashboard')
    else if (role === 'sub_coordinator') redirect('/sub-coordinator/dashboard')
    else if (role === 'site_incharge') redirect('/site-incharge/dashboard')
    else if (role === 'client') redirect('/client/dashboard')
    else if (role === 'coordinator') redirect('/coordinator/dashboard')
    else if (role === 'admin') redirect('/admin/dashboard')
    else if (!profile) return { error: `No profile record found for user ${user.id}. Contact administrator.` }
    else return { error: `Unrecognised role "${profile.platform_role}". Contact administrator.` }
  } catch(e) {
    if (isRedirectError(e)) throw e
    return { error: 'Login failed. Please try again.' }
  }
}