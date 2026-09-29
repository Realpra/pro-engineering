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
