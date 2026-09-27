'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sendSupervisorInstruction } from './actions'

type Recipient = { id: string; name: string }

const types = [
  { value: 'hold', label: '🔴 Hold — Stop Work' },
  { value: 'expedite', label: '🟠 Expedite — Speed Up' },
  { value: 'revised', label: '🟡 Revised — Change Plan' },
  { value: 'resource', label: '🟢 Resource — Add/Remove' },
  { value: 'alert', label: '⚠️ Alert — Attention' },
] as const

export default function InstructionForm({
  bookingRef,
  substageCode,
  supervisorUserId,
  siteIncharge,
  subCoordinators,
}: {
  bookingRef: string
  substageCode: string | null
  supervisorUserId: string
  siteIncharge: Recipient | null
  subCoordinators: Recipient[]
}) {
  const router = useRouter()
  const allRecipients = [...(siteIncharge ? [{ ...siteIncharge, label: `${siteIncharge.name} (Site Incharge)` }] : []),
    ...subCoordinators.map(s => ({ ...s, label: `${s.name} (Sub-Coordinator)` }))]

  const [recipientId, setRecipientId] = useState(allRecipients[0]?.id ?? '')
  const [instructionType, setInstructionType] = useState<typeof types[number]['value']>('alert')
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('high')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSend() {
    if (!recipientId || !text.trim()) { setError('Choose a recipient and enter an instruction.'); return }
    setSending(true)
    setError(null)
    const result = await sendSupervisorInstruction({
      bookingRef, substageCode, recipientId, instructionType, priority,
      instructionText: text, supervisorUserId,
    })
    setSending(false)
    if (result.error) setError(result.error)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-2xl px-5 py-6 text-center">
        <p className="text-green-700 font-bold text-sm">✓ Instruction Sent</p>
        <button onClick={() => router.push('/supervisor/dashboard')} className="mt-3 text-xs text-[#2E74B5] font-semibold underline">
          Back to Dashboard
        </button>
      </div>
    )
  }

  if (allRecipients.length === 0) {
    return <p className="text-sm text-gray-500">No Site Incharge or Sub-Coordinator found to send this to.</p>
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Send To</p>
        <select value={recipientId} onChange={e => setRecipientId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50">
          {allRecipients.map(r => (<option key={r.id} value={r.id}>{r.label}</option>))}
        </select>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Instruction Type</p>
        <select value={instructionType} onChange={e => setInstructionType(e.target.value as typeof instructionType)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50">
          {types.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
        </select>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Priority</p>
        <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50">
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Instruction</p>
        <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="What needs to happen?" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none" />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <button onClick={handleSend} disabled={sending} className="w-full bg-[#1F3864] text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-60">
        {sending ? 'Sending…' : 'Send Instruction →'}
      </button>
    </div>
  )
}
