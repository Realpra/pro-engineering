import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '../dashboard/SignOutButton'

export default async function InstructionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.platform_role !== 'sub_coordinator') redirect('/login')

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Sub-Coordinator'

  const { data: issued } = await supabase
    .from('site_instructions')
    .select('id, instruction_type, priority, instruction_text, issued_at, status, booking_ref')
    .eq('issued_by', user.id)
    .order('issued_at', { ascending: false })

  const { data: activeJobs } = await supabase
    .from('guest_enquiries')
    .select('booking_ref, job_title, job_type, zone, district')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const { data: supervisors } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('platform_role', 'supervisor')

  const pendingInstructions = (issued ?? []).filter(i => i.status === 'pending')
  const acknowledgedInstructions = (issued ?? []).filter(i => i.status === 'acknowledged')

  const instructionIcon = (type: string) => {
    if (type === 'hold') return '🔴'
    if (type === 'expedite') return '🟠'
    if (type === 'revised') return '🟡'
    if (type === 'resource') return '🟢'
    return '⚠️'
  }

  const priorityBadge = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-700 border-red-300'
    if (p === 'high') return 'bg-orange-100 text-orange-700 border-orange-300'
    if (p === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-blue-100 text-blue-700 border-blue-300'
  }

  const typeLabel = (type: string) => {
    if (type === 'hold') return 'Hold — Stop Work'
    if (type === 'expedite') return 'Expedite — Speed Up'
    if (type === 'revised') return 'Revise — Change Plan'
    if (type === 'resource') return 'Resource — Add/Remove Worker'
    return 'Alert — Attention Required'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      <header className="bg-[#1F3864] sticky top-0 z-10 shadow-md">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/sub-coordinator/dashboard" className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Instructions</p>
            <p className="text-white font-bold text-sm leading-tight">{displayName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-10">

        {/* SUMMARY */}
        <div className="bg-[#1F3864] rounded-2xl px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-orange-400 font-bold text-2xl">{pendingInstructions.length}</p>
              <p className="text-blue-300 text-xs">Pending</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">{acknowledgedInstructions.length}</p>
              <p className="text-blue-300 text-xs">Acknowledged</p>
            </div>
            <div>
              <p className="text-white font-bold text-2xl">{(issued ?? []).length}</p>
              <p className="text-blue-300 text-xs">Total Issued</p>
            </div>
          </div>
        </div>

        {/* NEW INSTRUCTION FORM */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Issue New Instruction
          </p>
          <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden">
            <div className="bg-[#1F3864] px-5 py-3">
              <p className="text-white font-bold text-sm">Dynamic Instruction</p>
              <p className="text-blue-300 text-xs mt-0.5">To Supervisor / Site Incharge / Site Head</p>
            </div>
            <div className="px-5 py-4 space-y-4">

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Site / Booking</p>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">Select site...</option>
                  {(activeJobs ?? []).map(job => (
                    <option key={job.booking_ref} value={job.booking_ref}>
                      {job.booking_ref} — {job.job_title ?? job.job_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Issue To</p>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50">
                  <option value="">Select recipient...</option>
                  <option value="all_supervisors">All Supervisors</option>
                  {(supervisors ?? []).map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                  <option value="site_incharge">Site Incharge</option>
                  <option value="site_head">Site Head</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Instruction Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'hold', icon: '🔴', label: 'Hold' },
                    { type: 'expedite', icon: '🟠', label: 'Expedite' },
                    { type: 'revised', icon: '🟡', label: 'Revise' },
                    { type: 'resource', icon: '🟢', label: 'Resource' },
                    { type: 'alert', icon: '⚠️', label: 'Alert' },
                  ].map(t => (
                    <button key={t.type} className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 flex items-center gap-1.5 active:bg-gray-50">
                      <span>{t.icon}</span>{t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Priority</p>
                <div className="flex gap-2">
                  {['Low', 'Medium', 'High', 'Critical'].map(p => (
                    <button key={p} className={`flex-1 border rounded-xl py-2 text-xs font-semibold ${p === 'Critical' ? 'border-red-300 text-red-600' : 'border-gray-200 text-gray-600'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Message</p>
                <textarea
                  rows={3}
                  placeholder="Type instruction clearly — will be sent to supervisor and site team..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
                />
              </div>

              {/* Resource fields */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-3">
                <p className="text-xs font-bold text-gray-500">Resource Change (if type = Resource)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Action</p>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-white">
                      <option>Add Worker</option>
                      <option>Remove Worker</option>
                      <option>Replace Worker</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Trade</p>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-white">
                      <option>Plumber</option>
                      <option>Mason</option>
                      <option>Tiler</option>
                      <option>Electrician</option>
                      <option>Waterproofer</option>
                      <option>Helper</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Count</p>
                    <input type="number" defaultValue="1" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">From Date</p>
                    <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-white" />
                  </div>
                </div>
              </div>

              <button className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm">
                Send Instruction
              </button>

            </div>
          </div>
        </section>

        {/* INSTRUCTION TYPES REFERENCE */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Instruction Types
          </p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {[
              { icon: '🔴', type: 'Hold', desc: 'Stop work immediately on specified substage or site' },
              { icon: '🟠', type: 'Expedite', desc: 'Accelerate work — supervisor reports progress by EOD' },
              { icon: '🟡', type: 'Revise', desc: 'Change to plan — communicate revised approach to site team' },
              { icon: '🟢', type: 'Resource', desc: 'Add / remove / replace worker — deployed same day if available' },
              { icon: '⚠️', type: 'Alert', desc: 'Attention required — supervisor assesses and responds' },
            ].map(item => (
              <div key={item.type} className="px-5 py-3 flex items-start gap-3">
                <span className="text-lg shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-700">{item.type}</p>
                  <p className="text-xs text-gray-400 leading-snug">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PENDING INSTRUCTIONS */}
        {pendingInstructions.length > 0 && (
          <section>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
              Pending — Awaiting Acknowledgement
            </p>
            <div className="space-y-3">
              {pendingInstructions.map(inst => (
                <div key={inst.id} className="bg-white rounded-2xl border border-orange-200 shadow-sm px-5 py-4">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-xl shrink-0">{instructionIcon(inst.instruction_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${priorityBadge(inst.priority)}`}>
                          {inst.priority}
                        </span>
                        <span className="text-xs text-gray-400">{typeLabel(inst.instruction_type)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{inst.instruction_text}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {inst.booking_ref} · {new Date(inst.issued_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                    Awaiting Acknowledgement
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ACKNOWLEDGED */}
        {acknowledgedInstructions.length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Acknowledged
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {acknowledgedInstructions.map(inst => (
                <div key={inst.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{instructionIcon(inst.instruction_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${priorityBadge(inst.priority)}`}>
                          {inst.priority}
                        </span>
                        <span className="text-xs text-green-600 font-semibold">✓ Acknowledged</span>
                      </div>
                      <p className="text-sm text-gray-700">{inst.instruction_text}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {inst.booking_ref} · {new Date(inst.issued_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EMPTY */}
        {(issued ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">No instructions issued yet</p>
            <p className="text-gray-400 text-xs mt-1">Use the form above to send instructions to supervisors and site teams</p>
          </div>
        )}

      </main>
    </div>
  )
}