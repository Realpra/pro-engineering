'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  submitWorkerRegistration, createWorkerAuthAccount, checkPhoneExists,
  getOnboardingReferenceData, getZoneSectorCoverage,
  saveSkillAnswers, saveSecondarySkills, saveAccidentHistory, uploadWorkerPhoto,
  type GeoNode, type RegistrationInput, type SecondarySkillInput, type AccidentIncidentInput,
} from './actions'
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
  'Mason','Plumber','Electrician','Waterproofer','Tiler','Painter',
  'Carpenter','False Ceiling Installer','Helper','Supervisor',
]

const SECTORS = [
  {v:'civil',l:'Civil'}, {v:'mep',l:'MEP (Mechanical, Electrical, Plumbing)'},
  {v:'interior',l:'Interior Works'}, {v:'false_roofing',l:'False Ceiling / Roofing'},
  {v:'painting',l:'Painting'}, {v:'wood_work',l:'Wood Work'},
  {v:'architecture',l:'Architecture'}, {v:'construction_pmc',l:'Construction / PMC'},
]

const LABOUR_TYPES = [
  {v:'skilled_trade',l:'Skilled Trade Worker'}, {v:'support_labour',l:'Support / Unskilled Labour'},
  {v:'specialist',l:'Specialist'}, {v:'supervisor',l:'Supervisor'}, {v:'coordinator',l:'Coordinator'},
]

const YEARS_EXP = [
  {v:'less_1',l:'Less than 1 year'}, {v:'1_3',l:'1 to 3 years'}, {v:'3_5',l:'3 to 5 years'},
  {v:'5_10',l:'5 to 10 years'}, {v:'10_plus',l:'More than 10 years'},
]

const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const PPE_ITEMS = ['Helmet','Safety Shoes','Gloves','Safety Glasses','Ear Protection','Reflective Vest','Dust Mask','Safety Harness']
const YES_NO_LIMITED = [{v:'yes',l:'Yes'},{v:'no',l:'No'},{v:'with_difficulty',l:'With Difficulty'}]
const RATING_LEVELS = [{v:'beginner',l:'Beginner'},{v:'competent',l:'Competent'},{v:'expert',l:'Expert'}]
const DAYS_PER_MONTH = [{v:'lt10',l:'Less than 10 days'},{v:'10_15',l:'10 to 15 days'},{v:'15_20',l:'15 to 20 days'},{v:'20_25',l:'20 to 25 days'},{v:'25_plus',l:'25+ days'}]
const NOTICE_PERIODS = [{v:'immediate',l:'Immediate'},{v:'1_week',l:'1 week'},{v:'2_weeks',l:'2 weeks'},{v:'1_month',l:'1 month'}]
const TEAM_SOLO = [{v:'team',l:'Team'},{v:'solo',l:'Solo'},{v:'either',l:'Either'}]
const SMARTPHONE_OPTS = [{v:'yes',l:'Yes, smartphone'},{v:'basic_phone',l:'Basic phone only'},{v:'no',l:'No phone'}]

// ─── Shared styles ───────────────────────────────────────────────────────────
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864] focus:border-transparent'
const sel = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide'
const req = <span className="text-red-500 ml-0.5">*</span>
const btn = 'w-full bg-[#1F3864] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#162c52] transition-colors disabled:opacity-50'
const btnOut = 'w-full border-2 border-[#1F3864] text-[#1F3864] font-bold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors'
const btnSm = 'text-xs font-bold text-[#1F3864] border border-[#1F3864] rounded-lg px-3 py-1.5 hover:bg-gray-50'
const btnSmDanger = 'text-xs font-bold text-red-600 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-50'
const secHead = 'text-[#1F3864] font-bold text-base mb-4 pb-2 border-b border-gray-100'
const card = 'bg-white rounded-2xl shadow-sm p-5 space-y-4'
const radioRow = 'flex items-center gap-2 cursor-pointer py-1'
const checkRow = 'flex items-center gap-2 cursor-pointer py-1'
const hint = 'text-xs text-gray-400 mt-1'

// ─── Small reusable field components ────────────────────────────────────────
function Text({label, value, onChange, placeholder, required, type='text', maxLength, help}:
  {label:string; value:string; onChange:(v:string)=>void; placeholder?:string; required?:boolean; type?:string; maxLength?:number; help?:string}) {
  return (
    <div>
      <label className={lbl}>{label}{required && req}</label>
      <input className={inp} type={type} value={value} maxLength={maxLength}
        onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
      {help && <p className={hint}>{help}</p>}
    </div>
  )
}

function Area({label, value, onChange, placeholder, rows=3, help}:
  {label:string; value:string; onChange:(v:string)=>void; placeholder?:string; rows?:number; help?:string}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <textarea className={inp} rows={rows} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
      {help && <p className={hint}>{help}</p>}
    </div>
  )
}

