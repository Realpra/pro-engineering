'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

type ActionResult = {
  success?: true
  error?: string
  bookingRef?: string
}

// Real, production self-service path (replaces the previous mechanism, which
// generated a token/OTP and stored it on guest_enquiries but never actually
// dispatched it anywhere -- confirmed non-functional, Session 63/this
// session's own finding). Magic-link and phone-OTP sending itself now runs
// client-side via the Supabase Auth SDK directly (app/client/login/page.tsx,
// app/client/auth/callback/page.tsx) so the resulting session is set
// correctly in the browser -- this server action only does the one thing
// that needs elevated access: linking a real, now-authenticated
// auth.users.id onto every guest_enquiries row matching the verified
// email/phone, since client_user_id was previously never written by any
// live code path at all.
export async function linkClientAccount(
  userId: string,
  contactEmail: string | null,
  contactPhone: string | null,
): Promise<ActionResult> {
  if (!contactEmail && !contactPhone) return { error: 'No contact to match against.' }

  const admin = adminClient()
  const now = new Date().toISOString()

  const query = admin.from('guest_enquiries').select('booking_ref, created_at').order('created_at', { ascending: false })
  const { data: rows, error: findErr } = contactEmail
    ? await query.eq('contact_email', contactEmail)
    : await query.eq('contact_phone', contactPhone!)

  if (findErr) return { error: findErr.message }
  if (!rows || rows.length === 0) {
    return { error: 'No booking found for this contact. Ask your coordinator to confirm your details are on file.' }
  }

  const { error: updateErr } = contactEmail
    ? await admin.from('guest_enquiries').update({ client_user_id: userId, client_last_login_at: now }).eq('contact_email', contactEmail)
    : await admin.from('guest_enquiries').update({ client_user_id: userId, client_last_login_at: now }).eq('contact_phone', contactPhone!)

  if (updateErr) return { error: updateErr.message }

  return { success: true, bookingRef: rows[0].booking_ref }
}

export async function getBookingRefForUser(userId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('guest_enquiries')
    .select('booking_ref')
    .eq('client_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) {
    return { error: 'No booking found for this account.' }
  }

  return { success: true, bookingRef: row.booking_ref }
}
