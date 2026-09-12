'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { assignSupervisor } from './actions'
import { createClient } from '@/lib/supabase/client'

export type Supervisor = {
  id: string
  full_name: string
}

export type Booking = {
  booking_ref: string | null
  job_title: string | null
  job_type: string | null
  zone: string | null
  district: string | null
  service_model: string | null
  budget_min: number | null
  budget_max: number | null
  status: string | null
  payment_status: string | null
  created_at: string | null
  supervisor_id: string | null
}

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border border-blue-200',
  confirmed: 'bg-green-100 text-green-700 border border-green-200',
  cancelled: 'bg-red-100 text-red-700 border border-red-200',
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  completed: 'bg-purple-100 text-purple-700 border border-purple-200',
  active: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const PAYMENT_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 border border-green-200',
  unpaid: 'bg-red-100 text-red-700 border border-red-200',
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  refunded: 'bg-gray-100 text-gray-600 border border-gray-200',
}

function StatusBadge({ status, map }: { status: string | null; map: Record<string, string> }) {
  const key = (status ?? '').toLowerCase()
  const styles = map[key] ?? 'bg-gray-100 text-gray-500 border border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${styles}`}>
      {status ?? '—'}
    </span>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return null
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val)
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-[#2E74B5] mt-6 mb-1 pb-1 border-b-2 border-[#2E74B5]/20">
      {title}
    </h3>
  )
}

