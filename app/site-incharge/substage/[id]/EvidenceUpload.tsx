'use client'
import { useState, useTransition } from 'react'
import { uploadEvidence } from './actions'

interface EvidenceItem {
  type: string
  label: string
  confirmed: boolean
  url?: string
}

interface Props {
  substageId: string
  evidenceChecklist: EvidenceItem[]
}

export default function EvidenceUpload({ substageId, evidenceChecklist: initial }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>(initial)
  const [uploading, setUploading] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleUpload(index: number, label: string, file: File) {
    setUploading(index)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('label', label)
    formData.append('index', index.toString())

    startTransition(async () => {
      try {
        const result = await uploadEvidence(substageId, formData)
        if (result.success) {
          setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, confirmed: true, url: result.url } : item
          ))
        }
      } catch (e) {
        console.error('Upload failed:', e)
      } finally {
        setUploading(null)
      }
    })
  }

  const confirmed = items.filter(i => i.confirmed).length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-bold text-[#1F3864] uppercase tracking-wider">Evidence Required</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confirmed === items.length ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {confirmed}/{items.length}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <div key={index} className="px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">📷</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 leading-snug mb-2">{item.label}</p>
                {item.confirmed ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Confirmed
                    </span>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2E74B5] underline">View</a>
                    )}
                  </div>
                ) : (
                  <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${uploading === index ? 'bg-gray-100 text-gray-400' : 'bg-[#1F3864] text-white active:bg-[#162c50]'}`}>
                    {uploading === index ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload Photo
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploading !== null || isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(index, item.label, file)
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}