'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import content from '@/content/site-content.json'
import { createClient } from '@/lib/supabase/client'

export const ACCOUNT_PENDING_KEY = 'proeng_account_pending'

// Shown on every public page after a request is raised without signing in,
// and keeps coming back on each visit until the client has signed in once.
export default function AccountReminder() {
  const [bookingRef, setBookingRef] = useState<string | null>(null)

  useEffect(() => {
    const ref = localStorage.getItem(ACCOUNT_PENDING_KEY)
    if (!ref) return
    createClient().auth.getSession().then(({ data }) => {
      if (data.session) localStorage.removeItem(ACCOUNT_PENDING_KEY)
      else setBookingRef(ref)
    })
  }, [])

  if (!bookingRef) return null
  return (
    <div className="bg-[#F97316] text-[#1F2328]">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="font-mono font-bold">{bookingRef}</span> · {content.reminder.text}
        </span>
        <Link href="/client/login" className="font-bold underline underline-offset-4">{content.reminder.cta}</Link>
      </div>
    </div>
  )
}
