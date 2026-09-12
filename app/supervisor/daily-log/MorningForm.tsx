'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { submitMorningLog } from './actions'

type AttendanceStatus = 'present' | 'absent' | 'late'

type Props = {
  supervisorId: string
  bookingRef: string
  crew: { id: string; full_name: string; trade: string }[]
  onComplete: () => void
}

async function uploadPhoto(supervisorId: string, file: File, prefix: string): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${supervisorId}/${prefix}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('site-log-photos').upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  return path
}

export default function MorningForm({ supervisorId, bookingRef, crew, onComplete }: Props) {
  const initialAttendance = useMemo<Record<string, AttendanceStatus>>(
    () => Object.fromEntries(crew.map((w) => [w.id, 'present' as AttendanceStatus])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [attendance, setAttendance] = useState(initialAttendance)
  const [morningPhotoFile, setMorningPhotoFile] = useState<File | null>(null)
  const [sitePhotoPreview, setSitePhotoPreview] = useState<string | null>(null)
  const [plannedScope, setPlannedScope] = useState('')
  const [materialsDelivered, setMaterialsDelivered] = useState(false)
  const [materialsDescription, setMaterialsDescription] = useState('')
  const [materialsPhotoFile, setMaterialsPhotoFile] = useState<File | null>(null)
  const [materialsPhotoPreview, setMaterialsPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!morningPhotoFile) return
    setSubmitting(true)
    setError(null)
    try {
      const sitePhotoUrl = await uploadPhoto(supervisorId, morningPhotoFile, 'site')

      let materialsPhotoUrl: string | null = null
      if (materialsDelivered && materialsPhotoFile) {
        materialsPhotoUrl = await uploadPhoto(supervisorId, materialsPhotoFile, 'materials')
      }

      const crewAttendance = crew.map((w) => ({
        worker_id: w.id,
        name: w.full_name,
        trade: w.trade,
        status: attendance[w.id] ?? 'present',
      }))

      const result = await submitMorningLog({
        supervisorId,
        bookingRef,
        crewAttendance,
        sitePhotoUrl,
        plannedScope,
        materialsDelivered,
        materialsDescription: materialsDelivered ? materialsDescription : null,
        materialsPhotoUrl,
      })

      if (result.error) throw new Error(result.error)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-[#1F3864] mb-4">Morning Log</h2>

      <div className="mb-4 bg-gray-50 rounded-lg p-3">
        <p className="text-sm text-gray-500">Date</p>
        <p className="text-base font-medium">{new Date().toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</p>
        <p className="text-sm text-gray-500 mt-1">Job Reference</p>
        <p className="text-base font-medium">{bookingRef}</p>
      </div>

      <h3 className="text-base font-bold text-[#1F3864] mb-2">Crew Check-In</h3>
      <div className="space-y-3 mb-6">
        {crew.map(worker => (
          <div key={worker.id} className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="font-bold text-base">{worker.full_name}</p>
            <p className="text-sm text-gray-500 mb-2">{worker.trade}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAttendance(a => ({...a, [worker.id]: 'present'}))}
                className={`flex-1 py-4 rounded-lg text-base font-bold ${attendance[worker.id] === 'present' ? 'bg-green-600 text-white' : 'bg-white text-green-600 border-2 border-green-600'}`}
              >Present</button>
              <button
                type="button"
                onClick={() => setAttendance(a => ({...a, [worker.id]: 'absent'}))}
                className={`flex-1 py-4 rounded-lg text-base font-bold ${attendance[worker.id] === 'absent' ? 'bg-red-600 text-white' : 'bg-white text-red-600 border-2 border-red-600'}`}
              >Absent</button>
              <button
                type="button"
                onClick={() => setAttendance(a => ({...a, [worker.id]: 'late'}))}
                className={`flex-1 py-4 rounded-lg text-base font-bold ${attendance[worker.id] === 'late' ? 'bg-amber-500 text-white' : 'bg-white text-amber-500 border-2 border-amber-500'}`}
              >Late</button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-base font-bold text-[#1F3864] mb-2">First-on-Site Photograph</h3>
      <div className="mb-6">
        <input type="file" accept="image/*" id="morning-photo" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f) setMorningPhotoFile(f); }} />
        <label htmlFor="morning-photo" className="flex items-center justify-center gap-2 w-full py-5 bg-[#1F3864] text-white rounded-lg text-base font-bold cursor-pointer">
          📷 {morningPhotoFile ? morningPhotoFile.name : 'Take First-on-Site Photo'}
        </label>
        {morningPhotoFile && <p className="text-green-600 text-sm mt-1">✓ Photo selected</p>}
      </div>

      <h3 className="text-base font-bold text-[#1F3864] mb-2">Today's Planned Scope</h3>
      <textarea
        value={plannedScope}
        onChange={e => setPlannedScope(e.target.value)}
        placeholder="Describe today's planned work scope"
        className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[100px] mb-6"
      />

      <h3 className="text-base font-bold text-[#1F3864] mb-2">Materials Delivered Today?</h3>
      <div className="flex gap-3 mb-4">
        <button type="button" onClick={() => setMaterialsDelivered(true)} className={`flex-1 py-4 rounded-lg text-base font-bold ${materialsDelivered ? 'bg-green-600 text-white' : 'bg-white text-green-600 border-2 border-green-600'}`}>YES</button>
        <button type="button" onClick={() => setMaterialsDelivered(false)} className={`flex-1 py-4 rounded-lg text-base font-bold ${!materialsDelivered ? 'bg-gray-500 text-white' : 'bg-white text-gray-500 border-2 border-gray-300'}`}>NO</button>
      </div>
      {materialsDelivered && (
        <div className="mb-6">
          <textarea value={materialsDescription} onChange={e => setMaterialsDescription(e.target.value)} placeholder="Describe materials delivered" className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[80px] mb-3" />
          <input type="file" accept="image/*" id="materials-photo" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f) setMaterialsPhotoFile(f); }} />
          <label htmlFor="materials-photo" className="flex items-center justify-center gap-2 w-full py-4 bg-[#2E74B5] text-white rounded-lg text-base font-bold cursor-pointer">
            📷 {materialsPhotoFile ? materialsPhotoFile.name : 'Take Materials Photo'}
          </label>
          {materialsPhotoFile && <p className="text-green-600 text-sm mt-1">✓ Photo selected</p>}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!morningPhotoFile || submitting}
        className={`w-full py-5 rounded-lg text-base font-bold ${morningPhotoFile && !submitting ? 'bg-[#1F3864] text-white' : 'bg-gray-300 text-gray-500'}`}
      >
        {submitting ? 'Submitting...' : !morningPhotoFile ? 'Take site photo to enable submit' : 'Submit Morning Log'}
      </button>
    </div>
  )
}
