'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recommendWorkerOnboarding, returnWorkerOnboarding } from '../actions'
import { WORKER_RETURN_REASONS } from '@/lib/workerReturnReasons'

export type PendingWorker = {
  id: string
  full_name: string
  trade: string | null
  district: string | null
  skill_level: string | null
  phone: string | null
  is_bocw_registered: boolean | null
  height_restriction: boolean | null
  dust_restriction: boolean | null
  credential_type: string | null
  credential_other_detail: string | null
  credential_valid_upto: string | null
}

function credentialLabel(w: PendingWorker): string | null {
  if (!w.credential_type || w.credential_type === 'not_applicable') return null
  const kind = w.credential_type === 'other' ? (w.credential_other_detail || 'Other') : w.credential_type === 'permit_license' ? 'Permit/License' : 'Registration'
  return w.credential_valid_upto ? `${kind} — valid upto ${w.credential_valid_upto}` : kind
}

// First step of the onboarding approval chain (project owner's confirmed
// design, 1 Oct 2026): Sub-Coordinator recommends a newly self-onboarded
// worker forward to Coordinator, or returns it for correction. The full
// onboarding proforma -- BOCW status, restrictions -- travels with the
// worker through this chain (shown here, not just captured and left
// behind), per the standing "every field feeds forward" principle.
export default function OnboardingReviewCard({ worker }: { worker: PendingWorker }) {
  const router = useRouter()
  const [mode, setMode] = useState<null | 'recommend' | 'return'>(null)
  const [text, setText] = useState('')
  const [reasonIdx, setReasonIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOtherReason = reasonIdx >= 0 && WORKER_RETURN_REASONS[reasonIdx].label === 'Other'

  function pickReason(idx: number) {
    setReasonIdx(idx)
    setText(idx >= 0 && WORKER_RETURN_REASONS[idx].label !== 'Other' ? WORKER_RETURN_REASONS[idx].action : '')
  }

  async function submit() {
    setBusy(true)
    setError(null)
    const res = mode === 'recommend'
      ? await recommendWorkerOnboarding(worker.id, text.trim())
      : await returnWorkerOnboarding(worker.id, text.trim())
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setMode(null)
    setText('')
    setReasonIdx(-1)
    router.refresh()
  }

  const restrictions: string[] = []
  if (worker.height_restriction) restrictions.push('Height')
  if (worker.dust_restriction) restrictions.push('Dust')

  return (
    <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
      <div className="bg-orange-50 px-5 py-3 border-b border-orange-100">
        <p className="text-sm font-bold text-gray-800">{worker.full_name}</p>
        <p className="text-xs text-gray-500">{worker.trade} · {worker.district} · {worker.skill_level?.replace('_', ' ')}</p>
        {worker.phone && <p className="text-xs text-gray-400 mt-0.5">📞 {worker.phone}</p>}
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-gray-400">BOCW Registered</p>
            <p className="font-semibold">{worker.is_bocw_registered ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-gray-400">Restrictions</p>
            <p className="font-semibold">{restrictions.length > 0 ? restrictions.join(', ') : 'None'}</p>
          </div>
        </div>
        {credentialLabel(worker) && (
          <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2 py-1.5">
            🪪 {credentialLabel(worker)}
          </p>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {mode ? (
          <div className="space-y-2">
            {mode === 'return' && (
              <select
                value={reasonIdx}
                onChange={(e) => pickReason(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg p-2 text-xs"
              >
                <option value={-1}>Select a reason…</option>
                {WORKER_RETURN_REASONS.map((r, i) => (
                  <option key={r.label} value={i}>{r.label}</option>
                ))}
              </select>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={mode === 'recommend' ? 'Remark for Coordinator (optional)…' : isOtherReason ? 'Describe what needs correcting…' : 'What needs correcting?'}
              className="w-full border border-gray-300 rounded-lg p-2 text-xs resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={busy || (mode === 'return' && !text.trim())}
                className={`flex-1 text-xs font-bold py-2 rounded-xl disabled:opacity-50 ${mode === 'recommend' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
              >
                {busy ? 'Saving…' : mode === 'recommend' ? 'Confirm Recommend' : 'Confirm Return'}
              </button>
              <button type="button" onClick={() => setMode(null)} disabled={busy} className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('return')} className="flex-1 border border-red-300 text-red-600 text-xs font-bold py-2.5 rounded-xl">
              Return for Correction
            </button>
            <button type="button" onClick={() => setMode('recommend')} className="flex-1 bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl">
              ✓ Recommend → Coordinator
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
