'use server'

import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

// slotId scopes a report to one Flow (ii) daily execution visit (one
// supervisor_daily_routes slot = one visit = one row), instead of collapsing
// every visit to the same booking into a single row. Flow (i) SITE SURVEY
// (app/site-survey/[bookingRef]) calls this with no slotId at all -- it keeps
// matching supervisor_id + booking_ref with slot_id IS NULL, unaffected by this.
export async function initReport(
  supervisorId: string,
  bookingRef: string,
  jobTitle: string,
  slotId?: string | null,
): Promise<{ reportId?: string; error?: string }> {
  const supabase = await createClient()

  let query = supabase
    .from('site_visit_reports')
    .select('id')
    .eq('supervisor_id', supervisorId)
    .eq('booking_ref', bookingRef)

  query = slotId ? query.eq('slot_id', slotId) : query.is('slot_id', null)

  const { data: existing, error: fetchErr } = await query.maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (existing) return { reportId: existing.id }

  const { data: inserted, error: insertErr } = await (supabase as SupabaseAny)
    .from('site_visit_reports')
    .insert({
      supervisor_id: supervisorId,
      booking_ref: bookingRef,
      slot_id: slotId ?? null,
      // Discriminates Flow (i) Site Survey from Flow (ii) Daily Execution --
      // see 20260927_site_visit_reports_flow_discriminator.sql. Every
      // downstream consumer (generateBOQ, the estimate page, the site-survey
      // page's own existing-report check) must filter on this explicitly.
      report_type: slotId ? 'daily_execution' : 'site_survey',
      status: 'in_progress',
      screen_progress: 0,
      screen01_job_details: { jobTitle },
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }
  return { reportId: inserted.id }
}

export async function saveScreen(
  reportId: string,
  screenNumber: number,
  columnName: string,
  data: object,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // screen_progress was declared (20260628) and displayed to Admin
  // (app/admin/scope-report/[id]/page.tsx) but never written -- always showed
  // "0/20". Every saveScreen call now records the caller's own screen number.
  const update: SupabaseAny = { [columnName]: data, screen_progress: screenNumber }

  // risk_flag_count was declared (20260628) and read by Admin
  // (app/admin/scope-report/[id]/page.tsx, ScopeReportView.tsx) but never
  // written -- Screen17_RiskDecisions only ever aggregated flagCount inside
  // its own JSONB blob (screen17_risk_decisions.flagCount). Copy it up to the
  // scalar column whenever that screen saves (PENDING #32 / Bug #1).
  const flagCount = (data as { flagCount?: unknown }).flagCount
  if (columnName === 'screen17_risk_decisions' && typeof flagCount === 'number') {
    update.risk_flag_count = flagCount
  }

  const { error } = await (supabase as SupabaseAny)
    .from('site_visit_reports')
    .update(update)
    .eq('id', reportId)

  if (error) return { error: error.message }
  return {}
}

export async function submitReport(reportId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: report, error: fetchErr } = await supabase
    .from('site_visit_reports')
    .select('booking_ref, slot_id, supervisor_id, screen02_scope_intent')
    .eq('id', reportId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  // LTF sourcing correction (29 Sep 2026, project owner): Screen 2's
  // per-substage LTF answers (form.ltfBySubstage, Session 58's "LTF per-
  // substage loop") have always been captured here but only ever sat inside
  // screen02_scope_intent's JSON blob, disconnected from the real ltf_feeds
  // table the route-compile cron (app/api/cron/ltf-route-compile) actually
  // reads. Aggregate to one site-level signal at the same finalization point
  // every other Screen 21 side-effect uses (Decision 5, Scope Change): ready
  // only if every answered sub-stage said Yes; any "No" makes the whole site
  // not-ready, with each "No" sub-stage's own remarks carried forward.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scopeIntent = (report as any).screen02_scope_intent as { ltfBySubstage?: Record<string, { confirmed?: string; remarks?: string }> } | null
  const ltfAnswers = Object.values(scopeIntent?.ltfBySubstage ?? {}).filter(a => a.confirmed === 'Yes' || a.confirmed === 'No')

  if (ltfAnswers.length > 0) {
    const isReadyTomorrow = ltfAnswers.every(a => a.confirmed === 'Yes')
    const notes = ltfAnswers.filter(a => a.confirmed === 'No' && a.remarks).map(a => a.remarks).join('; ') || null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: enquiry } = await (supabase as any)
      .from('guest_enquiries')
      .select('id')
      .eq('booking_ref', report.booking_ref)
      .maybeSingle()

    const todayStart = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingFeed } = await (supabase as any)
      .from('ltf_feeds')
      .select('id')
      .eq('booking_ref', report.booking_ref)
      .gte('submitted_at', todayStart)
      .maybeSingle()

    const feedPayload = {
      site_id: enquiry?.id ?? null,
      booking_ref: report.booking_ref,
      submitted_by: (report as SupabaseAny).supervisor_id ?? null,
      submitted_at: new Date().toISOString(),
      is_ready_tomorrow: isReadyTomorrow,
      target_time_slot: null,
      contractor_notes: notes,
      accountability_flag: false,
    }

    // Best-effort -- a failure here must not fail the visit submission
    // itself, same discipline as the report_status write below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (existingFeed) await (supabase as any).from('ltf_feeds').update(feedPayload).eq('id', existingFeed.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else await (supabase as any).from('ltf_feeds').insert(feedPayload)
  }

  const submittedAt = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from('site_visit_reports')
    .update({ status: 'submitted', submitted_at: submittedAt })
    .eq('id', reportId)

  if (updateErr) return { error: updateErr.message }

  const { error: enquiryErr } = await supabase
    .from('guest_enquiries')
    .update({ status: 'scope_report_submitted' })
    .eq('booking_ref', report.booking_ref)

  if (enquiryErr) return { error: enquiryErr.message }

  // supervisor_daily_routes.report_status/report_submitted_at are read by 5
  // files across Supervisor/Coordinator/Sub-Coordinator (dashboard, route
  // planning) to show a per-slot "report submitted" badge, but nothing ever
  // wrote them -- the badge was permanently stale even after this report's
  // own slot-scoping fix (Session 58). Write them back here, best-effort:
  // a failure here must not fail the visit submission itself.
  const slotId = (report as SupabaseAny).slot_id as string | null
  if (slotId) {
    await (supabase as SupabaseAny)
      .from('supervisor_daily_routes')
      .update({ report_status: 'submitted', report_submitted_at: submittedAt })
      .eq('id', slotId)
  }

  return {}
}

