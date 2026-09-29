'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { linkClientAccount } from '@/app/client/login/actions'

// Real magic-link landing page. The Supabase JS client auto-detects the
// session from the URL fragment on load (detectSessionInUrl defaults to
// true), so this page just waits for that session, then links the newly
// authenticated auth.users.id onto every guest_enquiries row matching the
// verified email -- the one step that previously never happened anywhere,
// since client_user_id was never written by any live code path.
export default function ClientAuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function run() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError('This link is invalid or has expired. Please request a new one.')
        return
      }
      const result = await linkClientAccount(session.user.id, session.user.email ?? null, session.user.phone ?? null)
      if (result.error) {
        setError(result.error)
        return
      }
      router.replace(result.bookingRef ? `/client/dashboard/${result.bookingRef}` : '/client/dashboard')
    }

    run()
  }, [router])

  return (
    <div className="min-h-screen bg-[#1F3864] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        <h1 className="text-[#1F3864] text-2xl font-bold">PRO ENGINEERING</h1>
        {error ? (
          <>
            <p className="text-gray-600 text-sm mt-4">{error}</p>
            <a href="/client/login" className="inline-block mt-6 bg-[#1F3864] text-white font-bold px-6 py-3 rounded-xl">
              Back to Login
            </a>
          </>
        ) : (
          <p className="text-gray-500 text-sm mt-4">Signing you in…</p>
        )}
      </div>
    </div>
  )
}
