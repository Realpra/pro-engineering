'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { raiseInvoiceObjection } from '@/app/objections/actions'
import { OBJECTION_TYPES } from '@/lib/invoiceObjections'

// Client objects to a milestone invoice (owner, 31 Oct 2026, D30) and later sees the reply.
export type ClientObjection = {
  id: string
  milestone_payment_id: string | null
  objection_type: string
  description: string
  status: string
  resolution: string | null
  revised_amount: number | null
  reply_to_client: string | null
  raised_at: string
}

export default function InvoiceObjectionBox({
  bookingRef, milestoneId, objections,
}: { bookingRef: string; milestoneId: string; objections: ClientObjection[] }) {
  const router = useRouter()
  const mine = objections.filter(o => o.milestone_payment_id === milestoneId)
  const hasOpen = mine.some(o => o.status === 'open')
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(OBJECTION_TYPES[0].value)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const label = Object.fromEntries(OBJECTION_TYPES.map(t => [t.value, t.label]))

  return (
    <div className="px-4 pb-3 space-y-2">
      {mine.map(o => (
        <div key={o.id} className={`text-xs rounded-lg px-3 py-2 ${o.status === 'open' ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
          <p><b>Your objection:</b> {label[o.objection_type] ?? o.objection_type} — {o.description}</p>
          {o.status === 'open'
            ? <p className="mt-1">Being checked by our team. You will get a reply here.</p>
            : <p className="mt-1"><b>Reply:</b> {o.reply_to_client}{o.resolution === 'admitted' && o.revised_amount != null ? ` (invoice corrected to ₹${Math.round(o.revised_amount).toLocaleString('en-IN')})` : ''}</p>}
        </div>
      ))}
      {!hasOpen && !open && (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-red-700 underline">
          Object to this invoice
        </button>
      )}
      {open && (
        <div className="border border-red-200 rounded-lg p-3 space-y-2 bg-red-50/40">
          <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
            {OBJECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What is wrong? (which item, what you see on site)"
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={async () => {
              setBusy(true); setMsg(null)
              const res = await raiseInvoiceObjection({ bookingRef, milestonePaymentId: milestoneId, objectionType: type, description })
              setBusy(false)
              if (res.error) setMsg(res.error); else { setOpen(false); setDescription(''); router.refresh() }
            }} className="rounded-lg bg-red-600 text-white text-xs font-bold px-4 py-2 disabled:opacity-50">
              {busy ? 'Sending…' : 'Send objection'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-600">Cancel</button>
          </div>
          {msg && <p className="text-xs text-red-700">{msg}</p>}
        </div>
      )}
    </div>
  )
}
