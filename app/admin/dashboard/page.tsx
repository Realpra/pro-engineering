import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

// ── defensive fetch helper — a bad table/column name must never crash the page ──
async function safeSelect(promise: Promise<{ data: AnyRecord[] | null; error: unknown }>): Promise<AnyRecord[]> {
  try {
    const { data, error } = await promise
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[admin/dashboard] query error:', error)
      return []
    }
    return data ?? []
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[admin/dashboard] query threw:', e)
    return []
  }
}

function money(n: number): string {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN')
}

function fmtHeaderDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay() // 0 = Sunday
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function countBy(rows: AnyRecord[], field: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) {
    const key = row?.[field] ?? 'unknown'
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

const PIPELINE_STAGES = ['New', 'Confirmed', 'Site Visit', 'Estimate Sent', 'Estimate Accepted', 'In Progress', 'Completed'] as const

// Real guest_enquiries.status enum values are not fully confirmed across every
// stage of the flow, so this classifies by loose substring match — best-effort,
// never throws, and unmatched/empty statuses fall into 'New'.
function stageForStatus(status: unknown): string {
  const s = String(status ?? '').toLowerCase()
  if (!s || s === 'new') return 'New'
  if (s.includes('confirm')) return 'Confirmed'
  if (s.includes('scope_report') || s.includes('site_visit') || s.includes('visit')) return 'Site Visit'
  if (s.includes('estimate_sent') || s.includes('sent_to_client')) return 'Estimate Sent'
  if (s.includes('estimate_accepted') || (s.includes('accepted') && !s.includes('worker'))) return 'Estimate Accepted'
  if (s.includes('progress') || s.includes('work_started') || s.includes('milestone')) return 'In Progress'
  if (s.includes('complet')) return 'Completed'
  return 'New'
}

function StatCard({ label, value, colorClass = 'text-gray-800' }: { label: string; value: string | number; colorClass?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1 leading-snug">{label}</p>
    </div>
  )
}

function AlertPill({ href, label, count, className }: { href: string; label: string; count: number; className: string }) {
  if (count <= 0) return null
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white ${className}`}>
      {label}: {count}
    </Link>
  )
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'admin') redirect('/admin/dashboard')

  const adminName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Admin'
  const now = new Date()
  const monthStart = startOfMonth(now)
  const weekStart = startOfWeek(now)

  const sb = supabase as SupabaseAny

  const [
    workersRaw,
    milestonesRaw,
    enquiriesRaw,
    instructionsRaw,
    siteLogsRaw,
    scopeChangesRaw,
    preDeliveryRaw,
    piTrackerRaw,
    zoneProposalsRaw,
    boqRaw,
    zonesRaw,
    usersRaw,
    clientResponsesRaw,
  ] = await Promise.all([
    safeSelect(
      sb.from('workers').select(
        'id, full_name, approval_status, skill_level, zones, specialist_track_a, specialist_track_b, specialist_track_c, specialist_track_d, current_job_booking_ref, created_at',
      ),
    ),
    safeSelect(
      sb.from('milestone_payment_schedule').select(
        'id, booking_ref, milestone_code, status, payment_amount, planned_date, payment_released_at, coordinator_approved_at, decision_5_raised_at, decision_5_admin_decision, created_at',
      ),
    ),
    safeSelect(
      sb.from('guest_enquiries').select('id, booking_ref, status, job_type, zone, contact_name, is_active, created_at, driving_role'),
    ),
    safeSelect(sb.from('site_instructions').select('id, booking_ref, instruction_type, admin_acknowledged_at, issued_at')),
    safeSelect(sb.from('daily_site_logs').select('id, booking_ref, escalate_to_admin, decision_on_log, log_date')),
    safeSelect(sb.from('scope_change_requests').select('id, booking_ref, admin_decision, change_status, created_at')),
    safeSelect(sb.from('pre_delivery_assessment').select('id, booking_ref, supervisor_flagged_to_admin, admin_decision, created_at')),
    safeSelect(sb.from('pi_tracker').select('id, booking_ref, pi_category, pi_score, quality_score')),
    safeSelect(sb.from('zone_proposals').select('id, new_zone_name, admin_decision, proposed_at')),
    safeSelect(
      sb.from('boq_generated').select(
        'id, booking_ref, status, platform_premium_amount, total_amount, client_accepted_at, client_rejected_at, sent_to_client_at, created_at',
      ),
    ),
    safeSelect(sb.from('geo_hierarchy').select('id, name, level, is_active').eq('is_active', true)),
    safeSelect(sb.from('users').select('id, full_name, platform_role, updated_at')),
    safeSelect(sb.from('estimate_client_responses').select('id, booking_ref, response_type, responded_at')),
  ])

  // ── lookups ──────────────────────────────────────────────────────────────────
  const contactNameByBooking: Record<string, string> = {}
  const zoneByBooking: Record<string, string> = {}
  for (const e of enquiriesRaw) {
    if (e.booking_ref) {
      contactNameByBooking[e.booking_ref] = e.contact_name ?? '—'
      zoneByBooking[e.booking_ref] = e.zone ?? '—'
    }
  }

  // ── 1. workers ───────────────────────────────────────────────────────────────
  const totalWorkers = workersRaw.length
  const pendingAdminApproval = workersRaw.filter((w) => w.approval_status === 'coordinator_approved').length
  const adminApprovedWorkers = workersRaw.filter((w) => w.approval_status === 'admin_approved').length
  const deployedWorkers = workersRaw.filter((w) => !!w.current_job_booking_ref).length
  // NOTE: skill_level is a 3-tier enum (semi_skilled/skilled/highly_skilled) in the
  // live schema, not the L1-L6 scale the spec assumed — mapped onto the closest
  // beginner/competent/expert grouping the spec intended.
  const beginnerWorkers = workersRaw.filter((w) => w.skill_level === 'semi_skilled').length
  const competentWorkers = workersRaw.filter((w) => w.skill_level === 'skilled').length
  const expertWorkers = workersRaw.filter((w) => w.skill_level === 'highly_skilled').length
  const specialistHolders = workersRaw.filter(
    (w) => w.specialist_track_a || w.specialist_track_b || w.specialist_track_c || w.specialist_track_d,
  ).length

  // ── 2. milestone_payment_schedule ────────────────────────────────────────────
  const msByStatus = countBy(milestonesRaw, 'status')
  const paymentsPendingAdmin = msByStatus['coordinator_approved'] ?? 0
  const decision5Queue = milestonesRaw.filter((m) => m.decision_5_raised_at && !m.decision_5_admin_decision).length
  const onHoldPayments = msByStatus['admin_hold'] ?? 0
  const above5LAlerts = milestonesRaw.filter((m) => Number(m.payment_amount) > 500000).length
  const overdueMilestones = milestonesRaw.filter(
    (m) => m.status === 'pending' && m.planned_date && new Date(m.planned_date) < now,
  )
  const onTrackMilestones = milestonesRaw.filter(
    (m) => m.status === 'pending' && m.planned_date && new Date(m.planned_date) >= now,
  )
  const completedThisWeekMilestones = milestonesRaw.filter(
    (m) => m.payment_released_at && new Date(m.payment_released_at) >= weekStart,
  )
  const completedThisWeekSum = completedThisWeekMilestones.reduce((s, m) => s + (Number(m.payment_amount) || 0), 0)

  // ── 3. guest_enquiries ───────────────────────────────────────────────────────
  // Jobs with no driving_role yet need Admin/Superadmin to route them to a
  // Coordinator or Sub-Coordinator (zone-based) before anyone can act on them --
  // see app/admin/coordinators/.
  const unroutedJobs = enquiriesRaw.filter((e) => e.is_active && !e.driving_role).length
  const pipelineCounts: Record<string, number> = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 0]))
  for (const e of enquiriesRaw) pipelineCounts[stageForStatus(e.status)] += 1
  const activeJobs = enquiriesRaw.filter((e) => {
    const s = String(e.status ?? '').toLowerCase()
    return s.includes('progress') || s.includes('milestone_review') || s.includes('work_started')
  }).length
  const completedThisMonth = enquiriesRaw.filter((e) => {
    const s = String(e.status ?? '').toLowerCase()
    return s.includes('complet') && e.created_at && new Date(e.created_at) >= monthStart
  }).length
  const jobTypeGroups = countBy(enquiriesRaw, 'job_type')

  // ── 4. site_instructions ─────────────────────────────────────────────────────
  const unacknowledgedInstructions = instructionsRaw.filter((i) => !i.admin_acknowledged_at).length

  // ── 5. daily_site_logs ───────────────────────────────────────────────────────
  const escalatedLogs = siteLogsRaw.filter((l) => l.escalate_to_admin === true).length
  const undecidedLogs = siteLogsRaw.filter((l) => l.escalate_to_admin === true && !l.decision_on_log).length

  // ── 6. scope_change_requests ─────────────────────────────────────────────────
  const scopeChangesPending = scopeChangesRaw.filter((c) => c.admin_decision == null).length

  // ── 7. pre_delivery_assessment ───────────────────────────────────────────────
  const pendingHandovers = preDeliveryRaw.filter(
    (a) => a.supervisor_flagged_to_admin === true && a.admin_decision == null,
  ).length

  // ── 8. pi_tracker ────────────────────────────────────────────────────────────
  const piByCategory = countBy(piTrackerRaw, 'pi_category')
  const blacklistRiskWorkers = piByCategory['blacklist_risk'] ?? 0
  const qualityScores = piTrackerRaw.map((p) => Number(p.quality_score)).filter((n) => Number.isFinite(n) && n > 0)
  const avgJobRating = qualityScores.length > 0 ? qualityScores.reduce((s, n) => s + n, 0) / qualityScores.length : null

  // ── 9. zone_proposals ────────────────────────────────────────────────────────
  const zoneProposalsPending = zoneProposalsRaw.filter((p) => !p.admin_decision || p.admin_decision === 'pending').length

  // ── 10. boq_generated ────────────────────────────────────────────────────────
  const boqByStatus = countBy(boqRaw, 'status')
  const boqThisMonth = boqRaw.filter((b) => b.created_at && new Date(b.created_at) >= monthStart)
  const platformPremiumThisMonth = boqThisMonth.reduce((s, b) => s + (Number(b.platform_premium_amount) || 0), 0)
  const contractValueThisMonth = boqThisMonth.reduce((s, b) => s + (Number(b.total_amount) || 0), 0)
  const jobs_completedValueThisMonth = boqThisMonth
    .filter((b) => String(b.status ?? '').includes('accepted'))
    .reduce((s, b) => s + (Number(b.total_amount) || 0), 0)
  const estimatesSent = boqRaw.filter((b) => b.status === 'sent_to_client' || b.sent_to_client_at).length
  const estimatesAccepted = boqRaw.filter((b) => !!b.client_accepted_at).length
  const estimatesRejected = boqRaw.filter((b) => !!b.client_rejected_at).length
  const underClientReview = clientResponsesRaw.filter((r) => r.response_type === 'review_requested').length

  // ── 12. users ────────────────────────────────────────────────────────────────
  const coordinatorsActiveToday = usersRaw.filter(
    (u) => u.platform_role === 'coordinator' && u.updated_at && isSameDay(new Date(u.updated_at), now),
  ).length

  // ── zone performance strip ──────────────────────────────────────────────────
  const zoneCards = zonesRaw.map((zone) => {
    const name = zone.name as string
    const jobsInZone = enquiriesRaw.filter((e) => e.zone === name)
    const activeJobsInZone = jobsInZone.filter((e) => stageForStatus(e.status) !== 'Completed').length
    const workersInZone = workersRaw.filter((w) => Array.isArray(w.zones) && w.zones.includes(name)).length
    const bookingRefsInZone = new Set(jobsInZone.map((e) => e.booking_ref))
    const revenueInZone = boqThisMonth
      .filter((b) => bookingRefsInZone.has(b.booking_ref))
      .reduce((s, b) => s + (Number(b.total_amount) || 0), 0)
    const piInZone = piTrackerRaw
      .filter((p) => bookingRefsInZone.has(p.booking_ref))
      .map((p) => Number(p.pi_score))
      .filter((n) => Number.isFinite(n) && n > 0)
    const avgPi = piInZone.length > 0 ? (piInZone.reduce((s, n) => s + n, 0) / piInZone.length).toFixed(1) : '—'
    return { name, activeJobsInZone, workersInZone, revenueInZone, avgPi }
  })

  // ── recent activity feed ─────────────────────────────────────────────────────
  type Activity = { ts: number; text: string; bookingRef: string | null }
  const activities: Activity[] = []

  for (const w of workersRaw) {
    if (w.approval_status === 'coordinator_approved' && w.created_at) {
      activities.push({ ts: new Date(w.created_at).getTime(), text: `Worker ${w.full_name} forwarded for admin approval`, bookingRef: null })
    }
  }
  for (const m of milestonesRaw) {
    if (m.status === 'coordinator_approved' && m.coordinator_approved_at) {
      activities.push({
        ts: new Date(m.coordinator_approved_at).getTime(),
        text: `Payment ${money(Number(m.payment_amount) || 0)} for ${m.booking_ref} awaiting admin approval`,
        bookingRef: m.booking_ref,
      })
    }
  }
  for (const i of instructionsRaw) {
    if (i.issued_at) {
      activities.push({ ts: new Date(i.issued_at).getTime(), text: `New ${i.instruction_type ?? 'site'} instruction issued`, bookingRef: i.booking_ref })
    }
  }
  for (const e of enquiriesRaw) {
    if (e.created_at) {
      activities.push({ ts: new Date(e.created_at).getTime(), text: `Job ${e.booking_ref} status → ${e.status ?? 'new'}`, bookingRef: e.booking_ref })
    }
  }
  for (const r of clientResponsesRaw) {
    if (r.responded_at) {
      const verb = r.response_type === 'accepted' ? 'accepted' : r.response_type === 'rejected' ? 'rejected' : 'reviewed'
      const clientName = contactNameByBooking[r.booking_ref] ?? 'Client'
      activities.push({
        ts: new Date(r.responded_at).getTime(),
        text: `Client ${clientName} ${verb} estimate for ${r.booking_ref}`,
        bookingRef: r.booking_ref,
      })
    }
  }

  const recentActivity = activities.sort((a, b) => b.ts - a.ts).slice(0, 10)

  function timeAgo(ts: number): string {
    const diffMs = now.getTime() - ts
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const statRows: { title: string; cards: { label: string; value: string | number; colorClass?: string }[] }[] = [
    {
      title: 'Workers',
      cards: [
        { label: 'Total Workers', value: totalWorkers },
        { label: 'Pending Admin Approval', value: pendingAdminApproval, colorClass: pendingAdminApproval > 0 ? 'text-[#F97316]' : undefined },
        { label: 'Admin Approved', value: adminApprovedWorkers, colorClass: 'text-green-600' },
        { label: 'Currently Deployed', value: deployedWorkers, colorClass: 'text-blue-600' },
      ],
    },
    {
      title: 'Competency',
      cards: [
        { label: 'Beginner Workers (Semi-Skilled)', value: beginnerWorkers },
        { label: 'Competent Workers (Skilled)', value: competentWorkers },
        { label: 'Expert Workers (Highly Skilled)', value: expertWorkers },
        { label: 'Specialist Track Holders', value: specialistHolders },
      ],
    },
    {
      title: 'Jobs',
      cards: [
        { label: 'Active Jobs', value: activeJobs },
        { label: 'Completed This Month', value: completedThisMonth },
        { label: 'Scope Changes Pending', value: scopeChangesPending, colorClass: scopeChangesPending > 0 ? 'text-[#F97316]' : undefined },
        { label: 'Pending Handovers', value: pendingHandovers, colorClass: pendingHandovers > 0 ? 'text-[#F97316]' : undefined },
      ],
    },
    {
      title: 'Payments',
      cards: [
        { label: 'Payments Pending Admin', value: paymentsPendingAdmin, colorClass: paymentsPendingAdmin > 0 ? 'text-[#F97316]' : undefined },
        { label: 'Decision 5 Queue', value: decision5Queue, colorClass: decision5Queue > 0 ? 'text-red-600' : undefined },
        { label: 'On Hold', value: onHoldPayments, colorClass: onHoldPayments > 0 ? 'text-amber-600' : undefined },
        { label: 'Above ₹5L Alerts', value: above5LAlerts, colorClass: 'text-blue-600' },
      ],
    },
    {
      title: 'Estimates',
      cards: [
        { label: 'Estimates Sent', value: estimatesSent },
        { label: 'Estimates Accepted', value: estimatesAccepted, colorClass: 'text-green-600' },
        { label: 'Under Client Review', value: underClientReview, colorClass: 'text-blue-600' },
        { label: 'Estimates Rejected', value: estimatesRejected, colorClass: 'text-red-600' },
      ],
    },
    {
      title: 'Platform Health',
      cards: [
        { label: 'Unacknowledged Instructions', value: unacknowledgedInstructions, colorClass: unacknowledgedInstructions > 0 ? 'text-[#F97316]' : undefined },
        { label: 'Escalated Site Logs', value: escalatedLogs, colorClass: escalatedLogs > 0 ? 'text-red-600' : undefined },
        { label: 'Blacklist Risk Workers', value: blacklistRiskWorkers, colorClass: blacklistRiskWorkers > 0 ? 'text-red-900' : undefined },
        { label: 'Zone Proposals Pending', value: zoneProposalsPending, colorClass: zoneProposalsPending > 0 ? 'text-amber-600' : undefined },
      ],
    },
    {
      title: 'Revenue',
      cards: [
        { label: 'Platform Premium This Month', value: money(platformPremiumThisMonth) },
        { label: 'Total Contract Value This Month', value: money(contractValueThisMonth) },
        { label: 'Jobs Completed Value This Month', value: money(jobs_completedValueThisMonth) },
        { label: 'Avg Job Rating', value: avgJobRating != null ? avgJobRating.toFixed(1) : '—' },
      ],
    },
  ]

  const quickNav = [
    { href: '/book', icon: '➕', label: 'New Job', desc: 'Create a job on a client\'s behalf', count: 0 },
    { href: '/admin/workers', icon: '👷', label: 'Workers', desc: 'Final approval gate', count: pendingAdminApproval },
    { href: '/admin/policy', icon: '⚙️', label: 'Policy', desc: 'Premium · Contingency · BOCW · TDS', count: 0 },
    { href: '/admin/payments', icon: '💰', label: 'Payments', desc: 'Approvals · Decision 5', count: paymentsPendingAdmin + decision5Queue },
    { href: '/admin/zones', icon: '🗺️', label: 'Zones', desc: 'Rate cards · proposals', count: zoneProposalsPending },
    { href: '/admin/reports', icon: '📋', label: 'Reports', desc: 'Safety · directives · audit', count: unacknowledgedInstructions + escalatedLogs },
    { href: '/admin/scope', icon: '📐', label: 'Scope', desc: 'Pre-delivery · PI tracker', count: pendingHandovers + scopeChangesPending },
    { href: '/admin/milestones', icon: '🏗️', label: 'Milestones', desc: 'Stages · scope changes', count: undecidedLogs },
    { href: '/admin/coordinators', icon: '🧭', label: 'Coordinators', desc: 'Zone coverage · job routing', count: unroutedJobs },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-[#1F3864]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold text-xl leading-tight">Admin Dashboard</p>
            <p className="text-blue-300 text-sm">Pro Engineering Platform</p>
          </div>
          <div className="text-right flex items-center gap-4">
            <div>
              <p className="text-white text-sm">{fmtHeaderDate(now)}</p>
              <p className="text-blue-300 text-xs">Signed in as {adminName}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* ALERT STRIP */}
        {(pendingAdminApproval > 0 || paymentsPendingAdmin > 0 || decision5Queue > 0 || escalatedLogs > 0 || unacknowledgedInstructions > 0) && (
          <div className="bg-red-600 rounded-2xl px-5 py-4">
            <p className="text-white font-bold text-sm mb-2">Immediate attention required:</p>
            <div className="flex flex-wrap gap-2">
              <AlertPill href="/admin/workers" label="Pending Worker Approvals" count={pendingAdminApproval} className="bg-[#F97316]" />
              <AlertPill href="/admin/payments" label="Payments Pending" count={paymentsPendingAdmin} className="bg-red-700" />
              <AlertPill href="/admin/payments" label="Decision 5 Queue" count={decision5Queue} className="bg-red-900" />
              <AlertPill href="/admin/reports" label="Escalated Site Logs" count={escalatedLogs} className="bg-red-700" />
              <AlertPill href="/admin/reports" label="Unacknowledged Safety Instructions" count={unacknowledgedInstructions} className="bg-[#F97316]" />
            </div>
          </div>
        )}

        {/* SECTION 1 — BOOKING PIPELINE STRIP */}
        <section>
          <h2 className="text-[#1F3864] font-bold text-lg mb-3">Booking Pipeline</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {PIPELINE_STAGES.map((stage, idx) => (
                <div key={stage} className="flex items-center gap-2">
                  <Link
                    href={`/admin/dashboard?stage=${encodeURIComponent(stage)}`}
                    className="flex flex-col items-center px-4 py-2 rounded-xl hover:bg-gray-50"
                  >
                    <span className="text-xl font-bold text-[#1F3864]">{pipelineCounts[stage] ?? 0}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{stage}</span>
                  </Link>
                  {idx < PIPELINE_STAGES.length - 1 && <span className="text-gray-300 text-xl">→</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2 — STAT CARDS */}
        <section className="space-y-6">
          {statRows.map((row) => (
            <div key={row.title}>
              <h3 className="text-[#1F3864] font-bold text-sm uppercase tracking-wide mb-3">{row.title}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {row.cards.map((c) => (
                  <StatCard key={c.label} label={c.label} value={c.value} colorClass={c.colorClass} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* SECTION 3 — ZONE PERFORMANCE STRIP */}
        <section>
          <h2 className="text-[#1F3864] font-bold text-lg mb-3">Zone Performance</h2>
          {zoneCards.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-gray-400 text-sm">
              No active zones found.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {zoneCards.map((z) => (
                <div key={z.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-56 flex-shrink-0">
                  <p className="font-bold text-[#1F3864]">{z.name}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-gray-600">Active jobs: <span className="font-semibold text-gray-800">{z.activeJobsInZone}</span></p>
                    <p className="text-gray-600">Workers deployed: <span className="font-semibold text-gray-800">{z.workersInZone}</span></p>
                    <p className="text-gray-600">Revenue this month: <span className="font-semibold text-gray-800">{money(z.revenueInZone)}</span></p>
                    <p className="text-gray-600">Avg PI score: <span className="font-semibold text-gray-800">{z.avgPi}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 4 — MILESTONE HEALTH */}
        <section>
          <h2 className="text-[#1F3864] font-bold text-lg mb-3">Milestone Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-2xl font-bold text-red-600">{overdueMilestones.length}</p>
              <p className="text-xs text-gray-500 mb-2">Overdue Milestones</p>
              <div className="flex flex-wrap gap-1.5">
                {overdueMilestones.slice(0, 8).map((m) => (
                  <Link
                    key={m.id}
                    href="/admin/milestones"
                    className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5"
                  >
                    {m.booking_ref}
                  </Link>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-2xl font-bold text-green-600">{onTrackMilestones.length}</p>
              <p className="text-xs text-gray-500">On Track</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-2xl font-bold text-blue-600">{completedThisWeekMilestones.length}</p>
              <p className="text-xs text-gray-500">Completed This Week</p>
              <p className="text-sm font-semibold text-gray-700 mt-1">{money(completedThisWeekSum)}</p>
            </div>
          </div>
        </section>

        {/* SECTION 5 — QUICK NAVIGATION */}
        <section>
          <h2 className="text-[#1F3864] font-bold text-lg mb-3">Quick Navigation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-1 relative"
              >
                {item.count > 0 && (
                  <span className="absolute top-3 right-3 bg-[#F97316] text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {item.count}
                  </span>
                )}
                <span className="text-2xl">{item.icon}</span>
                <p className="font-bold text-gray-800 text-sm">{item.label}</p>
                <p className="text-xs text-gray-400 leading-snug">{item.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* SECTION 6 — QUICK ACTIONS */}
        <section>
          <h2 className="text-[#1F3864] font-bold text-lg mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/admin/workers" className="bg-[#F97316] text-white font-bold text-sm text-center rounded-2xl py-4">
              GO TO PENDING WORKERS
            </Link>
            <Link href="/admin/payments" className="bg-red-600 text-white font-bold text-sm text-center rounded-2xl py-4">
              GO TO PAYMENT QUEUE
            </Link>
            <Link href="/admin/reports" className="bg-amber-500 text-white font-bold text-sm text-center rounded-2xl py-4">
              GO TO ESCALATED LOGS
            </Link>
            <Link href="/admin/scope" className="bg-blue-600 text-white font-bold text-sm text-center rounded-2xl py-4">
              GO TO SCOPE CHANGES
            </Link>
          </div>
        </section>

        {/* SECTION 7 — RECENT ACTIVITY FEED */}
        <section>
          <h2 className="text-[#1F3864] font-bold text-lg mb-3">Recent Activity</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {recentActivity.length === 0 ? (
              <div className="p-4 text-gray-400 text-sm">No recent activity.</div>
            ) : (
              recentActivity.map((a, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{timeAgo(a.ts)}</p>
                    <p className="text-sm text-gray-700 truncate">{a.text}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.bookingRef && (
                      <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{a.bookingRef}</span>
                    )}
                    {a.bookingRef && (
                      <Link href={`/admin/estimate/${a.bookingRef}`} className="text-[#1F3864]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* JOB TYPE BREAKDOWN — supporting guest_enquiries group-by required by spec */}
        {Object.keys(jobTypeGroups).length > 0 && (
          <section>
            <h2 className="text-[#1F3864] font-bold text-lg mb-3">Jobs by Type</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3">
              {Object.entries(jobTypeGroups).map(([type, count]) => (
                <div key={type} className="text-sm">
                  <span className="font-semibold text-gray-800">{count}</span>{' '}
                  <span className="text-gray-500">{type}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* undecided site logs + coordinators active today — supporting counts required by spec */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Undecided Escalated Logs" value={undecidedLogs} colorClass={undecidedLogs > 0 ? 'text-red-600' : undefined} />
          <StatCard label="Coordinators Active Today" value={coordinatorsActiveToday} colorClass="text-green-600" />
          <StatCard label="BOQs by Status (total)" value={Object.values(boqByStatus).reduce((s, n) => s + n, 0)} />
          <StatCard label="Milestones by Status (total)" value={Object.values(msByStatus).reduce((s, n) => s + n, 0)} />
        </section>
      </main>
    </div>
  )
}
