'use client'

import { useState } from 'react'
import { submitExtraWork, type ExtraWorkRoughItem } from './actions'

type Job = {
  booking_ref: string
  job_title: string | null
  job_type: string | null
}

type Props = {
  supervisorId: string
  jobs: Job[]
}

const triggerTypes = [
  {
    value: 'site',
    icon: '🔵',
    label: 'Site Arising',
    desc: 'Unanticipated condition found on site requiring additional work',
    badge: 'bg-blue-100 text-blue-700 border-blue-300',
    routes: 'technical_recommendation' as const,
  },
  {
    value: 'client',
    icon: '🟡',
    label: 'Client Request',
    desc: 'Client wants additional or changed scope — Trigger B',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    routes: 'client_demand' as const,
  },
  {
    value: 'technical',
    icon: '🟢',
    label: 'Technical Recommendation',
    desc: 'Supervisor technical recommendation for improvement — Trigger A',
    badge: 'bg-green-100 text-green-700 border-green-300',
    routes: 'technical_recommendation' as const,
  },
]

export default function ExtraWorksForm({ supervisorId, jobs }: Props) {
  const [triggerValue, setTriggerValue] = useState<string>('technical')
  const [bookingRef, setBookingRef] = useState('')
  const [description, setDescription] = useState('')
  const [justification, setJustification] = useState('')
  const [timelineImpactDays, setTimelineImpactDays] = useState('')
  const [roughItems, setRoughItems] = useState<{ description: string; qty: string; unit: string; amount: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTrigger = triggerTypes.find(t => t.value === triggerValue) ?? triggerTypes[0]

  function addItem() {
    setRoughItems(prev => [...prev, { description: '', qty: '', unit: 'sqft', amount: '' }])
  }

  function updateItem(idx: number, field: 'description' | 'qty' | 'unit' | 'amount', value: string) {
    setRoughItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  function removeItem(idx: number) {
    setRoughItems(prev => prev.filter((_, i) => i !== idx))
  }

  const total = roughItems.reduce((s, it) => s + (Number(it.amount) || 0), 0)

  async function handleSubmit() {
    if (!bookingRef || !description || !justification) {
      setError('Please select a site, and fill in the description and justification.')
      return
    }
    if (description.trim().length < 50) {
      setError('Description must be at least 50 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const items: ExtraWorkRoughItem[] = roughItems
        .filter(it => it.description.trim() !== '')
        .map(it => ({
          description: it.description,
          qty: Number(it.qty) || 0,
          unit: it.unit,
          amount: Number(it.amount) || 0,
        }))

      const result = await submitExtraWork(supervisorId, {
        booking_ref: bookingRef,
        trigger_type: selectedTrigger.routes,
        client_request: triggerValue === 'client' ? description : null,
        description,
        justification,
        rough_items: items,
        timeline_impact_days: Math.round(Number(timelineImpactDays)) || 0,
      })

      if (result.error) throw new Error(result.error)
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-green-300 shadow-sm px-5 py-8 text-center">
        <p className="text-4xl mb-3">✅</p>
        <p className="text-green-700 font-bold text-lg">Scope Change Submitted</p>
        <p className="text-gray-500 text-sm mt-1">Routed to Trade Skill Head → Coordinator → Client for approval.</p>
      </div>
    )
  }

  return (
    <>
      {/* TRIGGER TYPE SELECTION */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Trigger Type</p>
        <div className="space-y-2">
          {triggerTypes.map(t => (
            <label
              key={t.value}
              className="block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 cursor-pointer active:bg-gray-50"
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="trigger_type"
                  value={t.value}
                  checked={triggerValue === t.value}
                  onChange={() => setTriggerValue(t.value)}
                  className="w-4 h-4 mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base">{t.icon}</span>
                    <p className="text-sm font-bold text-gray-800">{t.label}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${t.badge}`}>
                      {t.value === 'client' ? 'Trigger B' : 'Trigger A'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-snug">{t.desc}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* SITE SELECTION */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Site / Booking</p>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <select
            value={bookingRef}
            onChange={e => setBookingRef(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
          >
            <option value="">Select site...</option>
            {jobs.map(job => (
              <option key={job.booking_ref} value={job.booking_ref}>
                {job.booking_ref} — {job.job_title ?? job.job_type}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* ARISING DETAILS */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Arising Details</p>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Description of Arising</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what was found or requested — be specific about location, extent, and nature of the work required (minimum 50 characters)..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
            />
            <p className={`text-xs mt-1 ${description.trim().length < 50 ? 'text-orange-500' : 'text-green-600'}`}>
              {description.trim().length}/50 characters minimum
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Timeline Impact (whole days)</p>
            <input
              type="number"
              min="0"
              step="1"
              value={timelineImpactDays}
              onChange={e => setTimelineImpactDays(e.target.value)}
              placeholder="e.g. 1"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
            />
            <p className="text-xs text-gray-400 mt-1">Above 5,000 cost or 2 days delay auto-notifies Coordinator alongside Sub-Coordinator.</p>
          </div>
        </div>
      </section>

      {/* TECHNICAL ASSESSMENT */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Justification</p>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
          <textarea
            value={justification}
            onChange={e => setJustification(e.target.value)}
            rows={3}
            placeholder="Technical or cost-of-service justification for this change..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
          />
        </div>
      </section>

      {/* ITEMISED EXTRA WORK ESTIMATE */}
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Itemised Extra Work Estimate</p>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-5 py-2 border-b border-gray-100">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2">Unit</div>
              <div className="col-span-3 text-right">Amount ₹</div>
            </div>
          </div>
          {roughItems.map((it, idx) => (
            <div key={idx} className="px-5 py-3 border-b border-gray-100">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <input
                    type="text"
                    value={it.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    placeholder="Work item..."
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={it.qty}
                    onChange={e => updateItem(idx, 'qty', e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 text-right"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={it.unit}
                    onChange={e => updateItem(idx, 'unit', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-1 py-1.5 text-xs text-gray-700 bg-gray-50"
                  >
                    <option>sqft</option>
                    <option>rft</option>
                    <option>nos</option>
                    <option>lot</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={it.amount}
                    onChange={e => updateItem(idx, 'amount', e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-gray-50 text-right"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-500 text-xs font-bold">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <button type="button" onClick={addItem} className="text-xs text-[#2E74B5] font-semibold">
              + Add Item
            </button>
            <div className="text-xs font-semibold text-gray-700">Total: ₹{total.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* ACTIONS */}
      <div className="space-y-3">
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit for Coordinator Approval →'}
        </button>
      </div>
    </>
  )
}
