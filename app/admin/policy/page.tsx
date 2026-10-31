import { redirect } from 'next/navigation'
import { toAdminLogRow } from '@/lib/policyChangeLog'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PolicyTabs, {
  type PremiumPolicy,
  type ContingencyPolicy,
  type PaymentPolicy,
  type ComplianceConfig,
  type BusinessRule,
  type PolicyChangeLog,
  type GeoOption,
} from './PolicyTabs'

export default async function AdminPolicyPage() {
  const supabase = await createClient()

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
    { data: premium },
    { data: contingency },
    { data: payment },
    { data: compliance },
    { data: rules },
    { data: logs },
    { data: geoRows },
  ] = await Promise.all([
    supabase.from('platform_premium_policy').select('*').order('vertical').order('job_category'),
    supabase.from('contingency_policy').select('*').order('vertical').order('job_category'),
    supabase.from('payment_policy').select('*').eq('is_active', true).limit(1),
    supabase.from('compliance_config').select('*').order('compliance_type').order('compliance_name'),
    supabase
      .from('business_rules_config')
      .select('*')
      .eq('is_active', true)
      .order('rule_category')
      .order('rule_name'),
    supabase.from('policy_change_log').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('geo_hierarchy').select('id, name, level').in('level', ['state', 'district', 'region', 'zone', 'sector']).order('level').order('name'),
  ])

  const adminUserId = user.id
  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="text-white/80 hover:text-white shrink-0"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-bold text-lg leading-tight">Policy</h1>
            <p className="text-blue-200 text-xs">Platform rate and compliance settings</p>
          </div>
          <p className="text-blue-200 text-xs shrink-0">{adminName}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <PolicyTabs
          premiumPolicies={(premium ?? []) as PremiumPolicy[]}
          contingencyPolicies={(contingency ?? []) as ContingencyPolicy[]}
          paymentPolicies={(payment ?? []) as PaymentPolicy[]}
          complianceConfigs={(compliance ?? []) as ComplianceConfig[]}
          businessRules={(rules ?? []) as BusinessRule[]}
          geoOptions={(geoRows ?? []) as GeoOption[]}
          policyChangeLogs={((logs ?? []) as unknown as Parameters<typeof toAdminLogRow>[0][]).map(toAdminLogRow) as PolicyChangeLog[]}
          adminUserId={adminUserId}
        />
      </main>
    </div>
  )
}
