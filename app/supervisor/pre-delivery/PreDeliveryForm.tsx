'use client'

import { useState } from 'react'
import { submitPreDeliveryAssessment, uploadSnagPhoto, type SnagItem } from './actions'

type Job = {
  booking_ref: string
  job_title: string | null
  job_type: string | null
}

type Props = {
  supervisorId: string
  jobs: Job[]
}

type SnagRow = {
  location: string
  description: string
  severity: SnagItem['severity']
  photoUrl: string | null
  uploading: boolean
  error: string | null
}

const severityOptions: SnagItem['severity'][] = ['minor', 'medium', 'major', 'critical']

export default function PreDeliveryForm({ supervisorId, jobs }: Props) {
  const [bookingRef, setBookingRef] = useState('')
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [clearance, setClearance] = useState<'cleared' | 'not_cleared' | 'conditional'>('cleared')
  const [snags, setSnags] = useState<SnagRow[]>([])
  const [flagToAdmin, setFlagToAdmin] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addSnag() {
    setSnags(prev => [...prev, { location: '', description: '', severity: 'minor', photoUrl: null, uploading: false, error: null }])
  }

  function updateSnag(idx: number, field: 'location' | 'description' | 'severity', value: string) {
    setSnags(prev => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))
  }

  function removeSnag(idx: number) {
    setSnags(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSnagPhoto(idx: number, file: File) {
    if (!bookingRef) {
      setSnags(prev => prev.map((s, i) => (i === idx ? { ...s, error: 'Select a job first' } : s)))
      return
    }
    setSnags(prev => prev.map((s, i) => (i === idx ? { ...s, uploading: true, error: null } : s)))
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadSnagPhoto(bookingRef, fd)
    setSnags(prev =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, uploading: false, photoUrl: result.url ?? s.photoUrl, error: result.error ?? null }
          : s,
      ),
    )
  }

  async function handleSubmit() {
    if (!bookingRef) {
      setError('Please select a job to inspect.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitPreDeliveryAssessment(supervisorId, {
        booking_ref: bookingRef,
        inspection_date: inspectionDate,
        clearance,
        snag_items: snags.map(s => ({
          location: s.location,
          description: s.description,
          severity: s.severity,
          photo_url: s.photoUrl,
        })),
        supervisor_flagged_to_admin: clearance !== 'cleared' && flagToAdmin,
        flag_reason: flagToAdmin ? flagReason || null : null,
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
        <p className="text-green-700 font-bold text-lg">Assessment Submitted</p>
        <p className="text-gray-500 text-sm mt-1">Pre-delivery assessment recorded for {bookingRef}.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Job</p>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-4">
          <select
            value={bookingRef}
            onChange={e => setBookingRef(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
          >
            <option value="">Select job...</option>
            {jobs.map(job => (
              <option key={job.booking_ref} value={job.booking_ref}>
                {job.booking_ref} — {job.job_title ?? job.job_type}
              </option>
            ))}
          </select>
          {jobs.length === 0 && (
            <p className="text-xs text-gray-400">No jobs currently in milestone review.</p>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Inspection Date</p>
            <input
              type="date"
              value={inspectionDate}
              onChange={e => setInspectionDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50"
            />
          </div>
        </div>
      </section>

      <section>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Overall Clearance</p>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {([
            { value: 'cleared', label: 'Cleared', color: 'text-green-700' },
            { value: 'conditional', label: 'Conditional', color: 'text-amber-700' },
            { value: 'not_cleared', label: 'Not Cleared', color: 'text-red-700' },
          ] as const).map(opt => (
            <label key={opt.value} className="flex items-center gap-3 px-5 py-3 cursor-pointer active:bg-gray-50">
              <input
                type="radio"
                name="clearance"
                checked={clearance === opt.value}
                onChange={() => setClearance(opt.value)}
                className="w-4 h-4"
              />
              <span className={`text-sm font-bold ${opt.color}`}>{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Snag Items</p>
          <button type="button" onClick={addSnag} className="text-xs text-[#2E74B5] font-semibold">
            + Add Snag Item
          </button>
        </div>
        <div className="space-y-3">
          {snags.map((snag, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500">Snag {idx + 1}</p>
                <button type="button" onClick={() => removeSnag(idx)} className="text-red-500 text-xs font-bold">
                  REMOVE
                </button>
              </div>
              <input
                type="text"
                value={snag.location}
                onChange={e => updateSnag(idx, 'location', e.target.value)}
                placeholder="Location (e.g. Master bathroom wall)"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50"
              />
              <textarea
                value={snag.description}
                onChange={e => updateSnag(idx, 'description', e.target.value)}
                rows={2}
                placeholder="Describe the snag..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50 resize-none"
              />
              <select
                value={snag.severity}
                onChange={e => updateSnag(idx, 'severity', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50"
              >
                {severityOptions.map(s => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>

              {snag.photoUrl && (
                <img src={snag.photoUrl} alt="Snag" className="w-full max-w-[200px] h-28 object-cover rounded-xl border border-gray-200" />
              )}
              {snag.uploading ? (
                <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-500 text-xs font-bold px-4 py-2 rounded-xl">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading…
                </span>
              ) : (
                <label className="inline-flex items-center gap-2 bg-[#1F3864] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                  📸 {snag.photoUrl ? 'Replace Photo' : 'Add Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleSnagPhoto(idx, file)
                    }}
                  />
                </label>
              )}
              {snag.error && <p className="text-red-600 text-xs">{snag.error}</p>}
            </div>
          ))}
          {snags.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-center">
              <p className="text-gray-400 text-sm">No snag items added</p>
            </div>
          )}
        </div>
      </section>

      {clearance !== 'cleared' && (
        <section>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={flagToAdmin} onChange={e => setFlagToAdmin(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">Flag this assessment for admin review</span>
            </label>
            {flagToAdmin && (
              <textarea
                value={flagReason}
                onChange={e => setFlagReason(e.target.value)}
                rows={3}
                placeholder="Reason for flagging to admin..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 resize-none"
              />
            )}
          </div>
        </section>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="w-full bg-[#1F3864] text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'SUBMIT PRE-DELIVERY ASSESSMENT'}
      </button>
    </div>
  )
}