function Sel({label, value, onChange, options, required, placeholder}:
  {label:string; value:string; onChange:(v:string)=>void; options:{v:string;l:string}[]; required?:boolean; placeholder?:string}) {
  return (
    <div>
      <label className={lbl}>{label}{required && req}</label>
      <select className={sel} value={value} onChange={e=>onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

function YesNo({label, value, onChange, help}:
  {label:string; value:boolean; onChange:(v:boolean)=>void; help?:string}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className="flex gap-4 mt-1">
        <label className={radioRow}>
          <input type="radio" checked={value} onChange={()=>onChange(true)} />
          <span className="text-sm">Yes</span>
        </label>
        <label className={radioRow}>
          <input type="radio" checked={!value} onChange={()=>onChange(false)} />
          <span className="text-sm">No</span>
        </label>
      </div>
      {help && <p className={hint}>{help}</p>}
    </div>
  )
}

function CheckGroup({label, options, selected, onToggle, help}:
  {label:string; options:string[]; selected:string[]; onToggle:(v:string)=>void; help?:string}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      {help && <p className={hint + ' mb-2'}>{help}</p>}
      <div className="bg-gray-50 rounded-xl p-3 space-y-1 grid grid-cols-2 gap-x-2">
        {options.map(o => (
          <label key={o} className={checkRow}>
            <input type="checkbox" checked={selected.includes(o)} onChange={()=>onToggle(o)} />
            <span className="text-sm">{o}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Rating({label, value, onChange}: {label:string; value:number; onChange:(v:number)=>void}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className="flex gap-2">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={()=>onChange(n)}
            className={`w-9 h-9 rounded-full text-sm font-bold border-2 ${value===n ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-gray-400 border-gray-200'}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Form state — mirrors RegistrationInput field-for-field, plus UI-only
// additions (photos, repeatable child-table rows, geo picker scratch state) ─
type SecondarySkillDetail = { ratingLevel: string; jobsLast2yr: string; complexExample: string }
type WorkSamplePhoto = { dataUrl: string; caption: string }

type Form = {
  fullName: string; phone: string; email: string; aadhaarLast4: string; pan: string
  gender: string; dob: string; whatsappSame: boolean; whatsappPhone: string
  state: string; district: string; city: string; pincode: string; address: string
  accommodationType: string; transportMode: string; maxTravelMinutes: string
  sameDayNoticeZones: string[]; willingOutOfZoneOvernight: boolean
  unavailableWeekdays: string[]; seasonalUnavailableMonths: string[]
  zones: string[]; selfiePhoto: string

  skill_level: string; sector: string; labour_type: string; employment_type: string
  years_experience: string; jobs_completed: string
  yearsResidential: string; yearsCommercial: string; yearsInstitutional: string
  largestProjectDescription: string; largestProjectRole: string; maxWorkersSupervised: string
  mostDemandingJobDescription: string
  lastEmployerName: string; lastEmployerPhone: string; lastEmployerWorkType: string
  reasonLeftLastEmployer: string
  priorEmployerName: string; priorEmployerWorkType: string
  longestTenureMonths: string; priorPlatformExperience: string

  skillAnswers: Record<string, string>

  secondaryTrades: string[]; nextTrainingInterest: string
  secondarySkillDetails: Partial<Record<string, SecondarySkillDetail>>

  rejectedWorkHistory: string; standoutJobDescription: string; hasAppreciationCertificate: boolean
  selfRatedQualityScore: string; selfRatedQualityReason: string; qualityCheckMethod: string
  paymentDisputeHistory: string; askedToLeaveSiteHistory: string; differentiatorDescription: string
  workSamplePhotos: WorkSamplePhoto[]

  height_restriction: boolean; dustRestriction: boolean; otherRestriction: boolean
  otherRestrictionDetail: string; deploymentRestriction: string
  onMedicationAffectingAlertness: boolean; doctorRestrictedWorkType: string
  canCarry25kg50m: string; canKneelCrouch2hr: boolean; canWorkHeights2m: string
  canWorkConfinedSpaces: boolean; canWorkHighHeat8hr: boolean; wearsCorrectiveLenses: boolean

  hadFallFromHeight: boolean; fallFromHeightDetail: string
  hadElectricShock: boolean; electricShockDetail: string
  witnessedStructuralCollapse: boolean; structuralCollapseDetail: string
  chemicalInhalationTreatment: string; eyeInjuryHistory: string
  changedPracticeAfterIncident: string; witnessedOthersAccident: string
  reportedNearMiss: boolean; nearMissActedOn: boolean
  hasPermanentInjuryRestriction: boolean; permanentInjuryDetail: string
  accidentIncidents: AccidentIncidentInput[]

  daily_wage: string; hourly_rate: string; is_available: boolean
  currentlyEmployedElsewhere: boolean; willInformCurrentEmployer: boolean
  availableDaysPerMonth: string; willingOutputBasedPay: boolean
  prefersTeamOrSolo: string; hasRegularPartner: boolean
  partnerName: string; partnerTrade: string; partnerPhone: string; partnerSkillAssessment: string
  noticePeriodNeeded: string; availableEmergency4hr: boolean; emergencyPremiumPct: string
  willingSundaysHolidays: boolean; holidayPremiumPct: string

  ownsBasicTools: boolean; toolsList: string; toolsCalibrated: boolean
  ownsPowerTools: boolean; powerToolsList: string; ownsPpe: string[]
  ownsSmartphone: string; essentialTool1: string; essentialTool2: string
  hasReliableTransport1hr: boolean

  ratingTechnicalAccuracy: number; ratingSpeed: number; ratingDrawingComprehension: number
  ratingUnsupervisedDelivery: number; ratingProblemIdentification: number; ratingAsksForGuidance: number
  ratingPhysicalFitness: number; ratingReliability: number; ratingHonesty: number

  team_name: string; teamNumber: string
  bocwRegistered: boolean; bocw_number: string; pf_uan: string; esic_ip: string
  bank_account: string; ifsc_code: string; emergency_name: string; emergency_phone: string
  credentialType: 'registration' | 'permit_license' | 'not_applicable' | 'other' | ''
  credentialOtherDetail: string; credentialValidUpto: string

  reference1Name: string; reference1Phone: string; reference2Name: string; reference2Phone: string
  consentReferenceCheck: boolean; consentProfileSharing: boolean
  declared: boolean; agreed: boolean
}

const INIT: Form = {
  fullName:'', phone:'', email:'', aadhaarLast4:'', pan:'',
  gender:'male', dob:'', whatsappSame:true, whatsappPhone:'',
  state:'Uttar Pradesh', district:'', city:'', pincode:'', address:'',
  accommodationType:'', transportMode:'', maxTravelMinutes:'',
  sameDayNoticeZones:[], willingOutOfZoneOvernight:false,
  unavailableWeekdays:[], seasonalUnavailableMonths:[],
  zones:[], selfiePhoto:'',

  skill_level:'skilled', sector:'civil', labour_type:'skilled_trade', employment_type:'self',
  years_experience:'3_5', jobs_completed:'',
  yearsResidential:'', yearsCommercial:'', yearsInstitutional:'',
  largestProjectDescription:'', largestProjectRole:'', maxWorkersSupervised:'',
  mostDemandingJobDescription:'',
  lastEmployerName:'', lastEmployerPhone:'', lastEmployerWorkType:'', reasonLeftLastEmployer:'',
  priorEmployerName:'', priorEmployerWorkType:'', longestTenureMonths:'', priorPlatformExperience:'',

  skillAnswers:{},

  secondaryTrades:[], nextTrainingInterest:'', secondarySkillDetails:{},

  rejectedWorkHistory:'', standoutJobDescription:'', hasAppreciationCertificate:false,
  selfRatedQualityScore:'', selfRatedQualityReason:'', qualityCheckMethod:'',
  paymentDisputeHistory:'', askedToLeaveSiteHistory:'', differentiatorDescription:'',
  workSamplePhotos:[],

  height_restriction:false, dustRestriction:false, otherRestriction:false,
  otherRestrictionDetail:'', deploymentRestriction:'',
  onMedicationAffectingAlertness:false, doctorRestrictedWorkType:'',
  canCarry25kg50m:'yes', canKneelCrouch2hr:true, canWorkHeights2m:'yes',
  canWorkConfinedSpaces:true, canWorkHighHeat8hr:true, wearsCorrectiveLenses:false,

  hadFallFromHeight:false, fallFromHeightDetail:'',
  hadElectricShock:false, electricShockDetail:'',
  witnessedStructuralCollapse:false, structuralCollapseDetail:'',
  chemicalInhalationTreatment:'', eyeInjuryHistory:'',
  changedPracticeAfterIncident:'', witnessedOthersAccident:'',
  reportedNearMiss:false, nearMissActedOn:false,
  hasPermanentInjuryRestriction:false, permanentInjuryDetail:'',
  accidentIncidents:[],

  daily_wage:'', hourly_rate:'', is_available:true,
  currentlyEmployedElsewhere:false, willInformCurrentEmployer:true,
  availableDaysPerMonth:'20_25', willingOutputBasedPay:false,
  prefersTeamOrSolo:'either', hasRegularPartner:false,
  partnerName:'', partnerTrade:'', partnerPhone:'', partnerSkillAssessment:'',
  noticePeriodNeeded:'immediate', availableEmergency4hr:false, emergencyPremiumPct:'',
  willingSundaysHolidays:false, holidayPremiumPct:'',

  ownsBasicTools:true, toolsList:'', toolsCalibrated:false,
  ownsPowerTools:false, powerToolsList:'', ownsPpe:[],
  ownsSmartphone:'yes', essentialTool1:'', essentialTool2:'',
  hasReliableTransport1hr:true,

  ratingTechnicalAccuracy:0, ratingSpeed:0, ratingDrawingComprehension:0,
  ratingUnsupervisedDelivery:0, ratingProblemIdentification:0, ratingAsksForGuidance:0,
  ratingPhysicalFitness:0, ratingReliability:0, ratingHonesty:0,

  team_name:'', teamNumber:'',
  bocwRegistered:false, bocw_number:'', pf_uan:'', esic_ip:'',
  bank_account:'', ifsc_code:'', emergency_name:'', emergency_phone:'',
  credentialType:'', credentialOtherDetail:'', credentialValidUpto:'',

  reference1Name:'', reference1Phone:'', reference2Name:'', reference2Phone:'',
  consentReferenceCheck:false, consentProfileSharing:false,
  declared:false, agreed:false,
}

const TOTAL = 14
const SCREEN_TITLES = [
  '', 'Personal Identity', 'Address, Zones & Logistics', 'Trade & Employment History',
  'Trade Skill Assessment', 'Multi-Skilling', 'Quality & Track Record',
  'Health & Physical Capability', 'Accident & Safety History', 'Availability & Preferences',
  'Tools & Equipment', 'Self-Assessment Ratings', 'Compliance & Finance',
  'References & Declaration', 'Review & Submit',
]

export default function TradeOnboardingPage() {
  const params = useParams()
  const router = useRouter()
  const trade = (params.trade as string) ?? ''
  const tName = tradeName(trade)

  const [screen, setScreen] = useState(1)
  const [skillPage, setSkillPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [workerCode, setWorkerCode] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [authError, setAuthError] = useState('')
  const [postSaveWarnings, setPostSaveWarnings] = useState<string[]>([])
  const [form, setForm] = useState<Form>(INIT)

  const [geo, setGeo] = useState<GeoNode[]>([])
  const [skillQuestions, setSkillQuestions] = useState<{id:string; question_code:string; question_text:string; display_order:number}[]>([])
  const skillChunks: typeof skillQuestions[] = []
  for (let i = 0; i < skillQuestions.length; i += 5) skillChunks.push(skillQuestions.slice(i, i + 5))
  const skillPageSafe = Math.min(skillPage, Math.max(skillChunks.length - 1, 0))
  const skillPageVisible = skillChunks[skillPageSafe] ?? []
  const skillIsLastPage = skillPageSafe >= skillChunks.length - 1
  const [districtId, setDistrictId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [sectorCoverage, setSectorCoverage] = useState<Record<string, {id:string; name:string}[]>>({})

  useEffect(() => {
    getOnboardingReferenceData(trade).then(r => {
      setGeo(r.geo)
      setSkillQuestions(r.skillQuestions)
    })
  }, [trade])

  const districts = geo.filter(g => g.level === 'district')
  const regions = geo.filter(g => g.level === 'region' && (!districtId || g.parent_id === districtId))
  const zoneNodes = geo.filter(g => g.level === 'zone' && (!regionId || g.parent_id === regionId))

  function set<K extends keyof Form>(k: K, v: Form[K]) { setForm(f => ({...f, [k]: v})) }

  function toggleArr(k: 'secondaryTrades' | 'zones' | 'sameDayNoticeZones' | 'unavailableWeekdays' | 'seasonalUnavailableMonths' | 'ownsPpe', v: string) {
    setForm(f => ({
      ...f,
      [k]: (f[k] as string[]).includes(v) ? (f[k] as string[]).filter(x => x !== v) : [...(f[k] as string[]), v]
    }))
  }

  async function onZoneToggle(zoneName: string, zoneId: string) {
    toggleArr('zones', zoneName)
    if (!sectorCoverage[zoneId]) {
      const sectors = await getZoneSectorCoverage(zoneId)
      setSectorCoverage(sc => ({...sc, [zoneId]: sectors}))
    }
  }

  function setSecondarySkillDetail(trade: string, patch: Partial<SecondarySkillDetail>) {
    setForm(f => ({
      ...f,
      secondarySkillDetails: {
        ...f.secondarySkillDetails,
        [trade]: { ratingLevel:'competent', jobsLast2yr:'', complexExample:'', ...f.secondarySkillDetails[trade], ...patch }
      }
    }))
  }

  function addAccident() {
    setForm(f => ({...f, accidentIncidents: [...f.accidentIncidents, { incidentYear: undefined, injuryDescription:'', cause:'', wasHospitalized:false, fullRecovery:true }]}))
  }
  function updateAccident(i: number, patch: Partial<AccidentIncidentInput>) {
    setForm(f => ({...f, accidentIncidents: f.accidentIncidents.map((a,idx) => idx===i ? {...a, ...patch} : a)}))
  }
  function removeAccident(i: number) {
    setForm(f => ({...f, accidentIncidents: f.accidentIncidents.filter((_,idx) => idx!==i)}))
  }

  function addWorkSample() {
    setForm(f => ({...f, workSamplePhotos: [...f.workSamplePhotos, {dataUrl:'', caption:''}]}))
  }
  async function setWorkSampleFile(i: number, file: File) {
    const dataUrl = await readAsDataUrl(file)
    setForm(f => ({...f, workSamplePhotos: f.workSamplePhotos.map((w,idx) => idx===i ? {...w, dataUrl} : w)}))
  }
  function setWorkSampleCaption(i: number, caption: string) {
    setForm(f => ({...f, workSamplePhotos: f.workSamplePhotos.map((w,idx) => idx===i ? {...w, caption} : w)}))
  }
  function removeWorkSample(i: number) {
    setForm(f => ({...f, workSamplePhotos: f.workSamplePhotos.filter((_,idx) => idx!==i)}))
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
      if (form.zones.length === 0) return setError('Select at least one work zone')
    }
    setScreen(s => s + 1)
  }

  async function submit() {
    setError('')
    if (!form.declared || !form.agreed) return setError('Please accept both declarations')
    setLoading(true)
    try {
      const payload: RegistrationInput = {
        fullName: form.fullName, phone: form.phone, email: form.email || undefined,
        aadhaarLast4: form.aadhaarLast4 || undefined, pan: form.pan || undefined,
        gender: form.gender || undefined, dob: form.dob || undefined,
        whatsappSame: form.whatsappSame, whatsappPhone: form.whatsappSame ? undefined : (form.whatsappPhone || undefined),
        state: form.state, district: form.district || undefined, city: form.city || undefined,
        pincode: form.pincode || undefined, address: form.address || undefined,
        accommodationType: form.accommodationType || undefined, transportMode: form.transportMode || undefined,
        maxTravelMinutes: form.maxTravelMinutes ? Number(form.maxTravelMinutes) : undefined,
        sameDayNoticeZones: form.sameDayNoticeZones.length ? form.sameDayNoticeZones : undefined,
        willingOutOfZoneOvernight: form.willingOutOfZoneOvernight,
        unavailableWeekdays: form.unavailableWeekdays.length ? form.unavailableWeekdays : undefined,
        seasonalUnavailableMonths: form.seasonalUnavailableMonths.length ? form.seasonalUnavailableMonths : undefined,
        zones: form.zones,

        skill_level: form.skill_level, sector: form.sector, labour_type: form.labour_type,
        employment_type: form.employment_type,
        years_experience: form.years_experience || undefined,
        jobs_completed: form.jobs_completed ? Number(form.jobs_completed) : undefined,
        yearsResidential: form.yearsResidential ? Number(form.yearsResidential) : undefined,
        yearsCommercial: form.yearsCommercial ? Number(form.yearsCommercial) : undefined,
        yearsInstitutional: form.yearsInstitutional ? Number(form.yearsInstitutional) : undefined,
        largestProjectDescription: form.largestProjectDescription || undefined,
        largestProjectRole: form.largestProjectRole || undefined,
        maxWorkersSupervised: form.maxWorkersSupervised ? Number(form.maxWorkersSupervised) : undefined,
        mostDemandingJobDescription: form.mostDemandingJobDescription || undefined,
        lastEmployerName: form.lastEmployerName || undefined, lastEmployerPhone: form.lastEmployerPhone || undefined,
        lastEmployerWorkType: form.lastEmployerWorkType || undefined,
        reasonLeftLastEmployer: form.reasonLeftLastEmployer || undefined,
        priorEmployerName: form.priorEmployerName || undefined, priorEmployerWorkType: form.priorEmployerWorkType || undefined,
        longestTenureMonths: form.longestTenureMonths ? Number(form.longestTenureMonths) : undefined,
        priorPlatformExperience: form.priorPlatformExperience || undefined,

        secondaryTrades: form.secondaryTrades, nextTrainingInterest: form.nextTrainingInterest || undefined,

        rejectedWorkHistory: form.rejectedWorkHistory || undefined,
        standoutJobDescription: form.standoutJobDescription || undefined,
        hasAppreciationCertificate: form.hasAppreciationCertificate,
        selfRatedQualityScore: form.selfRatedQualityScore ? Number(form.selfRatedQualityScore) : undefined,
        selfRatedQualityReason: form.selfRatedQualityReason || undefined,
        qualityCheckMethod: form.qualityCheckMethod || undefined,
        paymentDisputeHistory: form.paymentDisputeHistory || undefined,
        askedToLeaveSiteHistory: form.askedToLeaveSiteHistory || undefined,
        differentiatorDescription: form.differentiatorDescription || undefined,

        height_restriction: form.height_restriction, dustRestriction: form.dustRestriction,
        otherRestriction: form.otherRestriction, otherRestrictionDetail: form.otherRestrictionDetail || undefined,
        deploymentRestriction: form.deploymentRestriction || undefined,
        onMedicationAffectingAlertness: form.onMedicationAffectingAlertness,
        doctorRestrictedWorkType: form.doctorRestrictedWorkType || undefined,
        canCarry25kg50m: form.canCarry25kg50m || undefined, canKneelCrouch2hr: form.canKneelCrouch2hr,
        canWorkHeights2m: form.canWorkHeights2m || undefined, canWorkConfinedSpaces: form.canWorkConfinedSpaces,
        canWorkHighHeat8hr: form.canWorkHighHeat8hr, wearsCorrectiveLenses: form.wearsCorrectiveLenses,

        hadFallFromHeight: form.hadFallFromHeight, fallFromHeightDetail: form.fallFromHeightDetail || undefined,
        hadElectricShock: form.hadElectricShock, electricShockDetail: form.electricShockDetail || undefined,
        witnessedStructuralCollapse: form.witnessedStructuralCollapse,
        structuralCollapseDetail: form.structuralCollapseDetail || undefined,
        chemicalInhalationTreatment: form.chemicalInhalationTreatment || undefined,
        eyeInjuryHistory: form.eyeInjuryHistory || undefined,
        changedPracticeAfterIncident: form.changedPracticeAfterIncident || undefined,
        witnessedOthersAccident: form.witnessedOthersAccident || undefined,
        reportedNearMiss: form.reportedNearMiss, nearMissActedOn: form.nearMissActedOn,
        hasPermanentInjuryRestriction: form.hasPermanentInjuryRestriction,
        permanentInjuryDetail: form.permanentInjuryDetail || undefined,

        daily_wage: form.daily_wage ? Number(form.daily_wage) : undefined,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : undefined,
        is_available: form.is_available,
        currentlyEmployedElsewhere: form.currentlyEmployedElsewhere,
        willInformCurrentEmployer: form.willInformCurrentEmployer,
        availableDaysPerMonth: form.availableDaysPerMonth || undefined,
        willingOutputBasedPay: form.willingOutputBasedPay,
        prefersTeamOrSolo: form.prefersTeamOrSolo || undefined, hasRegularPartner: form.hasRegularPartner,
        partnerName: form.partnerName || undefined, partnerTrade: form.partnerTrade || undefined,
        partnerPhone: form.partnerPhone || undefined, partnerSkillAssessment: form.partnerSkillAssessment || undefined,
        noticePeriodNeeded: form.noticePeriodNeeded || undefined, availableEmergency4hr: form.availableEmergency4hr,
        emergencyPremiumPct: form.emergencyPremiumPct ? Number(form.emergencyPremiumPct) : undefined,
        willingSundaysHolidays: form.willingSundaysHolidays,
        holidayPremiumPct: form.holidayPremiumPct ? Number(form.holidayPremiumPct) : undefined,

        ownsBasicTools: form.ownsBasicTools, toolsList: form.toolsList || undefined,
        toolsCalibrated: form.toolsCalibrated, ownsPowerTools: form.ownsPowerTools,
        powerToolsList: form.powerToolsList || undefined, ownsPpe: form.ownsPpe.length ? form.ownsPpe : undefined,
        ownsSmartphone: form.ownsSmartphone || undefined, essentialTool1: form.essentialTool1 || undefined,
        essentialTool2: form.essentialTool2 || undefined, hasReliableTransport1hr: form.hasReliableTransport1hr,

        ratingTechnicalAccuracy: form.ratingTechnicalAccuracy || undefined, ratingSpeed: form.ratingSpeed || undefined,
        ratingDrawingComprehension: form.ratingDrawingComprehension || undefined,
        ratingUnsupervisedDelivery: form.ratingUnsupervisedDelivery || undefined,
        ratingProblemIdentification: form.ratingProblemIdentification || undefined,
        ratingAsksForGuidance: form.ratingAsksForGuidance || undefined,
        ratingPhysicalFitness: form.ratingPhysicalFitness || undefined, ratingReliability: form.ratingReliability || undefined,
        ratingHonesty: form.ratingHonesty || undefined,

        team_name: form.team_name || undefined, teamNumber: form.teamNumber || undefined,
        bocwRegistered: form.bocwRegistered, bocw_number: form.bocw_number || undefined,
        pf_uan: form.pf_uan || undefined, esic_ip: form.esic_ip || undefined,
        bank_account: form.bank_account || undefined, ifsc_code: form.ifsc_code || undefined,
        emergency_name: form.emergency_name || undefined, emergency_phone: form.emergency_phone || undefined,
        credentialType: form.credentialType || undefined,
        credentialOtherDetail: form.credentialType === 'other' ? (form.credentialOtherDetail || undefined) : undefined,
        credentialValidUpto: form.credentialType === 'not_applicable' || !form.credentialType ? undefined : (form.credentialValidUpto || undefined),

        reference1Name: form.reference1Name || undefined, reference1Phone: form.reference1Phone || undefined,
        reference2Name: form.reference2Name || undefined, reference2Phone: form.reference2Phone || undefined,
        consentReferenceCheck: form.consentReferenceCheck, consentProfileSharing: form.consentProfileSharing,
        declared: form.declared, agreed: form.agreed,
      }

      const result = await submitWorkerRegistration(trade, payload)
      if ('error' in result) {
        console.error('Registration error:', result.error)
        setError(result.error)
        return
      }
      setWorkerCode(result.workerCode)
      const workerId = result.workerId
      const warnings: string[] = []

      if (workerId) {
        const [authResult, skillResult, secondaryResult, accidentResult] = await Promise.all([
          createWorkerAuthAccount(trade, form.fullName, workerId, result.workerCode),
          saveSkillAnswers(workerId, trade, form.skillAnswers),
          saveSecondarySkills(workerId, form.secondaryTrades.map((t): SecondarySkillInput => ({
            skillName: t,
            ratingLevel: form.secondarySkillDetails[t]?.ratingLevel || 'competent',
            jobsLast2yr: form.secondarySkillDetails[t]?.jobsLast2yr ? Number(form.secondarySkillDetails[t]!.jobsLast2yr) : undefined,
            complexExample: form.secondarySkillDetails[t]?.complexExample || undefined,
          }))),
          saveAccidentHistory(workerId, form.accidentIncidents),
        ])
        if ('error' in authResult) { console.error('Auth account creation failed:', authResult.error); setAuthError(authResult.error) }
        else { setLoginEmail(authResult.loginEmail) }
        if ('error' in skillResult) warnings.push('Skill assessment answers: ' + skillResult.error)
        if ('error' in secondaryResult) warnings.push('Secondary skills: ' + secondaryResult.error)
        if ('error' in accidentResult) warnings.push('Accident history: ' + accidentResult.error)

        if (form.selfiePhoto) {
          const photoResult = await uploadWorkerPhoto(workerId, form.selfiePhoto, 'selfie.jpg', 'selfie')
          if ('error' in photoResult) warnings.push('Selfie photo: ' + photoResult.error)
        }
        for (const sample of form.workSamplePhotos) {
          if (!sample.dataUrl) continue
          const photoResult = await uploadWorkerPhoto(workerId, sample.dataUrl, 'work-sample.jpg', 'work_sample')
          if ('error' in photoResult) warnings.push('Work sample photo: ' + photoResult.error)
        }
      }
      setPostSaveWarnings(warnings)
      setScreen(TOTAL + 1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] py-5 px-4 sticky top-0 z-10">
        <div className="text-white font-bold text-lg text-center">PRO ENGINEERING</div>
        <div className="text-blue-200 text-xs text-center mt-0.5">{tName} — Worker Registration</div>
      </div>

      {screen <= TOTAL && (
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#1F3864]">Step {screen} of {TOTAL}</span>
            <span className="text-xs text-gray-500">{SCREEN_TITLES[screen]}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-[#F97316] h-1.5 rounded-full transition-all duration-300" style={{width: `${(screen/TOTAL)*100}%`}} />
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-5 pb-10">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-start gap-2">
            <span className="mt-0.5">⚠️</span><span>{error}</span>
          </div>
        )}

        {/* SCREEN 1 — Personal Identity */}
        {screen === 1 && (
          <div className={card}>
            <div className={secHead}>Personal Identity</div>
            <Text label="Full Name" required value={form.fullName} onChange={v=>set('fullName',v)} placeholder="As per Aadhaar card" />
            <div className="grid grid-cols-2 gap-3">
              <Sel label="Gender" value={form.gender} onChange={v=>set('gender',v)}
                options={[{v:'male',l:'Male'},{v:'female',l:'Female'},{v:'other',l:'Other'}]} />
              <Text label="Date of Birth" type="date" value={form.dob} onChange={v=>set('dob',v)} />
            </div>
            <Text label="Mobile Number" required value={form.phone} onChange={v=>set('phone',v)} placeholder="10-digit mobile number" maxLength={10} />
            <div>
              <label className={lbl}>WhatsApp Number</label>
              <label className={checkRow}>
                <input type="checkbox" checked={form.whatsappSame} onChange={e=>set('whatsappSame',e.target.checked)} />
                <span className="text-sm text-gray-600">Same as mobile number</span>
              </label>
              {!form.whatsappSame && (
                <input className={inp} value={form.whatsappPhone} onChange={e=>set('whatsappPhone',e.target.value)} placeholder="WhatsApp number" maxLength={10} />
              )}
            </div>
            <Text label="Email Address" required type="email" value={form.email} onChange={v=>set('email',v)}
              placeholder="Your own contact email" help="Used for contact — your platform login is generated separately once approved" />
            <div className="grid grid-cols-2 gap-3">
              <Text label="Aadhaar Last 4 Digits" value={form.aadhaarLast4} onChange={v=>set('aadhaarLast4',v)} placeholder="XXXX" maxLength={4} />
              <Text label="PAN Number" value={form.pan} onChange={v=>set('pan',v.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
            </div>
            <div>
              <label className={lbl}>Selfie Photo</label>
              <input className={inp} type="file" accept="image/*" capture="user"
                onChange={async e => { const f = e.target.files?.[0]; if (f) set('selfiePhoto', await readAsDataUrl(f)) }} />
              {form.selfiePhoto && <img src={form.selfiePhoto} alt="Selfie preview" className="mt-2 w-20 h-20 rounded-full object-cover border border-gray-200" />}
              <p className={hint}>Used for identity verification on site</p>
            </div>
            <button className={btn} onClick={next}>Next: Address & Zones →</button>
          </div>
        )}

        {/* SCREEN 2 — Address, Zones & Logistics */}
        {screen === 2 && (
          <div className={card}>
            <div className={secHead}>Address, Zones & Logistics</div>
            <Sel label="State" required value={form.state} onChange={v=>set('state',v)} options={INDIAN_STATES.map(s=>({v:s,l:s}))} placeholder="Select State" />
            <div className="grid grid-cols-2 gap-3">
              <Text label="District (free text)" value={form.district} onChange={v=>set('district',v)} placeholder="e.g. Gautam Buddha Nagar" />
              <Text label="City / Town" value={form.city} onChange={v=>set('city',v)} placeholder="e.g. Noida" />
            </div>
            <Text label="PIN Code" value={form.pincode} onChange={v=>set('pincode',v)} placeholder="6-digit PIN code" maxLength={6} />
            <Area label="Current Address" value={form.address} onChange={v=>set('address',v)} placeholder="House / flat number, street, locality" />

            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">Work Zone Picker (District → Region → Zone)</div>
              <div>
                <label className={lbl}>District</label>
                <select className={sel} value={districtId} onChange={e=>{ setDistrictId(e.target.value); setRegionId('') }}>
                  <option value="">Select District</option>
                  {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {districtId && (
                <div>
                  <label className={lbl}>Region</label>
                  <select className={sel} value={regionId} onChange={e=>setRegionId(e.target.value)}>
                    <option value="">Select Region</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              {regionId && zoneNodes.length > 0 && (
                <div>
                  <label className={lbl}>Zones {req}</label>
                  <p className={hint + ' mb-2'}>Select every zone you can work in — a zone can serve multiple sectors by proximity</p>
                  <div className="bg-white rounded-xl p-3 space-y-2">
                    {zoneNodes.map(z => (
                      <div key={z.id}>
                        <label className={checkRow}>
                          <input type="checkbox" checked={form.zones.includes(z.name)} onChange={()=>onZoneToggle(z.name, z.id)} />
                          <span className="text-sm font-medium">{z.name}</span>
                        </label>
                        {form.zones.includes(z.name) && sectorCoverage[z.id]?.length > 0 && (
                          <div className="ml-6 text-xs text-gray-400">Covers: {sectorCoverage[z.id].map(s=>s.name).join(', ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {form.zones.length === 0 && <p className="text-xs text-amber-600">No zones seeded yet? Select a district then region above to reveal zones.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Sel label="Accommodation Type" value={form.accommodationType} onChange={v=>set('accommodationType',v)}
                options={[{v:'own_home',l:'Own Home'},{v:'rented',l:'Rented'},{v:'site_provided',l:'Site-Provided'},{v:'shared',l:'Shared with Team'}]} placeholder="Select" />
              <Sel label="Transport Mode" value={form.transportMode} onChange={v=>set('transportMode',v)}
                options={[{v:'walk',l:'Walk'},{v:'cycle',l:'Cycle'},{v:'two_wheeler',l:'Two-Wheeler'},{v:'public_transport',l:'Public Transport'},{v:'four_wheeler',l:'Four-Wheeler'}]} placeholder="Select" />
            </div>
            <Text label="Max Travel Time to Site (minutes)" type="number" value={form.maxTravelMinutes} onChange={v=>set('maxTravelMinutes',v)} placeholder="e.g. 45" />
            <CheckGroup label="Same-Day-Notice Zones" options={form.zones} selected={form.sameDayNoticeZones}
              onToggle={v=>toggleArr('sameDayNoticeZones',v)} help="From your selected zones, which can you reach on same-day notice?" />
            <YesNo label="Willing to Work Out-of-Zone Overnight?" value={form.willingOutOfZoneOvernight} onChange={v=>set('willingOutOfZoneOvernight',v)} />
            <CheckGroup label="Weekdays Unavailable" options={WEEKDAYS} selected={form.unavailableWeekdays} onToggle={v=>toggleArr('unavailableWeekdays',v)} />
            <CheckGroup label="Seasonally Unavailable Months" options={MONTHS} selected={form.seasonalUnavailableMonths} onToggle={v=>toggleArr('seasonalUnavailableMonths',v)} />

            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(1)}>← Back</button>
              <button className={btn} onClick={next}>Next: Trade History →</button>
            </div>
          </div>
        )}

        {/* SCREEN 3 — Trade & Employment History */}
        {screen === 3 && (
          <div className={card}>
            <div className={secHead}>Trade & Employment History</div>
            <div>
              <label className={lbl}>Primary Trade {req}</label>
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-sm font-bold text-orange-700">{tName}</div>
              <p className={hint}>To change trade go back to the trade selector</p>
            </div>
            <Sel label="Skill Level" required value={form.skill_level} onChange={v=>set('skill_level',v)}
              options={[{v:'unskilled',l:'Unskilled'},{v:'semi_skilled',l:'Semi-Skilled'},{v:'skilled',l:'Skilled'},{v:'highly_skilled',l:'Highly Skilled'}]} />
            <Sel label="Job Sector / Vertical" required value={form.sector} onChange={v=>set('sector',v)} options={SECTORS} />
            <Sel label="Labour Type" required value={form.labour_type} onChange={v=>set('labour_type',v)} options={LABOUR_TYPES} />
            <Sel label="Employment Classification" required value={form.employment_type} onChange={v=>set('employment_type',v)}
              options={[{v:'self',l:'Self Employed'},{v:'associate',l:'Associate'},{v:'sub_contractor',l:'Sub Contractor'}]} />
            <div className="grid grid-cols-2 gap-3">
              <Sel label="Years of Experience" value={form.years_experience} onChange={v=>set('years_experience',v)} options={YEARS_EXP} />
              <Text label="Jobs Completed in Trade" type="number" value={form.jobs_completed} onChange={v=>set('jobs_completed',v)} placeholder="Approx count" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Text label="Years — Residential" type="number" value={form.yearsResidential} onChange={v=>set('yearsResidential',v)} />
              <Text label="Years — Commercial" type="number" value={form.yearsCommercial} onChange={v=>set('yearsCommercial',v)} />
              <Text label="Years — Institutional" type="number" value={form.yearsInstitutional} onChange={v=>set('yearsInstitutional',v)} />
            </div>
            <Area label="Largest Project — Description" value={form.largestProjectDescription} onChange={v=>set('largestProjectDescription',v)} />
            <div className="grid grid-cols-2 gap-3">
              <Text label="Your Role On It" value={form.largestProjectRole} onChange={v=>set('largestProjectRole',v)} />
              <Text label="Max Workers You've Supervised" type="number" value={form.maxWorkersSupervised} onChange={v=>set('maxWorkersSupervised',v)} />
            </div>
            <Area label="Most Demanding Job You've Handled" value={form.mostDemandingJobDescription} onChange={v=>set('mostDemandingJobDescription',v)} />
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Last Employer</div>
              <Text label="Name" value={form.lastEmployerName} onChange={v=>set('lastEmployerName',v)} />
              <div className="grid grid-cols-2 gap-3">
                <Text label="Phone" value={form.lastEmployerPhone} onChange={v=>set('lastEmployerPhone',v)} maxLength={10} />
                <Text label="Type of Work" value={form.lastEmployerWorkType} onChange={v=>set('lastEmployerWorkType',v)} />
              </div>
              <Text label="Reason for Leaving" value={form.reasonLeftLastEmployer} onChange={v=>set('reasonLeftLastEmployer',v)} />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Prior Employer</div>
              <Text label="Name" value={form.priorEmployerName} onChange={v=>set('priorEmployerName',v)} />
              <div className="grid grid-cols-2 gap-3">
                <Text label="Type of Work" value={form.priorEmployerWorkType} onChange={v=>set('priorEmployerWorkType',v)} />
                <Text label="Longest Tenure (months)" type="number" value={form.longestTenureMonths} onChange={v=>set('longestTenureMonths',v)} />
              </div>
            </div>
            <Area label="Prior Platform / Marketplace Experience" value={form.priorPlatformExperience} onChange={v=>set('priorPlatformExperience',v)} />
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(2)}>← Back</button>
              <button className={btn} onClick={next}>Next: Skill Assessment →</button>
            </div>
          </div>
        )}

        {/* SCREEN 4 — Trade Skill Assessment (paginated 5-per-page, project owner's decision,
            2 Oct 2026: every page is skippable, none of these answers are mandatory) */}
        {screen === 4 && (
          <div className={card}>
            <div className={secHead}>Trade Skill Assessment — {tName}</div>
            <p className={hint}>Answer briefly in your own words if you can. None of these are required — skip any or all.</p>
            {skillChunks.length > 1 && (
              <p className="text-xs text-gray-400">
                Questions {skillPageSafe * 5 + 1}–{skillPageSafe * 5 + skillPageVisible.length} of {skillQuestions.length}
              </p>
            )}
            {skillQuestions.length === 0 && (
              <p className="text-sm text-gray-400">No skill questions are set up for {tName} yet — you can continue without answering.</p>
            )}
            {skillPageVisible.map(q => (
              <Area key={q.id} label={q.question_text} value={form.skillAnswers[q.question_code] || ''}
                onChange={v => setForm(f => ({...f, skillAnswers: {...f.skillAnswers, [q.question_code]: v}}))} rows={2} />
            ))}
            <div className="flex gap-3 flex-wrap">
              <button className={btnOut} onClick={() => skillPageSafe > 0 ? setSkillPage(skillPageSafe - 1) : setScreen(3)}>← Back</button>
              {skillPageSafe > 0 && (
                <button className={btnOut} onClick={() => setSkillPage(0)}>⟲ Back to First</button>
              )}
              <button className={btn} onClick={() => skillIsLastPage ? next() : setSkillPage(skillPageSafe + 1)}>
                {skillIsLastPage
                  ? 'SKIP — Next: Multi-Skilling →'
                  : `SKIP — Next ${Math.min(5, skillQuestions.length - (skillPageSafe + 1) * 5)} Questions →`}
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 5 — Multi-Skilling */}
        {screen === 5 && (
          <div className={card}>
            <div className={secHead}>Multi-Skilling</div>
            <CheckGroup label="Secondary Trades (select all that apply)" options={TRADES.filter(t=>t!==tName)}
              selected={form.secondaryTrades} onToggle={v=>toggleArr('secondaryTrades',v)} />
            {form.secondaryTrades.map(t => {
              const d = form.secondarySkillDetails[t] || { ratingLevel:'competent', jobsLast2yr:'', complexExample:'' }
              return (
                <div key={t} className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">{t}</div>
                  <Sel label="Self-Rated Level" value={d.ratingLevel} onChange={v=>setSecondarySkillDetail(t,{ratingLevel:v})} options={RATING_LEVELS} />
                  <Text label="Jobs Done in Last 2 Years" type="number" value={d.jobsLast2yr} onChange={v=>setSecondarySkillDetail(t,{jobsLast2yr:v})} />
                  <Area label="Describe a Complex Job You Did" value={d.complexExample} onChange={v=>setSecondarySkillDetail(t,{complexExample:v})} rows={2} />
                </div>
              )
            })}
            <Text label="Interested In Training For" value={form.nextTrainingInterest} onChange={v=>set('nextTrainingInterest',v)} placeholder="e.g. Waterproofing" />
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(4)}>← Back</button>
              <button className={btn} onClick={next}>Next: Quality & Track Record →</button>
            </div>
          </div>
        )}

        {/* SCREEN 6 — Quality & Track Record */}
        {screen === 6 && (
          <div className={card}>
            <div className={secHead}>Quality & Track Record</div>
            <Area label="Any Work Ever Rejected or Redone? Describe" value={form.rejectedWorkHistory} onChange={v=>set('rejectedWorkHistory',v)} />
            <Area label="A Job You're Proud Of" value={form.standoutJobDescription} onChange={v=>set('standoutJobDescription',v)} />
            <YesNo label="Do You Have an Appreciation Certificate?" value={form.hasAppreciationCertificate} onChange={v=>set('hasAppreciationCertificate',v)} />
            <div className="grid grid-cols-2 gap-3">
              <Text label="Self-Rated Quality (1-10)" type="number" value={form.selfRatedQualityScore} onChange={v=>set('selfRatedQualityScore',v)} />
              <Text label="Why That Score?" value={form.selfRatedQualityReason} onChange={v=>set('selfRatedQualityReason',v)} />
            </div>
            <Text label="How Do You Check Your Own Work?" value={form.qualityCheckMethod} onChange={v=>set('qualityCheckMethod',v)} />
            <Area label="Any Payment Disputes? Describe" value={form.paymentDisputeHistory} onChange={v=>set('paymentDisputeHistory',v)} />
            <Area label="Ever Asked to Leave a Site? Describe" value={form.askedToLeaveSiteHistory} onChange={v=>set('askedToLeaveSiteHistory',v)} />
            <Area label="What Makes Your Work Different From Others?" value={form.differentiatorDescription} onChange={v=>set('differentiatorDescription',v)} />
            <div>
              <label className={lbl}>Work Sample Photos</label>
              {form.workSamplePhotos.map((w,i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 mb-2 space-y-2">
                  <input className={inp} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) setWorkSampleFile(i, f) }} />
                  {w.dataUrl && <img src={w.dataUrl} alt="Work sample" className="w-full h-32 object-cover rounded-lg" />}
                  <input className={inp} value={w.caption} onChange={e=>setWorkSampleCaption(i, e.target.value)} placeholder="Caption (what job is this?)" />
                  <button type="button" className={btnSmDanger} onClick={()=>removeWorkSample(i)}>Remove</button>
                </div>
              ))}
              <button type="button" className={btnSm} onClick={addWorkSample}>+ Add Work Sample Photo</button>
            </div>
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(5)}>← Back</button>
              <button className={btn} onClick={next}>Next: Health & Capability →</button>
            </div>
          </div>
        )}

        {/* SCREEN 7 — Health & Physical Capability */}
        {screen === 7 && (
          <div className={card}>
            <div className={secHead}>Health & Physical Capability</div>
            <div className="bg-amber-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">Physical Restrictions</div>
              <p className={hint}>These are recorded and carried forward with your onboarding request to every approval level</p>
              <label className={checkRow}>
                <input type="checkbox" checked={form.height_restriction} onChange={e=>set('height_restriction',e.target.checked)} />
                <span className="text-sm">I cannot work at heights (above 10 feet)</span>
              </label>
              <label className={checkRow}>
                <input type="checkbox" checked={form.dustRestriction} onChange={e=>set('dustRestriction',e.target.checked)} />
                <span className="text-sm">I have a dust / respiratory restriction</span>
              </label>
              <label className={checkRow}>
                <input type="checkbox" checked={form.otherRestriction} onChange={e=>set('otherRestriction',e.target.checked)} />
                <span className="text-sm">Other restriction</span>
              </label>
              {form.otherRestriction && (
                <Text label="Describe Other Restriction" value={form.otherRestrictionDetail} onChange={v=>set('otherRestrictionDetail',v)} />
              )}
              {(form.height_restriction || form.dustRestriction || form.otherRestriction) && (
                <Area label="Overall Restriction Notes" value={form.deploymentRestriction} onChange={v=>set('deploymentRestriction',v)} rows={2} />
              )}
            </div>
            <YesNo label="On Medication Affecting Alertness?" value={form.onMedicationAffectingAlertness} onChange={v=>set('onMedicationAffectingAlertness',v)} />
            {form.onMedicationAffectingAlertness && (
              <Text label="Doctor-Restricted Work Type" value={form.doctorRestrictedWorkType} onChange={v=>set('doctorRestrictedWorkType',v)} />
            )}
            <Sel label="Can You Carry 25kg for 50m?" value={form.canCarry25kg50m} onChange={v=>set('canCarry25kg50m',v)} options={YES_NO_LIMITED} />
            <YesNo label="Can You Kneel / Crouch for 2 Hours?" value={form.canKneelCrouch2hr} onChange={v=>set('canKneelCrouch2hr',v)} />
            <Sel label="Can You Work at Heights Above 2m?" value={form.canWorkHeights2m} onChange={v=>set('canWorkHeights2m',v)} options={YES_NO_LIMITED} />
            <YesNo label="Can You Work in Confined Spaces?" value={form.canWorkConfinedSpaces} onChange={v=>set('canWorkConfinedSpaces',v)} />
            <YesNo label="Can You Work in High Heat for 8 Hours?" value={form.canWorkHighHeat8hr} onChange={v=>set('canWorkHighHeat8hr',v)} />
            <YesNo label="Do You Wear Corrective Lenses?" value={form.wearsCorrectiveLenses} onChange={v=>set('wearsCorrectiveLenses',v)} />
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(6)}>← Back</button>
              <button className={btn} onClick={next}>Next: Accident History →</button>
            </div>
          </div>
        )}

        {/* SCREEN 8 — Accident & Safety History */}
        {screen === 8 && (
          <div className={card}>
            <div className={secHead}>Accident & Safety History</div>
            <YesNo label="Have You Ever Fallen From a Height?" value={form.hadFallFromHeight} onChange={v=>set('hadFallFromHeight',v)} />
            {form.hadFallFromHeight && <Area label="Describe" value={form.fallFromHeightDetail} onChange={v=>set('fallFromHeightDetail',v)} rows={2} />}
            <YesNo label="Have You Had an Electric Shock?" value={form.hadElectricShock} onChange={v=>set('hadElectricShock',v)} />
            {form.hadElectricShock && <Area label="Describe" value={form.electricShockDetail} onChange={v=>set('electricShockDetail',v)} rows={2} />}
            <YesNo label="Witnessed a Structural Collapse?" value={form.witnessedStructuralCollapse} onChange={v=>set('witnessedStructuralCollapse',v)} />
            {form.witnessedStructuralCollapse && <Area label="Describe" value={form.structuralCollapseDetail} onChange={v=>set('structuralCollapseDetail',v)} rows={2} />}
            <Text label="Any Chemical Inhalation Treatment?" value={form.chemicalInhalationTreatment} onChange={v=>set('chemicalInhalationTreatment',v)} />
            <Text label="Any Eye Injury History?" value={form.eyeInjuryHistory} onChange={v=>set('eyeInjuryHistory',v)} />
            <Area label="Did an Incident Change How You Work?" value={form.changedPracticeAfterIncident} onChange={v=>set('changedPracticeAfterIncident',v)} rows={2} />
            <Area label="Ever Witnessed Someone Else's Accident?" value={form.witnessedOthersAccident} onChange={v=>set('witnessedOthersAccident',v)} rows={2} />
            <YesNo label="Have You Ever Reported a Near-Miss?" value={form.reportedNearMiss} onChange={v=>set('reportedNearMiss',v)} />
            {form.reportedNearMiss && <YesNo label="Was It Acted On?" value={form.nearMissActedOn} onChange={v=>set('nearMissActedOn',v)} />}
            <YesNo label="Do You Have a Permanent Injury Restriction?" value={form.hasPermanentInjuryRestriction} onChange={v=>set('hasPermanentInjuryRestriction',v)} />
            {form.hasPermanentInjuryRestriction && <Area label="Describe" value={form.permanentInjuryDetail} onChange={v=>set('permanentInjuryDetail',v)} rows={2} />}

            <div>
              <label className={lbl}>Past Accident / Incident Log</label>
              {form.accidentIncidents.map((a,i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 mb-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inp} type="number" placeholder="Year" value={a.incidentYear ?? ''} onChange={e=>updateAccident(i,{incidentYear: e.target.value ? Number(e.target.value) : undefined})} />
                    <input className={inp} placeholder="Cause" value={a.cause ?? ''} onChange={e=>updateAccident(i,{cause: e.target.value})} />
                  </div>
                  <textarea className={inp} rows={2} placeholder="Injury description" value={a.injuryDescription ?? ''} onChange={e=>updateAccident(i,{injuryDescription: e.target.value})} />
                  <div className="flex gap-4">
                    <label className={checkRow}><input type="checkbox" checked={!!a.wasHospitalized} onChange={e=>updateAccident(i,{wasHospitalized: e.target.checked})} /><span className="text-sm">Hospitalized</span></label>
                    <label className={checkRow}><input type="checkbox" checked={!!a.fullRecovery} onChange={e=>updateAccident(i,{fullRecovery: e.target.checked})} /><span className="text-sm">Full Recovery</span></label>
                  </div>
                  <button type="button" className={btnSmDanger} onClick={()=>removeAccident(i)}>Remove</button>
                </div>
              ))}
              <button type="button" className={btnSm} onClick={addAccident}>+ Add Incident</button>
            </div>
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(7)}>← Back</button>
              <button className={btn} onClick={next}>Next: Availability →</button>
            </div>
          </div>
        )}

        {/* SCREEN 9 — Availability & Preferences */}
        {screen === 9 && (
          <div className={card}>
            <div className={secHead}>Availability & Preferences</div>
            <div className="grid grid-cols-2 gap-3">
              <Text label="Expected Daily Wage ₹" type="number" value={form.daily_wage} onChange={v=>set('daily_wage',v)} placeholder="Per day in ₹" />
              <Text label="Hourly Rate ₹" type="number" value={form.hourly_rate} onChange={v=>set('hourly_rate',v)} placeholder="Per hour in ₹" />
            </div>
            <YesNo label="Available for Work Right Now?" value={form.is_available} onChange={v=>set('is_available',v)} />
            <YesNo label="Currently Employed Elsewhere?" value={form.currentlyEmployedElsewhere} onChange={v=>set('currentlyEmployedElsewhere',v)} />
            {form.currentlyEmployedElsewhere && <YesNo label="Will Inform Current Employer?" value={form.willInformCurrentEmployer} onChange={v=>set('willInformCurrentEmployer',v)} />}
            <Sel label="Available Days Per Month" value={form.availableDaysPerMonth} onChange={v=>set('availableDaysPerMonth',v)} options={DAYS_PER_MONTH} />
            <YesNo label="Willing to Work on Output-Based Pay?" value={form.willingOutputBasedPay} onChange={v=>set('willingOutputBasedPay',v)} />
            <Sel label="Prefer Team or Solo Work?" value={form.prefersTeamOrSolo} onChange={v=>set('prefersTeamOrSolo',v)} options={TEAM_SOLO} />
            <YesNo label="Do You Have a Regular Work Partner?" value={form.hasRegularPartner} onChange={v=>set('hasRegularPartner',v)} />
            {form.hasRegularPartner && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <Text label="Partner Name" value={form.partnerName} onChange={v=>set('partnerName',v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Text label="Partner Trade" value={form.partnerTrade} onChange={v=>set('partnerTrade',v)} />
                  <Text label="Partner Phone" value={form.partnerPhone} onChange={v=>set('partnerPhone',v)} maxLength={10} />
                </div>
                <Text label="Your Assessment of Partner's Skill" value={form.partnerSkillAssessment} onChange={v=>set('partnerSkillAssessment',v)} />
              </div>
            )}
            <Sel label="Notice Period Needed" value={form.noticePeriodNeeded} onChange={v=>set('noticePeriodNeeded',v)} options={NOTICE_PERIODS} />
            <YesNo label="Available on 4-Hour Emergency Call?" value={form.availableEmergency4hr} onChange={v=>set('availableEmergency4hr',v)} />
            {form.availableEmergency4hr && <Text label="Emergency Premium % Expected" type="number" value={form.emergencyPremiumPct} onChange={v=>set('emergencyPremiumPct',v)} />}
            <YesNo label="Willing to Work Sundays / Holidays?" value={form.willingSundaysHolidays} onChange={v=>set('willingSundaysHolidays',v)} />
            {form.willingSundaysHolidays && <Text label="Holiday Premium % Expected" type="number" value={form.holidayPremiumPct} onChange={v=>set('holidayPremiumPct',v)} />}
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(8)}>← Back</button>
              <button className={btn} onClick={next}>Next: Tools & Equipment →</button>
            </div>
          </div>
        )}

        {/* SCREEN 10 — Tools & Equipment */}
        {screen === 10 && (
          <div className={card}>
            <div className={secHead}>Tools & Equipment</div>
            <YesNo label="Own Basic Hand Tools?" value={form.ownsBasicTools} onChange={v=>set('ownsBasicTools',v)} />
            {form.ownsBasicTools && <Text label="List Your Basic Tools" value={form.toolsList} onChange={v=>set('toolsList',v)} />}
            <YesNo label="Are Your Tools Calibrated / In Good Condition?" value={form.toolsCalibrated} onChange={v=>set('toolsCalibrated',v)} />
            <YesNo label="Own Power Tools?" value={form.ownsPowerTools} onChange={v=>set('ownsPowerTools',v)} />
            {form.ownsPowerTools && <Text label="List Your Power Tools" value={form.powerToolsList} onChange={v=>set('powerToolsList',v)} />}
            <CheckGroup label="PPE You Own" options={PPE_ITEMS} selected={form.ownsPpe} onToggle={v=>toggleArr('ownsPpe',v)} />
            <Sel label="Smartphone?" value={form.ownsSmartphone} onChange={v=>set('ownsSmartphone',v)} options={SMARTPHONE_OPTS} />
            <Text label="A Measuring Tool You Own for Your Trade" value={form.essentialTool1} onChange={v=>set('essentialTool1',v)}
              placeholder="e.g. 5m measuring tape, vernier calipers, laser distance meter…" />
            <Text label="A Leveling/Precision Tool You Own for Your Trade" value={form.essentialTool2} onChange={v=>set('essentialTool2',v)}
              placeholder="e.g. 600mm spirit level, plumb bob, multimeter…" />
            <YesNo label="Reliable Transport Within 1 Hour of Site?" value={form.hasReliableTransport1hr} onChange={v=>set('hasReliableTransport1hr',v)} />
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(9)}>← Back</button>
              <button className={btn} onClick={next}>Next: Self-Assessment →</button>
            </div>
          </div>
        )}

        {/* SCREEN 11 — Self-Assessment Ratings */}
        {screen === 11 && (
          <div className={card}>
            <div className={secHead}>Self-Assessment Ratings (1 = Low, 5 = High)</div>
            <Rating label="Technical Accuracy" value={form.ratingTechnicalAccuracy} onChange={v=>set('ratingTechnicalAccuracy',v)} />
            <Rating label="Speed of Work" value={form.ratingSpeed} onChange={v=>set('ratingSpeed',v)} />
            <Rating label="Drawing / Design Comprehension" value={form.ratingDrawingComprehension} onChange={v=>set('ratingDrawingComprehension',v)} />
            <Rating label="Ability to Deliver Unsupervised" value={form.ratingUnsupervisedDelivery} onChange={v=>set('ratingUnsupervisedDelivery',v)} />
            <Rating label="Problem Identification" value={form.ratingProblemIdentification} onChange={v=>set('ratingProblemIdentification',v)} />
            <Rating label="Asks for Guidance When Needed" value={form.ratingAsksForGuidance} onChange={v=>set('ratingAsksForGuidance',v)} />
            <Rating label="Physical Fitness" value={form.ratingPhysicalFitness} onChange={v=>set('ratingPhysicalFitness',v)} />
            <Rating label="Reliability" value={form.ratingReliability} onChange={v=>set('ratingReliability',v)} />
            <Rating label="Honesty" value={form.ratingHonesty} onChange={v=>set('ratingHonesty',v)} />
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(10)}>← Back</button>
              <button className={btn} onClick={next}>Next: Compliance & Finance →</button>
            </div>
          </div>
        )}

        {/* SCREEN 12 — Compliance & Finance */}
        {screen === 12 && (
          <div className={card}>
            <div className={secHead}>Compliance and Finance</div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">BOCW Registration</div>
              <div className="text-xs text-gray-500 mb-3">Building and Other Construction Workers welfare fund registration</div>
              <YesNo label="" value={form.bocwRegistered} onChange={v=>set('bocwRegistered',v)} />
              {form.bocwRegistered && <Text label="BOCW Registration Number" value={form.bocw_number} onChange={v=>set('bocw_number',v)} placeholder="BW/UP/..." />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Text label="PF UAN Number" value={form.pf_uan} onChange={v=>set('pf_uan',v)} placeholder="12-digit UAN" />
              <Text label="ESIC IP Number" value={form.esic_ip} onChange={v=>set('esic_ip',v)} placeholder="ESIC number" />
            </div>
            <div className="bg-green-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-green-700 uppercase tracking-wide">Bank Account for Payment</div>
              <Text label="Account Number" value={form.bank_account} onChange={v=>set('bank_account',v)} />
              <Text label="IFSC Code" value={form.ifsc_code} onChange={v=>set('ifsc_code',v.toUpperCase())} placeholder="e.g. SBIN0001234" maxLength={11} />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Emergency Contact</div>
              <Text label="Contact Name" value={form.emergency_name} onChange={v=>set('emergency_name',v)} />
              <Text label="Contact Phone" value={form.emergency_phone} onChange={v=>set('emergency_phone',v)} maxLength={10} />
            </div>
            <Text label="Team Name (if part of a team)" value={form.team_name} onChange={v=>set('team_name',v)} placeholder="Team or contractor name" />
            <Text label="Team Number" value={form.teamNumber} onChange={v=>set('teamNumber',v)} placeholder="Team / sub-contract code"
              help="If you're onboarding through a sub-contractor, or as part of a whole team ready for full job deployment, enter the team's number here to link every team member together." />
            <div className="bg-amber-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">Trade Credential Validity</div>
              <div className="text-xs text-gray-500">
                If your trade requires a government registration, permit, or license, record it here
                so its validity is tracked for you and for whoever approves your onboarding.
              </div>
              <Sel label="Credential Type" value={form.credentialType} onChange={v=>set('credentialType', v as Form['credentialType'])}
                options={[{v:'registration',l:'Registration'},{v:'permit_license',l:'Permit / License'},{v:'not_applicable',l:'Not Applicable'},{v:'other',l:'Other'}]}
                placeholder="Select…" />
              {form.credentialType === 'other' && (
                <Text label="Describe the Credential" value={form.credentialOtherDetail} onChange={v=>set('credentialOtherDetail',v)} />
              )}
              {(form.credentialType === 'registration' || form.credentialType === 'permit_license' || form.credentialType === 'other') && (
                <Text label="Valid Upto" type="date" value={form.credentialValidUpto} onChange={v=>set('credentialValidUpto',v)} />
              )}
            </div>
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(11)}>← Back</button>
              <button className={btn} onClick={next}>Next: References →</button>
            </div>
          </div>
        )}

        {/* SCREEN 13 — References & Declaration */}
        {screen === 13 && (
          <div className={card}>
            <div className={secHead}>References & Declaration</div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Reference 1</div>
              <Text label="Name" value={form.reference1Name} onChange={v=>set('reference1Name',v)} />
              <Text label="Phone" value={form.reference1Phone} onChange={v=>set('reference1Phone',v)} maxLength={10} />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Reference 2</div>
              <Text label="Name" value={form.reference2Name} onChange={v=>set('reference2Name',v)} />
              <Text label="Phone" value={form.reference2Phone} onChange={v=>set('reference2Phone',v)} maxLength={10} />
            </div>
            <label className={checkRow}>
              <input type="checkbox" checked={form.consentReferenceCheck} onChange={e=>set('consentReferenceCheck',e.target.checked)} />
              <span className="text-sm text-gray-600">I consent to my references being contacted for verification</span>
            </label>
            <label className={checkRow}>
              <input type="checkbox" checked={form.consentProfileSharing} onChange={e=>set('consentProfileSharing',e.target.checked)} />
              <span className="text-sm text-gray-600">I consent to my profile being shared with clients for job matching</span>
            </label>
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(12)}>← Back</button>
              <button className={btn} onClick={next}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* SCREEN 14 — Review & Submit */}
        {screen === 14 && (
          <div className="space-y-4">
            <div className={card}>
              <div className={secHead}>Review Your Details</div>
              <div className="space-y-2 text-sm">
                {[
                  ['Name', form.fullName], ['Phone', form.phone], ['Email', form.email || '—'],
                  ['Gender', form.gender], ['State', form.state], ['City', form.city || '—'],
                  ['Trade', tName], ['Skill Level', form.skill_level.replace('_',' ')],
                  ['Zones', form.zones.join(', ') || '—'], ['Daily Wage', form.daily_wage ? '₹'+form.daily_wage : '—'],
                  ['Available', form.is_available ? 'Yes' : 'No'],
                  ['Secondary Trades', form.secondaryTrades.join(', ') || 'None'],
                  ['BOCW', form.bocwRegistered ? 'Registered' : 'Not Registered'],
                  ['Height Restriction', form.height_restriction ? 'Yes' : 'No'],
                  ['Dust Restriction', form.dustRestriction ? 'Yes' : 'No'],
                  ['Other Restriction', form.otherRestriction ? (form.otherRestrictionDetail || 'Yes') : 'No'],
                  ['Team Number', form.teamNumber || 'N/A'],
                  ['Work Samples Attached', String(form.workSamplePhotos.filter(w=>w.dataUrl).length)],
                  ['Selfie Attached', form.selfiePhoto ? 'Yes' : 'No'],
                ].map(([k,v]) => (
                  <div key={k} className="flex items-start gap-2 py-1 border-b border-gray-50">
                    <span className="text-gray-400 w-40 flex-shrink-0 text-xs font-medium">{k}</span>
                    <span className="text-gray-800 font-medium text-xs">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={card}>
              <div className={secHead}>Declaration</div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 flex-shrink-0" checked={form.declared} onChange={e=>set('declared',e.target.checked)} />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I declare that all information provided in this registration is true, accurate and complete to the best of my knowledge. I understand that providing false information may result in rejection of my application or termination from the platform.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer mt-3">
                <input type="checkbox" className="mt-0.5 flex-shrink-0" checked={form.agreed} onChange={e=>set('agreed',e.target.checked)} />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I agree to Pro Engineering's Terms of Service, Code of Conduct, and Privacy Policy. I understand that I will be subject to competency assessment before being assigned to any job.
                </span>
              </label>
            </div>
            <div className="flex gap-3">
              <button className={btnOut} onClick={()=>setScreen(13)}>← Back</button>
              <button className={btn} onClick={submit} disabled={loading}>{loading ? 'Submitting...' : '✓ Submit Registration'}</button>
            </div>
          </div>
        )}

        {/* SUCCESS SCREEN */}
        {screen === TOTAL + 1 && (
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
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4 text-sm text-green-700">
                Platform login created: <strong>{loginEmail}</strong>. Ask your coordinator for the password.
              </div>
            )}
            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
                Registration was saved, but the platform login account could not be created: {authError}. Contact your coordinator.
              </div>
            )}
            {postSaveWarnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700 text-left">
                <div className="font-semibold mb-1">Registration was saved, but a few extra details didn't:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {postSaveWarnings.map((w,i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <div className="space-y-3">
              <button className={btn} onClick={()=>{ setForm(INIT); setScreen(1); setWorkerCode(''); setLoginEmail(''); setAuthError(''); setPostSaveWarnings([]) }}>
                Register Another Worker
              </button>
              <button className={btnOut} onClick={()=>router.push('/')}>Go to Home</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
