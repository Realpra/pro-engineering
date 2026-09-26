'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { submitWorkerRegistration, createWorkerAuthAccount, checkPhoneExists } from './actions'
import { tradeName } from './utils'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry',
  'Chandigarh','Dadra & Nagar Haveli','Daman & Diu','Lakshadweep','Andaman & Nicobar',
]

const TRADES = [
  'Mason','Plumber','Electrician','Waterproofer','Painter',
  'Carpenter','False Ceiling Installer','Helper','Supervisor',
]

const SECTORS = [
  {v:'civil',l:'Civil'},
  {v:'mep',l:'MEP (Mechanical, Electrical, Plumbing)'},
  {v:'interior',l:'Interior Works'},
  {v:'false_roofing',l:'False Ceiling / Roofing'},
  {v:'painting',l:'Painting'},
  {v:'wood_work',l:'Wood Work'},
  {v:'architecture',l:'Architecture'},
  {v:'construction_pmc',l:'Construction / PMC'},
]

const LABOUR_TYPES = [
  {v:'skilled_trade',l:'Skilled Trade Worker'},
  {v:'support_labour',l:'Support / Unskilled Labour'},
  {v:'specialist',l:'Specialist'},
  {v:'supervisor',l:'Supervisor'},
  {v:'coordinator',l:'Coordinator'},
]

const ZONES = [
  'Noida Sector 62','Noida Sector 63','Noida Sector 64',
  'Noida Sector 58','Noida Sector 61','Noida Sector 68',
  'Greater Noida West','Greater Noida','Ghaziabad',
]

const YEARS_EXP = [
  {v:'less_1',l:'Less than 1 year'},
  {v:'1_3',l:'1 to 3 years'},
  {v:'3_5',l:'3 to 5 years'},
  {v:'5_10',l:'5 to 10 years'},
  {v:'10_plus',l:'More than 10 years'},
]

type Form = {
  fullName: string; phone: string; whatsappSame: boolean; whatsappPhone: string
  email: string; aadhaarLast4: string; pan: string; gender: string; dob: string
  state: string; district: string; city: string; pincode: string; address: string
  skill_level: string; sector: string; labour_type: string; employment_type: string
  secondaryTrades: string[]; years_experience: string; jobs_completed: string
  zones: string[]; daily_wage: string; hourly_rate: string; is_available: boolean
  height_restriction: boolean; dustRestriction: boolean; deploymentRestriction: string
  team_name: string; teamNumber: string
  bocwRegistered: boolean; bocw_number: string; pf_uan: string; esic_ip: string
  bank_account: string; ifsc_code: string; emergency_name: string; emergency_phone: string
  declared: boolean; agreed: boolean
}

const INIT: Form = {
  fullName:'', phone:'', whatsappSame:true, whatsappPhone:'',
  email:'', aadhaarLast4:'', pan:'', gender:'male', dob:'',
  state:'Uttar Pradesh', district:'', city:'', pincode:'', address:'',
  skill_level:'skilled', sector:'civil', labour_type:'skilled_trade', employment_type:'self',
  secondaryTrades:[], years_experience:'3_5', jobs_completed:'',
  zones:[], daily_wage:'', hourly_rate:'', is_available:true,
  height_restriction:false, dustRestriction:false, deploymentRestriction:'',
  team_name:'', teamNumber:'',
  bocwRegistered:false, bocw_number:'', pf_uan:'', esic_ip:'',
  bank_account:'', ifsc_code:'', emergency_name:'', emergency_phone:'',
  declared:false, agreed:false,
}

