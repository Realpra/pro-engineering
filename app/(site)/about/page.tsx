import Link from 'next/link'
import { ArrowRight, Check, Phone } from 'lucide-react'
import content from '@/content/site-content.json'
import { Band, ButtonLink, PageHero, SectionHead } from '../_components/blocks'

const a = content.about
const { contact } = content

const LINKS = [
  { ...a.links.values, href: '/about/values' },
  { ...a.links.safety, href: '/about/values#safety' },
  { ...a.links.story, href: '#story' },
  { ...a.links.testimonials, href: '#testimonials' },
  { ...a.links.partners, href: '#partners' },
]

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow={a.eyebrow} title={a.title} intro={a.intro} />

      <section className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 grid sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-stone-200">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className="group py-5 lg:px-5 first:lg:pl-0">
              <div className="flex items-center gap-1.5 font-black">
                {l.title} <ArrowRight className="w-4 h-4 text-[#C2570C] group-hover:translate-x-1 transition-transform" aria-hidden />
              </div>
              <p className="mt-1 text-sm text-stone-600">{l.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <Band>
        <p className="max-w-3xl text-lg leading-relaxed text-stone-700">{a.description}</p>
      </Band>

      <Band tone="white">
        <SectionHead title={a.whyTitle} intro={a.whyIntro} />
        <ol className="grid gap-x-10 gap-y-4 md:grid-cols-2 max-w-4xl">
          {a.why.map((item, i) => (
            <li key={item} className="flex gap-3">
              <span className="w-7 h-7 shrink-0 bg-[#1F2328] text-[#F97316] text-xs font-black flex items-center justify-center tabular-nums">{i + 1}</span>
              <span className="font-bold pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </Band>

      <Band>
        <SectionHead title={a.supportTitle} />
        <div className="grid gap-5 md:grid-cols-3">
          {a.support.map(s => (
            <div key={s.title} className="bg-white border border-stone-200 border-t-4 border-t-[#F97316] p-5">
              <div className="flex items-center gap-2 font-black"><Check className="w-4 h-4 text-[#C2570C]" aria-hidden /> {s.title}</div>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="white" id="story">
        <SectionHead title={a.storyTitle} />
        <p className="max-w-3xl leading-relaxed text-stone-700">{a.story}</p>
      </Band>

      <Band id="testimonials">
        <SectionHead title={a.testimonialsTitle} />
        <div className="grid gap-5 md:grid-cols-2">
          {a.testimonials.map(t => (
            <figure key={t.name} className="bg-white border border-stone-200 border-l-4 border-l-[#F97316] p-6">
              <blockquote className="text-lg leading-relaxed">{t.quote}</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-black">{t.name}</span> <span className="text-stone-500">· {t.detail}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Band>

      <Band tone="white" id="partners">
        <SectionHead title={a.partnersTitle} />
        <p className="max-w-3xl leading-relaxed text-stone-700">{a.partnersBody}</p>
      </Band>

      <section className="bg-[#F97316]">
        <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-[#1F2328]">{a.callTitle}</h2>
            <p className="mt-1 flex items-center gap-2 text-[#1F2328]">
              <Phone className="w-4 h-4" aria-hidden /> {a.callBody} <span className="font-black">{contact.phone}</span>
            </p>
          </div>
          <ButtonLink href="/contact" variant="dark">{content.closing.contact}</ButtonLink>
        </div>
      </section>
    </>
  )
}