function DetailPanel({
  booking,
  onClose,
  supervisors,
}: {
  booking: Booking
  onClose: () => void
  supervisors: Supervisor[]
}) {
  const budget =
    booking.budget_min !== null || booking.budget_max !== null
      ? [formatCurrency(booking.budget_min), formatCurrency(booking.budget_max)]
          .filter(Boolean)
          .join(' – ')
      : null

  const currentSupervisor = supervisors.find((s) => s.id === booking.supervisor_id)
  const [selectedSupervisorId, setSelectedSupervisorId] = useState(booking.supervisor_id ?? '')
  const [isPending, startTransition] = useTransition()
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assessmentWarning, setAssessmentWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedSupervisorId) { setAssessmentWarning(null); return }
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('assessment_bookings')
      .select('slot_id')
      .eq('worker_id', selectedSupervisorId)
      .then(async ({ data: bookings }) => {
        if (!bookings || bookings.length === 0) { setAssessmentWarning(null); return }
        const slotIds = bookings.map((b) => b.slot_id)
        const { data: slots } = await supabase
          .from('assessment_slots')
          .select('slot_date')
          .in('id', slotIds)
          .gte('slot_date', today)
          .order('slot_date', { ascending: true })
          .limit(1)
        if (slots && slots.length > 0) {
          const d = new Date(slots[0].slot_date + 'T00:00:00').toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          })
          setAssessmentWarning(`This worker has an assessment scheduled on ${d}`)
        } else {
          setAssessmentWarning(null)
        }
      })
  }, [selectedSupervisorId])

  function handleAssign() {
    if (!selectedSupervisorId || !booking.booking_ref) return
    setAssignError(null)
    startTransition(async () => {
      try {
        await assignSupervisor(booking.booking_ref!, selectedSupervisorId)
        onClose()
      } catch (err) {
        setAssignError(err instanceof Error ? err.message : 'Assignment failed')
      }
    })
  }

  const isAlreadyAssigned = !!currentSupervisor

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="bg-[#1F3864] px-6 py-5 flex items-start justify-between shrink-0">
        <div>
          <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-1">Booking Details</p>
          <h2 className="text-white font-bold text-lg leading-tight">
            {booking.job_title ?? 'Untitled Job'}
          </h2>
          {booking.booking_ref && (
            <p className="text-blue-300 text-xs font-mono mt-1">{booking.booking_ref}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-blue-300 hover:text-white transition-colors ml-4 mt-0.5 p-1 rounded-lg hover:bg-white/10"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status row */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
        <StatusBadge status={booking.status} map={STATUS_STYLES} />
        {booking.payment_status && (
          <>
            <span className="text-gray-300">·</span>
            <StatusBadge status={booking.payment_status} map={PAYMENT_STYLES} />
          </>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <SectionHeader title="Job Information" />
        <DetailRow label="Booking Ref" value={booking.booking_ref} />
        <DetailRow label="Job Title" value={booking.job_title} />
        <DetailRow label="Job Type" value={booking.job_type} />

        <SectionHeader title="Location" />
        <DetailRow label="Zone" value={booking.zone} />
        <DetailRow label="District" value={booking.district} />

        <SectionHeader title="Service & Budget" />
        <DetailRow label="Service Model" value={booking.service_model} />
        <DetailRow
          label="Budget Range"
          value={
            budget ? (
              <span className="font-semibold text-[#1F3864]">{budget}</span>
            ) : null
          }
        />
        <DetailRow label="Budget Min" value={formatCurrency(booking.budget_min)} />
        <DetailRow label="Budget Max" value={formatCurrency(booking.budget_max)} />

        <SectionHeader title="Status" />
        <DetailRow
          label="Booking Status"
          value={<StatusBadge status={booking.status} map={STATUS_STYLES} />}
        />
        <DetailRow
          label="Payment Status"
          value={<StatusBadge status={booking.payment_status} map={PAYMENT_STYLES} />}
        />

        <SectionHeader title="Dates" />
        <DetailRow label="Created" value={formatDate(booking.created_at)} />

        {/* Assign Supervisor */}
        <SectionHeader title="Assign Supervisor" />

        {isAlreadyAssigned && (
          <div className="flex items-center gap-2 mt-2 mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div>
              <p className="text-xs text-green-700 font-semibold">{currentSupervisor.full_name}</p>
              <p className="text-xs text-green-600">Currently assigned</p>
            </div>
          </div>
        )}

        <div className="mt-2 space-y-2">
          <select
            value={selectedSupervisorId}
            onChange={(e) => setSelectedSupervisorId(e.target.value)}
            disabled={isPending}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E74B5] focus:border-transparent disabled:opacity-50 bg-white"
          >
            <option value="">
              {supervisors.length === 0 ? 'No supervisors available' : 'Select a supervisor…'}
            </option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>

          {assessmentWarning && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.538-1.333-3.308 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-amber-700">{assessmentWarning}</p>
                <p className="text-xs text-amber-600 mt-0.5">You can still assign — this is a warning only.</p>
              </div>
            </div>
          )}

          <button
            onClick={handleAssign}
            disabled={!selectedSupervisorId || isPending}
            className="w-full bg-[#1F3864] text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-[#2E74B5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Assigning…
              </>
            ) : isAlreadyAssigned ? (
              'Reassign Supervisor'
            ) : (
              'Assign Supervisor'
            )}
          </button>

          {assignError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {assignError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

type FilterStatus = 'all' | 'new' | 'confirmed'

const FILTER_LABELS: Record<FilterStatus, string> = {
  all: 'All',
  new: 'New',
  confirmed: 'Confirmed',
}

export default function BookingsTable({
  bookings,
  supervisors,
  platformRole: _platformRole,
}: {
  bookings: Booking[]
  supervisors: Supervisor[]
  platformRole?: string
}) {
  const [selected, setSelected] = useState<Booking | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')

  const close = useCallback(() => setSelected(null), [])

  // Build a quick lookup map for supervisor names
  const supervisorMap = new Map(supervisors.map((s) => [s.id, s.full_name]))

  const filtered =
    filter === 'all'
      ? bookings
      : bookings.filter((b) => (b.status ?? '').toLowerCase() === filter)

  function countFor(f: FilterStatus) {
    if (f === 'all') return bookings.length
    return bookings.filter((b) => (b.status ?? '').toLowerCase() === f).length
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected])

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'new', 'confirmed'] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === f
                ? 'bg-[#1F3864] text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864] hover:text-[#1F3864]'
            }`}
          >
            {FILTER_LABELS[f]}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              filter === f ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {countFor(f)}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1F3864] text-white text-left">
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Booking Ref</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Job Title</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Job Type</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Zone</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">District</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Service Model</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Budget</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Supervisor</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Payment</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Created</th>
                <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((booking, i) => {
                  const budgetMin = formatCurrency(booking.budget_min)
                  const budgetMax = formatCurrency(booking.budget_max)
                  const budget = [budgetMin, budgetMax].filter(Boolean).join(' – ') || '—'
                  const supervisorName = booking.supervisor_id
                    ? (supervisorMap.get(booking.supervisor_id) ?? '—')
                    : '—'

                  return (
                    <tr
                      key={booking.booking_ref ?? i}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-mono text-[#2E74B5] font-semibold text-xs whitespace-nowrap">
                        {booking.booking_ref ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-900 font-medium max-w-[180px] truncate">
                        {booking.job_title ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                        {booking.job_type ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                        {booking.zone ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                        {booking.district ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                        {booking.service_model ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-700 font-medium whitespace-nowrap text-xs">
                        {budget}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={booking.status} map={STATUS_STYLES} />
                      </td>
                      <td className="px-4 py-3.5 text-gray-700 text-xs whitespace-nowrap">
                        {supervisorName !== '—' ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                            {supervisorName}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={booking.payment_status} map={PAYMENT_STYLES} />
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(booking.created_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setSelected(booking)}
                          className="text-xs font-semibold text-[#2E74B5] hover:text-[#1F3864] hover:underline whitespace-nowrap transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="font-medium text-gray-500">
                      {filter === 'all' ? 'No bookings found' : `No ${filter} bookings`}
                    </p>
                    <p className="text-xs mt-1">
                      {filter === 'all'
                        ? 'Guest enquiries will appear here once submitted'
                        : 'Try selecting a different filter'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel overlay */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${selected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          onClick={close}
        />

        {/* Slide-in panel */}
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${selected ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {selected && (
            <DetailPanel
              key={selected.booking_ref ?? undefined}
              booking={selected}
              onClose={close}
              supervisors={supervisors}
            />
          )}
        </div>
      </div>
    </>
  )
}
