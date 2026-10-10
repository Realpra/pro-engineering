'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import content from '@/content/site-content.json'
import catalogue from '@/content/job-catalogue.json'
import { submitPartnerRegistration, type PartnerType, type SkillCount } from '../actions'
import { Choice, Field, FormError, Section, Select, SkillRows, SubmitButton, inputClass } from './form'
import { CoveragePicker, type Coverage } from './geo'

const p = content.partner
const pf = p.fields

const COPY = { team_head: p.teamHead, associate: p.associate, contractor: p.contractor }

const ENGAGEMENTS = [
  { value: 'lead_basis', label: pf.leadBasis },
  { value: 'sub_contractor', label: pf.subContractor },
  { value: 'labour_provider', label: pf.labourProvider },
]

const lumpSumJobs = (catalogue.trades as { lumpSum: { name: string; skills: string[] }[] }[]).flatMap(t => t.lumpSum)

export default function PartnerForm({ type }: { type: PartnerType }) {
  const copy = COPY[type]

  const [v, setV] = useState({
    fullName: '', phone: '', whatsappPhone: '', email: '',
    companyName: '', firmType: '', gstNumber: '', panNumber: '', yearEstablished: '',
    officeAddress: '', websiteLinks: '', socialLinks: '',
    yearsExperience: '', workKinds: '', largestJob: '', clientReferences: '',
    teamPackage: '', totalWorkers: '', commercialTerms: '', remarks: '',
  })
  const [teamBasis, setTeamBasis] = useState<'by_skill' | 'by_package' | ''>('')
  const [team, setTeam] = useState<SkillCount[]>([{ skill: '', count: 1 }])
  const [coverage, setCoverage] = useState<Coverage>({ state: '', districts: [], sectors: [] })
  const [engagementTypes, setEngagementTypes] = useState<string[]>([])
  const [declared, setDeclared] = useState(false)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV(prev => ({ ...prev, [key]: e.target.value }))
  const num = (s: string) => (s ? Number(s) : undefined)

  // A crew declared against a lump sum job starts from that job's usual skills.
  function selectPackage(name: string) {
    setV(prev => ({ ...prev, teamPackage: name }))
    const crew = lumpSumJobs.find(j => j.name === name)?.skills ?? []
    if (crew.length > 0) setTeam(crew.map(s => ({ skill: s, count: 1 })))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPending(true)
    const result = await submitPartnerRegistration({
      partnerType: type,
      ...v,
      yearEstablished: num(v.yearEstablished),
      yearsExperience: num(v.yearsExperience),
      totalWorkers: num(v.totalWorkers),
      teamBasis: teamBasis || undefined,
      teamComposition: team,
      ...coverage,
      engagementTypes,
      declared,
    })
    setPending(false)
    if (result.error) { setError(result.error); return }
    setDone(true)
    window.scrollTo({ top: 0 })
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-14">
        <CheckCircle2 className="w-12 h-12 text-green-700" aria-hidden />
        <h1 className="mt-4 text-3xl font-black">{p.success.title}</h1>
        <p className="mt-2 text-stone-600">{p.success.body}</p>
        <Link href="/" className="mt-8 inline-block px-4 py-2.5 bg-[#1F2328] text-white text-sm font-bold hover:bg-black">
          {p.success.home}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-10 space-y-5">
      <header>
        <div className="text-xs font-bold uppercase tracking-widest text-[#C2570C]">{p.eyebrow}</div>
        <h1 className="mt-2 text-3xl font-black">{copy.title}</h1>
        <p className="mt-2 text-stone-600">{copy.intro}</p>
        <div className="mt-5 bg-white border border-stone-200 border-l-4 border-l-[#F97316] p-5">
          <h2 className="font-black">{p.howTitle}</h2>
          <p className="mt-1 text-sm text-stone-700 leading-relaxed">{copy.how}</p>
        </div>
      </header>

      <Section step={1} title={p.sections.identity}>
        <Field label={pf.fullName}>
          <input type="text" autoComplete="name" value={v.fullName} onChange={set('fullName')} className={inputClass} />
        </Field>
        <Field label={pf.phone}>
          <input type="tel" autoComplete="tel" inputMode="numeric" value={v.phone} onChange={set('phone')} className={inputClass} />
        </Field>
        <Field label={pf.whatsappPhone} optional>
          <input type="tel" inputMode="numeric" value={v.whatsappPhone} onChange={set('whatsappPhone')} className={inputClass} />
        </Field>
        <Field label={pf.email} optional>
          <input type="email" autoComplete="email" value={v.email} onChange={set('email')} className={inputClass} />
        </Field>
      </Section>

      <Section step={2} title={p.sections.firm}>
        <Field label={pf.companyName} optional={type !== 'contractor'}>
          <input type="text" autoComplete="organization" value={v.companyName} onChange={set('companyName')} className={inputClass} />
        </Field>
        <Field label={pf.firmType} optional>
          <Select value={v.firmType} onChange={firmType => setV(prev => ({ ...prev, firmType }))} options={pf.firmTypes} />
        </Field>
        <Field label={pf.gstNumber} optional={type !== 'contractor'}>
          <input type="text" value={v.gstNumber} onChange={set('gstNumber')} className={inputClass} />
        </Field>
        <Field label={pf.panNumber} optional>
          <input type="text" value={v.panNumber} onChange={set('panNumber')} className={inputClass} />
        </Field>
        <Field label={pf.yearEstablished} optional>
          <input type="number" min={1950} max={2100} value={v.yearEstablished} onChange={set('yearEstablished')} className={inputClass} />
        </Field>
        <Field label={pf.websiteLinks} optional>
          <input type="text" value={v.websiteLinks} onChange={set('websiteLinks')} className={inputClass} />
        </Field>
        <Field label={pf.socialLinks} optional wide>
          <input type="text" value={v.socialLinks} onChange={set('socialLinks')} className={inputClass} />
        </Field>
        <Field label={pf.officeAddress} optional wide>
          <textarea rows={2} value={v.officeAddress} onChange={set('officeAddress')} className={inputClass} />
        </Field>
      </Section>

      <Section step={3} title={p.sections.experience}>
        <Field label={pf.yearsExperience}>
          <input type="number" min={0} max={70} value={v.yearsExperience} onChange={set('yearsExperience')} className={inputClass} />
        </Field>
        <Field label={pf.largestJob} optional>
          <input type="text" value={v.largestJob} onChange={set('largestJob')} className={inputClass} />
        </Field>
        <Field label={pf.workKinds} wide>
          <textarea rows={2} value={v.workKinds} onChange={set('workKinds')} className={inputClass} />
        </Field>
        <Field label={pf.clientReferences} optional wide>
          <textarea rows={2} value={v.clientReferences} onChange={set('clientReferences')} className={inputClass} />
        </Field>
      </Section>

      <Section step={4} title={p.sections.team}>
        <Field label={pf.teamBasis} wide group>
          <Choice value={teamBasis} onChange={setTeamBasis}
            options={[{ value: 'by_skill', label: pf.bySkill }, { value: 'by_package', label: pf.byPackage }]} />
        </Field>
        {teamBasis === 'by_package' && (
          <Field label={pf.teamPackage} wide>
            <Select value={v.teamPackage} onChange={selectPackage} options={lumpSumJobs.map(j => j.name)} />
          </Field>
        )}
        <Field label={pf.teamRows} wide group>
          <div className="grid"><SkillRows rows={team} onChange={setTeam} /></div>
        </Field>
        <Field label={pf.totalWorkers}>
          <input type="number" min={1} value={v.totalWorkers} onChange={set('totalWorkers')} className={inputClass} />
        </Field>
      </Section>

      <Section step={5} title={p.sections.coverage}>
        <CoveragePicker value={coverage} onChange={setCoverage}
          labels={{ state: pf.state, districts: pf.districts, sectors: pf.sectors }} />
      </Section>

      <Section step={6} title={p.sections.engagement}>
        <Field label={pf.engagementTypes} wide group>
          <div className="space-y-2">
            {ENGAGEMENTS.map(o => (
              <label key={o.value} className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="w-4 h-4 mt-0.5 accent-[#F97316]"
                  checked={engagementTypes.includes(o.value)}
                  onChange={() => setEngagementTypes(prev => prev.includes(o.value) ? prev.filter(x => x !== o.value) : [...prev, o.value])} />
                {o.label}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <Section step={7} title={p.sections.terms}>
        <Field label={pf.commercialTerms} optional wide>
          <textarea rows={2} value={v.commercialTerms} onChange={set('commercialTerms')} className={inputClass} />
        </Field>
        <Field label={pf.remarks} optional wide>
          <textarea rows={2} value={v.remarks} onChange={set('remarks')} className={inputClass} />
        </Field>
      </Section>

      <Section step={8} title={p.sections.declaration}>
        <label className="sm:col-span-2 flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="w-4 h-4 mt-0.5 accent-[#F97316]" checked={declared} onChange={e => setDeclared(e.target.checked)} />
          {pf.declared}
        </label>
      </Section>

      <FormError message={error} />
      <SubmitButton label={p.submit} pending={pending} />

      <p className="text-sm text-stone-600">
        <Link href="/onboarding" className="font-bold underline underline-offset-4 decoration-[#F97316] decoration-2">{p.workerLink}</Link>
      </p>
    </form>
  )
}
