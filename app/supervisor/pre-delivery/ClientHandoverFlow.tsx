'use client'

import { useRef, useState } from 'react'
import { submitClientHandover, uploadHandoverPhoto, DISSATISFACTION_CATEGORIES } from './actions'

// SA-13 Client Handover Sign-Off, final 4-screen redesign (June log line
// 11224-11228). Screen 1: satisfaction Y/N. Screen 2 (if NO): grouped
// dissatisfaction categories. Screen 3: digital signature. Screen 4: 6
// handover photographs.
export default function ClientHandoverFlow({ assessmentId, bookingRef }: { assessmentId: string; bookingRef: string }) {
  const [screen, setScreen] = useState(1)
  const [satisfied, setSatisfied] = useState<boolean | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [photos, setPhotos] = useState<(string | null)[]>(Array(6).fill(null))
  const [uploading, setUploading] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  function toggleCategory(cat: string) {
    setCategories(prev => (prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]))
  }

  function getCanvasPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const point = 'touches' in e ? e.touches[0] : e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    drawing.current = true
    const ctx = canvas.getContext('2d')
    const { x, y } = getCanvasPos(e, canvas)
    ctx?.beginPath()
    ctx?.moveTo(x, y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getCanvasPos(e, canvas)
    if (ctx) {
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#1F3864'
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  function endDraw() {
    drawing.current = false
  }

  function clearSignature() {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  async function handlePhotoUpload(idx: number, file: File) {
    setUploading(idx)
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadHandoverPhoto(bookingRef, fd)
    setUploading(null)
    if (result.url) {
      setPhotos(prev => prev.map((p, i) => (i === idx ? result.url! : p)))
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    const canvas = canvasRef.current
    const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : null
    const result = await submitClientHandover({
      assessmentId,
      bookingRef,
      satisfied: satisfied ?? true,
      dissatisfactionCategories: categories,
      signatureDataUrl,
      handoverPhotoUrls: photos.filter((p): p is string => Boolean(p)),
    })
    setSubmitting(false)
    if (result.error) setError(result.error)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-2xl px-5 py-6 text-center">
        <p className="text-green-700 font-bold text-sm">✓ Client Handover Recorded</p>
        {satisfied === false && <p className="text-xs text-gray-500 mt-1">Routed to Sub-Coordinator's attention queue.</p>}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#1F3864]/20 shadow-sm overflow-hidden">
      <div className="bg-[#1F3864] px-5 py-3">
        <p className="text-white font-bold text-sm">Client Handover Sign-Off</p>
        <p className="text-blue-300 text-xs mt-0.5">Screen {screen} of 4</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {screen === 1 && (
          <>
            <p className="text-sm font-semibold text-gray-700">Is the client satisfied overall?</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setSatisfied(true); setScreen(3) }}
                className="flex-1 bg-green-600 text-white text-sm font-bold py-3 rounded-xl"
              >
                Yes
              </button>
              <button
                onClick={() => { setSatisfied(false); setScreen(2) }}
                className="flex-1 bg-red-600 text-white text-sm font-bold py-3 rounded-xl"
              >
                No
              </button>
            </div>
          </>
        )}

        {screen === 2 && (
          <>
            <p className="text-sm font-semibold text-gray-700">What's the client dissatisfied about?</p>
            <div className="space-y-2">
              {DISSATISFACTION_CATEGORIES.map(cat => (
                <label key={cat} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl cursor-pointer">
                  <input type="checkbox" checked={categories.includes(cat)} onChange={() => toggleCategory(cat)} className="w-4 h-4 rounded" />
                  <span className="text-sm text-gray-700">{cat}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setScreen(3)}
              disabled={categories.length === 0}
              className="w-full bg-[#1F3864] text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50"
            >
              Next →
            </button>
          </>
        )}

        {screen === 3 && (
          <>
            <p className="text-sm font-semibold text-gray-700">Client signature</p>
            <canvas
              ref={canvasRef}
              width={320}
              height={140}
              className="w-full border border-gray-300 rounded-xl bg-gray-50 touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            <div className="flex gap-2">
              <button onClick={clearSignature} className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 rounded-xl">
                Clear
              </button>
              <button onClick={() => setScreen(4)} className="flex-1 bg-[#1F3864] text-white text-xs font-bold py-2.5 rounded-xl">
                Next →
              </button>
            </div>
          </>
        )}

        {screen === 4 && (
          <>
            <p className="text-sm font-semibold text-gray-700">Handover photographs (up to 6)</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <label key={i} className="aspect-square border border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden bg-gray-50">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handlePhotoUpload(i, e.target.files[0])} />
                  {uploading === i ? (
                    <span className="text-xs text-gray-400">…</span>
                  ) : url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={`Handover ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400">+ Photo {i + 1}</span>
                  )}
                </label>
              ))}
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-green-600 text-white text-sm font-bold py-3 rounded-xl disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Complete Handover'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
