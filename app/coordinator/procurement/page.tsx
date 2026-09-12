import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type BOQRow = {
  id: any
  booking_ref: any
  status: any
  line_items: any
  subtotal_material: any
  turnkey_enabled: any
  total_amount: any
  tier: any
}

export default async function CoordinatorProcurementPage() {
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
    .select('booking_ref, job_title, job_type, zone, district, status, estimate_total, contact_name')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const bookingRefs = (activeJobs ?? []).map(j => j.booking_ref)

  const { data: boqRaw } = bookingRefs.length > 0
    ? await supabase
        .from('boq_generated')
        .select('id, booking_ref, status, line_items, subtotal_material, turnkey_enabled, total_amount, tier')
        .in('booking_ref', bookingRefs)
        .order('created_at', { ascending: false })
    : { data: [] as BOQRow[] }

  const boqMap = new Map<string, BOQRow>()
  for (const b of boqRaw ?? []) {
    if (!boqMap.has(b.booking_ref)) boqMap.set(b.booking_ref, b)
  }

  const procurementStages = [
    { key: 'estimate_raised', label: 'Estimate Raised' },
    { key: 'client_approved', label: 'Client Approved' },
    { key: 'po_raised', label: 'PO Raised' },
    { key: 'delivery_scheduled', label: 'Delivery Scheduled' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'confirmed', label: 'Confirmed' },
  ]

  const materialCategories = [
    { code: 'WPF', label: 'Waterproofing Compound', unit: 'kg', example: 'Dr. Fixit, Fosroc, STP' },
    { code: 'TIL-FL', label: 'Floor Tiles', unit: 'sqft', example: 'Kajaria, Somany, RAK' },
    { code: 'TIL-WL', label: 'Wall Tiles', unit: 'sqft', example: 'Kajaria, Somany, RAK' },
    { code: 'ADH', label: 'Tile Adhesive', unit: 'kg', example: 'Laticrete, Ardex, BAL' },
    { code: 'GRT', label: 'Grout', unit: 'kg', example: 'Mapei, Laticrete, Ardex' },
    { code: 'PPE', label: 'Plumbing Pipes & Fittings', unit: 'lot', example: 'Astral, Prince, Supreme CPVC' },
    { code: 'ELE', label: 'Electrical Materials', unit: 'lot', example: 'Finolex, Havells, Polycab' },
    { code: 'PNT', label: 'Paint', unit: 'litre', example: 'Asian Paints, Berger, Dulux' },
    { code: 'SLN', label: 'Silicone Sealant', unit: 'tube', example: 'Pidilite, Sika, Fosroc' },
  ]

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
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Procurement</p>
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
              <p className="text-orange-400 font-bold text-2xl">
                {(boqRaw ?? []).filter(b => b.turnkey_enabled).length}
              </p>
              <p className="text-blue-300 text-xs">Turnkey Jobs</p>
            </div>
            <div>
              <p className="text-green-400 font-bold text-2xl">
                {(boqRaw ?? []).filter(b => b.status === 'accepted').length}
              </p>
              <p className="text-blue-300 text-xs">Client Accepted</p>
            </div>
          </div>
        </div>

        {/* PROCUREMENT FLOW */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Procurement Flow</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="space-y-3">
              {[
                { step: 1, label: 'Client accepts estimate (turnkey)', desc: 'LM job card — labour + material' },
                { step: 2, label: 'Coordinator raises material procurement estimate', desc: 'Material list extracted from BOQ · spec, grade, brand, quantity' },
                { step: 3, label: 'Client approves material estimate', desc: 'Formal approval before supply chain triggered' },
                { step: 4, label: 'Supply chain triggered', desc: 'Vendor selected · Purchase order raised · PO number recorded' },
                { step: 5, label: 'Delivery tracked', desc: 'Expected delivery date per batch · aligned to milestone plan' },
                { step: 6, label: 'Site receipt confirmed', desc: 'Site head logs receipt · condition · quantity · photo' },
                { step: 7, label: 'Procurement complete', desc: 'Coordinator marks complete · work commencement cleared' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#1F3864] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-400 leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* JOB PROCUREMENT STATUS */}
        {(activeJobs ?? []).length > 0 && (
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Job Procurement Status</p>
            <div className="space-y-3">
              {(activeJobs ?? []).map(job => {
                const boq = boqMap.get(job.booking_ref)
                const materialTotal = boq?.subtotal_material ?? 0
                const turnkey = boq?.turnkey_enabled ?? false
                return (
                  <div key={job.booking_ref} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-[#1F3864] px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-blue-300 text-xs">{job.booking_ref}</p>
                          <p className="text-white font-bold text-sm mt-0.5">{job.job_title ?? job.job_type}</p>
                          <p className="text-blue-300 text-xs mt-0.5">{[job.zone, job.district].filter(Boolean).join(', ')}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full border ${
                          turnkey ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {turnkey ? 'Turnkey (LM)' : 'Labour Only'}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-gray-400">Client</p>
                          <p className="font-semibold text-gray-700">{job.contact_name ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">BOQ Status</p>
                          <p className="font-semibold text-gray-700 capitalize">{boq?.status?.replace(/_/g, ' ') ?? 'No BOQ'}</p>
                        </div>
                        {boq?.tier && (
                          <div>
                            <p className="text-gray-400">Tier</p>
                            <p className="font-semibold text-gray-700 capitalize">{boq.tier}</p>
                          </div>
                        )}
                        {materialTotal > 0 && (
                          <div>
                            <p className="text-gray-400">Material Value</p>
                            <p className="font-semibold text-gray-700">₹{Number(materialTotal).toLocaleString('en-IN')}</p>
                          </div>
                        )}
                      </div>

                      {turnkey ? (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500">Procurement Stage</p>
                          <div className="flex flex-wrap gap-1.5">
                            {procurementStages.map(stage => (
                              <button key={stage.key} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                                {stage.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                              Raise Material Estimate
                            </button>
                            <button className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl">
                              Raise Purchase Order
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                          <p className="text-xs text-gray-400">Labour-only job · No material procurement required</p>
                          <p className="text-xs text-gray-400 mt-0.5">If client requests turnkey — update job card type to LM</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* MATERIAL CATEGORIES */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Material Categories</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {materialCategories.map(cat => (
              <div key={cat.code} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#2E74B5]">{cat.code}</span>
                    <p className="text-sm font-semibold text-gray-700">{cat.label}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{cat.example}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{cat.unit}</span>
              </div>
            ))}
          </div>
        </section>

        {/* DELIVERY PROTOCOL */}
        <section>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Delivery Protocol</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="space-y-2 text-xs text-gray-600">
              <p>• Delivery date set per batch — aligned to milestone plan</p>
              <p>• Site head logs receipt in daily log on delivery day</p>
              <p>• Receipt log includes: description · quantity · batch number · condition · photo</p>
              <p>• Short delivery or damage → coordinator action required: reorder or supplement</p>
              <p>• Delivery overdue → 🔴 red flash on coordinator dashboard</p>
              <p>• All materials confirmed received → coordinator marks procurement complete</p>
              <p>• Work commencement cleared only after procurement complete</p>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}