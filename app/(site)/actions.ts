'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createClientDevAuthAccount } from '@/app/book/actions'
import { logJobMovement } from '@/lib/jobMovementLog'

// The public site runs anonymously -- geo_hierarchy's RLS only grants SELECT to
// `authenticated`, and both inserts below are public form submissions. Same
// service-role precedent as app/book/actions.ts's own adminClient().
function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export type GeoNode = { id: string; name: string; level: string | null; parent_id: string | null }

// Full State > District > Region > Zone > Sector tree. The client-facing picker
// only ever shows State > District > Sector (the project owner's rule: zones are
// the project side's concern, not the client's) and resolves a district's
// sectors by walking parent_id through the region/zone rows in between.
export async function getPublicGeoTree(): Promise<GeoNode[]> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('geo_hierarchy')
    .select('id, name, level, parent_id')
    .eq('is_active', true)
    .in('level', ['state', 'district', 'region', 'zone', 'sector'])
    .order('name')
  return (data ?? []) as GeoNode[]
}

export type SkillCount = { skill: string; count: number }
export type RequestType = 'one_day' | 'turn_key' | 'labour_bazaar'

export type JobRequestInput = {
  requestType: RequestType
  trade: string
  skill?: string
  jobType?: string
  lumpSumPackage?: string
  withMaterial?: boolean
  workUnit?: 'full_day' | 'hours'
  timeFrom?: string
  timeTo?: string
  daySlot?: 'forenoon' | 'afternoon'
  durationDays?: number
  skillsRequired: SkillCount[]
  scopeDescription: string
  preferredDate: string
  state: string
  district: string
  sector: string
  address: string
  firmName?: string
  contactName: string
  contactPhone: string
  contactEmail?: string
}

function generateRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'PE'
  for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

// guest_enquiries.job_type has a live CHECK constraint; these are the values
// lib/booking.ts's JOB_TYPE_DB_MAP already writes, nothing new.
function dbJobType(input: JobRequestInput): string {
  if (input.requestType === 'labour_bazaar') return 'construction'
  if (input.trade === 'Civil') return input.skill === 'Waterproofing' ? 'waterproofing' : 'renovation'
  return 'other'
}

function jobTitle(input: JobRequestInput): string {
  if (input.requestType === 'one_day') return [input.trade, input.skill, input.jobType].filter(Boolean).join(' - ')
  if (input.requestType === 'turn_key') return `${input.lumpSumPackage} (${input.trade}, lump sum)`
  const total = input.skillsRequired.reduce((n, s) => n + s.count, 0)
  return `Labour Bazaar - ${total} workers (${input.trade})`
}

export async function submitJobRequest(
  input: JobRequestInput,
): Promise<{ bookingRef?: string; loginEmail?: string; error?: string }> {
  const name = input.contactName.trim()
  const phone = input.contactPhone.replace(/\D/g, '')
  if (!name) return { error: 'Please enter your name.' }
  if (phone.length < 10) return { error: 'Please enter a 10-digit mobile number.' }
  if (!input.trade) return { error: 'Please choose a trade.' }
  if (!input.preferredDate) return { error: 'Please choose a date.' }
  if (!input.district || !input.sector) return { error: 'Please choose the district and sector.' }
  if (!input.address.trim()) return { error: 'Please enter the address.' }

  const skills = input.skillsRequired.filter(s => s.skill && s.count > 0)

  try {
    const admin = adminClient()
    const ref = generateRef()

    const { error: insertErr } = await admin.from('guest_enquiries').insert({
      booking_ref: ref,
      contact_name: name,
      contact_phone: phone,
      contact_email: input.contactEmail?.trim() || null,
      job_title: jobTitle(input),
      job_type: dbJobType(input),
      zone: input.sector,
      district: input.district,
      preferred_start_date: input.preferredDate,
      status: 'enquiry',
      scope_description: input.scopeDescription.trim() || null,
      address_line: input.address.trim(),
      site_state: input.state || null,
      firm_name: input.firmName?.trim() || null,
      request_type: input.requestType,
      request_trade: input.trade,
      request_skill: input.skill || null,
      request_job_type: input.jobType || null,
      lump_sum_package: input.lumpSumPackage || null,
      with_material: input.requestType === 'turn_key' ? input.withMaterial ?? null : null,
      work_unit: input.requestType === 'one_day' ? input.workUnit ?? null : null,
      time_from: input.workUnit === 'hours' ? input.timeFrom || null : null,
      time_to: input.workUnit === 'hours' ? input.timeTo || null : null,
      day_slot: input.requestType === 'one_day' ? input.daySlot ?? null : null,
      duration_days: input.durationDays ?? null,
      skills_required: skills,
    })
    if (insertErr) return { error: insertErr.message }

    // A signed-in client raising another request keeps their one account --
    // every visit is a new job, never a new login. Anyone else gets the same
    // dev/beta account /book/submit creates (createClientDevAuthAccount).
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await logJobMovement(admin, {
      bookingRef: ref, stage: 'request', action: 'created',
      fromUserId: user?.id ?? null, fromRole: user ? null : 'client', toRole: 'admin',
      remarks: `Website request: ${input.requestType}`,
    })
    if (user) {
      const { data: profile } = await admin.from('users').select('platform_role').eq('id', user.id).maybeSingle()
      if (profile?.platform_role === 'client') {
        await admin.from('guest_enquiries').update({ client_user_id: user.id }).eq('booking_ref', ref)
        return { bookingRef: ref }
      }
    }

    const devAccount = await createClientDevAuthAccount(ref, name)
    return { bookingRef: ref, loginEmail: devAccount.loginEmail }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e.message }
  }
}

