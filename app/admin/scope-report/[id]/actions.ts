'use server'

import { createClient } from '@/lib/supabase/server'
import { logJobMovement } from '@/lib/jobMovementLog'

// ── helpers ───────────────────────────────────────────────────────────────────

async function getReviewerData() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { supabase, user: null, userData: null }
  const { data: userData } = await supabase
    .from('users')
    .select('id, platform_role')
    .eq('email', user.email)
    .single()
  return { supabase, user, userData }
}

// ── existing actions (kept for compatibility) ─────────────────────────────────

export async function updateCoordinatorReview(
  reportId: string,
  notes: string,
  reviewStatus: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('site_visit_reports')
    .update({ coordinator_notes: notes || null, review_status: reviewStatus })
    .eq('id', reportId)
  if (error) return { error: error.message }
  return {}
}

export async function saveReviewEdit(
  reportId: string,
  screenNumber: number,
  fieldPath: string,
  originalValue: string,
  newValue: string,
  reason: string,
): Promise<{ error?: string; id?: string }> {
  const { supabase, userData } = await getReviewerData()
  if (!userData) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('report_reviews')
    .insert({
      report_id: reportId,
      reviewer_id: userData.id,
      reviewer_role: userData.platform_role,
      screen_number: screenNumber,
      field_path: fieldPath,
      original_value: originalValue,
      new_value: newValue,
      reason,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: data?.id }
}

export async function submitToNextLevel(
  reportId: string,
  submitterRole: string,
  notes: string,
): Promise<{ error?: string }> {
  const { supabase, userData } = await getReviewerData()
  if (!userData) return { error: 'Not authenticated' }

  const submittedToRole = submitterRole === 'sub-coordinator' ? 'coordinator' : 'admin'
  const newStatus = submitterRole === 'sub-coordinator' ? 'coordinator_review' : 'admin_review'

  const [submissionResult, statusResult] = await Promise.all([
    supabase.from('report_submissions').insert({
      report_id: reportId,
      submitted_by: userData.id,
      submitted_role: submitterRole,
      submitted_to_role: submittedToRole,
      submission_notes: notes || null,
    }),
    supabase.from('site_visit_reports')
      .update({ status: newStatus })
      .eq('id', reportId),
  ])

  if (submissionResult.error) return { error: submissionResult.error.message }
  if (statusResult.error) return { error: statusResult.error.message }
  await logJobMovement(supabase, {
    siteVisitReportId: reportId, stage: 'survey', action: 'forwarded',
    itemType: 'site_visit_report', itemId: reportId,
    fromUserId: userData.id, fromRole: userData.platform_role, toRole: submittedToRole, remarks: notes,
  })
  return {}
}

// ── coordinator notes save ────────────────────────────────────────────────────

export async function saveCoordinatorNotes(
  reportId: string,
  notes: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('site_visit_reports')
    .update({ coordinator_notes: notes || null })
    .eq('id', reportId)
  if (error) return { error: error.message }
  return {}
}

// ── coordinator action 1: approve ─────────────────────────────────────────────

export async function approveAndSendToAdmin(
  reportId: string,
  coordinatorNotes: string,
): Promise<{ error?: string }> {
  const { supabase, userData } = await getReviewerData()
  if (!userData) return { error: 'Not authenticated' }

  const [reportResult, submissionResult] = await Promise.all([
    supabase.from('site_visit_reports').update({
      review_status: 'approved_for_estimate',
      status: 'admin_review',
      coordinator_notes: coordinatorNotes || null,
    }).eq('id', reportId),
    supabase.from('report_submissions').insert({
      report_id: reportId,
      submitted_by: userData.id,
      submitted_role: 'coordinator',
      submitted_to_role: 'admin',
      submission_notes: coordinatorNotes || null,
    }),
  ])

  if (reportResult.error) return { error: reportResult.error.message }
  if (submissionResult.error) return { error: submissionResult.error.message }
  await logJobMovement(supabase, {
    siteVisitReportId: reportId, stage: 'survey', action: 'approved',
    itemType: 'site_visit_report', itemId: reportId,
    fromUserId: userData.id, fromRole: userData.platform_role, toRole: 'admin', remarks: coordinatorNotes,
  })
  return {}
}

// ── coordinator action 2: return to sub-coordinator ───────────────────────────

export async function returnToSubCoordinator(
  reportId: string,
  reason: string,
  sections: string[],
  coordinatorNotes: string,
  bookingRef: string,
): Promise<{ error?: string }> {
  const { supabase, userData } = await getReviewerData()
  if (!userData) return { error: 'Not authenticated' }

  const submissionNote = [
    sections.length > 0 ? `Sections to correct: ${sections.join(', ')}.` : '',
    `Reason: ${reason}`,
  ].filter(Boolean).join(' ')

  const [reportResult, submissionResult, enquiryResult] = await Promise.all([
    supabase.from('site_visit_reports').update({
      review_status: 'returned_to_sub_coordinator',
      coordinator_notes: coordinatorNotes || null,
    }).eq('id', reportId),
    supabase.from('report_submissions').insert({
      report_id: reportId,
      submitted_by: userData.id,
      submitted_role: 'coordinator',
      submitted_to_role: 'sub-coordinator',
      submission_notes: submissionNote,
    }),
    bookingRef
      ? supabase.from('guest_enquiries')
          .update({ status: 'sub_coordinator_review' })
          .eq('booking_ref', bookingRef)
      : Promise.resolve({ error: null }),
  ])

  if (reportResult.error) return { error: reportResult.error.message }
  if (submissionResult.error) return { error: submissionResult.error.message }
  if (enquiryResult.error) return { error: enquiryResult.error.message }
  await logJobMovement(supabase, {
    bookingRef: bookingRef || null, siteVisitReportId: reportId, stage: 'survey', action: 'returned',
    itemType: 'site_visit_report', itemId: reportId,
    fromUserId: userData.id, fromRole: userData.platform_role, toRole: 'sub_coordinator', remarks: submissionNote,
  })
  return {}
}

// ── coordinator action 3: return to supervisor ────────────────────────────────

export async function returnToSupervisor(
  reportId: string,
  reason: string,
  screens: number[],
  revisitType: 'full' | 'specific',
  coordinatorNotes: string,
  bookingRef: string,
): Promise<{ error?: string }> {
  const { supabase, userData } = await getReviewerData()
  if (!userData) return { error: 'Not authenticated' }

  const revisitDesc = revisitType === 'full'
    ? 'Full re-visit required.'
    : screens.length > 0
      ? `Specific screens: ${screens.map((n) => `Screen ${n}`).join(', ')}.`
      : 'Specific screens (none specified).'

  const submissionNote = `${revisitDesc} Reason: ${reason}`

  const [reportResult, submissionResult, enquiryResult] = await Promise.all([
    supabase.from('site_visit_reports').update({
      review_status: 'returned_to_supervisor',
      status: 'returned_for_correction',
      coordinator_notes: coordinatorNotes || null,
    }).eq('id', reportId),
    supabase.from('report_submissions').insert({
      report_id: reportId,
      submitted_by: userData.id,
      submitted_role: 'coordinator',
      submitted_to_role: 'supervisor',
      submission_notes: submissionNote,
    }),
    bookingRef
      ? supabase.from('guest_enquiries')
          .update({ status: 'site_revisit_required' })
          .eq('booking_ref', bookingRef)
      : Promise.resolve({ error: null }),
  ])

  if (reportResult.error) return { error: reportResult.error.message }
  if (submissionResult.error) return { error: submissionResult.error.message }
  if (enquiryResult.error) return { error: enquiryResult.error.message }
  await logJobMovement(supabase, {
    bookingRef: bookingRef || null, siteVisitReportId: reportId, stage: 'survey', action: 'returned',
    itemType: 'site_visit_report', itemId: reportId,
    fromUserId: userData.id, fromRole: userData.platform_role, toRole: 'supervisor', remarks: submissionNote,
  })
  return {}
}
