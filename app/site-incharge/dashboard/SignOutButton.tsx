'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }
  return (
    <button
      onClick={handleSignOut}
      className="text-xs text-blue-300 hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg border border-blue-400/30 hover:border-blue-300/50"
    >
      Sign Out
    </button>
  )
}