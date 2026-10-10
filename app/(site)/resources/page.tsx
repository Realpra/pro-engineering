import content from '@/content/site-content.json'
import { Band, PageHero } from '../_components/blocks'

const r = content.resources

function slug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export default function ResourcesPage() {
  return (
    <>
      <PageHero eyebrow={r.eyebrow} title={r.title} intro={r.intro} />

      <nav className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 flex gap-6 overflow-x-auto text-sm font-bold whitespace-nowrap">
          {r.groups.map(g => (
            <a key={g.title} href={`#${slug(g.title)}`} className="py-3 border-b-2 border-transparent hover:border-[#F97316]">{g.title}</a>
          ))}
        </div>
      </nav>

      <Band>
        <div className="space-y-14">
          {r.groups.map(group => (
            <section key={group.title} id={slug(group.title)} className="scroll-mt-44">
              <h2 className="text-2xl font-black pb-2 border-b-2 border-[#1F2328]">{group.title}</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {group.items.map(item => (
                  <article key={item.title} className="bg-white border border-stone-200 flex flex-col">
                    <div className="h-2 bg-[#F97316]" aria-hidden />
                    <div className="p-5">
                      <div className="text-xs font-bold uppercase tracking-wide text-stone-500">{item.date}</div>
                      <h3 className="mt-1.5 font-black leading-snug">{item.title}</h3>
                      <p className="mt-2 text-sm text-stone-600 leading-relaxed">{item.summary}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Band>
    </>
  )
}
