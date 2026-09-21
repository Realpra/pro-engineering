'use client'

import { useMemo, useState } from 'react'
import PaymentCard, { NIL_PAYMENT, decisionType, type Payment, type PaymentMode } from './PaymentCard'

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return `₹${num(v).toLocaleString('en-IN')}`
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const DECISION_TYPE_LABEL: Record<string, string> = {
  decision_5: 'Decision 5',
  rework: 'Rework',
  override: 'Override',
  standard: 'Standard',
}

type TabKey = 'pending' | 'decision5' | 'rework' | 'hold' | 'above_limit' | 'history'

const MILESTONE_OPTIONS = ['M0', 'M1', 'M2', 'M3', 'M4']
const SKILL_LEVEL_OPTIONS = ['unskilled', 'semi_skilled', 'skilled', 'highly_skilled']

const STATUS_OPTIONS = [
  'coordinator_approved',
  'admin_approved',
  'admin_hold',
  'admin_rejected',
  'decision_5_raised',
  'decision_5_confirmed',
]

const DECISION_TYPE_OPTIONS = ['standard', 'decision_5', 'rework', 'override']

const EMPTY_MESSAGE: Record<Exclude<TabKey, 'history'>, string> = {
  pending: 'No payments pending approval',
  decision5: 'No Decision 5 cases',
  rework: 'No rework deductions pending',
  hold: 'No payments on hold',
  above_limit: 'No above-limit payments',
}

