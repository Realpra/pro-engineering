'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

// /book runs anonymously (no login) -- geo_hierarchy's RLS policy only grants
// SELECT to `authenticated`, so an anon-key client would see zero rows. Same
// precedent already used by app/onboarding/[trade]/actions.ts's own public
// geo picker.
function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export type GeoNode = { id: string; name: string; level: string | null; parent_id: string | null }

export async function getBookingGeoTree(): Promise<GeoNode[]> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('geo_hierarchy')
    .select('id, name, level, parent_id')
    .eq('is_active', true)
    .in('level', ['district', 'region', 'zone', 'sector'])
    .order('name')
  return (data ?? []) as GeoNode[]
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'client'
}

// Dev/beta convention (project owner's explicit decision, 29 Sep 2026),
// exactly mirroring app/onboarding/[trade]/actions.ts's createWorkerAuthAccount
// for workers (WORKER DEV/BETA LOGIN CONVENTION, Session 65): every new
// booking gets its own real, distinct auth.users row immediately, with a
// systematically generated login email and a shared password, so local
// development/testing is never blocked on real email/SMS delivery while the
// real self-service signup path (Magic Link/Phone OTP, app/client/login)
// is what production clients actually use. Both paths set the exact same
// guest_enquiries.client_user_id column -- not two competing mechanisms.
const CLIENT_DEV_LOGIN_PASSWORD = 'Client2026'

export async function createClientDevAuthAccount(
  bookingRef: string,
  contactName: string,
): Promise<{ success?: true; loginEmail?: string; error?: string }> {
  try {
    const admin = adminClient()
    const suffix = bookingRef.replace(/[^A-Za-z0-9]/g, '').slice(-4).toLowerCase()
    const loginEmail = `${slugify(contactName)}_client_${suffix}@proengineering.in`

    const { data, error } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: CLIENT_DEV_LOGIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: contactName, booking_ref: bookingRef },
    })
    if (error) return { error: error.message }
    const newId = data.user.id

    const { error: usersErr } = await admin.from('users').insert({
      id: newId, email: loginEmail, full_name: contactName, platform_role: 'client',
    })
    if (usersErr) return { error: usersErr.message }

    const { error: updateErr } = await admin
      .from('guest_enquiries')
      .update({ client_user_id: newId })
      .eq('booking_ref', bookingRef)
    if (updateErr) return { error: updateErr.message }

    return { success: true, loginEmail }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e.message }
  }
}
