'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { forwardInvoiceObjection, decideInvoiceObjection } from './actions'
import { ROLE_LABEL, type ObjectionRole } from '@/lib/invoiceObjections'

export type ObjectionView = {
  id: string
  bookingRef: string
  milestoneCode: string | null
  invoiceAmount: number | null
  typeLabel: string
  description: string
  raisedAt: string
  jobValue: number | null
  holderRole: ObjectionRole
  decidingRole: ObjectionRole
  status: string
  resolution: string | null
  revisedAmount: number | null
  reply: string | null
  trail: { action: string; fromRole: string | null; toRole: string | null; remarks: string | null; at: string }[]
}

const money = (n: number | null) => (n == null ? '—' : '₹' + Math.round(Number(n)).toLocaleString('en-IN'))
const roleName = (r: string | null) => (r ? (ROLE_LABEL as Record<string, string>)[r] ?? r : '—')

export default function ObjectionCard({ o, myRole, actionable = false }: { o: ObjectionView; myRole: ObjectionRole; actionable?: boolean }) {
  const router = useRouter()
  const [remark, setRemark] = useState('')
  const [resolution, setResolution] = useState<'admitted' | 'clarified'>('clarified')
  const [revised, setRevised] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const isDecider = actionable && myRole === o.decidingRole
  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 ${actionable ? 'border-orange-300' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-sm font-bold text-[#1F3864]">{o.bookingRef}</span>
        <span className="text-xs text-gray-500">{o.milestoneCode} invoice {money(o.invoiceAmount)} · job value {money(o.jobValue)}</span>
        <span className="ml-auto text-[11px] font-semibold text-gray-600">
          {o.status === 'resolved' ? `Resolved — ${o.resolution === 'admitted' ? 'admitted' : 'clarified'}` : `With ${roleName(o.holderRole)} · decided by ${roleName(o.decidingRole)}`}
        </span>
      </div>
      <p className="text-sm"><b>{o.typeLabel}:</b> {o.description}</p>
      {o.trail.length > 0 && (
        <ol className="space-y-1 border-l-2 border-gray-200 pl-3">
          {o.trail.map((t, i) => (
            <li key={i} className="text-xs text-gray-600">
              <span className="text-gray-400">{new Date(t.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>{' '}
              <b>{roleName(t.fromRole)}</b>{t.toRole ? ` → ${roleName(t.toRole)}` : ''}: {t.remarks}
            </li>
          ))}
        </ol>
      )}
      {o.status === 'resolved' && o.reply && (
        <p className="text-xs bg-green-50 border border-green-200 rounded-lg p-2">
          Reply to client: {o.reply}{o.resolution === 'admitted' ? ` (invoice now ${money(o.revisedAmount)})` : ''}
        </p>
      )}

      {actionable && !isDecider && (
        <div className="space-y-2">
          <textarea rows={2} className={input} value={remark} onChange={e => setRemark(e.target.value)}
            placeholder="Factual position at your level (what was actually done / found)" />
          <button type="button" disabled={busy} onClick={async () => {
            setBusy(true); setMsg(null)
            const res = await forwardInvoiceObjection(o.id, remark)
            setBusy(false)
            if (res.error) setMsg(res.error); else router.refresh()
          }} className="rounded-lg bg-[#1F3864] text-white text-xs font-bold px-4 py-2 disabled:opacity-50">
            {busy ? 'Sending…' : 'Add remark and move up'}
          </button>
        </div>
      )}

      {isDecider && (
        <div className="space-y-2">
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1"><input type="radio" checked={resolution === 'clarified'} onChange={() => setResolution('clarified')} /> Clarify (invoice unchanged)</label>
            <label className="flex items-center gap-1"><input type="radio" checked={resolution === 'admitted'} onChange={() => setResolution('admitted')} /> Admit (correct the invoice)</label>
          </div>
          {resolution === 'admitted' && (
            <input className={input} inputMode="decimal" value={revised} onChange={e => setRevised(e.target.value)} placeholder="Corrected invoice amount (₹)" />
          )}
          <textarea rows={3} className={input} value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to the client" />
          <button type="button" disabled={busy} onClick={async () => {
            setBusy(true); setMsg(null)
            const res = await decideInvoiceObjection({
              objectionId: o.id, resolution, revisedAmount: resolution === 'admitted' ? Number(revised) : null, replyToClient: reply,
            })
            setBusy(false)
            if (res.error) setMsg(res.error); else router.refresh()
          }} className="rounded-lg bg-green-700 text-white text-xs font-bold px-4 py-2 disabled:opacity-50">
            {busy ? 'Saving…' : 'Decide and reply to client'}
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-red-700">{msg}</p>}
    </div>
  )
}
