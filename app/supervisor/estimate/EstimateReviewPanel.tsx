'use client'

import { useState } from 'react'
import { supervisorGenerateBOQ, submitSupervisorEstimateReview, type EstimateAction } from './actions'

type Boq = {
  id: string
  total_amount: number | null
  status: string | null
  supervisor_review_action: string | null
  supervisor_review_reason: string | null
  supervisor_review_amount: number | null
} | null

export default function EstimateReviewPanel({
  bookingRef,
  boq,
  supervisorUserId,
}: {
  bookingRef: string
  boq: Boq
  supervisorUserId: string
}) {
  const [tier, setTier] = useState<'budget' | 'premium' | 'luxury'>('budget')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const [action, setAction] = useState<EstimateAction>('confirm')
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    const result = await supervisorGenerateBOQ(bookingRef, tier)
    setGenerating(false)
    if (result.error) setGenError(result.error)
  }

  async function handleSubmitReview() {
    setSubmitting(true)
    setSubmitError(null)
    const result = await submitSupervisorEstimateReview({
      bookingRef,
      action,
      reason: reason || null,
      revisedAmount: amount ? Number(amount) : null,
      supervisorUserId,
    })
    setSubmitting(false)
    if (result.error) setSubmitError(result.error)
    else setDone(true)
  }

  if (!boq) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
        <p className="text-sm text-gray-600">No estimate exists yet for this job.</p>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Tier</p>
          <select value={tier} onChange={e => setTier(e.target.value as typeof tier)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50">
            <option value="budget">Budget</option>
            <option value="premium">Premium</option>
            <option value="luxury">Luxury</option>
          </select>
        </div>
        {genError && <p className="text-red-600 text-xs">{genError}</p>}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-[#1F3864] text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-60"
        >
          {generating ? 'Generating…' : 'Generate Estimate from Site Survey'}
        </button>
      </div>
    )
  }

  if (done || boq.supervisor_review_action) {
    const finalAction = done ? action : boq.supervisor_review_action
    return (
      <div className="bg-green-50 border border-green-300 rounded-2xl px-5 py-4">
        <p className="text-sm font-bold text-green-700 capitalize">✓ Recorded: {finalAction}s estimate</p>
        {(done ? reason : boq.supervisor_review_reason) && (
          <p className="text-xs text-gray-500 mt-1">{done ? reason : boq.supervisor_review_reason}</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-600">HQ Estimate</p>
        <p className="text-xl font-bold text-[#1F3864]">
          {boq.total_amount ? `₹${Number(boq.total_amount).toLocaleString('en-IN')}` : '₹ —'}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">Supervisor Action</p>
        <div className="space-y-2">
          {([
            { value: 'confirm', label: '✓ Confirms — No change needed' },
            { value: 'revise', label: '↑↓ Revises — Overall amount changed' },
            { value: 'modify', label: '✎ Modifies — Specific line items changed' },
          ] as { value: EstimateAction; label: string }[]).map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="estimate_action" checked={action === opt.value} onChange={() => setAction(opt.value)} className="w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
      {action !== 'confirm' && (
        <>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Reason</p>
            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why estimate needs revision..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Suggested Amount (if applicable)</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter suggested amount..." className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50" />
            </div>
          </div>
        </>
      )}
      {submitError && <p className="text-red-600 text-xs">{submitError}</p>}
      <button
        onClick={handleSubmitReview}
        disabled={submitting}
        className="w-full bg-green-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit to Coordinator →'}
      </button>
    </div>
  )
}
