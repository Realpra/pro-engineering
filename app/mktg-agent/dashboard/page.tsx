import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function MktgAgentDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'mktg_agent') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Marketing Agent'
  const istHour = new Date().getUTCHours() + 5.5 >= 24 ? new Date().getUTCHours() + 5.5 - 24 : new Date().getUTCHours() + 5.5

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">Pro Engineering</p>
            <p className="text-blue-300 text-xs truncate">Marketing — {displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6 pb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">
            {greeting(Math.floor(istHour))}, {displayName.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Log a new lead into the pipeline</p>
        </div>

        <Link
          href="/book"
          className="block bg-[#1F3864] rounded-2xl px-5 py-6 shadow-sm active:scale-[0.98] transition-transform"
        >
          <p className="text-white font-bold text-lg mb-1">+ Create New Job</p>
          <p className="text-blue-300 text-sm">
            Fill in a client&apos;s job details — no payment is required, a coordinator will
            follow up to arrange a free site survey.
          </p>
        </Link>
      </main>
    </div>
  )
}