export default function TradeOnboardingPage() {
  const params = useParams()
  const router = useRouter()
  const trade = (params.trade as string) ?? ''
  const tName = tradeName(trade)

  const [screen, setScreen] = useState(1)
  const TOTAL = 6
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [workerCode, setWorkerCode] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [authError, setAuthError] = useState('')
  const [form, setForm] = useState<Form>(INIT)

  function set(k: keyof Form, v: any) { setForm(f => ({...f, [k]: v})) }

  function toggleArr(k: 'secondaryTrades' | 'zones', v: string) {
    setForm(f => ({
      ...f,
      [k]: (f[k] as string[]).includes(v)
        ? (f[k] as string[]).filter(x => x !== v)
        : [...(f[k] as string[]), v]
    }))
  }

  async function next() {
    setError('')
    if (screen === 1) {
      if (!form.fullName.trim()) return setError('Full name is required')
      if (!/^\d{10}$/.test(form.phone)) return setError('Phone number must be 10 digits')
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('A valid email address is required')
      if (form.aadhaarLast4 && !/^\d{4}$/.test(form.aadhaarLast4)) return setError('Aadhaar last 4 must be exactly 4 digits')
      const { exists } = await checkPhoneExists(form.phone)
      if (exists) return setError('This phone number is already registered. Contact your coordinator.')
    }
    if (screen === 2) {
      if (!form.state) return setError('State is required')
    }
    if (screen === 4) {
      if (form.zones.length === 0) return setError('Select at least one work zone')
    }
    setScreen(s => s + 1)
  }

  async function submit() {
    setError('')
    if (!form.declared || !form.agreed) return setError('Please accept both declarations')
    setLoading(true)
    try {
      const result = await submitWorkerRegistration(trade, {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
        aadhaarLast4: form.aadhaarLast4 || undefined,
        pan: form.pan || undefined,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        whatsappSame: form.whatsappSame,
        whatsappPhone: form.whatsappSame ? undefined : (form.whatsappPhone || undefined),
        state: form.state,
        district: form.district || undefined,
        city: form.city || undefined,
        pincode: form.pincode || undefined,
        address: form.address || undefined,
        skill_level: form.skill_level,
        sector: form.sector,
        labour_type: form.labour_type,
        employment_type: form.employment_type,
        secondaryTrades: form.secondaryTrades,
        years_experience: form.years_experience || undefined,
        jobs_completed: form.jobs_completed ? Number(form.jobs_completed) : undefined,
        zones: form.zones,
        daily_wage: form.daily_wage ? Number(form.daily_wage) : undefined,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : undefined,
        is_available: form.is_available,
        height_restriction: form.height_restriction,
        dustRestriction: form.dustRestriction,
        deploymentRestriction: form.deploymentRestriction || undefined,
        team_name: form.team_name || undefined,
        teamNumber: form.teamNumber || undefined,
        bocwRegistered: form.bocwRegistered,
        bocw_number: form.bocw_number || undefined,
        pf_uan: form.pf_uan || undefined,
        esic_ip: form.esic_ip || undefined,
        bank_account: form.bank_account || undefined,
        ifsc_code: form.ifsc_code || undefined,
        emergency_name: form.emergency_name || undefined,
        emergency_phone: form.emergency_phone || undefined,
      })
      if ('error' in result) {
        console.error('Registration error:', result.error)
        setError(result.error + ' (debug: error in result)')
        return
      }
      setWorkerCode(result.workerCode)
      if (result.workerId) {
        const authResult = await createWorkerAuthAccount(trade, form.fullName, result.workerId, result.workerCode)
        if ('error' in authResult) {
          console.error('Auth account creation failed:', authResult.error)
          setAuthError(authResult.error)
        } else {
          setLoginEmail(authResult.loginEmail)
        }
      }
      setScreen(7)
    } finally {
      setLoading(false)
    }
  }

  // Shared styles
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864] focus:border-transparent'
  const sel = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]'
  const lbl = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide'
  const req = <span className="text-red-500 ml-0.5">*</span>
  const btn = 'w-full bg-[#1F3864] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#162c52] transition-colors'
  const btnOut = 'w-full border-2 border-[#1F3864] text-[#1F3864] font-bold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors'
  const secHead = 'text-[#1F3864] font-bold text-base mb-4 pb-2 border-b border-gray-100'
  const card = 'bg-white rounded-2xl shadow-sm p-5 space-y-4'
  const radioRow = 'flex items-center gap-2 cursor-pointer py-1'
  const checkRow = 'flex items-center gap-2 cursor-pointer py-1'

  const screenTitles = [
    '','Personal Identity','Address & Location','Trade & Skills',
    'Zone & Availability','Compliance & Finance','Declaration'
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1F3864] py-5 px-4 sticky top-0 z-10">
        <div className="text-white font-bold text-lg text-center">PRO ENGINEERING</div>
        <div className="text-blue-200 text-xs text-center mt-0.5">{tName} — Worker Registration</div>
      </div>

      {/* Progress bar */}
      {screen <= TOTAL && (
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#1F3864]">Step {screen} of {TOTAL}</span>
            <span className="text-xs text-gray-500">{screenTitles[screen]}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-[#F97316] h-1.5 rounded-full transition-all duration-300"
              style={{width: `${(screen/TOTAL)*100}%`}} />
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-5 pb-10">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-start gap-2">
            <span className="mt-0.5">⚠️</span><span>{error}</span>
          </div>
        )}

        {/* SCREEN 1 — Personal Identity */}
        {screen === 1 && (
          <div className={card}>
            <div className={secHead}>Personal Identity</div>

            <div>
              <label className={lbl}>Full Name {req}</label>
              <input className={inp} value={form.fullName}
                onChange={e=>set('fullName',e.target.value)}
                placeholder="As per Aadhaar card" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Gender {req}</label>
                <select className={sel} value={form.gender} onChange={e=>set('gender',e.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Date of Birth</label>
                <input className={inp} type="date" value={form.dob}
                  onChange={e=>set('dob',e.target.value)} />
              </div>
            </div>

            <div>
              <label className={lbl}>Mobile Number {req}</label>
              <input className={inp} value={form.phone}
                onChange={e=>set('phone',e.target.value)}
                placeholder="10-digit mobile number" maxLength={10} />
            </div>

            <div>
              <label className={lbl}>WhatsApp Number</label>
              <label className={checkRow}>
                <input type="checkbox" checked={form.whatsappSame}
                  onChange={e=>set('whatsappSame',e.target.checked)} />
                <span className="text-sm text-gray-600">Same as mobile number</span>
              </label>
              {!form.whatsappSame && (
                <input className={inp} value={form.whatsappPhone}
                  onChange={e=>set('whatsappPhone',e.target.value)}
                  placeholder="WhatsApp number" maxLength={10} />
              )}
            </div>

            <div>
              <label className={lbl}>Email Address {req}</label>
              <input className={inp} type="email" value={form.email}
                onChange={e=>set('email',e.target.value)}
                placeholder="Your own contact email" />
              <p className="text-xs text-gray-400 mt-1">Used for contact — your platform login is generated separately once approved</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Aadhaar Last 4 Digits</label>
                <input className={inp} value={form.aadhaarLast4}
                  onChange={e=>set('aadhaarLast4',e.target.value)}
                  placeholder="XXXX" maxLength={4} />
              </div>
              <div>
                <label className={lbl}>PAN Number</label>
                <input className={inp} value={form.pan}
                  onChange={e=>set('pan',e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F" maxLength={10} />
              </div>
            </div>

            <button className={btn} onClick={next}>Next: Address →</button>
          </div>
        )}

        {/* SCREEN 2 — Address */}
        {screen === 2 && (
          <div className={card}>
            <div className={secHead}>Address and Location</div>

            <div>
              <label className={lbl}>State {req}</label>
              <select className={sel} value={form.state} onChange={e=>set('state',e.target.value)}>
                <option value="">Select State</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>District</label>
                <input className={inp} value={form.district}
                  onChange={e=>set('district',e.target.value)}
                  placeholder="e.g. Gautam Buddha Nagar" />
              </div>
              <div>
                <label className={lbl}>City / Town</label>
                <input className={inp} value={form.city}
                  onChange={e=>set('city',e.target.value)}
                  placeholder="e.g. Noida" />
              </div>
            </div>

            <div>
              <label className={lbl}>PIN Code</label>
              <input className={inp} value={form.pincode}
                onChange={e=>set('pincode',e.target.value)}
                placeholder="6-digit PIN code" maxLength={6} />
            </div>

            <div>
              <label className={lbl}>Current Address</label>
              <textarea className={inp} rows={3} value={form.address}
                onChange={e=>set('address',e.target.value)}
                placeholder="House / flat number, street, locality" />
            </div>

            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(1)}>← Back</button>
              <button className={btn} onClick={next}>Next: Trade →</button>
            </div>
          </div>
        )}

        {/* SCREEN 3 — Trade and Skills */}
        {screen === 3 && (
          <div className={card}>
            <div className={secHead}>Trade and Skills</div>

            <div>
              <label className={lbl}>Primary Trade {req}</label>
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-sm font-bold text-orange-700">
                {tName}
              </div>
              <p className="text-xs text-gray-400 mt-1">To change trade go back to the trade selector</p>
            </div>

            <div>
              <label className={lbl}>Skill Level {req}</label>
              <select className={sel} value={form.skill_level} onChange={e=>set('skill_level',e.target.value)}>
                <option value="unskilled">Unskilled</option>
                <option value="semi_skilled">Semi-Skilled</option>
                <option value="skilled">Skilled</option>
                <option value="highly_skilled">Highly Skilled</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Sector {req}</label>
              <select className={sel} value={form.sector} onChange={e=>set('sector',e.target.value)}>
                {SECTORS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}>Labour Type {req}</label>
              <select className={sel} value={form.labour_type} onChange={e=>set('labour_type',e.target.value)}>
                {LABOUR_TYPES.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}>Employment Classification {req}</label>
              <select className={sel} value={form.employment_type} onChange={e=>set('employment_type',e.target.value)}>
                <option value="self">Self Employed</option>
                <option value="associate">Associate</option>
                <option value="sub_contractor">Sub Contractor</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Secondary Trades (select all that apply)</label>
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                {TRADES.filter(t => t !== tName).map(t => (
                  <label key={t} className={checkRow}>
                    <input type="checkbox"
                      checked={form.secondaryTrades.includes(t)}
                      onChange={()=>toggleArr('secondaryTrades',t)} />
                    <span className="text-sm">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Years of Experience</label>
                <select className={sel} value={form.years_experience} onChange={e=>set('years_experience',e.target.value)}>
                  {YEARS_EXP.map(y => <option key={y.v} value={y.v}>{y.l}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Jobs Completed in Trade</label>
                <input className={inp} type="number" value={form.jobs_completed}
                  onChange={e=>set('jobs_completed',e.target.value)}
                  placeholder="Approx count" min={0} />
              </div>
            </div>

            <div>
              <label className={lbl}>Team Name (if part of a team)</label>
              <input className={inp} value={form.team_name}
                onChange={e=>set('team_name',e.target.value)} placeholder="Team or contractor name" />
            </div>

            <div>
              <label className={lbl}>Team Number</label>
              <input className={inp} value={form.teamNumber}
                onChange={e=>set('teamNumber',e.target.value)} placeholder="Team / sub-contract code" />
              <p className="text-xs text-gray-400 mt-1">If you're onboarding through a sub-contractor, or as part of a whole team ready for full job deployment (multiple skills covered by the team, no need to itemize each member's skill separately), enter the team's number here to link every team member together.</p>
            </div>

            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(2)}>← Back</button>
              <button className={btn} onClick={next}>Next: Zone →</button>
            </div>
          </div>
        )}

        {/* SCREEN 4 — Zone and Availability */}
        {screen === 4 && (
          <div className={card}>
            <div className={secHead}>Zone and Availability</div>

            <div>
              <label className={lbl}>Work Zones {req}</label>
              <p className="text-xs text-gray-400 mb-2">Select all areas where you can work</p>
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                {ZONES.map(z => (
                  <label key={z} className={checkRow}>
                    <input type="checkbox"
                      checked={form.zones.includes(z)}
                      onChange={()=>toggleArr('zones',z)} />
                    <span className="text-sm">{z}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Expected Daily Wage ₹</label>
                <input className={inp} type="number" value={form.daily_wage}
                  onChange={e=>set('daily_wage',e.target.value)}
                  placeholder="Per day in ₹" />
              </div>
              <div>
                <label className={lbl}>Hourly Rate ₹</label>
                <input className={inp} type="number" value={form.hourly_rate}
                  onChange={e=>set('hourly_rate',e.target.value)}
                  placeholder="Per hour in ₹" />
              </div>
            </div>

            <div>
              <label className={lbl}>Available for Work Right Now?</label>
              <div className="flex gap-4 mt-1">
                <label className={radioRow}>
                  <input type="radio" name="avail" checked={form.is_available}
                    onChange={()=>set('is_available',true)} />
                  <span className="text-sm">Yes — Available immediately</span>
                </label>
                <label className={radioRow}>
                  <input type="radio" name="avail" checked={!form.is_available}
                    onChange={()=>set('is_available',false)} />
                  <span className="text-sm">No — Not available now</span>
                </label>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">Physical Restrictions</div>
              <label className={checkRow}>
                <input type="checkbox" checked={form.height_restriction}
                  onChange={e=>set('height_restriction',e.target.checked)} />
                <span className="text-sm">I cannot work at heights (above 10 feet)</span>
              </label>
              <label className={checkRow}>
                <input type="checkbox" checked={form.dustRestriction}
                  onChange={e=>set('dustRestriction',e.target.checked)} />
                <span className="text-sm">I have a dust / respiratory restriction</span>
              </label>
              {(form.height_restriction || form.dustRestriction) && (
                <div>
                  <label className={lbl}>Restriction Details</label>
                  <textarea className={inp} rows={2} value={form.deploymentRestriction}
                    onChange={e=>set('deploymentRestriction',e.target.value)}
                    placeholder="Describe the restriction briefly" />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(3)}>← Back</button>
              <button className={btn} onClick={next}>Next: Compliance →</button>
            </div>
          </div>
        )}

        {/* SCREEN 5 — Compliance and Finance */}
        {screen === 5 && (
          <div className={card}>
            <div className={secHead}>Compliance and Finance</div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">BOCW Registration</div>
              <div className="text-xs text-gray-500 mb-3">Building and Other Construction Workers welfare fund registration</div>
              <div className="flex gap-4">
                <label className={radioRow}>
                  <input type="radio" name="bocw" checked={form.bocwRegistered}
                    onChange={()=>set('bocwRegistered',true)} />
                  <span className="text-sm">Yes — I am registered</span>
                </label>
                <label className={radioRow}>
                  <input type="radio" name="bocw" checked={!form.bocwRegistered}
                    onChange={()=>set('bocwRegistered',false)} />
                  <span className="text-sm">No</span>
                </label>
              </div>
              {form.bocwRegistered && (
                <div className="mt-3">
                  <label className={lbl}>BOCW Registration Number</label>
                  <input className={inp} value={form.bocw_number}
                    onChange={e=>set('bocw_number',e.target.value)} placeholder="BW/UP/..." />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>PF UAN Number</label>
                <input className={inp} value={form.pf_uan}
                  onChange={e=>set('pf_uan',e.target.value)} placeholder="12-digit UAN" />
              </div>
              <div>
                <label className={lbl}>ESIC IP Number</label>
                <input className={inp} value={form.esic_ip}
                  onChange={e=>set('esic_ip',e.target.value)} placeholder="ESIC number" />
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">Bank Account for Payment</div>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Account Number</label>
                  <input className={inp} value={form.bank_account}
                    onChange={e=>set('bank_account',e.target.value)} placeholder="Bank account number" />
                </div>
                <div>
                  <label className={lbl}>IFSC Code</label>
                  <input className={inp} value={form.ifsc_code}
                    onChange={e=>set('ifsc_code',e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234" maxLength={11} />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Emergency Contact</div>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Contact Name</label>
                  <input className={inp} value={form.emergency_name}
                    onChange={e=>set('emergency_name',e.target.value)} placeholder="Name of contact person" />
                </div>
                <div>
                  <label className={lbl}>Contact Phone</label>
                  <input className={inp} value={form.emergency_phone}
                    onChange={e=>set('emergency_phone',e.target.value)}
                    placeholder="10-digit number" maxLength={10} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(4)}>← Back</button>
              <button className={btn} onClick={next}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* SCREEN 6 — Declaration */}
        {screen === 6 && (
          <div className="space-y-4">
            <div className={card}>
              <div className={secHead}>Review Your Details</div>
              <div className="space-y-2 text-sm">
                {[
                  ['Name', form.fullName],
                  ['Phone', form.phone],
                  ['Email', form.email || '—'],
                  ['Gender', form.gender],
                  ['Aadhaar Last 4', form.aadhaarLast4 || '—'],
                  ['PAN', form.pan || '—'],
                  ['State', form.state],
                  ['District', form.district || '—'],
                  ['City', form.city || '—'],
                  ['Trade', tName],
                  ['Skill Level', form.skill_level.replace('_',' ')],
                  ['Sector', form.sector],
                  ['Employment', form.employment_type.replace('_',' ')],
                  ['Zones', form.zones.join(', ') || '—'],
                  ['Daily Wage', form.daily_wage ? '₹'+form.daily_wage : '—'],
                  ['Available', form.is_available ? 'Yes' : 'No'],
                  ['BOCW', form.bocwRegistered ? 'Registered' : 'Not Registered'],
                  ['Emergency Contact', form.emergency_name || '—'],
                ].map(([k,v]) => (
                  <div key={k} className="flex items-start gap-2 py-1 border-b border-gray-50">
                    <span className="text-gray-400 w-36 flex-shrink-0 text-xs font-medium">{k}</span>
                    <span className="text-gray-800 font-medium capitalize text-xs">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Address</span>
                  <span className="text-sm font-medium text-right">{form.address}, {form.city}, {form.pincode}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Labour Type</span>
                  <span className="text-sm font-medium">{form.labour_type}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Secondary Trades</span>
                  <span className="text-sm font-medium">{Array.isArray(form.secondaryTrades) && form.secondaryTrades.length > 0 ? form.secondaryTrades.join(', ') : 'None'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Years Experience</span>
                  <span className="text-sm font-medium">{form.years_experience}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Jobs Completed</span>
                  <span className="text-sm font-medium">{form.jobs_completed}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Hourly Rate</span>
                  <span className="text-sm font-medium">₹{form.hourly_rate}/hr</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">BOCW Number</span>
                  <span className="text-sm font-medium">{form.bocw_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">PF UAN</span>
                  <span className="text-sm font-medium">{form.pf_uan || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">ESIC IP</span>
                  <span className="text-sm font-medium">{form.esic_ip || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Bank Account</span>
                  <span className="text-sm font-medium">{form.bank_account}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">IFSC Code</span>
                  <span className="text-sm font-medium">{form.ifsc_code}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Emergency Phone</span>
                  <span className="text-sm font-medium">{form.emergency_phone}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Height Restriction</span>
                  <span className="text-sm font-medium">{form.height_restriction ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Dust Restriction</span>
                  <span className="text-sm font-medium">{form.dustRestriction ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Deployment Restriction</span>
                  <span className="text-sm font-medium">{form.deploymentRestriction || 'None'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Team Name</span>
                  <span className="text-sm font-medium">{form.team_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">Team Number</span>
                  <span className="text-sm font-medium">{form.teamNumber || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className={card}>
              <div className={secHead}>Declaration</div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 flex-shrink-0"
                  checked={form.declared} onChange={e=>set('declared',e.target.checked)} />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I declare that all information provided in this registration is true, accurate and complete to the best of my knowledge. I understand that providing false information may result in rejection of my application or termination from the platform.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer mt-3">
                <input type="checkbox" className="mt-0.5 flex-shrink-0"
                  checked={form.agreed} onChange={e=>set('agreed',e.target.checked)} />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I agree to Pro Engineering's Terms of Service, Code of Conduct, and Privacy Policy. I understand that I will be subject to competency assessment before being assigned to any job.
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(5)}>← Back</button>
              <button className={btn} onClick={submit} disabled={loading}>
                {loading ? 'Submitting...' : '✓ Submit Registration'}
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS SCREEN */}
        {screen === 7 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <div className="text-[#1F3864] font-bold text-xl mb-2">Registration Successful</div>
            <div className="text-gray-500 text-sm mb-6 leading-relaxed">
              Your registration has been received. Our coordinator will review your details and contact you within 24 hours.
            </div>
            <div className="bg-[#1F3864] rounded-xl p-4 mb-4 text-center">
              <div className="text-blue-200 text-xs mb-1 uppercase tracking-wide">Your Worker ID</div>
              <div className="text-white font-bold text-2xl tracking-widest">{workerCode}</div>
              <div className="text-blue-200 text-xs mt-1">Save this ID — you will need it for future reference</div>
            </div>
            {loginEmail && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-6 text-sm text-green-700">
                Platform login created: <strong>{loginEmail}</strong>. Ask your coordinator for the password.
              </div>
            )}
            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 text-sm text-red-700">
                Registration was saved, but the platform login account could not be created: {authError}. Contact your coordinator.
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-4 space-y-1 mt-4">
              <h3 className="font-semibold text-gray-700 mb-3">Registration Summary</h3>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Name</span>
                <span className="text-sm font-medium">{form.fullName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Phone</span>
                <span className="text-sm font-medium">+91 {form.phone}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Email</span>
                <span className="text-sm font-medium">{form.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Aadhaar Last 4</span>
                <span className="text-sm font-medium">XXXX-XXXX-{form.aadhaarLast4}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">PAN</span>
                <span className="text-sm font-medium">{form.pan || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">State</span>
                <span className="text-sm font-medium">{form.state}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">District</span>
                <span className="text-sm font-medium">{form.district}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Address</span>
                <span className="text-sm font-medium">{form.address}, {form.city}, {form.pincode}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Trade</span>
                <span className="text-sm font-medium">{tradeName(trade)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Skill Level</span>
                <span className="text-sm font-medium">{form.skill_level}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Sector</span>
                <span className="text-sm font-medium">{form.sector}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Labour Type</span>
                <span className="text-sm font-medium">{form.labour_type}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Employment Type</span>
                <span className="text-sm font-medium">{form.employment_type}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Secondary Trades</span>
                <span className="text-sm font-medium">{Array.isArray(form.secondaryTrades) && form.secondaryTrades.length > 0 ? form.secondaryTrades.join(', ') : 'None'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Years Experience</span>
                <span className="text-sm font-medium">{form.years_experience}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Jobs Completed</span>
                <span className="text-sm font-medium">{form.jobs_completed}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Zones</span>
                <span className="text-sm font-medium">{Array.isArray(form.zones) && form.zones.length > 0 ? form.zones.join(', ') : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Available</span>
                <span className="text-sm font-medium">{form.is_available ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Daily Wage</span>
                <span className="text-sm font-medium">₹{form.daily_wage}/day</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Hourly Rate</span>
                <span className="text-sm font-medium">₹{form.hourly_rate}/hr</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">BOCW Registered</span>
                <span className="text-sm font-medium">{form.bocwRegistered ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">BOCW Number</span>
                <span className="text-sm font-medium">{form.bocw_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">PF UAN</span>
                <span className="text-sm font-medium">{form.pf_uan || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">ESIC IP</span>
                <span className="text-sm font-medium">{form.esic_ip || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Bank Account</span>
                <span className="text-sm font-medium">{form.bank_account}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">IFSC Code</span>
                <span className="text-sm font-medium">{form.ifsc_code}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Emergency Contact</span>
                <span className="text-sm font-medium">{form.emergency_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Emergency Phone</span>
                <span className="text-sm font-medium">{form.emergency_phone}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Height Restriction</span>
                <span className="text-sm font-medium">{form.height_restriction ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Dust Restriction</span>
                <span className="text-sm font-medium">{form.dustRestriction ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Deployment Restriction</span>
                <span className="text-sm font-medium">{form.deploymentRestriction || 'None'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Team Name</span>
                <span className="text-sm font-medium">{form.team_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Team Number</span>
                <span className="text-sm font-medium">{form.teamNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Worker Code</span>
                <span className="text-sm font-medium">{workerCode}</span>
              </div>
            </div>
            <div className="space-y-3">
              <button className={btn} onClick={()=>router.push('/onboarding')}>
                Register Another Worker
              </button>
              <button className={btnOut} onClick={()=>router.push('/')}>
                Go to Home
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
