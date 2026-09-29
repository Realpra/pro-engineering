export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import EstimateConsole from './EstimateConsole'
import { generateBOQ } from './actions'
import type { BOQLineItem } from './actions'

type GeneratedBOQ = {
  id: string
  tier: string
  job_card_type: string
  status: string
  line_items: BOQLineItem[]
  subtotal_labour: number
  subtotal_material: number
  platform_premium_pct: number
  platform_premium_amount: number
  bocw_cess_percent: number
  bocw_cess_amount: number
  gst_amount: number
  total_amount: number
  estimate_version: number | null
  estimate_version_label: string | null
  deferred_value: number
  deferred_pct: number
  contingency_percent: number | null
  platform_premium_status: string | null
  contingency_status: string | null
}

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ bookingRef: string }>
}) {
  const { bookingRef } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  // Resolve user role (user lookup pattern from this codebase)
  const { data: userData } = await supabase
    .from('users')
    .select('platform_role')
    .eq('email', user.email!)
    .single()

  const adminUserId = user.id

  // Step 1: fetch job — zone needed to filter rate card in next step
  // contact_name/contact_phone/contact_email added 29 Sep 2026 -- confirmed
  // real gap via a live test: this page never fetched or displayed the
  // client's contact info at all, despite being where staff prepare an
  // estimate and would need to reach the client (e.g. to arrange a survey
  // visit). Not just a display miss -- the columns weren't even selected.
  const { data: job } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, zone, district, job_type, contact_name, contact_phone, contact_email')
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  if (!job) notFound()

  const today = new Date().toLocaleDateString('en-CA')

  // Step 2: parallel fetches
  const [reportResult, rateCardsResult, labourConfigResult, existingEstimateResult] =
    await Promise.all([
      // scope report — coordinator-approved reports have status='admin_review'
      supabase
        .from('site_visit_reports')
        .select('*')
        .eq('booking_ref', bookingRef)
        // See 20260927_site_visit_reports_flow_discriminator.sql -- without
        // this, a Flow (ii) Daily Execution Visit row could be picked up here
        // instead of the real Flow (i) Site Survey this page needs.
        .eq('report_type', 'site_survey')
        .in('status', ['submitted', 'admin_review'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // fetch all active rate cards flat — zone filter applied after geo_hierarchy lookup below
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('rate_card')
        .select('activity_code, activity_name, unit, base_rate, min_rate, max_rate, geo_id')
        .eq('is_active', true)
        .lte('effective_from', today)
        .or(`effective_until.is.null,effective_until.gte.${today}`),

      // activity config ordered by sequence; rate_card_code links to rate_card.activity_code
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('labour_rate_config')
        .select('activity, activity_name, unit, sequence_order, rate_card_code')
        .order('sequence_order', { ascending: true, nullsFirst: false }),

      // most recent estimate for this booking (may be null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('estimates')
        .select('id, version, status, line_items, subtotal_labour, contingency_pct, discount_pct, coordinator_notes')
        .eq('booking_ref', bookingRef)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const report = reportResult.data ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRateCards = ((rateCardsResult.data ?? []) as any[]) as {
    activity_code: string
    base_rate: number
    geo_id: string
  }[]

  // Look up geo_hierarchy for the job's zone, then filter rate cards to that zone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: geoData } = await (supabase as any)
    .from('geo_hierarchy')
    .select('id, name, level')
    .eq('name', job.zone ?? '')
    .eq('level', 'sector')
    .maybeSingle()

  const rateCards = geoData?.id
    ? allRateCards.filter((rc) => rc.geo_id === geoData.id)
    : []

  const labourConfig = ((labourConfigResult.data ?? []) as unknown[]) as {
    activity: string
    activity_name: string | null
    unit: string | null
    sequence_order: number | null
    rate_card_code: string | null
  }[]

  const existingEstimate = (existingEstimateResult.data ?? null) as {
    id: string
    version: number
    status: string
    line_items: unknown
    subtotal_labour: number
    contingency_pct: number
    discount_pct: number
    coordinator_notes: string | null
  } | null

  // ── Auto-generate BOQ ──────────────────────────────────────────────────────
  // If no draft BOQ exists for this booking, generate one. Always fetch fresh
  // from boq_generated so column values are current.
  let generatedBOQ: GeneratedBOQ | null = null

  if (report) {
    // Only generate if no row exists yet, or if line_items is empty.
    // Never call generateBOQ when a row already has content — it would
    // overwrite the status (e.g. client_review → draft) even with the
    // status-preservation logic in generateBOQ, since line items would be
    // recalculated from scratch and the whole estimate effectively reset.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRow } = await (supabase as any)
      .from('boq_generated')
      .select('id, line_items')
      .eq('booking_ref', bookingRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const hasContent =
      existingRow &&
      Array.isArray(existingRow.line_items) &&
      existingRow.line_items.length > 0

    if (!hasContent) {
      await generateBOQ(bookingRef, 'budget', 'LM')
    }

    // Always fetch the full row after potential generate so we get correct values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingBOQ } = await (supabase as any)
      .from('boq_generated')
      .select('*')
      .eq('booking_ref', bookingRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingBOQ) generatedBOQ = existingBOQ as GeneratedBOQ
  }

  // Latest unprocessed client response (triggers the remarks review panel)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let latestClientResponse: any = null
  if (generatedBOQ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: resp } = await (supabase as any)
      .from('estimate_client_responses')
      .select('*')
      .eq('booking_ref', bookingRef)
      .eq('coordinator_processed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    latestClientResponse = resp ?? null
  }

  // Review status badge for header
  const reviewStatus = report
    ? String((report as Record<string, unknown>).review_status ?? '')
    : ''
  const reviewStatusLabel =
    reviewStatus === 'approved_for_estimate' ? 'Approved for Estimate' :
    reviewStatus === 'admin_review'          ? 'Admin Review' :
    reviewStatus === 'coordinator_review'    ? 'Coordinator Review' :
    report ? 'Submitted' : 'No Report'

  const reviewStatusClass =
    reviewStatus === 'approved_for_estimate' ? 'bg-green-400 text-green-900' :
    reviewStatus === 'admin_review'          ? 'bg-purple-300 text-purple-900' :
    report ? 'bg-blue-300 text-blue-900' : 'bg-gray-300 text-gray-700'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-[#1F3864] text-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <Link
            href={report ? `/admin/scope-report/${(report as Record<string, unknown>).id}` : '/admin/dashboard'}
            className="text-xs text-blue-200 hover:text-white mb-3 inline-block"
          >
            ← {report ? 'Back to Scope Report' : 'Admin Dashboard'}
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                  {bookingRef}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${reviewStatusClass}`}>
                  {reviewStatusLabel}
                </span>
                {userData?.platform_role && (
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                    {userData.platform_role}
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold">Estimate Console</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-blue-200">
                {job.job_title && <span>{job.job_title}</span>}
                {job.zone && <span>{job.zone}{job.district ? `, ${job.district}` : ''}</span>}
                {rateCards.length > 0 && (
                  <span>{rateCards.length} rates loaded</span>
                )}
              </div>
              {(job.contact_name || job.contact_phone || job.contact_email) && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-white font-semibold">
                  {job.contact_name && <span>👤 {job.contact_name}</span>}
                  {job.contact_phone && <span>📞 {job.contact_phone}</span>}
                  {job.contact_email && <span>✉️ {job.contact_email}</span>}
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className="text-[10px] text-blue-200 uppercase tracking-wide">BOQ Items</p>
              <p className="text-2xl font-bold text-white">
                {generatedBOQ ? generatedBOQ.line_items.filter(i => !i.isRiskFlag).length : labourConfig.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <EstimateConsole
        bookingRef={bookingRef}
        report={report as Record<string, unknown> | null}
        job={job}
        rateCards={rateCards}
        labourConfig={labourConfig}
        existingEstimate={existingEstimate}
        generatedBOQ={generatedBOQ}
        latestClientResponse={latestClientResponse}
        platformRole={userData?.platform_role ?? 'coordinator'}
        adminUserId={adminUserId}
      />
    </div>
  )
}
