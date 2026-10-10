import content from '@/content/site-content.json'
import catalogue from '@/content/job-catalogue.json'
import { Band, ButtonLink, PageHero, SectionHead } from '../_components/blocks'

const s = content.services
const trades = catalogue.trades as {
  name: string
  skills: { name: string; jobs: string[] }[]
  lumpSum: { name: string; skills: string[] }[]
}[]

export default function ServicesPage() {
  return (
    <>
      <PageHero eyebrow={s.eyebrow} title={s.title} intro={s.intro} />

      <Band>
        <div className="space-y-12">
          {trades.map(trade => (
            <article key={trade.name} className="bg-white border border-stone-200">
              <h2 className="px-6 py-4 bg-[#1F2328] text-white text-xl font-black border-l-4 border-[#F97316]">{trade.name}</h2>
              <div className="p-6 grid gap-10 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 pb-2 border-b-2 border-[#1F2328]">{s.skillsTitle}</h3>
                  <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                    {trade.skills.map(skill => (
                      <div key={skill.name}>
                        <div className="font-black">{skill.name}</div>
                        <ul className="mt-1.5 space-y-1 text-sm text-stone-600">
                          {skill.jobs.map(job => <li key={job}>{job}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 pb-2 border-b-2 border-[#1F2328]">{s.lumpSumTitle}</h3>
                  <ul className="mt-4 space-y-3 text-sm">
                    {trade.lumpSum.map(pkg => (
                      <li key={pkg.name}>
                        <div className="font-bold">{pkg.name}</div>
                        {pkg.skills.length > 0 && <div className="text-stone-500">{pkg.skills.join(', ')}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-10"><ButtonLink href="/#request">{s.cta}</ButtonLink></div>
      </Band>

      <Band tone="white">
        <SectionHead title={s.projectsTitle} intro={s.projectsIntro} />
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2.5 text-sm font-medium max-w-3xl">
          {s.projects.map(project => (
            <li key={project} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#F97316] shrink-0" aria-hidden />
              {project}
            </li>
          ))}
        </ul>
        <div className="mt-8"><ButtonLink href="/book" variant="dark">{content.request.fullProjectCta}</ButtonLink></div>
      </Band>
    </>
  )
}
