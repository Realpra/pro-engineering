/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import QualityTestsManager, { type QualityTest, type TestStep, type StageOption } from './QualityTestsManager'

// Admin quality test repository (owner's decision D13, 30 Oct 2026).
export default async function QualityTestsPage() {
  const supabase = await createClient()
  const sb = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'admin') redirect('/admin/dashboard')

  const [testsRes, stepsRes, stagesRes] = await Promise.all([
    sb.from('qip_templates').select('*').order('job_type', { ascending: true }).order('milestone_number', { ascending: true }),
    sb.from('qip_template_checks').select('*').order('sequence_order', { ascending: true }),
    sb.from('milestone_stage_templates')
      .select('job_type, milestone_code, milestone_name, milestone_number, vertical')
      .eq('is_active', true)
      .order('milestone_number', { ascending: true }),
  ])

  const loadError = testsRes.error?.message ?? stepsRes.error?.message ?? null

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
            <h1 className="text-white font-bold text-lg leading-tight">Quality Tests</h1>
            <p className="text-blue-200 text-xs">Per job and sector — steps the site team answers</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-500 mb-4">
          Each test belongs to a job type and, optionally, a stage. Add, edit, reorder, deactivate or
          delete tests and their steps. A failed test raises a risk flag and alerts Coordinator; it does
          not stop the job. A test already used in a site report cannot be deleted — deactivate it instead.
        </p>
        <QualityTestsManager
          tests={(testsRes.data ?? []) as QualityTest[]}
          steps={(stepsRes.data ?? []) as TestStep[]}
          stages={(stagesRes.data ?? []) as StageOption[]}
          loadError={loadError}
        />
      </main>
    </div>
  )
}
