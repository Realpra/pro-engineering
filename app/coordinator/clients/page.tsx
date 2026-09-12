import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function CoordinatorClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'coordinator') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Coordinator'

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select(`booking_ref, job_title, job_type, zone, district, status,
      contact_name, contact_phone, estimate_total,
      preferred_start_date, supervisor_id, created_at`)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  const { data: boqData } = bookingRefs.length > 0
    ? await supabase
        .from('boq_generated')
        .select(`id, booking_ref, status, total_amount, version,
          sent_to_client_at, client_accepted_at, client_rejected_at,
          platform_premium_status, contingency_status, risk_flag_items, tier`)
        .in('booking_ref', bookingRefs)
        .order('created_at', { ascending: false })
    : { data: [] }

  const { data: clientResponses } = bookingRefs.length > 0
    ? await supabase
        .from('estimate_client_responses')
        .select(`id, booking_ref, response_type, overall_remarks,
          line_item_responses, responded_at, coordinator_actioned_at`)
        .in('booking_ref', bookingRefs)
        .order('responded_at', { ascending: false })
    : { data: [] }

  const { data: supervisors } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('platform_role', 'supervisor')

  const supervisorMap = Object.fromEntries((supervisors ?? []).map(s => [s.id, s.full_name]))

  const boqMap = new Map<string, any>()
  for (const b of boqData ?? []) {
    if (!boqMap.has(b.booking_ref)) boqMap.set(b.booking_ref, b)
  }

  const responseMap = new Map<string, any>()
  for (const r of clientResponses ?? []) {
    if (!responseMap.has(r.booking_ref)) responseMap.set(r.booking_ref, r)
  }

  const isSLABreached = (respondedAt: string | null) => {
    if (!respondedAt) return false
    return Date.now() - new Date(respondedAt).getTime() > 60 * 60 * 1000
  }

  const daysSince = (sentAt: string | null) => {
    if (!sentAt) return null
    return Math.floor((Date.now() - new Date(sentAt).getTime()) / 86400000)
  }

  const getResponsePath = (response: any, boq: any) => {
    if (!boq) return { label: 'No estimate yet', color: 'bg-gray-100 text-gray-500' }
    if (!response && boq.status === 'draft') return { label: 'Draft — not sent', color: 'bg-gray-100 text-gray-500' }
    if (!response && boq.status === 'admin_review') return { label: 'Pending Admin approval', color: 'bg-yellow-100 text-yellow-700' }
    if (!response && boq.sent_to_client_at) return { label: 'Sent — awaiting client', color: 'bg-blue-100 text-blue-700' }
    if (response?.response_type === 'accepted') return { label: 'PATH 1 — Accepted ✓', color: 'bg-green-100 text-green-700' }
    if (response?.response_type === 'review_requested') return { label: 'PATH 2 — Query raised', color: 'bg-orange-100 text-orange-700' }
    if (response?.response_type === 'rejected') return { label: 'PATH 5 — Declined', color: 'bg-red-100 text-red-700' }
    return { label: 'Unknown', color: 'bg-gray-100 text-gray-500' }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'confirmed': 'bg-purple-100 text-purple-700 border-purple-300',
      'milestone_review': 'bg-orange-100 text-orange-700 border-orange-300',
      'estimate_sent': 'bg-blue-100 text-blue-700 border-blue-300',
      'estimate_accepted': 'bg-green-100 text-green-700 border-green-300',
      'client_review_requested': 'bg-orange-100 text-orange-700 border-orange-300',
      'estimate_rejected': 'bg-red-100 text-red-700 border-red-300',
    }
    return map[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
  }

  const pendingQueries = (activeJobs ?? []).filter(j => {
    const r = responseMap.get(j.booking_ref)
    return r?.response_type === 'review_requested' && !r?.coordinator_actioned_at
  })

  const slaBreached = pendingQueries.filter(j => {
    const r = responseMap.get(j.booking_ref)
    return isSLABreached(r?.responded_at)
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/coordinator/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Clients</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-white font-bold text-2xl">{(activeJobs ?? []).length}</p>
              <p className="text-blue-300 text-xs">Active Jobs</p>
            </div>
            <div>
              <p className={`font-bold text-2xl ${pendingQueries.length > 0 ? 'text-orange-400' : 'text-white'}`}>
                {pendingQueries.length}
              </p>
              <p className="text-blue-300 text-xs">Queries Pending</p>
            </div>
            <div>
              <p className={`font-bold text-2xl ${slaBreached.length > 0 ? 'text-red-400' : 'text-white'}`}>
                {slaBreached.length}
              </p>
              <p className="text-blue-300 text-xs">SLA Breached</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30 text-center">
            <p className="text-blue-200 text-xs">Query SLA: 1 working hour · No prices discussed on site</p>
          </div>
        </div>

        {/* SLA ALERTS */}
        {slaBreached.length > 0 && (
          <section>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">🔴 SLA Breached — Respond Now</p>
            <div className="space-y-2">
              {slaBreached.map(job => {
                const r = responseMap.get(job.booking_ref)
                return (
                  <div key={job.booking_ref} className="bg-red-600 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-white text-lg shrink-0">🔴</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold">{job.booking_ref} · {job.contact_name}</p>
                      <p className="text-red-200 text-xs">
                        Query raised {r?.responded_at ? new Date(r.responded_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                    </div>
                    <Link href="/coordinator/estimate" className="shrink-0 bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg">
                      Respond
                    </Link>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* CLIENT CARDS */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active Client Jobs — {(activeJobs ?? []).length}</p>
          <div className="space-y-4">
            {(activeJobs ?? []).map(job => {
              const boq = boqMap.get(job.booking_ref)
              const response = responseMap.get(job.booking_ref)
              const responsePath = getResponsePath(response, boq)
              const days = daysSince(boq?.sent_to_client_at)
              const slaAlert = response?.response_type === 'review_requested' && !response?.coordinator_actioned_at && isSLABreached(response?.responded_at)
              const lineItems = (response?.line_item_responses as any[]) ?? []
              const queriedLines = lineItems.filter((l: any) => l.client_action === 'seek_review' || l.client_action === 'reject')
              const riskFlags = (boq?.risk_flag_items as any[]) ?? []
              const waivedFlags = riskFlags.filter((f: any) => f.client_decision === 'waived' || f.client_decision === 'declined')

              return (
                <div key={job.booking_ref} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${slaAlert ? 'border-red-300' : 'border-gray-200'}`}>

                  <div className={`px-5 py-3 ${slaAlert ? 'bg-red-600' : 'bg-[#1F3864]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-blue-300 text-xs">{job.booking_ref}</p>
                        <p className="text-white font-bold text-sm mt-0.5">{job.job_title ?? job.job_type}</p>
                        <p className="text-blue-300 text-xs mt-0.5">{[job.zone, job.district].filter(Boolean).join(', ')}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusBadge(job.status)}`}>
                        {job.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">

                    {/* CLIENT + SUPERVISOR INFO */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Client</p>
                        <p className="font-semibold text-gray-700">{job.contact_name ?? '—'}</p>
                      </div>
                      {supervisorMap[job.supervisor_id] && (
                        <div>
                          <p className="text-gray-400">Lead</p>
                          <p className="font-semibold text-gray-700">{supervisorMap[job.supervisor_id]}</p>
                        </div>
                      )}
                      {job.preferred_start_date && (
                        <div>
                          <p className="text-gray-400">Preferred Start</p>
                          <p className="font-semibold text-gray-700">
                            {new Date(job.preferred_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      )}
                      {boq?.total_amount > 0 && (
                        <div>
                          <p className="text-gray-400">Estimate Total</p>
                          <p className="font-semibold text-gray-700">₹{Number(boq.total_amount).toLocaleString('en-IN')}</p>
                        </div>
                      )}
                    </div>

                    {/* ESTIMATE STATUS */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-500">Estimate</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${responsePath.color}`}>
                          {responsePath.label}
                        </span>
                      </div>
                      {boq?.sent_to_client_at && (
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Sent {new Date(boq.sent_to_client_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          <span>{days !== null ? `${days}d ago` : ''} · v{boq.version ?? 1}.0 · {boq.tier ?? '—'}</span>
                        </div>
                      )}
                    </div>

                    {/* CLIENT QUERIES */}
                    {response?.response_type === 'review_requested' && queriedLines.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-orange-600">Client Queries — {queriedLines.length} line{queriedLines.length !== 1 ? 's' : ''}</p>
                          {slaAlert && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">SLA BREACHED</span>}
                        </div>
                        {queriedLines.slice(0, 2).map((line: any, i: number) => (
                          <div key={i} className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                            <p className="text-xs font-bold text-gray-700">{line.description ?? line.sku_code}</p>
                            <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                              <div>
                                <p className="text-gray-400">Original</p>
                                <p className="font-semibold">₹{Number(line.current_rate ?? 0).toLocaleString('en-IN')}/{line.unit}</p>
                              </div>
                              {line.client_proposed_rate && (
                                <div>
                                  <p className="text-gray-400">Client Proposes</p>
                                  <p className="font-semibold text-orange-700">₹{Number(line.client_proposed_rate).toLocaleString('en-IN')}/{line.unit}</p>
                                </div>
                              )}
                            </div>
                            {line.client_remarks && <p className="text-xs text-gray-500 mt-1 italic">"{line.client_remarks}"</p>}
                            <div className="flex gap-1.5 mt-2">
                              <button className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-green-100 text-green-700">Accept</button>
                              <button className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-blue-100 text-blue-700">Keep</button>
                              <button className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-orange-100 text-orange-700">Compromise</button>
                            </div>
                          </div>
                        ))}
                        {queriedLines.length > 2 && (
                          <p className="text-xs text-gray-400 text-center">+{queriedLines.length - 2} more — open estimate console</p>
                        )}
                        <Link href="/coordinator/estimate" className="block w-full bg-orange-500 text-white text-xs font-bold py-3 rounded-xl text-center">
                          Open Estimate Console →
                        </Link>
                      </div>
                    )}

                    {/* DECLINED */}
                    {response?.response_type === 'rejected' && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-red-700 mb-1">Client Declined</p>
                        {response.overall_remarks && <p className="text-xs text-red-600">"{response.overall_remarks}"</p>}
                        <div className="flex gap-2 mt-2">
                          <button className="flex-1 text-xs font-bold py-2 rounded-lg border border-gray-300 text-gray-600">Revise Estimate</button>
                          <button className="flex-1 text-xs font-bold py-2 rounded-lg bg-red-600 text-white">Mark as Lost</button>
                        </div>
                      </div>
                    )}

                    {/* WAIVED RISK FLAGS */}
                    {waivedFlags.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-purple-700 mb-1">⚖️ Waived Risk Notices — {waivedFlags.length}</p>
                        {waivedFlags.map((flag: any, i: number) => (
                          <p key={i} className="text-xs text-purple-600">{flag.flag_name ?? flag.description} · Legal notice generated ✓</p>
                        ))}
                      </div>
                    )}

                    {/* PENDING ADMIN APPROVAL */}
                    {boq && (boq.platform_premium_status === 'proposed' || boq.contingency_status === 'proposed') && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-yellow-700">⏳ Pending Admin Approval — cannot send to client</p>
                        {boq.platform_premium_status === 'proposed' && <p className="text-xs text-yellow-600 mt-0.5">Platform Premium awaiting Admin</p>}
                        {boq.contingency_status === 'proposed' && <p className="text-xs text-yellow-600 mt-0.5">Contingency awaiting Admin</p>}
                      </div>
                    )}

                    {/* ACCEPTED */}
                    {response?.response_type === 'accepted' && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-green-600 text-lg">✓</span>
                        <div>
                          <p className="text-xs font-bold text-green-700">Estimate Accepted</p>
                          <p className="text-xs text-green-600">{new Date(response.responded_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    )}

                    {/* RESPONSE PATHS REFERENCE */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <p className="text-xs font-bold text-gray-400 mb-1.5">Response Paths</p>
                      <div className="space-y-0.5 text-xs text-gray-400">
                        <p>1 Accept · 2 Query (1hr SLA) · 3 Value Engineering · 4 Waive Risk · 5 Decline</p>
                      </div>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {(activeJobs ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-gray-500 font-semibold text-sm">No active client jobs</p>
            <p className="text-gray-400 text-xs mt-1">Active jobs with clients will appear here</p>
          </div>
        )}

      </main>
    </div>
  )
}