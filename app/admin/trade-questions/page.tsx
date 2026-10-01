import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import QuestionBankTabs from './QuestionBankTabs'

const TRADES = [
  'Mason', 'Plumber', 'Electrician', 'Waterproofer', 'Painter',
  'Carpenter', 'False Ceiling Installer', 'Helper', 'Supervisor',
]

export default async function TradeQuestionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'admin') redirect('/admin/dashboard')

  const { data: questions } = await supabase
    .from('trade_skill_questions')
    .select('id, trade, question_code, question_text, display_order, is_active')
    .order('trade', { ascending: true })
    .order('display_order', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-white/80 hover:text-white shrink-0" aria-label="Back to dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Question Bank</h1>
            <p className="text-blue-200 text-xs">Section C — Trade Skill Assessment, per trade</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-500 mb-4">
          These questions appear on Screen 4 of the Worker Onboarding form, 5 per page, for the
          matching trade. Nothing here is mandatory for a worker to answer — add, edit, reorder,
          deactivate, or delete freely; changes apply to the next worker who registers.
        </p>
        <QuestionBankTabs trades={TRADES} questions={questions ?? []} />
      </main>
    </div>
  )
}
