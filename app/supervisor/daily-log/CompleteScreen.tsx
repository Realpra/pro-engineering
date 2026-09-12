'use client'

import Link from 'next/link'

export default function CompleteScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-[#1F3864] mb-2">Daily Log Complete</h2>
      <p className="text-sm text-gray-500 mb-8 max-w-xs">
        All sections submitted for today. Great work!
      </p>
      <Link
        href="/supervisor/dashboard"
        className="px-8 py-3 rounded-xl bg-[#1F3864] text-white font-bold text-sm active:bg-[#162950] transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
