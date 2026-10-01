'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTradeQuestion, updateTradeQuestion, setTradeQuestionActive, deleteTradeQuestion } from './actions'

export type Question = {
  id: string
  trade: string
  question_code: string
  question_text: string
  display_order: number
  is_active: boolean
}

function QuestionRow({ q }: { q: Question }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(q.question_text)
  const [order, setOrder] = useState(q.display_order)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await updateTradeQuestion(q.id, text, order)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    setEditing(false)
    router.refresh()
  }

  async function toggleActive() {
    setBusy(true)
    const res = await setTradeQuestionActive(q.id, !q.is_active)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete "${q.question_code}"? This cannot be undone.`)) return
    setBusy(true)
    const res = await deleteTradeQuestion(q.id)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className={`border rounded-xl p-3 ${q.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-mono text-gray-400">{q.question_code} · order {q.display_order}</span>
        <div className="flex gap-2 shrink-0">
          {!q.is_active && <span className="text-[10px] font-bold text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">INACTIVE</span>}
        </div>
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none" />
          <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className="w-24 border border-gray-300 rounded-lg p-1.5 text-sm" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="bg-[#2E74B5] text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setEditing(false); setText(q.question_text); setOrder(q.display_order) }} disabled={busy} className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-800 mt-1">{q.question_text}</p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setEditing(true)} disabled={busy} className="text-xs font-bold text-[#2E74B5]">Edit</button>
            <button type="button" onClick={toggleActive} disabled={busy} className="text-xs font-bold text-amber-600">{q.is_active ? 'Deactivate' : 'Activate'}</button>
            <button type="button" onClick={remove} disabled={busy} className="text-xs font-bold text-red-600">Delete</button>
          </div>
        </>
      )}
    </div>
  )
}

function AddQuestionForm({ trade, nextOrder }: { trade: string; nextOrder: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const [order, setOrder] = useState(nextOrder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await addTradeQuestion(trade, code, text, order)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    setOpen(false)
    setCode('')
    setText('')
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full border border-dashed border-gray-300 rounded-xl p-3 text-sm font-bold text-gray-500 hover:bg-gray-50">
        + Add Question for {trade}
      </button>
    )
  }

  return (
    <div className="border border-[#2E74B5] rounded-xl p-3 space-y-2 bg-blue-50">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="question_code (e.g. tile_laying)" className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Question text" className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none" />
      <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className="w-24 border border-gray-300 rounded-lg p-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy || !code.trim() || !text.trim()} className="bg-[#2E74B5] text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">{busy ? 'Adding…' : 'Add'}</button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg">Cancel</button>
      </div>
    </div>
  )
}

export default function QuestionBankTabs({ trades, questions }: { trades: string[]; questions: Question[] }) {
  const [activeTrade, setActiveTrade] = useState(trades[0])
  const tradeQuestions = questions.filter((q) => q.trade === activeTrade)
  const nextOrder = tradeQuestions.length > 0 ? Math.max(...tradeQuestions.map((q) => q.display_order)) + 1 : 1

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {trades.map((t) => {
          const count = questions.filter((q) => q.trade === t).length
          const active = t === activeTrade
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTrade(t)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border ${active ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-[#1F3864] border-[#1F3864]/30'}`}
            >
              {t} ({count})
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        {tradeQuestions.length === 0 && (
          <p className="text-sm text-gray-400">No questions yet for {activeTrade}.</p>
        )}
        {tradeQuestions.map((q) => <QuestionRow key={q.id} q={q} />)}
        <AddQuestionForm trade={activeTrade} nextOrder={nextOrder} />
      </div>
    </div>
  )
}
