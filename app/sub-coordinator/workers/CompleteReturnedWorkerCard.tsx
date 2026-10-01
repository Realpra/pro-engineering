'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeReturnedWorker, uploadCorrectionEvidence, type CompleteReturnedWorkerInput } from '../actions'

export type ReturnedWorker = {
  id: string
  full_name: string
  trade: string | null
  phone: string | null
  approval_status: string | null
  correction_action: string | null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function CompleteReturnedWorkerCard({ worker, currentUserId }: { worker: ReturnedWorker; currentUserId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<CompleteReturnedWorkerInput>({})
  const [howObtained, setHowObtained] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof CompleteReturnedWorkerInput>(key: K, value: CompleteReturnedWorkerInput[K]) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function submit() {
    setBusy(true)
    setError(null)
    let evidencePath: string | null = null
    if (evidenceFile) {
      const base64 = await fileToBase64(evidenceFile)
      const uploadRes = await uploadCorrectionEvidence(worker.id, base64, evidenceFile.name)
      if (uploadRes.error || !uploadRes.path) {
        setBusy(false)
        setError(uploadRes.error ?? 'Upload failed')
        return
      }
      evidencePath = uploadRes.path
    }
    const res = await completeReturnedWorker(worker.id, fields, howObtained.trim(), evidencePath, currentUserId)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setOpen(false)
    setFields({})
    setHowObtained('')
    setEvidenceFile(null)
    router.refresh()
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg p-2 text-xs'

  return (
    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
      <div className="bg-blue-50 px-5 py-3 border-b border-blue-100">
        <p className="text-sm font-bold text-gray-800">{worker.full_name}</p>
        <p className="text-xs text-gray-500">{worker.trade}{worker.phone ? ` · 📞 ${worker.phone}` : ''}</p>
        {worker.correction_action && <p className="text-xs text-amber-700 mt-1">Needs: {worker.correction_action}</p>}
      </div>
      <div className="px-5 py-4">
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="w-full bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl">
            📞 Complete From Phone/WhatsApp/Email
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Fill in only what the worker provided. Leave the rest blank.</p>
            <input className={inputCls} placeholder="Corrected phone" value={fields.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            <input className={inputCls} placeholder="Aadhaar last 4" maxLength={4} value={fields.aadhaarLast4 ?? ''} onChange={(e) => set('aadhaarLast4', e.target.value)} />
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={fields.bocwRegistered ?? false} onChange={(e) => set('bocwRegistered', e.target.checked)} />
              BOCW Registered
            </label>
            <input className={inputCls} placeholder="BOCW registration number" value={fields.bocwNumber ?? ''} onChange={(e) => set('bocwNumber', e.target.value)} />
            <input className={inputCls} placeholder="Bank account number" value={fields.bankAccount ?? ''} onChange={(e) => set('bankAccount', e.target.value)} />
            <input className={inputCls} placeholder="IFSC code" value={fields.ifscCode ?? ''} onChange={(e) => set('ifscCode', e.target.value.toUpperCase())} />
            <input className={inputCls} placeholder="Reference name" value={fields.reference1Name ?? ''} onChange={(e) => set('reference1Name', e.target.value)} />
            <input className={inputCls} placeholder="Reference phone" value={fields.reference1Phone ?? ''} onChange={(e) => set('reference1Phone', e.target.value)} />
            <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Other corrections made (describe)…" value={fields.otherCorrections ?? ''} onChange={(e) => set('otherCorrections', e.target.value)} />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Evidence photo/PDF (optional)</label>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} className="text-xs" />
            </div>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="How was this obtained? (e.g. called worker on WhatsApp 2 Oct, photo of BOCW card sent)"
              value={howObtained}
              onChange={(e) => setHowObtained(e.target.value)}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={busy || !howObtained.trim()}
                className="flex-1 bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Submit & Return to Pipeline'}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="px-3 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
