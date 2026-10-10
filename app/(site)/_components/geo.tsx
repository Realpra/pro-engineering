'use client'
import { useEffect, useMemo, useState } from 'react'
import content from '@/content/site-content.json'
import { getPublicGeoTree, type GeoNode } from '../actions'
import { Field, Select, inputClass } from './form'

const f = content.forms

export function useGeo() {
  const [geo, setGeo] = useState<GeoNode[]>([])
  useEffect(() => { getPublicGeoTree().then(setGeo) }, [])

  return useMemo(() => {
    const byId = new Map(geo.map(g => [g.id, g]))
    // A sector sits under zone > region > district; walk up to find its district.
    function districtOf(node: GeoNode): string | null {
      let cur: GeoNode | undefined = node
      for (let i = 0; cur && i < 6; i++) {
        if (cur.level === 'district') return cur.id
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
      }
      return null
    }
    const states = geo.filter(g => g.level === 'state')
    const sectors = geo.filter(g => g.level === 'sector').map(s => ({ ...s, districtId: districtOf(s) }))
    return {
      loaded: geo.length > 0,
      states: states.map(s => s.name),
      districtsOf: (state: string) => {
        const st = states.find(s => s.name === state)
        return geo.filter(g => g.level === 'district' && g.parent_id === st?.id).map(d => d.name)
      },
      sectorsOf: (state: string, district: string) => {
        const st = states.find(s => s.name === state)
        const d = geo.find(g => g.level === 'district' && g.name === district && g.parent_id === st?.id)
        return [...new Set(sectors.filter(s => s.districtId === d?.id).map(s => s.name))]
      },
    }
  }, [geo])
}

export type SiteLocation = { state: string; district: string; sector: string }

// Client-side picker: State > District > Sector, nothing else.
export function LocationPicker({ value, onChange }: { value: SiteLocation; onChange: (v: SiteLocation) => void }) {
  const geo = useGeo()
  const districts = geo.districtsOf(value.state)
  const sectors = geo.sectorsOf(value.state, value.district)

  return (
    <>
      <Field label={f.fields.state}>
        <Select value={value.state} options={geo.states} disabled={!geo.loaded}
          onChange={state => onChange({ state, district: '', sector: '' })} />
      </Field>
      <Field label={f.fields.district}>
        <Select value={value.district} options={districts} disabled={!value.state}
          onChange={district => onChange({ ...value, district, sector: '' })} />
      </Field>
      {value.district && sectors.length === 0 ? (
        <Field label={f.fields.sectorOther} hint={f.hints.noSectors} wide>
          <input type="text" value={value.sector} onChange={e => onChange({ ...value, sector: e.target.value })} className={inputClass} />
        </Field>
      ) : (
        <Field label={f.fields.sector} hint={f.hints.sector} wide>
          <Select value={value.sector} options={sectors} disabled={!value.district}
            onChange={sector => onChange({ ...value, sector })} />
        </Field>
      )}
    </>
  )
}

export type Coverage = { state: string; districts: string[]; sectors: string[] }

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter(i => i !== item) : [...list, item]
}

function CheckList({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (o: string) => void }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border border-stone-300 bg-white px-3 py-2.5 min-h-[44px]">
      {options.map(o => (
        <label key={o} className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} className="w-4 h-4 accent-[#F97316]" />
          {o}
        </label>
      ))}
    </div>
  )
}

// Supply-side picker: one state, many districts, many sectors.
export function CoveragePicker({
  value, onChange, labels,
}: { value: Coverage; onChange: (v: Coverage) => void; labels: { state: string; districts: string; sectors: string } }) {
  const geo = useGeo()
  const districts = geo.districtsOf(value.state)
  const sectors = [...new Set(value.districts.flatMap(d => geo.sectorsOf(value.state, d)))]

  return (
    <>
      <Field label={labels.state} wide>
        <Select value={value.state} options={geo.states} disabled={!geo.loaded}
          onChange={state => onChange({ state, districts: [], sectors: [] })} />
      </Field>
      {districts.length > 0 && (
        <Field label={labels.districts} wide group>
          <CheckList options={districts} selected={value.districts}
            onToggle={d => {
              const next = toggle(value.districts, d)
              const allowed = new Set(next.flatMap(x => geo.sectorsOf(value.state, x)))
              onChange({ ...value, districts: next, sectors: value.sectors.filter(s => allowed.has(s)) })
            }} />
        </Field>
      )}
      {sectors.length > 0 && (
        <Field label={labels.sectors} wide group>
          <CheckList options={sectors} selected={value.sectors}
            onToggle={s => onChange({ ...value, sectors: toggle(value.sectors, s) })} />
        </Field>
      )}
    </>
  )
}
