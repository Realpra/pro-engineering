'use client'
import { useState } from 'react'
import { loginAction } from './actions'
export default function UnifiedLoginPage() {
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await loginAction(formData)
    if (result?.error) { setError(result.error); setLoading(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1F3864]">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white mb-4">
            <span className="text-[#1F3864] font-black text-xl">PE</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Pro Engineering</h1>
          <p className="text-blue-200 mt-1 text-sm">Platform Portal </p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input type="email" name="email" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3864]" placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input type="password" name="password" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3864]" placeholder="••••••••" />
            </div>
              {error && typeof error==="string" && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 bg-[#1F3864] text-white rounded-xl font-bold hover:bg-[#162950] disabled:opacity-50">{loading ? 'Signing in...' : 'Sign In'}</button>
          </form>
          <p className="text-xs text-gray-400 text-center mt-6">Coordinator · Sub-Coordinator · Admin · Supervisor · Client · Super Admin</p>
        </div>
      </div>
    </div>
  )
}
