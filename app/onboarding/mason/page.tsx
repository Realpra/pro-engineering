'use client'

import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { submitWorker, saveCompetency, resubmitWorker } from './actions'

const ZONES = ['Noida Sector 62', 'Noida Sector 63', 'Noida Sector 64']

const MODULES = [
  { code: 'M1', label: 'Tile Works' },
  { code: 'M2', label: 'Plastering' },
  { code: 'M3', label: 'Brickwork' },
  { code: 'M4', label: 'Flooring' },
  { code: 'M5', label: 'Kitchen and Countertop' },
  { code: 'M6', label: 'Emergency Leakage' },
]

const MCQ: Record<string, { question: string; options: string[]; answer: string }> = {
  M1: {
    question: 'Which bond pattern gives the strongest result for wall tile installation?',
    options: ['Stacked / Grid bond', 'Staggered / Brick bond', 'Diagonal bond', 'Herringbone bond'],
    answer: 'Staggered / Brick bond',
  },
  M2: {
    question: 'What is the standard thickness of the scratch (base) coat of plaster?',
    options: ['3 – 5 mm', '6 – 9 mm', '12 – 15 mm', '20 – 25 mm'],
    answer: '12 – 15 mm',
  },
  M3: {
    question: 'What is the standard minimum lap (overlap) in English brick bonding?',
    options: ['Full brick', 'Half brick', 'Quarter brick', 'Third brick'],
    answer: 'Quarter brick',
  },
  M4: {
    question: 'Before laying stone flooring, what is the minimum curing time for the base screed?',
    options: ['24 hours', '3 days', '7 days', '28 days'],
    answer: '7 days',
  },
  M5: {
    question: 'Which material is best for sealing the joint between a countertop and the wall?',
    options: ['White cement grout', 'Silicone sealant', 'Epoxy paste', 'PVC tape'],
    answer: 'Silicone sealant',
  },
  M6: {
    question: 'When you discover an active pipe leak on site, what should you do FIRST?',
    options: ['Apply waterproofing membrane', 'Isolate the water supply valve', 'Drill drainage holes nearby', 'Report to supervisor only'],
    answer: 'Isolate the water supply valve',
  },
}

type Screen = 1 | 2 | 3 | 4 | 'resubmit' | 'success'

// ─── Small helpers ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-[#1F3864] mb-2">
      {children}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full px-4 py-4 rounded-xl border border-gray-200 bg-white text-base',
        'text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2',
        'focus:ring-[#2E74B5] focus:border-transparent transition-shadow',
        'disabled:bg-gray-50 disabled:text-gray-400',
        props.className ?? '',
      ].join(' ')}
    />
  )
}

