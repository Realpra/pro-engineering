import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'
import PrintCertificateButton from './PrintCertificateButton'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default async function CertificatePage() {
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
        .select('booking_ref, job_title, job_type, zone, district')
        .eq('supervisor_id', workerRecord.id)
        .eq('is_active', true)
    : { data: [] }

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  // Completed substages with supervisor approval
  const { data: completedSubstages } = bookingRefs.length > 0
    ? await supabase
        .from('job_milestone_substages')
        .select(`id, substage_code, substage_name, milestone_code,
          trade_type, booking_ref, status,
          supervisor_submitted_at, subcoordinator_reviewed_at,
          substage_approved_at, actual_completion_date`)
        .in('booking_ref', bookingRefs)
        .eq('status', 'completed')
        .order('supervisor_submitted_at', { ascending: false })
    : { data: [] }

  const jobMap = Object.fromEntries(
    (activeJobs ?? []).map(j => [j.booking_ref, j])
  )

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Supervisor Certificate</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* CERTIFICATE SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-white font-bold text-2xl">{(completedSubstages ?? []).length}</p>
              <p className="text-blue-300 text-xs">Certificates Issued</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">
                {(completedSubstages ?? []).filter(s => s.substage_approved_at).length}
              </p>
              <p className="text-blue-300 text-xs">Coordinator Approved</p>
            </div>
          </div>
        </div>

        {/* CERTIFICATE TEMPLATE */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Certificate Format
          </p>
          <div className="bg-white rounded-2xl border-2 border-[#1F3864]/20 shadow-sm overflow-hidden">
            {/* Certificate header */}
            <div className="bg-[#1F3864] px-6 py-5 text-center">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-1">Pro Engineering Platform</p>
              <p className="text-white font-bold text-lg">Supervisor Field Certificate</p>
              <p className="text-blue-300 text-xs mt-1">Quality Inspection & Completion Verification</p>
            </div>

            {/* Certificate body */}
            <div className="px-6 py-5 space-y-4">
              <div className="border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 font-medium mb-2">Declaration</p>
                <p className="text-sm text-gray-700 leading-relaxed italic">
                  "I, <span className="font-bold text-[#1F3864]">{displayName}</span>, Field Supervisor at Pro Engineering, 
                  hereby certify that I have physically visited the site referenced below, verified the work 
                  described in the substage, reviewed all evidence submitted by the Site Head, conducted a 
                  quality and safety assessment, and confirm the work is complete / partially complete as 
                  noted in this certificate."
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400 mb-0.5">Supervisor Name</p>
                  <p className="font-bold text-gray-800">{displayName}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400 mb-0.5">Date of Issue</p>
                  <p className="font-bold text-gray-800">[Auto-stamped]</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400 mb-0.5">Booking Ref</p>
                  <p className="font-bold text-gray-800">[From substage]</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400 mb-0.5">Substage Code</p>
                  <p className="font-bold text-gray-800">[LAB-XXX-XX]</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400 mb-0.5">Milestone</p>
                  <p className="font-bold text-gray-800">[M0 — M4]</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-gray-400 mb-0.5">Work Status</p>
                  <p className="font-bold text-gray-800">[Complete / Partial]</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2">Certificate includes:</p>
                <div className="space-y-1 text-xs text-gray-600">
                  <p>✓ Physical visit confirmation with GPS timestamp</p>
                  <p>✓ QIP quality report — all checklist items verified</p>
                  <p>✓ Evidence photos reviewed and confirmed</p>
                  <p>✓ Safety assessment completed</p>
                  <p>✓ Payment recommendation (full / partial / hold)</p>
                  <p>✓ Digital signature + auto-timestamp</p>
                </div>
              </div>

              <div className="bg-[#1F3864]/5 border border-[#1F3864]/20 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-gray-500">Certificate is auto-generated on Screen 20 of Site Visit</p>
                <Link
                  href="/supervisor/site-visit"
                  className="inline-block mt-2 bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-xl"
                >
                  Go to Site Visit →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CERTIFICATE HISTORY */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Certificate History
          </p>

          {(completedSubstages ?? []).length > 0 ? (
            <div className="space-y-3">
              {(completedSubstages ?? []).map((s, idx) => {
                const job = jobMap[s.booking_ref]
                const certNumber = `CERT-${String(idx + 1).padStart(4, '0')}`
                return (
                  <div key={s.id} id={`cert-${s.id}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Cert header */}
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#1F3864]">{certNumber}</p>
                        <p className="text-xs text-gray-400">{s.substage_code} · {s.booking_ref}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        s.substage_approved_at
                          ? 'bg-green-100 text-green-700 border-green-300'
                          : s.subcoordinator_reviewed_at
                          ? 'bg-blue-100 text-blue-700 border-blue-300'
                          : 'bg-orange-100 text-orange-700 border-orange-300'
                      }`}>
                        {s.substage_approved_at ? '✓ Approved' : s.subcoordinator_reviewed_at ? 'Sub-Coord Review' : 'Pending'}
                      </span>
                    </div>

                    <div className="px-5 py-4 space-y-3">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{s.substage_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{job?.job_title} · {s.milestone_code} · {s.trade_type}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-gray-400">Submitted</p>
                          <p className="font-semibold text-gray-700">{formatDateTime(s.supervisor_submitted_at)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Completed</p>
                          <p className="font-semibold text-gray-700">{formatDate(s.actual_completion_date)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Sub-Coord Review</p>
                          <p className="font-semibold text-gray-700">{formatDateTime(s.subcoordinator_reviewed_at)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Coordinator Approved</p>
                          <p className="font-semibold text-gray-700">{formatDateTime(s.substage_approved_at)}</p>
                        </div>
                      </div>

                      {/* Certificate preview */}
                      <div className="border border-[#1F3864]/20 rounded-xl px-4 py-3 bg-[#1F3864]/5">
                        <p className="text-xs font-bold text-[#1F3864] mb-2">Certificate Preview</p>
                        <p className="text-xs text-gray-600 italic leading-relaxed">
                          "I, {displayName}, certify that I have physically visited the site for {s.booking_ref},
                          verified {s.substage_code} — {s.substage_name?.substring(0, 50)}{(s.substage_name?.length ?? 0) > 50 ? '...' : ''},
                          and confirm the work is complete as of {formatDate(s.actual_completion_date)}."
                        </p>
                        <p className="text-xs text-gray-400 mt-2">Supervisor: {displayName} · {formatDateTime(s.supervisor_submitted_at)}</p>
                      </div>

                      <PrintCertificateButton targetId={`cert-${s.id}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
              <p className="text-gray-400 text-sm">No certificates issued yet</p>
              <p className="text-gray-400 text-xs mt-1">Certificates are generated when substages are completed and approved</p>
            </div>
          )}
        </section>

      </main>
    </div>
  )
}