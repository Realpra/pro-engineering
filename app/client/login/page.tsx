'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendMagicLink, sendOtp, verifyOtp, getBookingRefForUser } from './actions'

type Tab = 'magic' | 'otp' | 'email'

export default function ClientLoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('magic')

  // Magic link state
  const [magicContact, setMagicContact] = useState('')
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [magicError, setMagicError] = useState<string | null>(null)

  // OTP state
  const [otpPhase, setOtpPhase] = useState<1 | 2>(1)
  const [otpPhone, setOtpPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)

  // Email login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  async function handleSendMagicLink() {
    setMagicLoading(true)
    setMagicError(null)
    setMagicSent(false)
    const result = await sendMagicLink(magicContact)
    setMagicLoading(false)
    if (result.error) {
      setMagicError(result.error)
    } else {
      setMagicSent(true)
    }
  }

  async function handleSendOtp() {
    setOtpLoading(true)
    setOtpError(null)
    const result = await sendOtp(otpPhone)
    setOtpLoading(false)
    if (result.error) {
      setOtpError(result.error)
    } else {
      setOtpPhase(2)
    }
  }

  async function handleVerifyOtp() {
    setOtpLoading(true)
    setOtpError(null)
    const result = await verifyOtp(otpPhone, otpCode)
    setOtpLoading(false)
    if (result.error) {
      setOtpError(result.error)
    } else if (result.bookingRef) {
      router.push(`/client/dashboard/${result.bookingRef}`)
    }
  }

  async function handleEmailLogin() {
    setEmailLoading(true)
    setEmailError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setEmailError(error.message)
      setEmailLoading(false)
      return
    }

    const result = await getBookingRefForUser(data.user.id)
    setEmailLoading(false)

    if (result.error) {
      setEmailError(result.error)
    } else if (result.bookingRef) {
      router.push(`/client/dashboard/${result.bookingRef}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#1F3864] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <h1 className="text-[#1F3864] text-2xl font-bold text-center">PRO ENGINEERING</h1>
        <p className="text-gray-500 text-sm text-center mt-1 mb-6">Client Portal</p>

        <div className="flex gap-2 mb-6">
          {(
            [
              { key: 'magic', label: 'Magic Link' },
              { key: 'otp', label: 'OTP' },
              { key: 'email', label: 'Email Login' },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 px-3 py-2 rounded-full text-xs font-semibold transition ${
                tab === key
                  ? 'bg-[#1F3864] text-white'
                  : 'bg-white text-[#1F3864] border border-[#1F3864]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'magic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                WhatsApp number or email address
              </label>
              <input
                type="text"
                value={magicContact}
                onChange={e => setMagicContact(e.target.value)}
                placeholder="Enter your WhatsApp number or email"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
              />
            </div>

            <button
              type="button"
              onClick={handleSendMagicLink}
              disabled={magicLoading || !magicContact}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
            >
              {magicLoading ? 'Sending…' : 'SEND LINK'}
            </button>

            {magicSent && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                Link sent. Click the link in your WhatsApp or email to access your dashboard.
              </div>
            )}
            {magicError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {magicError}
              </div>
            )}
          </div>
        )}

        {tab === 'otp' && (
          <div className="space-y-4">
            {otpPhase === 1 && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Enter your registered mobile number
                  </label>
                  <input
                    type="text"
                    value={otpPhone}
                    onChange={e => setOtpPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || !otpPhone}
                  className="w-full bg-[#1F3864] hover:bg-[#162c50] text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
                >
                  {otpLoading ? 'Sending…' : 'SEND OTP'}
                </button>
              </>
            )}

            {otpPhase === 2 && (
              <>
                <input
                  type="number"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.slice(0, 6))}
                  maxLength={6}
                  placeholder="------"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otpCode.length !== 6}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
                >
                  {otpLoading ? 'Verifying…' : 'VERIFY OTP'}
                </button>
              </>
            )}

            {otpError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {otpError}
              </div>
            )}
          </div>
        )}

        {tab === 'email' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
              />
            </div>
            <button
              type="button"
              onClick={handleEmailLogin}
              disabled={emailLoading || !email || !password}
              className="w-full bg-[#1F3864] hover:bg-[#162c50] text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
            >
              {emailLoading ? 'Signing in…' : 'LOGIN'}
            </button>

            {emailError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {emailError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
