export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SuperAdminDashboard from './SuperAdminDashboard'

export default async function SuperAdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/superadmin/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('platform_role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'super_admin') redirect('/admin/dashboard')

  // Parallel fetch of all policy data
  const [
    premiumResult, contingencyResult, approvalsResult, historyResult,
    boqTemplatesResult, milestoneTemplatesResult, checklistTemplatesResult,
    platformUsersResult, allBookingsResult, allWorkersResult, allBOQsResult, allZonesResult,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('platform_premium_policy')
      .select('id, vertical, job_category, tier, premium_pct')
      .order('vertical').order('job_category').order('tier'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('contingency_policy')
      .select('id, vertical, job_category, tier, max_contingency_pct, admin_approval_limit_pct')
      .order('vertical').order('job_category').order('tier'),
    // Super admin sees requests above the admin-approval threshold (boq_total > 100000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('premium_approval_requests')
      .select('id, booking_ref, boq_id, requested_pct, policy_pct, boq_total, reason, status, created_at')
      .eq('status', 'pending')
      .gt('boq_total', 100000)
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('policy_change_log')
      .select('id, table_name, old_value, new_value, change_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('boq_sku_catalogue')
      .select('sku_code,sku_name,category,unit,sequence_order,wastage_multiplier,applicable_tiers,applicable_job_types,is_active')
      .order('sku_code'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('milestone_stage_templates')
      .select('milestone_code,milestone_name,milestone_number,payment_percent,planned_day,trade_type,sector,is_active')
      .order('milestone_number'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('substage_checklist_templates')
      .select('id,substage_code,trade_type,item_text,item_type,sequence_order,is_active')
      .order('sequence_order'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('users')
      .select('id,full_name,email,platform_role,created_at,is_active')
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('guest_enquiries')
      .select('booking_ref,status,zone,job_type,created_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('workers')
      .select('id,full_name,trade,skill_level,approval_status,is_active,is_bocw_registered,bocw_registration_number,pf_uan,esic_ip_number'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('boq_generated')
      .select('booking_ref,total_amount,platform_fee,tier,status,created_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('geo_hierarchy')
      .select('id,name,type,created_at'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const premiumPolicies = (premiumResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contingencyPolicies = (contingencyResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingApprovals = (approvalsResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changeHistory = (historyResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boqTemplates = (boqTemplatesResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const milestoneTemplates = (milestoneTemplatesResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checklistTemplates = (checklistTemplatesResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platformUsers = (platformUsersResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allBookings = (allBookingsResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allWorkers = (allWorkersResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allBOQs = (allBOQsResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allZones = (allZonesResult.data ?? []) as any[]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1F3864] shadow-lg">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Pro Engineering</h1>
              <p className="text-amber-400 text-xs font-semibold">Policy Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-blue-300 text-sm hidden sm:block">{user.email}</span>
            <span className="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
              Super Admin
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#1F3864]">Policy Control Centre</h2>
          <p className="text-gray-500 mt-0.5 text-sm">
            Manage platform premium rates, contingency limits, and approve override requests
          </p>
        </div>

        <SuperAdminDashboard
          premiumPolicies={premiumPolicies}
          contingencyPolicies={contingencyPolicies}
          pendingApprovals={pendingApprovals}
          changeHistory={changeHistory}
          boqTemplates={boqTemplates}
          milestoneTemplates={milestoneTemplates}
          checklistTemplates={checklistTemplates}
          platformUsers={platformUsers}
          allBookings={allBookings}
          allWorkers={allWorkers}
          allBOQs={allBOQs}
          allZones={allZones}
        />
      </main>
    </div>
  )
}
