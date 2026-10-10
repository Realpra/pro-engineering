import content from '@/content/site-content.json'
import { Band, PageHero } from '../../_components/blocks'

const v = content.values

export default function ValuesPage() {
  return (
    <>
      <PageHero eyebrow={v.eyebrow} title={v.title} intro={v.tagline} />

      <Band>
        <p className="max-w-3xl text-lg leading-relaxed text-stone-700">{v.intro}</p>

        <div className="mt-10 space-y-5">
          {v.items.map((item, i) => (
            <article key={item.title} id={item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
              className="scroll-mt-36 bg-white border border-stone-200 grid md:grid-cols-[200px_1fr]">
              <div className="bg-[#1F2328] text-white p-6 flex md:flex-col items-baseline md:items-start gap-3">
                <span className="text-3xl font-black text-[#F97316] tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <h2 className="text-xl font-black">{item.title}</h2>
              </div>
              <div className="p-6">
                <p className="font-bold">{item.tagline}</p>
                <p className="mt-2 text-stone-600 leading-relaxed">{item.body}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 max-w-3xl font-bold leading-relaxed border-l-4 border-[#F97316] pl-4">{v.closing}</p>
      </Band>
    </>
  )
}
