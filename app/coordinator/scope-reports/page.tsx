import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function CoordinatorScopeReportsPage() {
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

  // Jobs with scope report submitted — awaiting quality gate
  const { data: pendingReports } = await supabase
    .from('guest_enquiries')
    .select(`id, booking_ref, job_title, job_type, zone, district,
      status, supervisor_id, contact_name, scope_description,
      preferred_start_date, created_at`)
    .eq('status', 'scope_report_submitted')
    .order('created_at', { ascending: true })

  // Jobs already approved for estimate
  const { data: approvedJobs } = await supabase
    .from('guest_enquiries')
    .select(`booking_ref, job_title, job_type, zone, status, supervisor_id`)
    .in('status', ['approved_for_estimate', 'estimate_sent', 'estimate_accepted', 'confirmed', 'milestone_review'])
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: supervisors } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('platform_role', 'supervisor')

  const supervisorMap = Object.fromEntries(
    (supervisors ?? []).map(s => [s.id, s.full_name])
  )

  const checks = [
    { key: 'scope_complete', label: 'Scope Completeness', desc: 'All rooms and areas covered in the report?' },
    { key: 'quantities_verified', label: 'Quantities Verified', desc: 'Measurements match site survey data?' },
    { key: 'material_spec', label: 'Material Specification', desc: 'Grade and brand confirmed per scope?' },
    { key: 'method_of_working', label: 'Method of Working', desc: 'Trade sequence and method correct?' },
    { key: 'safety_assessment', label: 'Safety Assessment', desc: 'Site conditions and risks cleared?' },
    { key: 'client_signoff', label: 'Client Sign-off', desc: 'Client has verbally confirmed scope?' },
  ]

  const jobTypeLabel = (t: string) => {
    const map: Record<string, string> = {
      'home-renovation': 'Home Renovation',
      'bathroom-renovation': 'Bathroom Renovation',
      'kitchen-renovation': 'Kitchen Renovation',
      'leak-proofing': 'Waterproofing',
      'construction': 'Construction',
      'other': 'Other',
    }
    return map[t] ?? t
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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Scope Reports</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className={`font-bold text-2xl ${(pendingReports ?? []).length > 0 ? 'text-yellow-400' : 'text-white'}`}>
                {(pendingReports ?? []).length}
              </p>
              <p className="text-blue-300 text-xs">Awaiting Gate</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{(approvedJobs ?? []).length}</p>
              <p className="text-blue-300 text-xs">Passed Gate</p>
            </div>
            <div>
              <p className="text-blue-300 font-bold text-2xl">6</p>
              <p className="text-blue-300 text-xs">Gate Checks</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-400/30 text-center">
            <p className="text-blue-200 text-xs">All 6 checks must pass before estimate is triggered</p>
          </div>
        </div>

        {/* QUALITY GATE REFERENCE */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quality Gate — 6 Checks</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {checks.map((check, i) => (
              <div key={check.key} className="px-5 py-3 flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#1F3864] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-800">{check.label}</p>
                  <p className="text-xs text-gray-400 leading-snug">{check.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PENDING — AWAITING QUALITY GATE */}
        {(pendingReports ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-3">
              ⚡ Awaiting Quality Gate Review — {(pendingReports ?? []).length}
            </p>
            <div className="space-y-4">
              {(pendingReports ?? []).map(job => (
                <div key={job.booking_ref} className="bg-white rounded-2xl border border-yellow-200 shadow-sm overflow-hidden">
                  <div className="bg-yellow-500 px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-yellow-100 text-xs font-semibold">{job.booking_ref}</p>
                        <p className="text-white font-bold text-sm mt-0.5">{job.job_title ?? jobTypeLabel(job.job_type)}</p>
                        <p className="text-yellow-100 text-xs mt-0.5">{[job.zone, job.district].filter(Boolean).join(', ')}</p>
                      </div>
                      <span className="shrink-0 bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Gate Pending
                      </span>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Job Type</p>
                        <p className="font-semibold text-gray-700">{jobTypeLabel(job.job_type)}</p>
                      </div>
                      {supervisorMap[job.supervisor_id] && (
                        <div>
                          <p className="text-gray-400">Supervisor</p>
                          <p className="font-semibold text-gray-700">{supervisorMap[job.supervisor_id]}</p>
                        </div>
                      )}
                      {job.contact_name && (
                        <div>
                          <p className="text-gray-400">Client</p>
                          <p className="font-semibold text-gray-700">{job.contact_name}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-400">Submitted</p>
                        <p className="font-semibold text-gray-700">
                          {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>

                    {job.scope_description && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-1">Scope Summary</p>
                        <p className="text-xs text-gray-700 leading-snug">{job.scope_description}</p>
                      </div>
                    )}

                    {/* GATE CHECKLIST */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">Quality Gate Checklist</p>
                      <div className="space-y-2">
                        {checks.map((check, i) => (
                          <div key={check.key} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700">{check.label}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-green-600 text-sm font-bold flex items-center justify-center">✓</button>
                              <button className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-red-500 text-sm font-bold flex items-center justify-center">✗</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-xl px-4 py-3">
                      <p className="text-xs font-bold text-blue-700 mb-1">Return to Supervisor</p>
                      <textarea
                        rows={2}
                        placeholder="Remarks for supervisor — what needs correction before re-submission..."
                        className="w-full text-xs text-gray-700 bg-transparent resize-none outline-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button className="flex-1 border border-red-300 text-red-600 text-xs font-bold py-3 rounded-xl">
                        Return to Supervisor
                      </button>
                      <button className="flex-1 bg-green-600 text-white text-xs font-bold py-3 rounded-xl">
                        ✓ Pass All — Generate Estimate
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PASSED GATE */}
        {(approvedJobs ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Passed Gate — Recent
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {(approvedJobs ?? []).map(job => (
                <div key={job.booking_ref} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{job.booking_ref}</p>
                    <p className="text-sm font-semibold text-gray-700">{job.job_title ?? jobTypeLabel(job.job_type)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{job.zone}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    job.status === 'approved_for_estimate' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                    job.status === 'estimate_sent' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                    'bg-green-100 text-green-700 border-green-300'
                  }`}>
                    ✓ {job.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EMPTY */}
        {(pendingReports ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-gray-500 font-semibold text-sm">No scope reports pending</p>
            <p className="text-gray-400 text-xs mt-1">All scope reports have passed the quality gate</p>
          </div>
        )}

      </main>
    </div>
  )
}