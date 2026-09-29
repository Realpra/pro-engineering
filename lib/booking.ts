export interface BookingState {
  jobType?: string
  jobTitle?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  budget?: number
  zone?: string
  district?: string
  startDate?: string
  durationWeeks?: number
  serviceModel?: string
  serviceModelTitle?: string
  siteVisitDate?: string
  siteVisitSlot?: string
  scopeApproved?: boolean
  estimateTotal?: number
  jobId?: string
}

const KEY = 'proeng_booking_v1'

export function getBooking(): BookingState {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveBooking(data: Partial<BookingState>): BookingState {
  const updated = { ...getBooking(), ...data }
  localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}

export function clearBooking(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY)
}

// Maps UI job type IDs to Supabase CHECK constraint values
export const JOB_TYPE_DB_MAP: Record<string, string> = {
  'home-renovation': 'renovation',
  'leak-proofing': 'waterproofing',
  'construction': 'construction',
  'it-project': 'other',
  'clean-energy': 'other',
  'life-sciences': 'other',
  'geo-technical': 'civil',
  'project-management': 'other',
  'manufacturing': 'other',
}

// DEPRECATED (28 Sep 2026): superseded by the real geo_hierarchy District->Region->
// Zone->Sector picker in app/book/schedule/page.tsx, which now writes a real sector
// name straight into guest_enquiries.zone. These compass-direction codes never matched
// geo_hierarchy.name (generateBOQ's actual rate lookup), so every /book job silently
// defaulted to Noida Sector 62 -- see 20260928_geo_hierarchy_delhi_central_delhi.sql.
// Kept per this project's standing rule (never delete a construct without specific
// permission, only deprecate/add-alongside) -- not read anywhere in live code.
export const ZONE_DB_MAP: Record<string, string> = {
  'North': 'north',
  'South': 'south',
  'East': 'east',
  'West': 'west',
  'Central': 'central',
  'Northeast': 'northeast',
}
