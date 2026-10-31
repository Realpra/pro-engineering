/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { OBJECTION_CHAIN, OBJECTION_TYPES, ROLE_LABEL, type ObjectionRole } from '@/lib/invoiceObjections'
import ObjectionCard, { type ObjectionView } from './ObjectionCard'

// Client invoice objections inbox (owner, 31 Oct 2026, D30): each level in the chain sees the
// objections now with it, adds the factual position and moves it up; the deciding level
// admits or clarifies and replies to the client.
const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'
function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

const HOME: Record<string, string> = {
  site_incharge: '/site-incharge/dashboard', supervisor: '/supervisor/dashboard', coordinator: '/coordinator/dashboard',
  admin: '/admin/dashboard', super_admin: '/superadmin/dashboard',
}

export default async function ObjectionsPage() {
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('platform_role').eq('id', user.id).maybeSingle()
  const role = (profile?.platform_role ?? '') as ObjectionRole
  if (!(OBJECTION_CHAIN as readonly string[]).includes(role)) redirect('/login')

  const admin: any = adminClient()
  let allowedEnquiryIds: string[] | null = null
  if (role === 'site_incharge' || role === 'supervisor') {
    const { data: w } = await admin.from('workers').select('id').eq('auth_user_id', user.id).maybeSingle()
    const col = role === 'site_incharge' ? 'site_incharge_id' : 'supervisor_id'
    const { data: jobs } = w ? await admin.from('guest_enquiries').select('id').eq(col, w.id) : { data: [] }
    allowedEnquiryIds = (jobs ?? []).map((j: any) => j.id)
  }

  let q = admin.from('client_invoice_objections').select('*').order('raised_at', { ascending: false })
  if (allowedEnquiryIds) q = q.in('enquiry_id', allowedEnquiryIds.length ? allowedEnquiryIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: rows, error } = await q
  const all = (rows ?? []) as any[]

  const ids = all.map(o => o.id)
  const { data: trail } = ids.length
    ? await admin.from('job_movement_log').select('item_id, action, from_role, to_role, remarks, created_at')
        .eq('item_type', 'client_invoice_objection').in('item_id', ids).order('created_at', { ascending: true })
    : { data: [] }
  const trailById: Record<string, any[]> = {}
  for (const t of trail ?? []) (trailById[t.item_id] ??= []).push(t)

  const typeLabel = Object.fromEntries(OBJECTION_TYPES.map(t => [t.value, t.label]))
  const toView = (o: any): ObjectionView => ({
    id: o.id, bookingRef: o.booking_ref, milestoneCode: o.milestone_code, invoiceAmount: o.invoice_amount,
    typeLabel: typeLabel[o.objection_type] ?? o.objection_type, description: o.description, raisedAt: o.raised_at,
    jobValue: o.job_value, holderRole: o.holder_role, decidingRole: o.deciding_role, status: o.status,
    resolution: o.resolution, revisedAmount: o.revised_amount, reply: o.reply_to_client,
    trail: (trailById[o.id] ?? []).map(t => ({ action: t.action, fromRole: t.from_role, toRole: t.to_role, remarks: t.remarks, at: t.created_at })),
  })
  const withMe = all.filter(o => o.status === 'open' && o.holder_role === role).map(toView)
  const elsewhere = all.filter(o => o.status === 'open' && o.holder_role !== role).map(toView)
  const resolved = all.filter(o => o.status === 'resolved').slice(0, 20).map(toView)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1F3864]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={HOME[role] ?? '/login'} className="text-white/80 hover:text-white" aria-label="Back">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Client Invoice Objections</h1>
            <p className="text-blue-200 text-xs">You are acting as {ROLE_LABEL[role]}</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-gray-500">
          An objection moves Site Head → Supervisor → Coordinator → Admin → Super Admin. Each level adds the
          factual position and moves it up. It is decided one level above the role that normally handles the
          job&rsquo;s value (below ₹1L: Admin; ₹1L and above: Super Admin), who admits it (invoice corrected)
          or clarifies it, and replies to the client.
        </p>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">Could not load objections: {error.message}</p>}
        <section className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">With you now ({withMe.length})</p>
          {withMe.length === 0 && <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-4">Nothing waiting for you.</p>}
          {withMe.map(o => <ObjectionCard key={o.id} o={o} myRole={role} actionable />)}
        </section>
        {elsewhere.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Open, with another level ({elsewhere.length})</p>
            {elsewhere.map(o => <ObjectionCard key={o.id} o={o} myRole={role} />)}
          </section>
        )}
        {resolved.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Resolved ({resolved.length})</p>
            {resolved.map(o => <ObjectionCard key={o.id} o={o} myRole={role} />)}
          </section>
        )}
      </main>
    </div>
  )
}