// Raises the Decision 5 (Reject / Complete Redo) case Screen 18 of Flow (ii)
// collects. admin's resolution side (app/admin/payments/actions.ts) already
// reads/writes decision_5_admin_decision etc. on milestone_payment_schedule --
// this was the missing raise side (CLAUDE.md PENDING #9).
export async function raiseDecision5(
  bookingRef: string,
  milestoneCode: string | null,
  raisedByRole: string,
  reason: string,
  remedy: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  let query = (supabase as SupabaseAny)
    .from('milestone_payment_schedule')
    .select('id')
    .eq('booking_ref', bookingRef)
    .is('decision_5_raised_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  if (milestoneCode) query = query.eq('milestone_code', milestoneCode)

  const { data: row, error: fetchErr } = await query.maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!row) return { error: 'No matching milestone payment schedule row found for this booking/milestone' }

  const { error: updateErr } = await (supabase as SupabaseAny)
    .from('milestone_payment_schedule')
    .update({
      decision_5_raised_at: new Date().toISOString(),
      decision_5_raised_by: raisedByRole,
      decision_5_reason: reason,
      decision_5_remedy: remedy,
    })
    .eq('id', row.id)

  if (updateErr) return { error: updateErr.message }
  return {}
}

export async function uploadSiteVisitPhoto(
  bookingRef: string,
  screenName: string,
  formData: FormData,
): Promise<{ success?: true; url?: string; error?: string }> {
  const supabase = await createClient()

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const safeScreenName = screenName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const path = `site-visit/${bookingRef}/${safeScreenName}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('site-photos')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)

  return { success: true, url: urlData.publicUrl }
}
