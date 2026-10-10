import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import content from '@/content/site-content.json'
import { Band, ButtonLink, PageHero } from '../_components/blocks'

const c = content.contactPage
const { contact } = content

const DETAILS = [
  { icon: Phone, label: c.phoneLabel, value: contact.phone },
  { icon: Mail, label: c.emailLabel, value: contact.email },
  { icon: MapPin, label: c.addressLabel, value: contact.address },
  { icon: Clock, label: c.hoursLabel, value: contact.hours },
]

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow={c.eyebrow} title={c.title} intro={c.intro} />
      <Band>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DETAILS.map(d => (
            <div key={d.label} className="bg-white border border-stone-200 p-5">
              <d.icon className="w-5 h-5 text-[#C2570C]" aria-hidden />
              <dt className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-500">{d.label}</dt>
              <dd className="mt-1 font-bold break-words">{d.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="bg-[#1F2328] text-white p-6">
            <h2 className="text-xl font-black">{c.requestTitle}</h2>
            <p className="mt-2 text-stone-300">{c.requestBody}</p>
            <div className="mt-5"><ButtonLink href="/#request">{content.header.ctaPost}</ButtonLink></div>
          </div>
          <div className="bg-white border border-stone-200 p-6">
            <h2 className="text-xl font-black">{c.workTitle}</h2>
            <p className="mt-2 text-stone-600">{c.workBody}</p>
            <div className="mt-5"><ButtonLink href="/#work" variant="dark">{content.header.ctaJoin}</ButtonLink></div>
          </div>
        </div>
      </Band>
    </>
  )
}
