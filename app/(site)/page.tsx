import Link from 'next/link'
import {
  ArrowRight, Building2, Check, ClipboardCheck, Clock, Handshake, HardHat,
  LogIn, Play, ShieldCheck, UserPlus, Users, Wrench,
} from 'lucide-react'
import content from '@/content/site-content.json'
import { Band, ButtonLink, SectionHead } from './_components/blocks'

const { hero, request, work, numbers, how, homeZones, video, closing, header } = content

const HERO_ENTRIES = [
  { ...hero.client, href: '#request', icon: Wrench },
  { ...hero.provider, href: '#work', icon: HardHat },
  { ...hero.staff, href: '/login', icon: LogIn },
]

const REQUEST_CARDS = [
  { ...request.oneDay, href: '/request/one-day', icon: Clock },
  { ...request.turnKey, href: '/request/turn-key', icon: ClipboardCheck },
  { ...request.bulk, href: '/request/labour-bazaar', icon: Users },
]

const WORK_CARDS = [
  { ...work.worker, href: '/for-workers', icon: HardHat },
  { ...work.teamHead, href: '/work-with-us/team-head', icon: UserPlus },
  { ...work.associate, href: '/work-with-us/associate', icon: Handshake },
  { ...work.contractor, href: '/work-with-us/contractor', icon: Building2 },
]

export default function HomePage() {
  return (
    <>
      <section className="bg-[#1F2328] text-white">
        <div className="max-w-6xl mx-auto px-4 pt-14 pb-16">
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-widest text-[#F97316]">{hero.eyebrow}</div>
            <h1 className="mt-3 text-4xl sm:text-5xl font-black leading-[1.1]">{hero.title}</h1>
            <p className="mt-5 text-lg text-stone-300 leading-relaxed">{hero.body}</p>
            <p className="mt-5 inline-flex items-start gap-2 text-sm text-stone-200 border-l-4 border-[#F97316] pl-3">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#F97316]" aria-hidden />
              {hero.notice}
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {HERO_ENTRIES.map(e => (
              <Link key={e.href} href={e.href}
                className="group bg-white text-[#1F2328] p-6 border-t-4 border-[#F97316] hover:bg-[#FAF7F2] flex flex-col">
                <e.icon className="w-7 h-7 text-[#C2570C]" aria-hidden />
                <div className="mt-4 text-xl font-black">{e.title}</div>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed flex-1">{e.desc}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold">
                  {e.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Band id="request">
        <SectionHead eyebrow={request.eyebrow} title={request.title} intro={request.intro} />
        <div className="grid gap-5 md:grid-cols-3">
          {REQUEST_CARDS.map(c => (
            <div key={c.href} className="bg-white border border-stone-200 p-6 flex flex-col">
              <span className="w-11 h-11 bg-[#1F2328] text-[#F97316] flex items-center justify-center">
                <c.icon className="w-5 h-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-xl font-black">{c.title}</h3>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">{c.desc}</p>
              <ul className="mt-4 space-y-2 text-sm text-stone-700 flex-1">
                {[c.point1, c.point2, c.point3].map(p => (
                  <li key={p} className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#C2570C]" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
              <Link href={c.href} className="mt-6 px-4 py-2.5 bg-[#F97316] text-[#1F2328] text-sm font-bold text-center hover:bg-[#EA6A0C]">
                {c.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-stone-600">
          {request.fullProject}{' '}
          <Link href="/book" className="font-bold text-[#1F2328] underline underline-offset-4 decoration-[#F97316] decoration-2">
            {request.fullProjectCta}
          </Link>
        </p>
      </Band>

      <Band id="work" tone="dark">
        <SectionHead eyebrow={work.eyebrow} title={work.title} intro={work.intro} dark />
        <div className="grid gap-px bg-stone-700 sm:grid-cols-2 lg:grid-cols-4 border border-stone-700">
          {WORK_CARDS.map(c => (
            <Link key={c.href} href={c.href} className="group bg-[#1F2328] p-6 hover:bg-[#2A2F36] flex flex-col">
              <c.icon className="w-7 h-7 text-[#F97316]" aria-hidden />
              <h3 className="mt-4 text-lg font-black text-white">{c.title}</h3>
              <p className="mt-2 text-sm text-stone-300 leading-relaxed flex-1">{c.desc}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#F97316]">
                {c.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-6 inline-flex items-start gap-2 text-sm text-stone-200">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#F97316]" aria-hidden />
          {work.notice}
        </p>
      </Band>

      <section className="bg-white border-b border-stone-200">
        <dl className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {numbers.items.map(n => (
            <div key={n.label} className="border-l-4 border-[#F97316] pl-4">
              <dd className="text-4xl font-black tabular-nums">{n.value}</dd>
              <dt className="mt-1 text-sm text-stone-600">{n.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <Band id="how">
        <SectionHead eyebrow={how.eyebrow} title={how.title} intro={how.intro} />
        <ol className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {how.steps.map((s, i) => (
            <li key={s.title} className="border-t-2 border-[#1F2328] pt-4">
              <div className="text-2xl font-black text-[#C2570C] tabular-nums">{String(i + 1).padStart(2, '0')}</div>
              <div className="mt-1 font-bold">{s.title}</div>
              <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
      </Band>

      <Band tone="white">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="aspect-video bg-[#1F2328] flex flex-col items-center justify-center gap-3 text-stone-400">
            <span className="w-16 h-16 border-2 border-[#F97316] flex items-center justify-center">
              <Play className="w-7 h-7 text-[#F97316]" aria-hidden />
            </span>
            <span className="text-sm">{video.placeholder}</span>
          </div>
          <div>
            <h2 className="text-3xl font-black leading-tight">{video.title}</h2>
            <p className="mt-3 text-stone-600 leading-relaxed">{video.body}</p>
            <div className="mt-6"><ButtonLink href="/request/turn-key">{video.cta}</ButtonLink></div>
          </div>
        </div>
      </Band>

      <Band id="zones">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-[#C2570C]">{homeZones.eyebrow}</div>
            <h2 className="mt-2 text-3xl font-black leading-tight">{homeZones.title}</h2>
            <p className="mt-3 text-stone-600 leading-relaxed">{homeZones.intro}</p>
          </div>
          <ButtonLink href="/zones" variant="outline">{homeZones.cta}</ButtonLink>
        </div>
      </Band>

      <section className="bg-[#F97316]">
        <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-[#1F2328]">{closing.title}</h2>
            <p className="mt-1 text-[#1F2328]">{closing.body}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/#request" variant="dark">{header.ctaPost}</ButtonLink>
            <ButtonLink href="/#work" variant="outline">{header.ctaJoin}</ButtonLink>
            <ButtonLink href="/zones" variant="outline">{closing.zones}</ButtonLink>
            <ButtonLink href="/contact" variant="outline">{closing.contact}</ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}
