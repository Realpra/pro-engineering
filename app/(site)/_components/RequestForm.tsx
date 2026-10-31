'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import content from '@/content/site-content.json'
import catalogue from '@/content/job-catalogue.json'
import { cn } from '@/lib/utils'
import { submitJobRequest, type RequestType, type SkillCount } from '../actions'
import { Choice, Field, FormError, Section, Select, SkillRows, SubmitButton, inputClass } from './form'
import { LocationPicker, type SiteLocation } from './geo'
import { ACCOUNT_PENDING_KEY } from './AccountReminder'

const f = content.forms
const trades = catalogue.trades as {
  name: string
  skills: { name: string; jobs: string[] }[]
  lumpSum: { name: string; skills: string[] }[]
}[]

const COPY = { one_day: f.oneDay, turn_key: f.turnKey, labour_bazaar: f.bulk }

function isoDate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

// The owner's rule for short jobs: a bar of seven days, starting today.
function nextSevenDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      value: isoDate(d),
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    }
  })
}

export default function RequestForm({ type }: { type: RequestType }) {
  const copy = COPY[type]

  const [trade, setTrade] = useState('')
  const [skill, setSkill] = useState('')
  const [jobType, setJobType] = useState('')
  const [lumpSumPackage, setLumpSumPackage] = useState('')
  const [withMaterial, setWithMaterial] = useState<'with' | 'without' | ''>('')
  const [workUnit, setWorkUnit] = useState<'full_day' | 'hours' | ''>('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [daySlot, setDaySlot] = useState<'forenoon' | 'afternoon' | ''>('')
  const [preferredDate, setPreferredDate] = useState('')
  const [durationDays, setDurationDays] = useState('')
  const [skillsRequired, setSkillsRequired] = useState<SkillCount[]>([{ skill: '', count: 1 }])
  const [scopeDescription, setScopeDescription] = useState('')
  const [location, setLocation] = useState<SiteLocation>({ state: '', district: '', sector: '' })
  const [address, setAddress] = useState('')
  const [firmName, setFirmName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ bookingRef: string; loginEmail?: string } | null>(null)

  // Dates are worked out in the browser only: the server runs in UTC, so
  // rendering "today" there would disagree with an Indian visitor's evening.
  const [days, setDays] = useState<ReturnType<typeof nextSevenDays>>([])
  const [today, setToday] = useState('')
  useEffect(() => {
    setDays(nextSevenDays())
    setToday(isoDate(new Date()))
  }, [])

  const tradeDef = trades.find(t => t.name === trade)
  const skillDef = tradeDef?.skills.find(s => s.name === skill)

  function selectTrade(name: string) {
    setTrade(name)
    setSkill('')
    setJobType('')
    setLumpSumPackage('')
  }

  // Owner's decided turn-key flow: trade > lump sum job > with/without material > date >
  // location. The client does not state personnel; Pro Engineering plans the crew.
  // (Fixed 31 Oct 2026: the skills-and-numbers step had been shown on lump sum too.)
  function selectPackage(name: string) {
    setLumpSumPackage(name)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const missing =
      (type === 'one_day' && (!skill || !jobType || !workUnit || !daySlot)) ||
      (type === 'one_day' && workUnit === 'hours' && (!timeFrom || !timeTo)) ||
      (type === 'turn_key' && (!lumpSumPackage || !withMaterial)) ||
      (type === 'labour_bazaar' && (!durationDays || !firmName.trim()))
    if (missing) { setError(f.missing); return }

    setPending(true)
    const result = await submitJobRequest({
      requestType: type,
      trade, skill, jobType, lumpSumPackage,
      withMaterial: withMaterial ? withMaterial === 'with' : undefined,
      workUnit: workUnit || undefined,
      timeFrom, timeTo,
      daySlot: daySlot || undefined,
      durationDays: durationDays ? Number(durationDays) : undefined,
      skillsRequired: type === 'turn_key' ? [] : skillsRequired, scopeDescription, preferredDate,
      ...location, address, firmName,
      contactName, contactPhone, contactEmail,
    })
    setPending(false)

    if (result.error || !result.bookingRef) { setError(result.error ?? ''); return }
    // Drives the "complete your account" bar until the client signs in.
    if (result.loginEmail) localStorage.setItem(ACCOUNT_PENDING_KEY, result.bookingRef)
    setDone({ bookingRef: result.bookingRef, loginEmail: result.loginEmail })
    window.scrollTo({ top: 0 })
  }

  if (done) {
    const s = f.success
    return (
      <div className="max-w-2xl mx-auto px-4 py-14">
        <CheckCircle2 className="w-12 h-12 text-green-700" aria-hidden />
        <h1 className="mt-4 text-3xl font-black">{s.title}</h1>
        <p className="mt-2 text-stone-600">{s.body}</p>

        <div className="mt-8 bg-[#1F2328] text-white p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-stone-400">{s.refLabel}</div>
          <div className="mt-1 text-3xl font-black font-mono tracking-widest text-[#F97316]">{done.bookingRef}</div>
          <div className="mt-2 text-sm text-stone-300">{s.refHint}</div>
        </div>

        <ul className="mt-6 space-y-2 text-sm text-stone-700">
          {[s.next1, s.next2, s.next3].map(n => (
            <li key={n} className="flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#C2570C]" aria-hidden />{n}</li>
          ))}
        </ul>

        {done.loginEmail && (
          <div className="mt-8 bg-white border border-stone-200 border-l-4 border-l-[#F97316] p-5">
            <h2 className="font-black">{s.accountTitle}</h2>
            <p className="mt-1 text-sm text-stone-600">{s.accountBody}</p>
            <div className="mt-3 bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-800">{s.devTitle}</div>
              <div className="font-mono text-amber-900 break-all">{done.loginEmail}</div>
              <div className="text-xs text-amber-800 mt-0.5">{s.devBody}</div>
            </div>
            <Link href="/client/login" className="mt-4 inline-block px-4 py-2.5 bg-[#1F2328] text-white text-sm font-bold hover:bg-black">
              {s.accountCta}
            </Link>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/#request" className="px-4 py-2.5 bg-[#F97316] text-[#1F2328] text-sm font-bold hover:bg-[#EA6A0C]">{s.another}</Link>
          <Link href="/" className="px-4 py-2.5 border-2 border-[#1F2328] text-sm font-bold hover:bg-[#1F2328] hover:text-white">{s.home}</Link>
        </div>
      </div>
    )
  }

  let step = 0
  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-10 space-y-5">
      <header className="mb-2">
        <div className="text-xs font-bold uppercase tracking-widest text-[#C2570C]">{content.request.eyebrow}</div>
        <h1 className="mt-2 text-3xl font-black">{copy.title}</h1>
        <p className="mt-2 text-stone-600">{copy.intro}</p>
      </header>

      <Section step={++step} title={f.sections.job}>
        {type === 'labour_bazaar' && (
          <Field label={f.fields.firmName} wide>
            <input type="text" value={firmName} onChange={e => setFirmName(e.target.value)} className={inputClass} />
          </Field>
        )}
        <Field label={f.fields.trade} wide={type !== 'turn_key'}>
          <Select value={trade} onChange={selectTrade} options={trades.map(t => t.name)} />
        </Field>
        {type === 'one_day' && (
          <>
            <Field label={f.fields.skill}>
              <Select value={skill} onChange={v => { setSkill(v); setJobType('') }} disabled={!tradeDef}
                options={tradeDef?.skills.map(s => s.name) ?? []} />
            </Field>
            <Field label={f.fields.jobType}>
              <Select value={jobType} onChange={setJobType} disabled={!skillDef} options={skillDef?.jobs ?? []} />
            </Field>
          </>
        )}
        {type === 'turn_key' && (
          <>
            <Field label={f.fields.lumpSumPackage}>
              <Select value={lumpSumPackage} onChange={selectPackage} disabled={!tradeDef}
                options={tradeDef?.lumpSum.map(p => p.name) ?? []} />
            </Field>
            <Field label={f.fields.material} wide group>
              <Choice value={withMaterial} onChange={setWithMaterial}
                options={[{ value: 'with', label: f.fields.withMaterial }, { value: 'without', label: f.fields.withoutMaterial }]} />
            </Field>
          </>
        )}
      </Section>

      <Section step={++step} title={f.sections.timing}>
        {type === 'one_day' ? (
          <>
            <Field label={f.fields.workUnit} wide group>
              <Choice value={workUnit} onChange={setWorkUnit}
                options={[{ value: 'full_day', label: f.fields.fullDay }, { value: 'hours', label: f.fields.hours }]} />
            </Field>
            {workUnit === 'hours' && (
              <>
                <Field label={f.fields.timeFrom}>
                  <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className={inputClass} />
                </Field>
                <Field label={f.fields.timeTo}>
                  <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className={inputClass} />
                </Field>
              </>
            )}
            <Field label={f.fields.daySlot} wide group>
              <Choice value={daySlot} onChange={setDaySlot}
                options={[{ value: 'forenoon', label: f.fields.forenoon }, { value: 'afternoon', label: f.fields.afternoon }]} />
            </Field>
            <Field label={f.fields.date} wide group>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {days.map(d => (
                  <button key={d.value} type="button" onClick={() => setPreferredDate(d.value)} aria-pressed={preferredDate === d.value}
                    className={cn(
                      'py-2 border-2 text-center',
                      preferredDate === d.value
                        ? 'bg-[#1F2328] border-[#1F2328] text-white'
                        : 'bg-white border-stone-300 hover:border-[#1F2328]',
                    )}>
                    <span className="block text-[11px] font-bold uppercase text-[#F97316]">{d.weekday}</span>
                    <span className="block text-sm font-bold">{d.day}</span>
                  </button>
                ))}
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label={f.fields.preferredDate} wide={type === 'turn_key'}>
              <input type="date" min={today} value={preferredDate} onChange={e => setPreferredDate(e.target.value)} className={inputClass} />
            </Field>
            {type === 'labour_bazaar' && (
              <Field label={f.fields.durationDays}>
                <input type="number" min={1} value={durationDays} onChange={e => setDurationDays(e.target.value)} className={inputClass} />
              </Field>
            )}
          </>
        )}
      </Section>

      {type !== 'turn_key' && (
        <Section step={++step} title={f.sections.skills}>
          <p className="sm:col-span-2 text-sm text-stone-600">{f.hints.skills}</p>
          <SkillRows rows={skillsRequired} onChange={setSkillsRequired} />
        </Section>
      )}

      <Section step={++step} title={f.sections.scope}>
        <Field label={f.fields.scope} wide>
          <textarea rows={4} value={scopeDescription} onChange={e => setScopeDescription(e.target.value)} className={inputClass} />
        </Field>
      </Section>

      <Section step={++step} title={f.sections.location}>
        <LocationPicker value={location} onChange={setLocation} />
        <Field label={f.fields.address} wide>
          <textarea rows={2} value={address} onChange={e => setAddress(e.target.value)} className={inputClass} />
        </Field>
      </Section>

      <Section step={++step} title={f.sections.contact}>
        <Field label={f.fields.contactName}>
          <input type="text" autoComplete="name" value={contactName} onChange={e => setContactName(e.target.value)} className={inputClass} />
        </Field>
        <Field label={f.fields.contactPhone} hint={f.hints.phone}>
          <input type="tel" autoComplete="tel" inputMode="numeric" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field label={f.fields.contactEmail} optional wide>
          <input type="email" autoComplete="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputClass} />
        </Field>
      </Section>

      <FormError message={error} />
      <SubmitButton label={copy.submit} pending={pending} />
    </form>
  )
}
