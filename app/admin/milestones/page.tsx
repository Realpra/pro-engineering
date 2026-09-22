/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MilestoneTabs, {
  type MilestoneTemplate,
  type ScopeChange,
  type Payment,
  type Substage,
} from './MilestoneTabs'

export default async function AdminMilestonesPage() {
  const supabase = await createClient()
  const sb = supabase as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'admin') redirect('/admin/dashboard')

  const [
    { data: templatesData },
    { data: scopeChangesData },
    { data: paymentsData },
    { data: substagesData },
    { data: enquiries },
  ] = await Promise.all([
    sb
      .from('milestone_stage_templates')
      .select('*')
      .order('vertical', { ascending: true })
      .order('job_category', { ascending: true })
      .order('milestone_number', { ascending: true }),
    sb
      .from('scope_change_requests')
      .select('*')
      .not('cost_impact_net', 'eq', 0)
      .order('created_at', { ascending: false }),
    sb.from('milestone_payment_schedule').select('*').order('created_at', { ascending: false }),
    sb
      .from('job_milestone_substages')
      .select('*')
      .eq('is_proposed', true)
      .order('created_at', { ascending: false }),
    sb
      .from('guest_enquiries')
      .select('id, booking_ref, contact_name, job_title, zone'),
  ])

  const templates = (templatesData ?? []) as MilestoneTemplate[]
  const scopeChanges = (scopeChangesData ?? []) as ScopeChange[]
  const payments = (paymentsData ?? []) as Payment[]
  const substages = (substagesData ?? []) as Substage[]

  const clientMap: Record<string, string> = {}
  for (const e of (enquiries ?? []) as any[]) {
    if (e?.booking_ref) {
      clientMap[e.booking_ref] = e.contact_name ?? '—'
    }
  }

  const adminUserId = user.id
  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  const totalTemplates = templates.length
  const pendingContractChanges = scopeChanges.filter((c) => c.admin_decision == null).length
  const overrideHistoryCount = payments.filter((p) => p.admin_override_type != null).length
  const pendingSubstageProposals = substages.filter(
    (s) => (s.substage_approval_status ?? 'pending') === 'pending'
  ).length

  const stats: { label: string; count: number; className: string }[] = [
    { label: 'Total Templates', count: totalTemplates, className: 'text-blue-600' },
    {
      label: 'Pending Contract Changes',
      count: pendingContractChanges,
      className: pendingContractChanges > 0 ? 'text-[#F97316]' : 'text-gray-400',
    },
    { label: 'Evidence Overrides', count: overrideHistoryCount, className: 'text-purple-600' },
    {
      label: 'Pending Substage Proposals',
      count: pendingSubstageProposals,
      className: pendingSubstageProposals > 0 ? 'text-[#F97316]' : 'text-gray-400',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="text-white/80 hover:text-white shrink-0"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Milestones</h1>
            <p className="text-blue-200 text-xs">
              Templates, contract changes, evidence and substage approvals
            </p>
          </div>
          <p className="text-blue-200 text-xs shrink-0">{adminName}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4"
            >
              <p className={`text-2xl font-bold ${s.className}`}>{s.count}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <MilestoneTabs
          templates={templates}
          scopeChanges={scopeChanges}
          payments={payments}
          substages={substages}
          clientMap={clientMap}
          adminUserId={adminUserId}
        />
      </main>
    </div>
  )
}