function PrimaryBtn({
  children,
  disabled,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full py-4 rounded-xl bg-[#1F3864] text-white font-semibold text-base',
        'active:scale-[0.98] transition-all disabled:opacity-40',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function OutlineBtn({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full py-4 rounded-xl border-2 border-[#1F3864] text-[#1F3864] font-semibold text-base active:scale-[0.98] transition-all"
    >
      {children}
    </button>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MasonOnboardingPage() {
  const supabase = useMemo(() => createClient(), [])

  const [screen, setScreen] = useState<Screen>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Screen 1 — identity
  const [fullName, setFullName] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [phone, setPhone] = useState('')

  // Screen 2 — bank
  const [bankAcc, setBankAcc] = useState('')
  const [ifsc, setIfsc] = useState('')

  // Screen 3 — site + photo
  const [zone, setZone] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Screen 4 — competency
  const [workerId, setWorkerId] = useState<string | null>(null)

  // Resubmit flow
  const [returningWorker, setReturningWorker] = useState<{
    id: string
    rejection_reason: string | null
    correction_action: string | null
  } | null>(null)
  const [resubmitLoading, setResubmitLoading] = useState(false)
  const [resubmitDone, setResubmitDone] = useState(false)
  const [moduleDeclared, setModuleDeclared] = useState<Record<string, boolean | null>>(
    () => Object.fromEntries(MODULES.map(m => [m.code, null]))
  )
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({})

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Navigation ───────────────────────────────────────────────────────────────

  async function goTo2() {
    if (!fullName.trim()) { setError('Full name is required'); return }
    if (!/^\d{4}$/.test(aadhaar)) { setError('Enter the last 4 digits of your Aadhaar'); return }
    if (phone.replace(/\D/g, '').length !== 10) { setError('Enter a valid 10-digit mobile number'); return }
    setError(null)
    setLoading(true)

    const normalizedPhone = `+91${phone.replace(/\D/g, '').slice(-10)}`
    const { data } = await supabase
      .from('workers')
      .select('id, rejection_reason, correction_action')
      .eq('phone', normalizedPhone)
      .eq('approval_status', 'returned_for_correction')
      .maybeSingle()

    setLoading(false)

    if (data) {
      setReturningWorker(data)
      setWorkerId(data.id)
      setScreen('resubmit')
    } else {
      setScreen(2)
    }
  }

  async function handleResubmit() {
    if (!workerId) return
    setResubmitLoading(true)
    setError(null)
    const res = await resubmitWorker(workerId)
    setResubmitLoading(false)
    if (res?.error) { setError(res.error); return }
    setResubmitDone(true)
  }

  function goTo3() {
    if (!/^\d{9,18}$/.test(bankAcc)) {
      setError('Enter a valid account number (9–18 digits)')
      return
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
      setError('Enter a valid IFSC code (e.g. SBIN0001234)')
      return
    }
    setError(null)
    setScreen(3)
  }

  // ── Photo ────────────────────────────────────────────────────────────────────

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Final submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!zone) { setError('Select your working zone'); return }
    if (!photo) { setError('Please take a selfie photograph'); return }
    setError(null)
    setLoading(true)

    // Upload selfie client-side (avoids server-action body-size limit on binary files)
    let photoPath: string | null = null
    const safeExt = photo.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') ?? 'jpg'
    const fileName = `${Date.now()}.${safeExt}`
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('worker-selfies')
      .upload(fileName, photo, { contentType: photo.type, upsert: false })
    if (uploadErr) {
      setLoading(false)
      setError(`Photo upload failed: ${uploadErr.message}`)
      return
    }
    photoPath = uploadData.path

    // Insert worker via server action
    const fd = new FormData()
    fd.set('full_name', fullName.trim())
    fd.set('aadhaar_last4', aadhaar)
    fd.set('phone', `+91${phone.replace(/\D/g, '').slice(-10)}`)
    fd.set('bank_account_number', bankAcc)
    fd.set('ifsc_code', ifsc.toUpperCase())
    fd.set('district', zone)
    fd.set('photo_path', photoPath)

    const result = await submitWorker(fd)
    setLoading(false)
    if (result.error) setError(result.error)
    else {
      setWorkerId(result.workerId ?? null)
      setScreen(4)
    }
  }

  async function handleSaveCompetency() {
    if (!workerId) return
    const yesMods = MODULES.filter(m => moduleDeclared[m.code] === true)
    const unanswered = yesMods.filter(m => !mcqAnswers[m.code])
    if (unanswered.length > 0) {
      setError(`Please answer the question for: ${unanswered.map(m => m.label).join(', ')}`)
      return
    }
    setError(null)
    setLoading(true)

    const entries = MODULES.map(m => {
      const declared = moduleDeclared[m.code] === true
      const userAnswer = mcqAnswers[m.code] ?? null
      const correct = declared && userAnswer === MCQ[m.code].answer
      return {
        module_code: m.code,
        declared,
        mcq_passed: declared ? correct : null,
        score: declared ? (correct ? 1 : 0) : null,
      }
    })

    const result = await saveCompetency(workerId, entries)
    setLoading(false)
    if (result.error) setError(result.error)
    else setScreen('success')
  }

  // ── Progress ─────────────────────────────────────────────────────────────────

  const progressPct = screen === 'success' ? 100 : screen === 'resubmit' ? 0 : ((screen as number) / 4) * 100

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1F3864] px-5 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-md">
        <div className="w-9 h-9 rounded-xl bg-[#2E74B5] flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Pro Engineering</p>
          <p className="text-blue-300 text-xs">Mason Registration</p>
        </div>
        {screen !== 'success' && screen !== 'resubmit' && (
          <span className="text-blue-200 text-sm font-semibold tabular-nums shrink-0">
            {screen} / 4
          </span>
        )}
      </header>

      {/* Progress bar */}
      {screen !== 'success' && screen !== 'resubmit' && (
        <div className="h-1.5 bg-[#1F3864]/10">
          <div
            className="h-full bg-[#2E74B5] transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 px-5 py-7 max-w-lg mx-auto w-full">

        {/* Error banner */}
        {error && <ErrorBanner message={error} />}

        {/* ── Screen 1: Identity ──────────────────────────────────────────────── */}
        {screen === 1 && (
          <div>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-[#1F3864]">Personal Details</h1>
              <p className="text-gray-500 text-sm mt-1">
                Enter your name, Aadhaar and mobile number
              </p>
            </div>

            <div className="space-y-5">
              {/* Full name */}
              <div>
                <Label>Full Name</Label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="As on Aadhaar card"
                  autoComplete="name"
                />
              </div>

              {/* Aadhaar last 4 */}
              <div>
                <Label>Aadhaar — Last 4 Digits</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={aadhaar}
                  onChange={e => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 4521"
                  className="tracking-[0.35em]"
                />
              </div>

              {/* Phone */}
              <div>
                <Label>Mobile Number</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-4 py-4 rounded-xl border border-gray-200 bg-gray-50 text-base text-gray-600 font-semibold shrink-0 select-none">
                    +91
                  </div>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    maxLength={10}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    autoComplete="tel-national"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8">
              <PrimaryBtn onClick={goTo2}>Continue →</PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Screen 2: Bank Details ──────────────────────────────────────────── */}
        {screen === 2 && (
          <div>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-[#1F3864]">Bank Details</h1>
              <p className="text-gray-500 text-sm mt-1">
                Your wages will be transferred to this account
              </p>
            </div>

            <div className="space-y-5">
              {/* Account number */}
              <div>
                <Label>Account Number</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={bankAcc}
                  onChange={e =>
                    setBankAcc(e.target.value.replace(/\D/g, '').slice(0, 18))
                  }
                  placeholder="9 – 18 digit account number"
                  autoComplete="off"
                />
              </div>

              {/* IFSC */}
              <div>
                <Label>IFSC Code</Label>
                <Input
                  type="text"
                  value={ifsc}
                  onChange={e =>
                    setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))
                  }
                  placeholder="e.g. SBIN0001234"
                  className="tracking-wider"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  4 letters · 0 · 6 characters — printed on your cheque book
                </p>
              </div>

              {/* Info card */}
              <div className="flex items-start gap-3 p-4 bg-[#2E74B5]/6 border border-[#2E74B5]/20 rounded-xl">
                <svg
                  className="w-5 h-5 text-[#2E74B5] shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs text-[#1F3864] leading-relaxed">
                  Your bank details are stored securely and used only for wage
                  transfers. Pro Engineering will never ask for your PIN or CVV.
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <div className="flex-1">
                <OutlineBtn onClick={() => { setError(null); setScreen(1) }}>← Back</OutlineBtn>
              </div>
              <div className="flex-[2]">
                <PrimaryBtn onClick={goTo3}>Continue →</PrimaryBtn>
              </div>
            </div>
          </div>
        )}

        {/* ── Screen 3: Zone + Photo ──────────────────────────────────────────── */}
        {screen === 3 && (
          <div>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-[#1F3864]">Site &amp; Photo</h1>
              <p className="text-gray-500 text-sm mt-1">
                Select your working zone and take a selfie
              </p>
            </div>

            <div className="space-y-6">
              {/* Zone selection */}
              <div>
                <Label>Working Zone</Label>
                <div className="space-y-3">
                  {ZONES.map(z => {
                    const active = zone === z
                    return (
                      <button
                        key={z}
                        onClick={() => setZone(z)}
                        className={[
                          'w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 text-left',
                          'active:scale-[0.98] transition-all',
                          active
                            ? 'bg-[#1F3864] border-[#1F3864]'
                            : 'bg-white border-gray-200 hover:border-[#2E74B5]',
                        ].join(' ')}
                      >
                        <div>
                          <p
                            className={`font-semibold text-base ${
                              active ? 'text-white' : 'text-gray-800'
                            }`}
                          >
                            {z}
                          </p>
                          <p
                            className={`text-sm mt-0.5 ${
                              active ? 'text-blue-200' : 'text-gray-400'
                            }`}
                          >
                            Uttar Pradesh
                          </p>
                        </div>
                        {active ? (
                          <svg
                            className="w-5 h-5 text-white shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Trade — read-only */}
              <div>
                <Label>Trade</Label>
                <div className="flex items-center gap-3 px-4 py-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="w-9 h-9 rounded-lg bg-[#1F3864]/10 flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5 text-[#1F3864]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M3 14h18M10 3v18M14 3v18"
                      />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-800 text-base flex-1">Mason</span>
                  <span className="text-xs text-gray-400 bg-gray-200 px-2.5 py-1 rounded-full font-medium">
                    Pre-selected
                  </span>
                </div>
              </div>

              {/* Selfie upload */}
              <div>
                <Label>Selfie Photograph</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Selfie preview"
                      className="w-full h-56 object-cover rounded-xl border-2 border-[#2E74B5]"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute bottom-3 right-3 px-3 py-2 bg-[#1F3864]/85 text-white text-sm font-semibold rounded-lg backdrop-blur-sm active:scale-95 transition-all"
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-10 rounded-xl border-2 border-dashed border-[#2E74B5]/40 bg-[#2E74B5]/5 flex flex-col items-center gap-3 active:scale-[0.98] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-[#2E74B5]/12 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-[#2E74B5]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-[#1F3864] font-semibold text-base">Take Selfie</p>
                      <p className="text-gray-400 text-sm mt-0.5">
                        Face the camera clearly, good lighting
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <div className="flex-1">
                <OutlineBtn onClick={() => { setError(null); setScreen(2) }}>← Back</OutlineBtn>
              </div>
              <div className="flex-[2]">
                <PrimaryBtn onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Submitting…' : 'Submit Registration'}
                </PrimaryBtn>
              </div>
            </div>
          </div>
        )}

        {/* ── Screen 4: Competency Modules ──────────────────────────────────── */}
        {screen === 4 && (
          <div>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-[#1F3864]">Skill Modules</h1>
              <p className="text-gray-500 text-sm mt-1">
                Select the areas you are confident working in
              </p>
            </div>

            {/* Module tiles */}
            <div className="grid grid-cols-2 gap-3 mb-7">
              {MODULES.map(m => {
                const dec = moduleDeclared[m.code]
                return (
                  <div
                    key={m.code}
                    className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm"
                  >
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#1F3864] text-white text-xs font-bold mb-1.5">
                        {m.code}
                      </span>
                      <p className="text-gray-800 font-semibold text-sm leading-snug">{m.label}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setModuleDeclared(prev => ({ ...prev, [m.code]: true }))}
                        className={[
                          'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                          dec === true
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'border border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-600',
                        ].join(' ')}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setModuleDeclared(prev => ({ ...prev, [m.code]: false }))}
                        className={[
                          'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                          dec === false
                            ? 'bg-gray-300 text-gray-700 shadow-sm'
                            : 'border border-gray-200 text-gray-400 hover:border-gray-300',
                        ].join(' ')}
                      >
                        No
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* MCQ questions for Yes modules */}
            {MODULES.some(m => moduleDeclared[m.code] === true) && (
              <div className="space-y-5 mb-7">
                <p className="text-sm font-semibold text-[#1F3864]">
                  Answer one question for each selected module
                </p>
                {MODULES.filter(m => moduleDeclared[m.code] === true).map(m => {
                  const q = MCQ[m.code]
                  return (
                    <div
                      key={m.code}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                    >
                      <div className="bg-[#1F3864]/5 px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-[#2E74B5] uppercase tracking-wide mb-1">
                          {m.code} — {m.label}
                        </p>
                        <p className="text-sm font-semibold text-gray-800">{q.question}</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {q.options.map(opt => {
                          const selected = mcqAnswers[m.code] === opt
                          return (
                            <button
                              key={opt}
                              onClick={() => setMcqAnswers(prev => ({ ...prev, [m.code]: opt }))}
                              className={[
                                'w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all',
                                selected
                                  ? 'border-[#2E74B5] bg-[#2E74B5]/8 text-[#1F3864] font-semibold'
                                  : 'border-gray-100 text-gray-700 hover:border-[#2E74B5]/40',
                              ].join(' ')}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <PrimaryBtn onClick={handleSaveCompetency} disabled={loading || !workerId}>
                {loading ? 'Saving…' : 'Save & Continue →'}
              </PrimaryBtn>
              <OutlineBtn onClick={() => { setError(null); setScreen('success') }}>
                Skip for now
              </OutlineBtn>
            </div>
          </div>
        )}

        {/* ── Resubmit ────────────────────────────────────────────────────────── */}
        {screen === 'resubmit' && returningWorker && (
          <div>
            {/* Amber banner */}
            <div className="mb-6 rounded-xl bg-amber-50 border border-amber-300 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-amber-800 text-base leading-snug">
                  Your registration was returned for correction
                </p>
                <p className="text-amber-700 text-sm mt-1 leading-relaxed">
                  Please make the required changes and resubmit for review.
                </p>
              </div>
            </div>

            {/* Rejection reason */}
            {returningWorker.rejection_reason && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Return Reason
                </p>
                <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                  <p className="text-sm text-gray-800">{returningWorker.rejection_reason}</p>
                </div>
              </div>
            )}

            {/* Correction checklist */}
            {returningWorker.correction_action && (
              <div className="mb-7">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Correction Action Required
                </p>
                <div className="bg-white rounded-xl border border-amber-200 px-4 py-3 space-y-2.5">
                  {returningWorker.correction_action
                    .split(/\.\s+/)
                    .map(s => s.trim().replace(/\.$/, ''))
                    .filter(Boolean)
                    .map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-amber-700">{i + 1}</span>
                        </div>
                        <p className="text-sm text-gray-800">{item}.</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Resubmit button / success state */}
            {resubmitDone ? (
              <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="font-bold text-green-800 text-base">Resubmitted Successfully</p>
                <p className="text-green-700 text-sm mt-1 leading-relaxed max-w-xs mx-auto">
                  Your registration has been resubmitted. You will be notified when reviewed.
                </p>
              </div>
            ) : (
              <button
                onClick={handleResubmit}
                disabled={resubmitLoading}
                className="w-full py-4 rounded-xl bg-green-600 text-white font-semibold text-base active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {resubmitLoading ? 'Resubmitting…' : 'I have made the corrections — Resubmit for Review'}
              </button>
            )}
          </div>
        )}

        {/* ── Success ─────────────────────────────────────────────────────────── */}
        {screen === 'success' && (
          <div className="flex flex-col items-center text-center py-10">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-[#1F3864] mb-2">
              Registration Submitted!
            </h2>
            <p className="text-gray-600 text-base mb-1">
              Welcome,{' '}
              <span className="font-semibold text-gray-800">{fullName}</span>
            </p>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
              Our team will review your details and contact you on your registered
              mobile number within 24 hours.
            </p>

            {/* Summary card */}
            <div className="mt-8 w-full max-w-xs bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-[#1F3864] px-4 py-3">
                <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider">
                  Registration Summary
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  { label: 'Name', value: fullName },
                  { label: 'Trade', value: 'Mason' },
                  { label: 'Zone', value: zone },
                  { label: 'State', value: 'Uttar Pradesh' },
                  { label: 'Phone', value: `+91 ${phone}` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-semibold text-gray-800 text-right max-w-[55%] truncate">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-6 text-xs text-gray-400">
              Reference number will be sent via SMS to your registered mobile.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
