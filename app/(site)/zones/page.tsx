import { MapPin } from 'lucide-react'
import content from '@/content/site-content.json'
import { getPublicGeoTree, type GeoNode } from '../actions'
import { Band, ButtonLink, PageHero } from '../_components/blocks'

const z = content.zonesPage

// Read live on every visit so a sector added in Admin > Zones shows up here
// without a redeploy.
export const dynamic = 'force-dynamic'

export default async function ZonesPage() {
  const geo = await getPublicGeoTree()
  const byId = new Map(geo.map(g => [g.id, g]))

  function districtOf(node: GeoNode): string | null {
    let cur: GeoNode | undefined = node
    for (let i = 0; cur && i < 6; i++) {
      if (cur.level === 'district') return cur.id
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return null
  }

  const sectors = geo.filter(g => g.level === 'sector').map(s => ({ name: s.name, districtId: districtOf(s) }))
  const states = geo
    .filter(g => g.level === 'state')
    .map(state => ({
      name: state.name,
      districts: geo
        .filter(g => g.level === 'district' && g.parent_id === state.id)
        .map(d => ({
          name: d.name,
          sectors: [...new Set(sectors.filter(s => s.districtId === d.id).map(s => s.name))],
        })),
    }))
    .filter(state => state.districts.length > 0)

  return (
    <>
      <PageHero eyebrow={z.eyebrow} title={z.title} intro={z.intro} />
      <Band>
        {states.length === 0 ? (
          <p className="bg-white border border-stone-200 p-6 text-stone-700">{z.empty}</p>
        ) : (
          <div className="space-y-10">
            {states.map(state => (
              <section key={state.name}>
                <h2 className="text-2xl font-black pb-2 border-b-2 border-[#1F2328]">{state.name}</h2>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {state.districts.map(d => (
                    <div key={d.name} className="bg-white border border-stone-200 p-5">
                      <h3 className="flex items-center gap-2 font-black">
                        <MapPin className="w-4 h-4 text-[#C2570C]" aria-hidden /> {d.name}
                      </h3>
                      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                        {d.sectors.map(s => (
                          <li key={s} className="border border-stone-300 px-2.5 py-1">{s}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <p className="mt-10 text-sm text-stone-600">{z.note}</p>
        <div className="mt-5"><ButtonLink href="/#request">{z.cta}</ButtonLink></div>
      </Band>
    </>
  )
}
