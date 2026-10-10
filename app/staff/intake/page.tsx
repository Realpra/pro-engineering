import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import IntakeBoard, { type PartnerRow, type RequestRow } from './IntakeBoard'

const DASHBOARDS: Record<string, string> = {
  super_admin: '/superadmin/dashboard',
  admin: '/admin/dashboard',
  coordinator: '/coordinator/dashboard',
  sub_coordinator: '/sub-coordinator/dashboard',
}

// Everything the public website's forms bring in, for every staff role that
// acts on it: job requests (one day / turn-key / Labour Bazaar) and supply-side
// partner registrations (Team Head / Associate / Contractor).
export default async function WebsiteIntakePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.platform_role ?? ''
  if (!(role in DASHBOARDS)) redirect('/login')

  const [{ data: requestsData, error: requestsError }, { data: partnersData, error: partnersError }] = await Promise.all([
    supabase
      .from('guest_enquiries')
      .select(`booking_ref, created_at, status, contact_name, contact_phone, job_title, district, zone,
        address_line, site_state, firm_name, scope_description, preferred_start_date,
        request_type, request_trade, request_skill, request_job_type, lump_sum_package, with_material,
        work_unit, time_from, time_to, day_slot, duration_days, skills_required`)
      .not('request_type', 'is', null)
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('supply_partners')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const loadError = requestsError?.message ?? partnersError?.message ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-white font-bold text-lg">Website Intake</h1>
            <p className="text-blue-200 text-xs">Requests and partner registrations raised on the public website</p>
          </div>
          <Link href={DASHBOARDS[role]} className="text-white text-xs font-bold bg-[#2E74B5] px-3 py-1.5 rounded-lg shrink-0">
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loadError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <p className="font-bold">Could not load website intake</p>
            <p className="mt-0.5">{loadError}</p>
            <p className="mt-1 text-xs">If this mentions a missing column or table, run supabase/migrations/20261010_public_website_intake.sql in the Supabase SQL Editor.</p>
          </div>
        )}
        <IntakeBoard
          requests={(requestsData ?? []) as unknown as RequestRow[]}
          partners={(partnersData ?? []) as unknown as PartnerRow[]}
          canOpenEstimate={role === 'admin' || role === 'super_admin'}
        />
      </div>
    </div>
  )
}
