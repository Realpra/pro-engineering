import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function CoordinatorEstimatePage() {
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

  // Active jobs with estimates
  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district, status, contact_name, estimate_total')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  const { data: boqData } = bookingRefs.length > 0
    ? await supabase
        .from('boq_generated')
        .select(`id, booking_ref, status, total_amount, version,
          sent_to_client_at, client_accepted_at, tier,
          platform_premium_status, contingency_status`)
        .in('booking_ref', bookingRefs)
        .order('created_at', { ascending: false })
    : { data: [] }

  const { data: clientRemarks } = bookingRefs.length > 0
    ? await supabase
        .from('estimate_client_responses')
        .select('id, booking_ref, response_type, responded_at, coordinator_actioned_at, line_item_responses')
        .in('booking_ref', bookingRefs)
        .eq('response_type', 'review_requested')
        .is('coordinator_actioned_at', null)
        .order('responded_at', { ascending: true })
    : { data: [] }

  const boqMap = new Map<string, any>()
  for (const b of boqData ?? []) {
    if (!boqMap.has(b.booking_ref)) boqMap.set(b.booking_ref, b)
  }

  // Deduplicate client remarks by booking_ref
  const remarksMap = new Map<string, any>()
  for (const r of clientRemarks ?? []) {
    if (!remarksMap.has(r.booking_ref)) remarksMap.set(r.booking_ref, r)
  }

  const pendingRemarks = Array.from(remarksMap.values())

  const statusColor = (status: string) => {
    if (status === 'accepted') return 'bg-green-100 text-green-700 border-green-300'
    if (status === 'sent_to_client') return 'bg-blue-100 text-blue-700 border-blue-300'
    if (status === 'admin_review') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    if (status === 'client_review') return 'bg-orange-100 text-orange-700 border-orange-300'
    if (status === 'draft') return 'bg-gray-100 text-gray-500 border-gray-200'
    return 'bg-gray-100 text-gray-500 border-gray-200'
  }

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Estimate Console</p>
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
              <p className={`font-bold text-2xl ${pendingRemarks.length > 0 ? 'text-orange-400' : 'text-white'}`}>
                {pendingRemarks.length}
              </p>
              <p className="text-blue-300 text-xs">Client Remarks</p>
            </div>
            <div>
              <p className="text-yellow-400 font-bold text-2xl">
                {(boqData ?? []).filter(b => b.platform_premium_status === 'proposed' || b.contingency_status === 'proposed').length}
              </p>
              <p className="text-blue-300 text-xs">Pending Admin</p>
            </div>
          </div>
        </div>

        {/* CLIENT REMARKS — PENDING ACTION */}
        {pendingRemarks.length > 0 && (
          <section>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">📩 Client Remarks — Action Required</p>
            <div className="space-y-3">
              {pendingRemarks.map(r => {
                const job = (activeJobs ?? []).find(j => j.booking_ref === r.booking_ref)
                const lineItems = (r.line_item_responses as any[]) ?? []
                const queriedLines = lineItems.filter((l: any) => l.client_action === 'seek_review' || l.client_action === 'reject')
                return (
                  <div key={r.booking_ref} className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
                    <div className="bg-orange-500 px-5 py-3">
                      <p className="text-orange-100 text-xs">{r.booking_ref}</p>
                      <p className="text-white font-bold text-sm mt-0.5">{job?.job_title ?? job?.job_type}</p>
                      <p className="text-orange-100 text-xs mt-0.5">
                        Received {new Date(r.responded_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-xs text-gray-500">{queriedLines.length} line item{queriedLines.length !== 1 ? 's' : ''} flagged by client</p>
                      {queriedLines.slice(0, 2).map((line: any, i: number) => (
                        <div key={i} className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                          <p className="text-xs font-bold text-gray-700">{line.description ?? line.sku_code}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs">
                            <span className="text-gray-400">Original: ₹{Number(line.current_rate ?? 0).toLocaleString('en-IN')}</span>
                            {line.client_proposed_rate && (
                              <span className="text-orange-600 font-semibold">Client: ₹{Number(line.client_proposed_rate).toLocaleString('en-IN')}</span>
                            )}
                          </div>
                          {line.client_remarks && <p className="text-xs text-gray-500 mt-1 italic">"{line.client_remarks}"</p>}
                        </div>
                      ))}
                      {queriedLines.length > 2 && (
                        <p className="text-xs text-gray-400">+{queriedLines.length - 2} more lines</p>
                      )}
                      <Link
                        href={`/admin/estimate/${r.booking_ref}`}
                        className="block w-full bg-orange-500 text-white text-xs font-bold py-3 rounded-xl text-center"
                      >
                        Open Estimate Console for {r.booking_ref} →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ALL ACTIVE JOB ESTIMATES */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">All Active Job Estimates</p>
          <div className="space-y-3">
            {(activeJobs ?? []).map(job => {
              const boq = boqMap.get(job.booking_ref)
              const pendingAdmin = boq?.platform_premium_status === 'proposed' || boq?.contingency_status === 'proposed'
              const hasRemarks = remarksMap.has(job.booking_ref)

              return (
                <div key={job.booking_ref} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${hasRemarks ? 'border-orange-200' : 'border-gray-200'}`}>
                  <div className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{job.booking_ref}</p>
                      <p className="text-sm font-bold text-gray-800 leading-snug">{job.job_title ?? job.job_type}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{job.contact_name} · {[job.zone, job.district].filter(Boolean).join(', ')}</p>
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      {boq ? (
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor(boq.status)}`}>
                          {boq.status?.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-400 border-gray-200">
                          No BOQ
                        </span>
                      )}
                      {boq?.total_amount > 0 && (
                        <p className="text-xs font-bold text-gray-700">₹{Number(boq.total_amount).toLocaleString('en-IN')}</p>
                      )}
                    </div>
                  </div>

                  {boq && (
                    <div className="px-5 pb-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>v{boq.version ?? 1}.0 · {boq.tier ?? '—'} tier</span>
                        {boq.sent_to_client_at && (
                          <span>Sent {new Date(boq.sent_to_client_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        )}
                      </div>
                      {pendingAdmin && (
                        <div className="bg-yellow-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-yellow-700 font-semibold">⏳ Pending Admin approval — cannot send to client</p>
                        </div>
                      )}
                      {hasRemarks && (
                        <div className="bg-orange-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-orange-700 font-semibold">📩 Client remarks received — action required</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="px-5 pb-4">
                    <Link
                      href={`/admin/estimate/${job.booking_ref}`}
                      className="block w-full bg-[#1F3864] text-white text-xs font-bold py-3 rounded-xl text-center"
                    >
                      {boq ? 'Open Estimate Console →' : 'Generate Estimate →'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </main>
    </div>
  )
}