export type PartnerType = 'team_head' | 'associate' | 'contractor'

export type PartnerInput = {
  partnerType: PartnerType
  fullName: string
  phone: string
  whatsappPhone?: string
  email?: string
  companyName?: string
  firmType?: string
  gstNumber?: string
  panNumber?: string
  yearEstablished?: number
  officeAddress?: string
  websiteLinks?: string
  socialLinks?: string
  yearsExperience?: number
  workKinds?: string
  largestJob?: string
  clientReferences?: string
  teamBasis?: 'by_skill' | 'by_package'
  teamPackage?: string
  teamComposition: SkillCount[]
  totalWorkers?: number
  state?: string
  districts: string[]
  sectors: string[]
  engagementTypes: string[]
  commercialTerms?: string
  remarks?: string
  declared: boolean
}

export async function submitPartnerRegistration(
  input: PartnerInput,
): Promise<{ success?: true; error?: string }> {
  const name = input.fullName.trim()
  const phone = input.phone.replace(/\D/g, '')
  if (!name) return { error: 'Please enter your name.' }
  if (phone.length < 10) return { error: 'Please enter a 10-digit mobile number.' }
  if (input.partnerType === 'contractor' && !input.gstNumber?.trim()) return { error: 'Please enter your GST number.' }
  if (input.engagementTypes.length === 0) return { error: 'Please tick at least one way you want to work with us.' }
  if (!input.declared) return { error: 'Please confirm the declaration.' }

  try {
    const admin = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from('supply_partners').insert({
      partner_type: input.partnerType,
      full_name: name,
      phone,
      whatsapp_phone: input.whatsappPhone?.replace(/\D/g, '') || null,
      email: input.email?.trim() || null,
      company_name: input.companyName?.trim() || null,
      firm_type: input.firmType || null,
      gst_number: input.gstNumber?.trim().toUpperCase() || null,
      pan_number: input.panNumber?.trim().toUpperCase() || null,
      year_established: input.yearEstablished ?? null,
      office_address: input.officeAddress?.trim() || null,
      website_links: input.websiteLinks?.trim() || null,
      social_links: input.socialLinks?.trim() || null,
      years_experience: input.yearsExperience ?? null,
      work_kinds: input.workKinds?.trim() || null,
      largest_job: input.largestJob?.trim() || null,
      client_references: input.clientReferences?.trim() || null,
      team_basis: input.teamBasis ?? null,
      team_package: input.teamBasis === 'by_package' ? input.teamPackage || null : null,
      team_composition: input.teamComposition.filter(s => s.skill && s.count > 0),
      total_workers: input.totalWorkers ?? null,
      site_state: input.state || null,
      districts: input.districts,
      sectors: input.sectors,
      engagement_types: input.engagementTypes,
      commercial_terms: input.commercialTerms?.trim() || null,
      remarks: input.remarks?.trim() || null,
      declared: true,
    })
    if (error) return { error: error.message }
    return { success: true }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e.message }
  }
}
