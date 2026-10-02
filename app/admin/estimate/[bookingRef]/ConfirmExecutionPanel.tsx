'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmJobForExecution } from './confirmExecutionActions'

export type SupervisorOption = { id: string; full_name: string | null; district: string | null }
export type CoordinatorOption = { id: string; full_name: string | null; email: string | null; coverage_zones: string[] | null }

export default function ConfirmExecutionPanel({
  bookingRef,
  zone,
  drivingRole,
  supervisors,
  coordinators,
  matchingCoordinatorIds,
}: {
  bookingRef: string
  zone: string | null
  drivingRole: 'coordinator' | 'sub_coordinator' | null | undefined
  supervisors: SupervisorOption[]
  coordinators: CoordinatorOption[]
  matchingCoordinatorIds: string[]
}) {
  const router = useRouter()
  const wasSubCoordinatorDriven = drivingRole === 'sub_coordinator'
  const [supervisorId, setSupervisorId] = useState('')
  const [coordinatorId, setCoordinatorId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // zone is a SECTOR-level name; a Coordinator's own coverage_zones holds
  // ZONE-level names -- matching is resolved server-side (matchingCoordinatorIds,
  // via the real geo_zone_sector_coverage table), never by comparing those
  // two strings directly (confirmed real bug, 2 Oct 2026).
  const matchingCoordinators = coordinators.filter((c) => matchingCoordinatorIds.includes(c.id))
  const otherCoordinators = coordinators.filter((c) => !matchingCoordinatorIds.includes(c.id))

  async function submit() {
    if (!supervisorId) { setError('Pick a Supervisor for this job.'); return }
    if (wasSubCoordinatorDriven && !coordinatorId) { setError('Pick the Coordinator who takes this job over.'); return }
    setBusy(true)
    setError(null)
    const res = await confirmJobForExecution({
      bookingRef,
      supervisorId,
      coordinatorUserId: wasSubCoordinatorDriven ? coordinatorId : null,
      wasSubCoordinatorDriven,
    })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4">
      <div className="bg-green-50 border border-green-300 rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-sm font-bold text-green-900">Client has consented to this estimate — confirm it for execution</p>
          <p className="text-xs text-green-800 mt-0.5">
            This is the single gate that moves a job from estimate-negotiation into real execution. It assigns the
            Supervisor who will inspect this job{wasSubCoordinatorDriven ? ', and — since this job was driven by a Sub-Coordinator up to now — hands it fully to the Coordinator you pick below' : ''}.
          </p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}</div>}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-green-900 mb-1">Supervisor</p>
            <select
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className="w-full border border-green-300 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="">Select supervisor…</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name ?? 'Unnamed'}{s.district ? ` — ${s.district}` : ''}</option>
              ))}
            </select>
          </div>

          {wasSubCoordinatorDriven && (
            <div>
              <p className="text-xs font-semibold text-green-900 mb-1">Hand Over To Coordinator</p>
              <select
                value={coordinatorId}
                onChange={(e) => setCoordinatorId(e.target.value)}
                className="w-full border border-green-300 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="">Select coordinator…</option>
                {matchingCoordinators.length > 0 && (
                  <optgroup label={`Covers ${zone}`}>
                    {matchingCoordinators.map((c) => (
                      <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="All (no zone match confirmed)">
                  {otherCoordinators.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="bg-green-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50"
        >
          {busy ? 'Confirming…' : 'Confirm Job for Execution'}
        </button>
      </div>
    </div>
  )
}
