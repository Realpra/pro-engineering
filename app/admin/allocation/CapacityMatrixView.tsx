import { Fragment } from 'react'
import type { MatrixRow } from '@/lib/capacityMatrix'

function cellClass(needed: number, assigned: number): string {
  if (needed === 0) return 'bg-slate-50 border-slate-200 text-slate-400'
  if (assigned >= needed) return 'bg-green-50 border-green-200 text-green-700'
  if (assigned > 0) return 'bg-yellow-50 border-yellow-200 text-yellow-700'
  return 'bg-red-50 border-red-200 text-red-700'
}

function shortDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function CapacityMatrixView({ days, rows }: { days: string[]; rows: MatrixRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
        <p className="text-sm text-gray-400">No trade demand in this window/zone.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 overflow-x-auto">
      <div className="min-w-max">
        <div className="grid" style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(68px, 1fr))` }}>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-2 py-2">Trade{rows[0]?.key.includes('::') ? ' / Skill Level' : ''}</div>
          {days.map((d) => (
            <div key={d} className="text-[11px] font-bold text-[#1F3864] text-center px-1 py-2 border-l border-gray-100">
              {shortDate(d)}
            </div>
          ))}

          {rows.map((row) => (
            <Fragment key={row.key}>
              <div className="text-xs font-semibold text-gray-700 px-2 py-1.5 border-t border-gray-100 flex items-center">
                {row.label}
              </div>
              {row.cells.map((c) => (
                <div key={`${row.key}-${c.date}`} className="px-1 py-1.5 border-t border-l border-gray-100">
                  <div className={`rounded-lg border text-center py-1.5 text-xs font-bold ${cellClass(c.needed, c.assigned)}`}>
                    {c.needed === 0 ? '—' : `${c.assigned}/${c.needed}`}
                  </div>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-5 flex-wrap mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border bg-green-50 border-green-200" /><span className="text-xs text-gray-500">Fully staffed</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border bg-yellow-50 border-yellow-200" /><span className="text-xs text-gray-500">Partial</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border bg-red-50 border-red-200" /><span className="text-xs text-gray-500">Shortfall</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border bg-slate-50 border-slate-200" /><span className="text-xs text-gray-500">No demand</span></div>
      </div>
    </div>
  )
}