export default function PaymentTabs({
  payments,
  clientMap,
  zoneMap,
  tradeOptions,
  adminUserId,
  adminLimit,
  coordinatorLimit,
}: {
  payments: Payment[]
  clientMap: Record<string, string>
  zoneMap: Record<string, string>
  tradeOptions: string[]
  adminUserId: string
  adminLimit: number
  coordinatorLimit: number
}) {
  const [tab, setTab] = useState<TabKey>('pending')

  const pending = useMemo(
    () =>
      payments.filter(
        (p) =>
          p.status === 'coordinator_approved' &&
          num(p.payment_amount) > coordinatorLimit &&
          num(p.payment_amount) <= adminLimit
      ),
    [payments, coordinatorLimit, adminLimit]
  )

  const decision5 = useMemo(
    () => payments.filter((p) => p.decision_5_raised_at != null && p.decision_5_admin_decision == null),
    [payments]
  )

  const rework = useMemo(
    () => payments.filter((p) => num(p.rework_cost_proposed) > 0 && p.rework_cost_approved_at == null),
    [payments]
  )

  const onHold = useMemo(() => payments.filter((p) => p.status === 'admin_hold'), [payments])

  const aboveLimit = useMemo(
    () => payments.filter((p) => num(p.payment_amount) > adminLimit),
    [payments, adminLimit]
  )

  const TABS: { key: TabKey; label: string; count: number; badge: boolean }[] = [
    { key: 'pending', label: 'Pending Admin Approval', count: pending.length, badge: true },
    { key: 'decision5', label: 'Decision 5 Queue', count: decision5.length, badge: true },
    { key: 'rework', label: 'Rework Cost Deductions', count: rework.length, badge: true },
    { key: 'hold', label: 'On Hold', count: onHold.length, badge: false },
    { key: 'above_limit', label: 'Above Limit Notifications', count: aboveLimit.length, badge: false },
    { key: 'history', label: 'Payment History', count: payments.length, badge: false },
  ]

  function renderList(list: Payment[], mode: Exclude<PaymentMode, 'history'>) {
    if (list.length === 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PaymentCard
            payment={NIL_PAYMENT}
            mode={mode}
            adminUserId={adminUserId}
            clientName="Nil"
            zone="Nil"
            emptyMessage={EMPTY_MESSAGE[mode]}
          />
        </div>
      )
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((p) => (
          <PaymentCard
            key={p.id}
            payment={p}
            mode={mode}
            adminUserId={adminUserId}
            clientName={clientMap[p.booking_ref ?? ''] ?? '—'}
            zone={zoneMap[p.booking_ref ?? ''] ?? '—'}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                active
                  ? 'bg-[#1F3864] text-white'
                  : 'bg-white text-[#1F3864] border border-[#1F3864] hover:bg-[#1F3864]/5'
              }`}
            >
              {t.label}
              {t.badge && t.count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${
                    active ? 'bg-white text-[#F97316]' : 'bg-[#F97316] text-white'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'pending' && renderList(pending, 'pending')}
      {tab === 'decision5' && renderList(decision5, 'decision5')}
      {tab === 'rework' && renderList(rework, 'rework')}
      {tab === 'hold' && renderList(onHold, 'hold')}
      {tab === 'above_limit' && renderList(aboveLimit, 'above_limit')}
      {tab === 'history' && (
        <PaymentHistory payments={payments} clientMap={clientMap} tradeOptions={tradeOptions} />
      )}
    </div>
  )
}

// ─── History with search + results table ───────────────────────────────────

function PaymentHistory({
  payments,
  clientMap,
  tradeOptions,
}: {
  payments: Payment[]
  clientMap: Record<string, string>
  tradeOptions: string[]
}) {
  const [bookingRef, setBookingRef] = useState('')
  const [client, setClient] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [milestone, setMilestone] = useState('')
  const [trade, setTrade] = useState('')
  const [skill_level, setSkillLevel] = useState('')
  const [amountFrom, setAmountFrom] = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [decType, setDecType] = useState('')
  const [status, setStatus] = useState('')

  const zoneOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of payments) if (p.zone) set.add(p.zone)
    return Array.from(set).sort()
  }, [payments])

  const filtered = useMemo(() => {
    const af = amountFrom === '' ? null : Number(amountFrom)
    const at = amountTo === '' ? null : Number(amountTo)
    const df = dateFrom === '' ? null : new Date(`${dateFrom}T00:00:00`).getTime()
    const dt = dateTo === '' ? null : new Date(`${dateTo}T23:59:59`).getTime()

    return payments.filter((p) => {
      if (bookingRef && !(p.booking_ref ?? '').toLowerCase().includes(bookingRef.toLowerCase())) return false
      if (client) {
        const name = clientMap[p.booking_ref ?? ''] ?? ''
        if (!name.toLowerCase().includes(client.toLowerCase())) return false
      }
      if (zoneFilter && (p.zone ?? '') !== zoneFilter) return false
      if (milestone && (p.milestone_code ?? '') !== milestone) return false
      if (trade && (p.trade ?? '') !== trade) return false
      if (skill_level && (p.skill_level ?? '') !== skill_level) return false
      const amt = num(p.payment_amount)
      if (af != null && amt < af) return false
      if (at != null && amt > at) return false
      if (df != null || dt != null) {
        const t = p.created_at ? new Date(p.created_at).getTime() : NaN
        if (Number.isNaN(t)) return false
        if (df != null && t < df) return false
        if (dt != null && t > dt) return false
      }
      if (decType && decisionType(p) !== decType) return false
      if (status && (p.status ?? '') !== status) return false
      return true
    })
  }, [payments, clientMap, bookingRef, client, zoneFilter, milestone, trade, skill_level, amountFrom, amountTo, dateFrom, dateTo, decType, status])

  const inp = 'border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1F3864]'

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={inp} placeholder="Booking ref" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} />
        <input className={inp} placeholder="Client name" value={client} onChange={(e) => setClient(e.target.value)} />
        <select className={inp} value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
          <option value="">All zones</option>
          {zoneOptions.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        <select className={inp} value={milestone} onChange={(e) => setMilestone(e.target.value)}>
          <option value="">All milestones</option>
          {MILESTONE_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className={inp} value={trade} onChange={(e) => setTrade(e.target.value)}>
          <option value="">All trades</option>
          {tradeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className={inp} value={skill_level} onChange={(e) => setSkillLevel(e.target.value)}>
          <option value="">All skill levels</option>
          {SKILL_LEVEL_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={inp} value={decType} onChange={(e) => setDecType(e.target.value)}>
          <option value="">All decision types</option>
          {DECISION_TYPE_OPTIONS.map((d) => (
            <option key={d} value={d}>{DECISION_TYPE_LABEL[d]}</option>
          ))}
        </select>
        <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          className={inp}
          type="number"
          placeholder="Amount from"
          value={amountFrom}
          onChange={(e) => setAmountFrom(e.target.value)}
        />
        <input
          className={inp}
          type="number"
          placeholder="Amount to"
          value={amountTo}
          onChange={(e) => setAmountTo(e.target.value)}
        />
        <input className={inp} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input className={inp} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <p className="text-xs text-gray-400 mb-3">{filtered.length} of {payments.length} payments</p>

      <div className="overflow-x-auto bg-white rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 font-semibold">Booking Ref</th>
              <th className="px-3 py-2 font-semibold">Client</th>
              <th className="px-3 py-2 font-semibold">Zone</th>
              <th className="px-3 py-2 font-semibold">Milestone</th>
              <th className="px-3 py-2 font-semibold">Trade</th>
              <th className="px-3 py-2 font-semibold">Skill Level</th>
              <th className="px-3 py-2 font-semibold">Amount</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Decision Type</th>
              <th className="px-3 py-2 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2.5 text-sm text-gray-800">{p.booking_ref ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{clientMap[p.booking_ref ?? ''] ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{p.zone ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{p.milestone_code ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{p.trade ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{p.skill_level ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{money(p.payment_amount)}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{p.status ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{DECISION_TYPE_LABEL[decisionType(p)]}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-800">{fmtDate(p.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-400">
                  No payment history
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
