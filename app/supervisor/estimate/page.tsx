import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'

export default async function EstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'supervisor') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Supervisor'

  const { data: workerRecord } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: activeJobs } = workerRecord
    ? await supabase
        .from('guest_enquiries')
        .select('id, booking_ref, job_title, job_type, zone, district, status, estimate_total, scope_description, contact_name')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  const selectedJob = ref
    ? (activeJobs ?? []).find(j => j.booking_ref === ref)
    : null

  // Get substages for selected job — for quality/inspection requirements
  const { data: substages } = selectedJob
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          trade_type, planned_day, planned_hours, is_critical_path,
          evidence_checklist, supervisor_checklist`)
        .eq('booking_ref', selectedJob.booking_ref)
        .order('milestone_code', { ascending: true })
        .order('planned_day', { ascending: true })
    : { data: [] }

  const milestones = ['M0', 'M1', 'M2', 'M3', 'M4']
  const milestoneNames: Record<string, string> = {
    M0: 'Mobilisation & Preparatory Works — 20%',
    M1: 'First Fix — Civil & MEP Rough-in — 25%',
    M2: 'Mid Works — Waterproofing & Screed — 20%',
    M3: 'Second Fix — Finishing & Tiling — 25%',
    M4: 'Handover & DLP Start — 10%',
  }

  const verificationItems = [
    'Quantities verified against site measurement',
    'Specifications verified — material grade correct',
    'Method of working verified — trade sequence correct',
    'Material requirements verified — all items accounted',
    'BOQ line items checked against scope list',
    'All documents reviewed and signed off',
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/supervisor/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Estimate Preparation</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* JOB LIST */}
        {!ref && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Active Jobs — Select to Prepare Estimate
            </p>
            {(activeJobs ?? []).length > 0 ? (
              <div className="space-y-3">
                {(activeJobs ?? []).map(job => (
                  <Link
                    key={job.booking_ref}
                    href={`/supervisor/estimate?ref=${job.booking_ref}`}
                    className="block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 active:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                            Draft
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-medium">{job.booking_ref}</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">{job.job_title ?? 'Active Job'}</p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {job.job_type} · {[job.zone, job.district].filter(Boolean).join(', ')}
                        </p>
                        {job.estimate_total && (
                          <p className="text-xs text-[#1F3864] font-semibold mt-1">HQ Estimate: ₹{Number(job.estimate_total).toLocaleString('en-IN')}</p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-400 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
                <p className="text-gray-400 text-sm">No active jobs assigned</p>
              </div>
            )}
          </section>
        )}

        {/* SELECTED JOB ESTIMATE */}
        {selectedJob && (
          <>
            {/* Job Header */}
            <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-1">{selectedJob.booking_ref}</p>
              <p className="text-white font-bold text-lg">{selectedJob.job_title ?? 'Active Job'}</p>
              <p className="text-blue-300 text-xs mt-0.5 capitalize">
                {selectedJob.job_type} · {[selectedJob.zone, selectedJob.district].filter(Boolean).join(', ')}
              </p>
            </div>

            {/* HQ Estimate vs Supervisor */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                HQ Estimate Review
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-600">HQ Estimate</p>
                  <p className="text-xl font-bold text-[#1F3864]">
                    {selectedJob.estimate_total
                      ? `₹${Number(selectedJob.estimate_total).toLocaleString('en-IN')}`
                      : '₹ —'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Supervisor Action</p>
                  <div className="space-y-2">
                    {[
                      { value: 'confirm', label: '✓ Confirms — No change needed' },
                      { value: 'revise', label: '↑↓ Revises — Overall amount changed' },
                      { value: 'modify', label: '✎ Modifies — Specific line items changed' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="estimate_action" value={opt.value} className="w-4 h-4" />
                        <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Revision Reason</p>
                  <textarea
                    rows={2}
                    placeholder="Explain why estimate needs revision..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Revised Amount</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500">₹</span>
                    <input
                      type="number"
                      placeholder="Enter revised amount..."
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Milestone & Substage Breakdown */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Milestone & Substage Breakdown
              </p>
              <div className="space-y-3">
                {milestones.map(mc => {
                  const group = (substages ?? []).filter(s => s.milestone_code === mc)
                  if (group.length === 0) return null
                  return (
                    <div key={mc} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-[#2E74B5] uppercase tracking-wider">{mc}</p>
                        <p className="text-sm font-semibold text-gray-800">{milestoneNames[mc]}</p>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {group.map(s => {
                          const evidence = (s.evidence_checklist as any[]) ?? []
                          const checklist = (s.supervisor_checklist as any[]) ?? []
                          return (
                            <div key={s.id} className="px-5 py-3">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-gray-400 font-medium">{s.substage_code}</p>
                                    {s.is_critical_path && <span className="text-xs font-bold text-red-500">🔴</span>}
                                  </div>
                                  <p className="text-sm font-semibold text-gray-800 leading-snug">{s.substage_name}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {s.trade_type} · Day {s.planned_day} · {s.planned_hours}hrs
                                  </p>
                                </div>
                              </div>
                              {/* Quality requirements */}
                              <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs">
                                <p className="text-blue-700 font-semibold mb-1">Quality & Inspection Requirements</p>
                                <div className="space-y-0.5 text-blue-600">
                                  <p>• Evidence items: {evidence.length} required</p>
                                  <p>• Checklist items: {checklist.length} to verify</p>
                                  {s.is_critical_path && <p>• 🔴 Critical path — supervisor must inspect physically</p>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Document Verification */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Document & Quantity Verification
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
                {verificationItems.map((item, idx) => (
                  <label key={idx} className="flex items-start gap-4 px-5 py-4 cursor-pointer active:bg-gray-50">
                    <input type="checkbox" className="w-4 h-4 mt-0.5 shrink-0 rounded" />
                    <p className="text-sm font-medium text-gray-700 leading-snug">{item}</p>
                  </label>
                ))}
              </div>
            </section>

            {/* Scope Description */}
            {selectedJob.scope_description && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Scope Description
                </p>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedJob.scope_description}</p>
                </div>
              </section>
            )}

            {/* Supervisor Notes */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Supervisor Notes
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Technical Observations</p>
                  <textarea
                    rows={3}
                    placeholder="Note any technical observations or recommendations..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Method of Execution Notes</p>
                  <textarea
                    rows={2}
                    placeholder="Note any special execution requirements or sequence changes..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="space-y-3">
              <button className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm">
                Save Estimate Draft
              </button>
              <button className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl text-sm">
                Submit to Coordinator →
              </button>
            </div>
          </>
        )}

      </main>
    </div>
  )
}