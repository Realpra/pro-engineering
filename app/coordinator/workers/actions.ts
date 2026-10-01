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
export async function approveWorkerToAdmin(workerId: string, remark: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('workers').update({
    approval_status: 'coordinator_approved',
    coordinator_recommendation: remark || null,
  }).eq('id', workerId)
  if (error) return { error: error.message }
  revalidatePath('/coordinator/workers')
  revalidatePath('/admin/workers')
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
