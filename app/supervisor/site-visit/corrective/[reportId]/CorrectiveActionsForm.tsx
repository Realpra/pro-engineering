'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveCorrectiveAction, markCorrectiveActionDone, type CorrectiveActionInput } from './actions'
import type { VisitFinding } from '@/lib/visitFindings'

export type SavedAction = {
  id: string
  finding_source: string
  finding_text: string
  action_type: string
  direction: string | null
  delay_days: number | null
  delay_reason_category: string | null
  recast_by: string | null
  status: string
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  redo_attend: 'Redo / attend',
  more_resources: 'More resources',
  delay: 'Delay — recast',
  other: 'Other note',
}

type Draft = {
  actionType: CorrectiveActionInput['actionType'] | ''
  direction: string
  delayDays: string
  delayReasonCategory: '' | 'Client' | 'Project Reasons' | 'Beyond Control'
  recastBy: '' | 'supervisor' | 'site_head'
}
const EMPTY: Draft = { actionType: '', direction: '', delayDays: '', delayReasonCategory: '', recastBy: '' }

export default function CorrectiveActionsForm({
  reportId, findings, saved,
}: { reportId: string; findings: VisitFinding[]; saved: SavedAction[] }) {
  const router = useRouter()
  const doneTexts = new Set(saved.map(s => s.finding_text))
  const open = findings.filter(f => !doneTexts.has(f.text))
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const input = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm'

  const d = (k: string) => drafts[k] ?? EMPTY
  const set = (k: string, patch: Partial<Draft>) => setDrafts(x => ({ ...x, [k]: { ...d(k), ...patch } }))

  async function save(key: string, source: CorrectiveActionInput['findingSource'], text: string) {
    const dr = d(key)
    if (!dr.actionType) { setMsg(m => ({ ...m, [key]: 'Choose an action.' })); return }
    setBusy(key); setMsg(m => ({ ...m, [key]: '' }))
    const res = await saveCorrectiveAction({
      reportId, findingSource: source, findingText: text, actionType: dr.actionType,
      direction: dr.direction,
      delayDays: dr.actionType === 'delay' ? Number(dr.delayDays) || null : null,
      delayReasonCategory: dr.actionType === 'delay' ? (dr.delayReasonCategory || null) : null,
      recastBy: dr.actionType === 'delay' ? (dr.recastBy || null) : null,
    })
    setBusy(null)
    if (res.error) { setMsg(m => ({ ...m, [key]: res.error! })); return }
    setMsg(m => ({ ...m, [key]: res.note ?? 'Saved.' }))
    if (key === '__extra') setExtra('')
    router.refresh()
  }

  const editor = (key: string, source: CorrectiveActionInput['findingSource'], text: string) => {
    const dr = d(key)
    return (
      <div className="space-y-2">
        <select value={dr.actionType} onChange={e => set(key, { actionType: e.target.value as Draft['actionType'] })} className={input}>
          <option value="">Choose action…</option>
          <option value="redo_attend">Redo / attend — direction to Site Head</option>
          <option value="more_resources">More resources — request to Coordinator</option>
          <option value="delay">Delay — recast the milestone</option>
          <option value="other">Other — note</option>
        </select>
        {dr.actionType === 'delay' && (
          <div className="grid grid-cols-3 gap-2">
            <input className={input} placeholder="Days lost" inputMode="numeric" value={dr.delayDays} onChange={e => set(key, { delayDays: e.target.value })} />
            <select className={input} value={dr.delayReasonCategory} onChange={e => set(key, { delayReasonCategory: e.target.value as Draft['delayReasonCategory'] })}>
              <option value="">Reason…</option>
              <option value="Client">Client</option>
              <option value="Project Reasons">Project reasons</option>
              <option value="Beyond Control">Beyond control</option>
            </select>
            <select className={input} value={dr.recastBy} onChange={e => set(key, { recastBy: e.target.value as Draft['recastBy'] })}>
              <option value="">Recast by…</option>
              <option value="supervisor">I recast it</option>
              <option value="site_head">Site Head recasts, sends to me</option>
            </select>
          </div>
        )}
        <textarea rows={2} className={input} value={dr.direction} onChange={e => set(key, { direction: e.target.value })}
          placeholder={dr.actionType === 'delay' ? 'Notes (optional)' : 'Direction / what is to be done'} />
        <button type="button" disabled={busy === key} onClick={() => save(key, source, text)}
          className="rounded-lg bg-[#1F3864] text-white text-xs font-bold px-4 py-2 disabled:opacity-50">
          {busy === key ? 'Saving…' : 'Save action'}
        </button>
        {msg[key] && <p className="text-xs text-gray-700">{msg[key]}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Problems found on this visit ({open.length} open)</p>
        {open.length === 0 && <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-4">No open problems from this visit.</p>}
        {open.map(f => (
          <div key={f.key} className="bg-white rounded-2xl border border-amber-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800">{f.text}</p>
            <p className="text-[11px] text-gray-400">{f.source === 'risk_flag' ? 'Risk flag' : 'Checklist item'}</p>
            {editor(f.key, f.source, f.text)}
          </div>
        ))}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-800">Another problem not listed above</p>
          <input className={input} value={extra} onChange={e => setExtra(e.target.value)} placeholder="Describe the problem" />
          {extra.trim() && editor('__extra', 'other', extra.trim())}
        </div>
      </section>

      {saved.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Actions recorded ({saved.length})</p>
          {saved.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-800">{s.finding_text}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ACTION_LABEL[s.action_type] ?? s.action_type}
                  {s.action_type === 'delay' && ` · ${s.delay_days}d · ${s.delay_reason_category} · ${s.recast_by === 'site_head' ? 'Site Head recasts' : 'Supervisor recast'}`}
                  {s.direction ? ` — ${s.direction}` : ''}
                </p>
              </div>
              {s.status === 'done' ? (
                <span className="shrink-0 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Done</span>
              ) : (
                <button type="button" onClick={async () => { await markCorrectiveActionDone(s.id, reportId); router.refresh() }}
                  className="shrink-0 text-[11px] font-bold text-[#1F3864] border border-[#1F3864] rounded-full px-2 py-0.5">
                  Mark done
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
