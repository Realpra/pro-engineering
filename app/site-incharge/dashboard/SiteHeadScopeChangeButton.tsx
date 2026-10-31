'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitSiteHeadScopeChange } from './actions'

type Item = { description: string; qty: string; unit: string; amount: string }
const EMPTY: Item = { description: '', qty: '', unit: '', amount: '' }

// Owner, 31 Oct 2026 (D32): Site Head starts a change of scope (addition, deletion or new
// work) as "site demands" or "client requests"; it then follows the estimate approval route.
export default function SiteHeadScopeChangeButton({ bookingRef }: { bookingRef: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [changeType, setChangeType] = useState<'addition' | 'deletion' | 'substitution'>('addition')
  const [source, setSource] = useState<'site_demand' | 'client_request'>('site_demand')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState('0')
  const [items, setItems] = useState<Item[]>([{ ...EMPTY }])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const input = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm'

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-[#1F3864] text-[#1F3864] font-bold py-3 text-sm">
        Raise a Change of Scope
      </button>
    )
  }

  async function submit() {
    setBusy(true); setMsg(null)
    const res = await submitSiteHeadScopeChange({
      bookingRef, changeType, source, description,
      roughItems: items.map(it => ({ description: it.description, qty: Number(it.qty) || 0, unit: it.unit, amount: Number(it.amount) || 0 })),
      timelineImpactDays: Number(days) || 0,
    })
    setBusy(false)
    if (res.error) { setMsg(res.error); return }
    setMsg('Change of scope sent for review and estimate approval.')
    setDescription(''); setItems([{ ...EMPTY }]); setDays('0')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
      <p className="text-sm font-bold text-[#1F3864]">Change of Scope</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={changeType} onChange={e => setChangeType(e.target.value as typeof changeType)} className={input}>
          <option value="addition">Addition / new work</option>
          <option value="deletion">Deletion</option>
          <option value="substitution">Change of item</option>
        </select>
        <select value={source} onChange={e => setSource(e.target.value as typeof source)} className={input}>
          <option value="site_demand">Site demands</option>
          <option value="client_request">Client requests</option>
        </select>
      </div>
      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
        placeholder="What changes and why" className={input} />
      <p className="text-xs font-semibold text-gray-500">Rough items (optional)</p>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-12 gap-1">
          <input className={`${input} col-span-5`} placeholder="Item" value={it.description}
            onChange={e => setItems(x => x.map((y, j) => j === i ? { ...y, description: e.target.value } : y))} />
          <input className={`${input} col-span-2`} placeholder="Qty" value={it.qty}
            onChange={e => setItems(x => x.map((y, j) => j === i ? { ...y, qty: e.target.value } : y))} />
          <input className={`${input} col-span-2`} placeholder="Unit" value={it.unit}
            onChange={e => setItems(x => x.map((y, j) => j === i ? { ...y, unit: e.target.value } : y))} />
          <input className={`${input} col-span-3`} placeholder="₹ approx" value={it.amount}
            onChange={e => setItems(x => x.map((y, j) => j === i ? { ...y, amount: e.target.value } : y))} />
        </div>
      ))}
      <button type="button" onClick={() => setItems(x => [...x, { ...EMPTY }])} className="text-xs font-semibold text-blue-700">
        + Add item
      </button>
      <label className="block text-xs text-gray-600">
        Extra days needed
        <input className={input} value={days} onChange={e => setDays(e.target.value)} inputMode="numeric" />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={submit}
          className="flex-1 rounded-xl bg-[#1F3864] text-white font-bold py-2.5 text-sm disabled:opacity-50">
          {busy ? 'Sending…' : 'Send for approval'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 text-sm text-gray-600">Close</button>
      </div>
      {msg && <p className="text-xs text-gray-700">{msg}</p>}
    </div>
  )
}
