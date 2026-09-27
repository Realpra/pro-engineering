import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { assignStaff } from '../actions'

export default async function CoordinatorJobsPage() {
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

  const { data: allJobs } = await supabase
    .from('guest_enquiries')
    .select(`id, booking_ref, job_title, job_type, zone, district,
      status, is_active, estimate_total, supervisor_id, site_incharge_id,
      contact_name, contact_phone, preferred_start_date,
      scope_description, created_at`)
    .order('created_at', { ascending: false })

  const { data: supervisors } = await supabase
    .from('workers')
    .select('id, full_name')
    .eq('trade', 'Supervisor')
    .eq('is_active', true)
    .order('full_name')

  const supervisorMap = Object.fromEntries(
    (supervisors ?? []).map(s => [s.id, s.full_name])
  )

  // Site Incharge has no dedicated workers.trade value the way Supervisor
  // does -- it's a users.platform_role, so candidates are found by that role
  // and matched back to their workers row via auth_user_id.
  const { data: siteInchargeUsers } = await supabase
    .from('users')
    .select('id')
    .eq('platform_role', 'site_incharge')
  const siteInchargeAuthIds = (siteInchargeUsers ?? []).map(u => u.id)
  const { data: siteIncharges } = siteInchargeAuthIds.length > 0
    ? await supabase
        .from('workers')
        .select('id, full_name')
        .in('auth_user_id', siteInchargeAuthIds)
        .order('full_name')
    : { data: [] as { id: string; full_name: string }[] }

  const siteInchargeMap = Object.fromEntries(
    (siteIncharges ?? []).map(s => [s.id, s.full_name])
  )

  const { data: substages } = await supabase
    .from('job_milestone_substages')
    .select('booking_ref, status, substage_approved_at, subcoordinator_reviewed_at')

  const getJobProgress = (ref: string) => {
    const s = (substages ?? []).filter(x => x.booking_ref === ref)
    const total = s.length
    const done = s.filter(x => x.status === 'completed').length
    return total > 0 ? Math.round((done / total) * 100) : null
  }

  const statusGroups = [
    { key: 'new', label: 'New Enquiries', color: 'bg-gray-100 text-gray-600 border-gray-300', dot: 'bg-gray-400' },
    { key: 'scope_report_submitted', label: 'Scope Report Submitted', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500' },
    { key: 'approved_for_estimate', label: 'Approved for Estimate', color: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500' },
    { key: 'estimate_sent', label: 'Estimate Sent to Client', color: 'bg-purple-100 text-purple-700 border-purple-300', dot: 'bg-purple-500' },
    { key: 'estimate_accepted', label: 'Estimate Accepted', color: 'bg-green-100 text-green-700 border-green-300', dot: 'bg-green-500' },
    { key: 'confirmed', label: 'Confirmed — Work Started', color: 'bg-indigo-100 text-indigo-700 border-indigo-300', dot: 'bg-indigo-500' },
    { key: 'milestone_review', label: 'Milestone Review', color: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500' },
    { key: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700 border-green-300', dot: 'bg-green-600' },
    { key: 'enquiry', label: 'Enquiry', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-300' },
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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Job Pipeline</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-white font-bold text-2xl">{(allJobs ?? []).length}</p>
              <p className="text-blue-300 text-xs">Total</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{(allJobs ?? []).filter(j => j.is_active).length}</p>
              <p className="text-blue-300 text-xs">Active</p>
            </div>
            <div>
              <p className="text-orange-400 font-bold text-2xl">{(allJobs ?? []).filter(j => j.status === 'milestone_review').length}</p>
              <p className="text-blue-300 text-xs">In Review</p>
            </div>
            <div>
              <p className="text-blue-300 font-bold text-2xl">{(allJobs ?? []).filter(j => j.status === 'completed').length}</p>
              <p className="text-blue-300 text-xs">Done</p>
            </div>
          </div>
        </div>

        {/* PIPELINE BY STATUS GROUP */}
        {statusGroups.map(group => {
          const jobs = (allJobs ?? []).filter(j => j.status === group.key)
          if (jobs.length === 0) return null
          return (
            <section key={group.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{group.label} — {jobs.length}</p>
              </div>
              <div className="space-y-3">
                {jobs.map(job => {
                  const progress = getJobProgress(job.booking_ref)
                  return (
                    <div key={job.booking_ref} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="bg-[#1F3864] px-5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-blue-300 text-xs font-semibold">{job.booking_ref}</p>
                            <p className="text-white font-bold text-sm mt-0.5 leading-snug">{job.job_title ?? jobTypeLabel(job.job_type)}</p>
                            <p className="text-blue-300 text-xs mt-0.5">{[job.zone, job.district].filter(Boolean).join(', ')}</p>
                          </div>
                          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${group.color}`}>
                            {group.label.split('—')[0].trim()}
                          </span>
                        </div>
                      </div>
                      <div className="px-5 py-4 space-y-3">
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
                          {siteInchargeMap[job.site_incharge_id] && (
                            <div>
                              <p className="text-gray-400">Site Incharge</p>
                              <p className="font-semibold text-gray-700">{siteInchargeMap[job.site_incharge_id]}</p>
                            </div>
                          )}
                          {job.contact_name && (
                            <div>
                              <p className="text-gray-400">Client</p>
                              <p className="font-semibold text-gray-700">{job.contact_name}</p>
                            </div>
                          )}
                          {job.estimate_total && (
                            <div>
                              <p className="text-gray-400">Estimate</p>
                              <p className="font-semibold text-gray-700">₹{Number(job.estimate_total).toLocaleString('en-IN')}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-gray-400">Booked</p>
                            <p className="font-semibold text-gray-700">
                              {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          {job.preferred_start_date && (
                            <div>
                              <p className="text-gray-400">Start Date</p>
                              <p className="font-semibold text-gray-700">
                                {new Date(job.preferred_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          )}
                        </div>

                        {progress !== null && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-gray-400">Substage Progress</p>
                              <p className="text-xs font-bold text-[#1F3864]">{progress}%</p>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-[#2E74B5]'}`} style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          {(job.status === 'scope_report_submitted') && (
                            <Link href="/coordinator/scope-reports" className="flex-1 bg-yellow-500 text-white text-xs font-bold py-2.5 rounded-xl text-center">
                              Review Scope →
                            </Link>
                          )}
                          {(job.status === 'approved_for_estimate' || job.status === 'estimate_sent') && (
                            <Link href={`/coordinator/estimate`} className="flex-1 bg-[#2E74B5] text-white text-xs font-bold py-2.5 rounded-xl text-center">
                              Estimate Console →
                            </Link>
                          )}
                          {(job.status === 'milestone_review' || job.status === 'confirmed') && (
                            <Link href="/coordinator/payments" className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl text-center">
                              Payments →
                            </Link>
                          )}
                          {(!['scope_report_submitted','approved_for_estimate','estimate_sent','milestone_review','confirmed'].includes(job.status)) && (
                            <div className="flex-1 border border-gray-200 text-gray-400 text-xs font-semibold py-2.5 rounded-xl text-center">
                              {job.status?.replace(/_/g, ' ')}
                            </div>
                          )}
                        </div>

                        <form action={assignStaff} className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Assign Staff</p>
                          <input type="hidden" name="booking_ref" value={job.booking_ref} />
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">Supervisor</label>
                            <select name="supervisor_id" defaultValue={job.supervisor_id ?? ''} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                              <option value="">— Select —</option>
                              {(supervisors ?? []).map(s => (
                                <option key={s.id} value={s.id}>{s.full_name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">Site Incharge</label>
                            <select name="site_incharge_id" defaultValue={job.site_incharge_id ?? ''} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                              <option value="">— Select —</option>
                              {(siteIncharges ?? []).map(s => (
                                <option key={s.id} value={s.id}>{s.full_name}</option>
                              ))}
                            </select>
                          </div>
                          <button type="submit" className="w-full text-xs bg-blue-700 text-white rounded-lg py-1.5 font-semibold">
                            Assign →
                          </button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {(allJobs ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-gray-400 text-sm">No jobs in pipeline</p>
          </div>
        )}

      </main>
    </div>
  )
}