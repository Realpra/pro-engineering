import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Matches the daily-log-deadline-check cron's own convention exactly
// (hardcoded project URL, service-role key from env, CRON_SECRET bearer
// check).
const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

// PROCESS FLOW (CLAUDE.md): Supervisor's daily route is "triggered by an
// LTF-ready signal from Site Incharge or by his own planned daily route."
// Sub-Coordinator's own /sub-coordinator/ltf page has always claimed "LTF
// feeds compile automatically at 20:00 each evening" -- confirmed false by
// repo-wide grep: the only path from a ready ltf_feeds row into
// supervisor_daily_routes was addLtfToRoute, a Sub-Coordinator manual
// one-click-per-feed action. With Sub-Coordinator's own build deliberately
// deferred (project owner, 29 Sep 2026) and its login broken, that manual
// step can't be relied on for the process to function live at all. This
// cron is the real automatic compile the UI has always claimed, wired via
// Vercel Cron at 20:00 IST (see vercel.json) -- the same mechanism as
// daily-log-deadline-check, this project's only other cron.
//
// Also carries forward "overhang" work: any booking whose supervisor has an
// overdue, incomplete critical-path substage gets one overhang slot queued
// for tomorrow, matching route/plan's own "08:30 Overhang / Morning"
// standard slot -- previously nothing ever created these automatically,
// despite the slot type and UI treatment already existing.
//
// Every supervisor_daily_routes/ltf_feeds column used below is already read
// or written elsewhere in this codebase (sub-coordinator/ltf/page.tsx,
// sub-coordinator/actions.ts's addLtfToRoute, supervisor/route/actions.ts's
// addSlotManually) -- none invented here, per this project's own rule
// against guessing at live-only schema.
//
// Needs CRON_SECRET set in Vercel, same as daily-log-deadline-check. Not
// runnable/testable from this session (no deployment or live DB access) --
// flagged, not silently assumed working.

const SLOT_TIMES: Record<string, [string, string]> = {
  morning: ['09:00', '11:00'],
  afternoon: ['14:00', '16:00'],
  evening: ['16:30', '18:30'],
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createServiceClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  let routesCreated = 0
  const errors: string[] = []

  // --- 1. LTF-ready compile ---
  const { data: readyFeeds } = await supabase
    .from('ltf_feeds')
    .select('id, site_id, booking_ref, target_time_slot, contractor_notes')
    .eq('is_ready_tomorrow', true)
    .gte('submitted_at', `${today}T00:00:00.000Z`)
    .lt('submitted_at', `${tomorrow}T00:00:00.000Z`)

  for (const feed of readyFeeds ?? []) {
    const { data: alreadyRouted } = await supabase
      .from('supervisor_daily_routes')
      .select('id')
      .eq('ltf_feed_id', feed.id)
      .maybeSingle()
    if (alreadyRouted) continue

    const { data: enquiry } = await supabase
      .from('guest_enquiries')
      .select('id, supervisor_id, zone, district')
      .eq('booking_ref', feed.booking_ref)
      .maybeSingle()
    if (!enquiry?.supervisor_id) continue

    const [slotStart, slotEnd] = SLOT_TIMES[feed.target_time_slot ?? 'morning'] ?? SLOT_TIMES.morning

    const { error } = await supabase.from('supervisor_daily_routes').insert({
      supervisor_id: enquiry.supervisor_id,
      scheduled_date: tomorrow,
      slot_type: 'inspection',
      site_id: feed.site_id ?? enquiry.id,
      site_address: [enquiry.zone, enquiry.district].filter(Boolean).join(', ') || null,
      slot_start: slotStart,
      slot_end: slotEnd,
      ltf_note: feed.contractor_notes,
      ltf_feed_id: feed.id,
      visit_status: 'scheduled',
      route_confirmed: false,
      planned_by: 'system',
      report_status: 'pending',
    })
    if (error) errors.push(`ltf ${feed.booking_ref}: ${error.message}`)
    else routesCreated++
  }

  // --- 2. Overhang carry-forward ---
  const { data: overdueSubstages } = await supabase
    .from('job_milestone_substages')
    .select('booking_ref, substage_code, substage_name')
    .eq('is_critical_path', true)
    .lt('early_finish_date', today)
    .not('status', 'in', '(completed,sent_back)')

  const overdueByBooking = new Map<string, string[]>()
  for (const s of overdueSubstages ?? []) {
    if (!s.booking_ref) continue
    const list = overdueByBooking.get(s.booking_ref) ?? []
    list.push(s.substage_name ?? s.substage_code ?? 'substage')
    overdueByBooking.set(s.booking_ref, list)
  }

  for (const [bookingRef, names] of overdueByBooking) {
    const { data: enquiry } = await supabase
      .from('guest_enquiries')
      .select('id, supervisor_id, zone, district')
      .eq('booking_ref', bookingRef)
      .maybeSingle()
    if (!enquiry?.supervisor_id) continue

    const { data: existingOverhang } = await supabase
      .from('supervisor_daily_routes')
      .select('id')
      .eq('supervisor_id', enquiry.supervisor_id)
      .eq('site_id', enquiry.id)
      .eq('scheduled_date', tomorrow)
      .eq('slot_type', 'overhang')
      .maybeSingle()
    if (existingOverhang) continue

    const { error } = await supabase.from('supervisor_daily_routes').insert({
      supervisor_id: enquiry.supervisor_id,
      scheduled_date: tomorrow,
      slot_type: 'overhang',
      site_id: enquiry.id,
      site_address: [enquiry.zone, enquiry.district].filter(Boolean).join(', ') || null,
      slot_start: '08:30',
      slot_end: '10:30',
      ltf_note: `Overdue critical-path work: ${names.join(', ')}`,
      visit_status: 'scheduled',
      route_confirmed: false,
      planned_by: 'system',
      report_status: 'pending',
    })
    if (error) errors.push(`overhang ${bookingRef}: ${error.message}`)
    else routesCreated++
  }

  return NextResponse.json({ routesCreated, ltfFeedsChecked: (readyFeeds ?? []).length, overhangsChecked: overdueByBooking.size, errors })
}
