'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/supervisor/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/10 min-h-[48px]"
      aria-label="Sign out"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span className="text-sm font-medium">Sign Out</span>
    </button>
  )
}
