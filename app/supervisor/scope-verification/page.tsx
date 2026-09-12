import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'

export default async function ScopeVerificationPage({
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
        .select('id, booking_ref, job_title, job_type, zone, district, status, scheduled_date, estimate_total, scope_description, contact_name, address_line, location')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  // If specific ref provided, show that job first
  const selectedJob = ref
    ? (activeJobs ?? []).find(j => j.booking_ref === ref)
    : null

  const verificationChecklist = [
    { id: 'qty', label: 'Quantities verified against site measurement' },
    { id: 'spec', label: 'Specifications verified — material grade correct' },
    { id: 'method', label: 'Method of working verified — trade sequence correct' },
    { id: 'material', label: 'Material requirements verified — all items accounted' },
    { id: 'boq', label: 'BOQ line items checked against scope list' },
    { id: 'docs', label: 'All documents reviewed and signed off' },
  ]

  const scopeItems = [
    { code: 'DEM', label: 'Demolition', trades: ['Mason', 'Helper'] },
    { code: 'ISO', label: 'Services Isolation', trades: ['Plumber', 'Electrician'] },
    { code: 'CHZ', label: 'Wall Chasing', trades: ['Mason'] },
    { code: 'PLM', label: 'Concealed Plumbing', trades: ['Plumber'] },
    { code: 'ELE', label: 'Electrical Rough-in', trades: ['Electrician'] },
    { code: 'WPF', label: 'Waterproofing', trades: ['Waterproofer'] },
    { code: 'SCR', label: 'Screed & Slope', trades: ['Mason'] },
    { code: 'TIL', label: 'Tiling — Floor & Wall', trades: ['Tiler'] },
    { code: 'SAN', label: 'Sanitary Fixtures', trades: ['Plumber'] },
    { code: 'PNT', label: 'Painting & Finishing', trades: ['Painter'] },
    { code: 'CLN', label: 'Final Cleaning', trades: ['Helper'] },
  ]

  const visitTypes = [
    { value: 'first_visit', label: 'First Visit — New Client' },
    { value: 'scope_change', label: 'Scope Change — Existing Job' },
    { value: 'estimate_review', label: 'Estimate Review' },
    { value: 'arising', label: 'Site Arising — New Work Found' },
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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Scope Verification</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* ACTIVE JOBS LIST */}
        {!ref && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Active Jobs — Select to Verify
            </p>
            {(activeJobs ?? []).length > 0 ? (
              <div className="space-y-3">
                {(activeJobs ?? []).map(job => (
                  <Link
                    key={job.booking_ref}
                    href={`/supervisor/scope-verification?ref=${job.booking_ref}`}
                    className="block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 active:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 font-medium">{job.booking_ref}</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">{job.job_title ?? 'Active Job'}</p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {job.job_type} · {[job.zone, job.district].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* SELECTED JOB SCOPE VERIFICATION */}
        {selectedJob && (
          <>
            {/* Job Details */}
            <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-1">{selectedJob.booking_ref}</p>
              <p className="text-white font-bold text-lg">{selectedJob.job_title ?? 'Active Job'}</p>
              <p className="text-blue-300 text-xs mt-0.5 capitalize">
                {selectedJob.job_type} · {[selectedJob.zone, selectedJob.district].filter(Boolean).join(', ')}
              </p>
              {selectedJob.address_line && (
                <p className="text-blue-200 text-xs mt-1">📍 {selectedJob.address_line}</p>
              )}
            </div>

            {/* Visit Type */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Visit Type
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {visitTypes.map(v => (
                    <label key={v.value} className="flex items-center gap-4 px-5 py-3 cursor-pointer active:bg-gray-50">
                      <input type="radio" name="visit_type" value={v.value} className="w-4 h-4 text-[#1F3864]" />
                      <p className="text-sm font-medium text-gray-700">{v.label}</p>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* Client Request Intake */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Client Request Details
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Client Name</p>
                  <input
                    type="text"
                    defaultValue={selectedJob.contact_name ?? ''}
                    placeholder="Client name..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Site Address</p>
                  <input
                    type="text"
                    defaultValue={selectedJob.address_line ?? ''}
                    placeholder="Full site address..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">Total Area (sqft)</p>
                    <input
                      type="number"
                      defaultValue={""}
                      placeholder="e.g. 45"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">Site Visit Date</p>
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Itemised Scope of Work */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Itemised Scope of Work
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {scopeItems.map(item => (
                    <div key={item.code} className="px-5 py-3">
                      <div className="flex items-center gap-4">
                        <input type="checkbox" className="w-4 h-4 rounded shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                          <p className="text-xs text-gray-400">{item.trades.join(' · ')}</p>
                        </div>
                        <div className="shrink-0 w-20">
                          <input
                            type="number"
                            placeholder="sqft"
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 text-right"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <button className="w-full border border-dashed border-[#2E74B5] text-[#2E74B5] text-xs font-semibold py-2.5 rounded-xl">
                    + Add Custom Item
                  </button>
                </div>
              </div>
            </section>

            {/* Site Visit Verification */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Site Visit Verification
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Scope verified on site?</p>
                  <div className="flex gap-3">
                    {['Yes — Fully Verified', 'Partially Verified', 'No — Not Visited'].map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="scope_verified" className="w-4 h-4" />
                        <span className="text-xs font-medium text-gray-600">{opt.split(' — ')[0]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Site Conditions Observed</p>
                  <textarea
                    rows={3}
                    placeholder="Describe actual site conditions — existing damage, access issues, special requirements..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* HQ Estimate Review */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                HQ Estimate Review
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">HQ Estimate</p>
                  <p className="text-lg font-bold text-[#1F3864]">₹ —</p>
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
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Revision Reason (if revising)</p>
                  <textarea
                    rows={2}
                    placeholder="Explain why the estimate needs revision..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Revised Amount (if applicable)</p>
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

            {/* Document & Quantity Verification */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Document & Quantity Verification
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
                {verificationChecklist.map(item => (
                  <label key={item.id} className="flex items-start gap-4 px-5 py-4 cursor-pointer active:bg-gray-50">
                    <input type="checkbox" className="w-4 h-4 mt-0.5 shrink-0 rounded" />
                    <p className="text-sm font-medium text-gray-700 leading-snug">{item.label}</p>
                  </label>
                ))}
              </div>
            </section>

            {/* Site Conditions & Notes */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Additional Notes
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Safety Concerns (if any)</p>
                  <textarea
                    rows={2}
                    placeholder="Note any safety risks or hazards observed..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Client Special Requests</p>
                  <textarea
                    rows={2}
                    placeholder="Note any client requests not covered in standard scope..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Submit */}
            <div className="space-y-3">
              <button className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm">
                Save Scope Verification Draft
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
