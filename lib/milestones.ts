// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

// Was duplicated identically in app/supervisor/milestone-tracker/actions.ts and
// app/site-incharge/substage/[id]/actions.ts (Duplicate/Conflict #3) -- both
// roles' "mark this substage done" actions need the same milestone-level
// rollup, so it now lives in one place both import.
export async function syncMilestonePaymentStatus(
  supabase: SupabaseAny,
  bookingRef: string,
  milestoneCode: string,
): Promise<void> {
  const { data: siblings } = await supabase
    .from('job_milestone_substages')
    .select('status')
    .eq('booking_ref', bookingRef)
    .eq('milestone_code', milestoneCode)

  const rows: SupabaseAny[] = siblings ?? []
  const allDone = rows.length > 0 && rows.every((s) => s.status === 'supervisor_submitted' || s.status === 'completed')

  if (allDone) {
    await supabase
      .from('milestone_payment_schedule')
      .update({ status: 'supervisor_submitted', supervisor_submitted_at: new Date().toISOString() })
      .eq('booking_ref', bookingRef)
      .eq('milestone_code', milestoneCode)
  }
}
