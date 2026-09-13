'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { submitWorkerRegistration } from './actions'
import { createWorkerAuthAccount, checkPhoneExists } from '../actions'

const ZONES = ['Noida Sector 62', 'Noida Sector 63', 'Noida Sector 64']

function tradeName(trade: string) {
  const map: Record<string,string> = {
    mason:'Mason',plumber:'Plumber',electrician:'Electrician',
    waterproofer:'Waterproofer',painter:'Painter',carpenter:'Carpenter',
    'false-ceiling-installer':'False Ceiling Installer',helper:'Helper',supervisor:'Supervisor'
  }
  return map[trade] ?? trade
}

export default function TradeOnboardingPage() {
  const params = useParams()
  const router = useRouter()
  const trade = (params.trade as string) ?? ''

  const [screen, setScreen] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [workerCode, setWorkerCode] = useState('')
  const [workerId, setWorkerId] = useState('')

  const [form, setForm] = useState({
    fullName:'', phone:'', email:'', aadhaarLast4:'',
    state:'', district:'',
    skillLevel:'skilled', dailyWage:'',
    zones:[] as string[], employmentType:'self',
    bocwRegistered:'no', bocwNumber:'',
    bankAccount:'', ifscCode:'',
    emergencyName:'', emergencyPhone:'',
    declared:false, agreed:false,
  })

  function set(k: string, v: any) { setForm(f => ({...f, [k]: v})) }

  function toggleZone(z: string) {
    set('zones', form.zones.includes(z) ? form.zones.filter(x=>x!==z) : [...form.zones, z])
  }

  async function next() {
    setError('')
    if (screen === 1) {
      if (!form.fullName.trim()) return setError('Full name is required')
      if (!/^\d{10}$/.test(form.phone)) return setError('Enter a valid 10-digit phone number')
      const { exists } = await checkPhoneExists(form.phone)
      if (exists) return setError('This phone number is already registered')
    }
    if (screen === 2) {
      if (form.zones.length === 0) return setError('Select at least one zone')
    }
    setScreen(s => s + 1)
  }

  async function submit() {
    setError('')
    if (!form.declared || !form.agreed) return setError('Please accept both declarations to proceed')
    setLoading(true)
    try {
      const result = await submitWorkerRegistration(trade, {
        fullName: form.fullName, phone: form.phone,
        email: form.email || undefined, aadhaarLast4: form.aadhaarLast4 || undefined,
        state: form.state, district: form.district || undefined,
        skillLevel: form.skillLevel, dailyWage: form.dailyWage ? Number(form.dailyWage) : undefined,
        zones: form.zones, employmentType: form.employmentType,
        bocwRegistered: form.bocwRegistered, bocwNumber: form.bocwNumber || undefined,
        bankAccount: form.bankAccount || undefined, ifscCode: form.ifscCode || undefined,
        emergencyName: form.emergencyName || undefined, emergencyPhone: form.emergencyPhone || undefined,
      })
      if ('error' in result) return setError(result.error)
      setWorkerCode(result.workerCode)
      setWorkerId(result.workerId)
      if (form.email && result.workerId) {
        await createWorkerAuthAccount(form.email, form.phone, form.fullName, trade, result.workerId)
      }
      setScreen(5)
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'
  const label = 'block text-xs font-medium text-gray-600 mb-1'
  const btn = 'w-full bg-[#1F3864] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#162c52] transition'
  const btnO = 'w-full border border-[#1F3864] text-[#1F3864] font-bold py-3 rounded-xl text-sm hover:bg-gray-50 transition'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] py-5 px-4">
        <div className="text-white font-bold text-lg text-center">PRO ENGINEERING</div>
        <div className="text-blue-200 text-sm text-center mt-0.5">{tradeName(trade)} Registration</div>
      </div>

      {screen < 5 && (
        <div className="flex justify-center gap-2 py-4">
          {[1,2,3,4].map(s => (
            <div key={s} className={`h-2 w-10 rounded-full ${s <= screen ? 'bg-[#F97316]' : 'bg-gray-200'}`} />
          ))}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pb-10">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}

        {screen === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <div className="text-[#1F3864] font-bold text-base mb-2">Personal Details</div>
            <div><label className={label}>Full Name *</label><input className={inp} value={form.fullName} onChange={e=>set('fullName',e.target.value)} placeholder="As per Aadhaar card" /></div>
            <div><label className={label}>Phone Number *</label><input className={inp} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="10-digit mobile number" maxLength={10} /></div>
            <div><label className={label}>Email Address (for login)</label><input className={inp} type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="Optional — needed for platform login" /></div>
            <div><label className={label}>Aadhaar Last 4 Digits</label><input className={inp} value={form.aadhaarLast4} onChange={e=>set('aadhaarLast4',e.target.value)} placeholder="Last 4 digits only" maxLength={4} /></div>
            <div><label className={label}>State *</label><input className={inp} value={form.state} onChange={e=>set('state',e.target.value)} placeholder="e.g. Uttar Pradesh" /></div>
            <div><label className={label}>District</label><input className={inp} value={form.district} onChange={e=>set('district',e.target.value)} placeholder="e.g. Gautam Buddha Nagar" /></div>
            <button className={btn} onClick={next}>Next →</button>
          </div>
        )}

        {screen === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <div className="text-[#1F3864] font-bold text-base mb-2">Trade and Zone</div>
            <div>
              <label className={label}>Trade</label>
              <div className="bg-orange-100 text-orange-700 text-sm font-bold px-3 py-2 rounded-lg inline-block">{tradeName(trade)}</div>
            </div>
            <div>
              <label className={label}>Skill Level *</label>
              {['unskilled','semi_skilled','skilled','highly_skilled'].map(s => (
                <label key={s} className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="radio" name="skill" value={s} checked={form.skillLevel===s} onChange={()=>set('skillLevel',s)} />
                  <span className="text-sm capitalize">{s.replace('_',' ')}</span>
                </label>
              ))}
            </div>
            <div><label className={label}>Expected Daily Wage ₹</label><input className={inp} type="number" value={form.dailyWage} onChange={e=>set('dailyWage',e.target.value)} placeholder="Your daily rate in ₹" /></div>
            <div>
              <label className={label}>Work Zones * (select all you can cover)</label>
              {ZONES.map(z => (
                <label key={z} className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" checked={form.zones.includes(z)} onChange={()=>toggleZone(z)} />
                  <span className="text-sm">{z}</span>
                </label>
              ))}
            </div>
            <div>
              <label className={label}>Employment Type *</label>
              {[['self','Self Employed'],['turnkey_team','Part of a Team'],['sub_contractor','Sub-Contractor']].map(([v,l]) => (
                <label key={v} className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="radio" name="emp" value={v} checked={form.employmentType===v} onChange={()=>set('employmentType',v)} />
                  <span className="text-sm">{l}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button className={btnO} onClick={()=>setScreen(1)}>← Back</button>
              <button className={btn} onClick={next}>Next →</button>
            </div>
          </div>
        )}

        {screen === 3 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <div className="text-[#1F3864] font-bold text-base mb-2">Compliance and Bank Details</div>
            <div>
              <label className={label}>BOCW Registered? *</label>
              {[['yes','Yes — I have a BOCW card'],['no','No']].map(([v,l]) => (
                <label key={v} className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="radio" name="bocw" value={v} checked={form.bocwRegistered===v} onChange={()=>set('bocwRegistered',v)} />
                  <span className="text-sm">{l}</span>
                </label>
              ))}
            </div>
            {form.bocwRegistered==='yes' && (
              <div><label className={label}>BOCW Registration Number</label><input className={inp} value={form.bocwNumber} onChange={e=>set('bocwNumber',e.target.value)} placeholder="BW/UP/..." /></div>
            )}
            <div><label className={label}>Bank Account Number</label><input className={inp} value={form.bankAccount} onChange={e=>set('bankAccount',e.target.value)} placeholder="For payment transfer" /></div>
            <div><label className={label}>IFSC Code</label><input className={inp} value={form.ifscCode} onChange={e=>set('ifscCode',e.target.value)} placeholder="e.g. SBIN0001234" /></div>
            <div><label className={label}>Emergency Contact Name</label><input className={inp} value={form.emergencyName} onChange={e=>set('emergencyName',e.target.value)} /></div>
            <div><label className={label}>Emergency Contact Phone</label><input className={inp} value={form.emergencyPhone} onChange={e=>set('emergencyPhone',e.target.value)} maxLength={10} /></div>
            <div className="flex gap-3">
              <button className={btnO} onClick={()=>setScreen(2)}>← Back</button>
              <button className={btn} onClick={next}>Next →</button>
            </div>
          </div>
        )}

        {screen === 4 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <div className="text-[#1F3864] font-bold text-base mb-2">Review and Submit</div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium">{form.fullName}</span></div>
              <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{form.phone}</span></div>
              {form.email && <div><span className="text-gray-500">Email:</span> <span className="font-medium">{form.email}</span></div>}
              <div><span className="text-gray-500">Trade:</span> <span className="font-medium">{tradeName(trade)}</span></div>
              <div><span className="text-gray-500">Skill Level:</span> <span className="font-medium capitalize">{form.skillLevel.replace('_',' ')}</span></div>
              <div><span className="text-gray-500">Zones:</span> <span className="font-medium">{form.zones.join(', ')}</span></div>
              <div><span className="text-gray-500">State:</span> <span className="font-medium">{form.state}</span></div>
              <div><span className="text-gray-500">BOCW:</span> <span className="font-medium">{form.bocwRegistered==='yes' ? 'Registered' : 'Not Registered'}</span></div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.declared} onChange={e=>set('declared',e.target.checked)} className="mt-0.5" />
              <span className="text-sm text-gray-600">I declare that all information provided is accurate and complete.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.agreed} onChange={e=>set('agreed',e.target.checked)} className="mt-0.5" />
              <span className="text-sm text-gray-600">I agree to Pro Engineering's terms of service and code of conduct.</span>
            </label>
            <div className="flex gap-3">
              <button className={btnO} onClick={()=>setScreen(3)}>← Back</button>
              <button className={btn} onClick={submit} disabled={loading}>{loading ? 'Submitting...' : 'Submit Registration'}</button>
            </div>
          </div>
        )}

        {screen === 5 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-5xl mb-4">✅</div>
            <div className="text-[#1F3864] font-bold text-xl mb-2">Registration Submitted</div>
            <div className="text-gray-500 text-sm mb-4">Our coordinator will review your details and contact you within 24 hours.</div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <div className="text-xs text-gray-500 mb-1">Your Worker ID</div>
              <div className="text-[#1F3864] font-bold text-lg">{workerCode}</div>
            </div>
            {form.email && <div className="text-gray-500 text-sm mb-6">Login credentials will be sent to <span className="font-medium">{form.email}</span> once your account is approved.</div>}
            <button className={btn} onClick={()=>router.push('/onboarding')}>Register Another Worker</button>
          </div>
        )}
      </div>
    </div>
  )
}
