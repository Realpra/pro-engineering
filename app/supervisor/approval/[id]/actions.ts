'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logJobMovement } from '@/lib/jobMovementLog'

// PENDING #25 (Session 62, HIGH PRIORITY, confirmed unresolved through
// Session 67): /supervisor/approval/[id] never existed as a route at all,
// despite being the target of every "Review & Approve"/"Send Back" action
// across app/supervisor/dashboard, app/supervisor/approvals, and
// app/supervisor/inspections -- the entire Site Head -> Supervisor ->
// Sub-Coordinator -> Finance payment chain had no working Supervisor-level
// gate. Mirrors admin/milestones/actions.ts's adminApproveSubstage/
// adminRejectSubstage exactly -- substage_approval_status/substage_approved_by/
// substage_approved_at are the already-frozen canonical gate columns for
// this table (Supervisor Visit schema freeze, Session 67); this is the
// same generic gate, exercised by Supervisor instead of Admin, not a new
// role-specific column.
export async function supervisorApproveSubstage(
  substageId: string,
  supervisorUserId: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('job_milestone_substages')
    .update({
      substage_approval_status: 'approved',
      substage_approved_by: supervisorUserId,
      substage_approved_at: now,
      updated_at: now,
    })
    .eq('id', substageId)
  if (error) return { error: error.message }
  await logJobMovement(supabase, {
    substageId, stage: 'milestone', action: 'approved',
    itemType: 'job_milestone_substage', itemId: substageId, toRole: 'sub_coordinator',
  })
  revalidatePath('/supervisor/approvals')
  revalidatePath('/supervisor/dashboard')
  return { success: true }
}

export async function supervisorSendBackSubstage(
  substageId: string,
  supervisorUserId: string,
  reason: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('job_milestone_substages')
    .update({
      substage_approval_status: 'rejected',
      substage_rejection_reason: reason,
      substage_approved_by: supervisorUserId,
      substage_approved_at: now,
      status: 'sent_back',
      updated_at: now,
    })
    .eq('id', substageId)
  if (error) return { error: error.message }
  await logJobMovement(supabase, {
    substageId, stage: 'milestone', action: 'returned',
    itemType: 'job_milestone_substage', itemId: substageId, toRole: 'site_incharge', remarks: reason,
  })
  revalidatePath('/supervisor/approvals')
  revalidatePath('/supervisor/dashboard')
  return { success: true }
}
