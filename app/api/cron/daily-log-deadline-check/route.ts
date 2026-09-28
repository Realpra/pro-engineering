import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Matches the exact adminClient() convention already established in
// app/onboarding/[trade]/actions.ts -- hardcoded project URL, service-role
// key from env, not NEXT_PUBLIC_SUPABASE_URL (which this repo doesn't use).
const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

// SA-5 spec (June log line 10479-10483): "Morning log ... must be submitted
// before 09:30. Evening log ... before 19:00. Missing either log generates
// an immediate coordinator alert." Confirmed via SUPERVISOR_INFEED_ACT_
// OUTPUT.md and a repo-wide grep that no deadline-enforcement or alerting
// mechanism existed anywhere -- daily_site_logs' morning/evening submission
// was tracked but never checked against a deadline. No cron/scheduled-job
// mechanism existed anywhere in this repo either (confirmed by grep) --
// this is the first one, wired via Vercel Cron (see vercel.json).
//
// Needs CRON_SECRET set as an env var in Vercel (and locally, for testing)
// -- Vercel signs its own cron requests with this as a Bearer token per
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
// Not runnable/testable from this session (no deployment access, no live
// DB access) -- flagged, not silently assumed working.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }
  const supabase = createServiceClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const now = new Date()
  const istHour = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24
  const stage: 'morning' | 'evening' | null = istHour >= 19 ? 'evening' : istHour >= 9.5 ? 'morning' : null
  if (!stage) return NextResponse.json({ skipped: 'Before either deadline' })

  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const column = stage === 'morning' ? 'morning_submitted_at' : 'evening_submitted_at'

  const { data: activeSupervisors } = await supabase
    .from('workers')
    .select('id, full_name')
    .eq('trade', 'Supervisor')
    .eq('is_active', true)

  const { data: todaysLogs } = await supabase
    .from('daily_site_logs')
    .select(`supervisor_id, ${column}`)
    .eq('log_date', today)

  const submittedIds = new Set((todaysLogs ?? []).filter((l: Record<string, unknown>) => l[column]).map((l: Record<string, unknown>) => l.supervisor_id as string))
  const missing = (activeSupervisors ?? []).filter(s => !submittedIds.has(s.id))
  if (missing.length === 0) return NextResponse.json({ escalated: 0 })

  const { data: coordinators } = await supabase.from('users').select('id').eq('platform_role', 'coordinator')
  if (!coordinators || coordinators.length === 0) return NextResponse.json({ error: 'No coordinator recipient found' }, { status: 500 })

  const rows = missing.flatMap(sup =>
    coordinators.map(c => ({
      instruction_type: 'daily_log_deadline_missed',
      instruction_category: 'system_alert',
      priority: 'high',
      instruction_text: `${sup.full_name ?? 'Supervisor'} has not submitted their ${stage} daily log (deadline ${stage === 'morning' ? '09:30' : '19:00'}).`,
      issued_to: c.id,
      issued_at: now.toISOString(),
      status: 'pending',
      is_active: true,
    })),
  )
  const { error } = await supabase.from('site_instructions').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ escalated: missing.length })
}
