import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PaymentTabs from './PaymentTabs'
import type { Payment } from './PaymentCard'

const DEFAULT_COORDINATOR_LIMIT = 100_000
const DEFAULT_ADMIN_LIMIT = 500_000

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default async function AdminPaymentsPage() {
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

  const [{ data: paymentsData }, { data: enquiries }, { data: policy }, { data: trades }] = await Promise.all([
    supabase.from('milestone_payment_schedule').select('*').order('created_at', { ascending: false }),
    supabase.from('guest_enquiries').select('booking_ref, full_name, zone'),
    supabase.from('payment_policy').select('coordinator_limit, admin_limit').eq('is_active', true).limit(1),
    supabase.from('trade_config').select('trade_name').order('trade_name'),
  ])

  const payments = (paymentsData ?? []) as Payment[]
  const tradeOptions = Array.from(
    new Set((trades ?? []).map((t) => t.trade_name).filter((t): t is string => Boolean(t)))
  )

  const clientMap: Record<string, string> = {}
  const zoneMap: Record<string, string> = {}
  for (const e of enquiries ?? []) {
    if (e?.booking_ref) {
      clientMap[e.booking_ref] = e.full_name ?? '—'
      zoneMap[e.booking_ref] = e.zone ?? '—'
    }
  }

  const policyRow = (policy ?? [])[0] as { coordinator_limit: number | null; admin_limit: number | null } | undefined
  const coordinatorLimit = policyRow?.coordinator_limit != null ? num(policyRow.coordinator_limit) : DEFAULT_COORDINATOR_LIMIT
  const adminLimit = policyRow?.admin_limit != null ? num(policyRow.admin_limit) : DEFAULT_ADMIN_LIMIT

  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'

  const pendingCount = payments.filter(
    (p) =>
      p.status === 'coordinator_approved' &&
      num(p.payment_amount) > coordinatorLimit &&
      num(p.payment_amount) <= adminLimit
  ).length
  const decision5Count = payments.filter(
    (p) => p.decision_5_raised_at != null && p.decision_5_admin_decision == null
  ).length
  const reworkCount = payments.filter(
    (p) => num(p.rework_cost_proposed) > 0 && p.rework_cost_approved_at == null
  ).length
  const holdCount = payments.filter((p) => p.status === 'admin_hold').length
  const aboveLimitCount = payments.filter((p) => num(p.payment_amount) > adminLimit).length

  const stats: { label: string; count: number; className: string }[] = [
    { label: 'Pending Approval', count: pendingCount, className: 'text-[#F97316]' },
    { label: 'Decision 5 Queue', count: decision5Count, className: 'text-red-600' },
    { label: 'Rework Deductions', count: reworkCount, className: 'text-amber-600' },
    { label: 'On Hold', count: holdCount, className: 'text-red-600' },
    { label: 'Above Limit', count: aboveLimitCount, className: 'text-blue-600' },
  ]

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
            <h1 className="text-white font-bold text-lg leading-tight">Payments</h1>
            <p className="text-blue-200 text-xs">₹1L–₹5L approvals and payment decisions</p>
          </div>
          <p className="text-blue-200 text-xs shrink-0">{adminName}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <p className={`text-2xl font-bold ${s.className}`}>{s.count}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <PaymentTabs
          payments={payments}
          clientMap={clientMap}
          zoneMap={zoneMap}
          tradeOptions={tradeOptions}
          adminUserId={user.id}
          adminLimit={adminLimit}
          coordinatorLimit={coordinatorLimit}
        />
      </main>
    </div>
  )
}
