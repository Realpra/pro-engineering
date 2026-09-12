export interface BookingState {
  jobType?: string
  jobTitle?: string
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
  tokenAmount?: number
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

export const ZONE_DB_MAP: Record<string, string> = {
  'North': 'north',
  'South': 'south',
  'East': 'east',
  'West': 'west',
  'Central': 'central',
  'Northeast': 'northeast',
}
