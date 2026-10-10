import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import content from '@/content/site-content.json'
import catalogue from '@/content/job-catalogue.json'
import { Band, ButtonLink, PageHero, SectionHead } from '../_components/blocks'

const w = content.forWorkers
const { work } = content

const PARTNER_LINKS = [
  { href: '/work-with-us/team-head', label: work.teamHead.title },
  { href: '/work-with-us/associate', label: work.associate.title },
  { href: '/work-with-us/contractor', label: work.contractor.title },
]

export default function ForWorkersPage() {
  return (
    <>
      <PageHero eyebrow={w.eyebrow} title={w.title} intro={w.intro} />

      <section className="bg-[#F97316] text-[#1F2328]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-start gap-2 text-sm font-bold">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          {work.notice}
        </div>
      </section>

      <Band>
        <SectionHead title={w.reasonsTitle} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {w.reasons.map(r => (
            <div key={r.title} className="bg-white border border-stone-200 border-t-4 border-t-[#F97316] p-5">
              <div className="font-black">{r.title}</div>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="white">
        <SectionHead title={w.tradesTitle} />
        <ul className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm font-bold">
          {catalogue.workerSkills.map(skill => (
            <li key={skill} className="border border-stone-300 px-3 py-3 text-center">{skill}</li>
          ))}
        </ul>
      </Band>

      <Band>
        <SectionHead title={w.stepsTitle} />
        <ol className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {w.steps.map((s, i) => (
            <li key={s.title} className="border-t-2 border-[#1F2328] pt-4">
              <div className="text-2xl font-black text-[#C2570C] tabular-nums">{String(i + 1).padStart(2, '0')}</div>
              <div className="mt-1 font-bold">{s.title}</div>
              <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10"><ButtonLink href="/onboarding">{w.cta}</ButtonLink></div>
      </Band>

      <Band tone="dark">
        <SectionHead title={w.partnerTitle} intro={w.partnerBody} dark />
        <div className="flex flex-wrap gap-3">
          {PARTNER_LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className="inline-flex items-center gap-2 px-5 py-3 border-2 border-stone-500 text-white text-sm font-bold hover:border-[#F97316]">
              {l.label} <ArrowRight className="w-4 h-4 text-[#F97316]" aria-hidden />
            </Link>
          ))}
        </div>
      </Band>
    </>
  )
}
