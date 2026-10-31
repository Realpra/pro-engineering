'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Worker onboarding approval chain, Coordinator's step (project owner's
// confirmed design, 1 Oct 2026): an ad hoc approval -- sets coordinator_
// approved, which (a) makes the worker immediately deployable (the worker-
// assignability gate reads this status too, not just admin_approved) and
// (b) is the exact value Admin's own "Pending Approval" queue already reads
// (app/admin/workers/WorkerTabs.tsx) -- so this single write is what pushes
// the worker into Admin's queue, in parallel, not as a second sequential
// step requiring its own "send to admin" action.
//
// Owner, 31 Oct 2026: onboarding is final only when Admin approves. Coordinator's
// interim allowance is his own separate act (markWorkerDeployableAdhoc below), not
// a side effect of sending the worker up. So this now writes the one "waiting for
// Admin" value the zone-registry assessment already writes, 'pending_admin_approval'.
// 'coordinator_approved' is no longer written; readers still accept it for any
// older row (lib/workerApprovalStatus.ts).
export async function approveWorkerToAdmin(workerId: string, remark: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('workers').update({
    approval_status: 'pending_admin_approval',
    coordinator_recommendation: remark || null,
  }).eq('id', workerId)
  if (error) return { error: error.message }
  revalidatePath('/coordinator/workers')
  revalidatePath('/admin/workers')
  return {}
}

// E3 (WorkersTable_Review workbook, 1 Oct 2026, confirmed "two independent actions"):
// an action genuinely separate from approveWorkerToAdmin above. Marks the worker
// immediately deployable -- added into the live deployment pool for their trade/skill --
// before, during, or without ever being recommended upward. The skill/field values on
// this worker are "adhoc" (Coordinator's own, not yet admin-finalized) until the worker
// is actually admin_approved; every deployment picker treats coordinator_deployable_at
// as equally deployable but tags it ADHOC so whoever deploys the worker knows the fields
// are provisional.
export async function markWorkerDeployableAdhoc(workerId: string, remark: string, coordinatorUserId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('workers').update({
    coordinator_deployable_at: new Date().toISOString(),
    coordinator_deployable_by: coordinatorUserId,
    coordinator_deployable_remark: remark || null,
  }).eq('id', workerId)
  if (error) return { error: error.message }
  revalidatePath('/coordinator/workers')
  revalidatePath('/coordinator/allocate')
  revalidatePath('/supervisor/milestone-tracker')
  revalidatePath('/supervisor/daily-log')
  return {}
}

export async function returnWorkerToSubCoordinator(workerId: string, reason: string): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: 'Explain what needs correcting.' }
  const supabase = await createClient()
  const { error } = await supabase.from('workers').update({
    approval_status: 'returned_to_subcoordinator',
    coordinator_recommendation: reason.trim(),
  }).eq('id', workerId)
  if (error) return { error: error.message }
  revalidatePath('/coordinator/workers')
  return {}
}
