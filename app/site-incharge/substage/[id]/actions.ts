'use server'
import { createClient } from '@/lib/supabase/server'
import { syncMilestonePaymentStatus } from '@/lib/milestones'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

export async function updateSubstageStatus(
  substageId: string,
  status: 'in_progress' | 'completed',
  completionPct: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 'completed' from the caller's point of view means the supervisor has
  // finished and submitted — the real workflow status is 'supervisor_submitted'
  // until sub-coordinator/coordinator sign-off.
  const dbStatus = status === 'completed' ? 'supervisor_submitted' : status

  const updates: Record<string, unknown> = {
    status: dbStatus,
    completion_pct: completionPct,
    updated_at: new Date().toISOString(),
  }

  if (status === 'completed') {
    updates.supervisor_submitted_at = new Date().toISOString()
    updates.actual_completion_date = new Date().toISOString().split('T')[0]
  }

  const { data: updated, error } = await (supabase as SupabaseAny)
    .from('job_milestone_substages')
    .update(updates)
    .eq('id', substageId)
    .select('booking_ref, milestone_code')
    .single()

  if (error) throw new Error(error.message)

  if (status === 'completed' && updated) {
    await syncMilestonePaymentStatus(supabase, updated.booking_ref, updated.milestone_code)
  }

  revalidatePath('/site-incharge/dashboard')
  revalidatePath(`/site-incharge/substage/${substageId}`)
}

export async function updateSupervisorChecklist(
  substageId: string,
  checklist: { item: string; type: string; checked: boolean; checked_by: string | null; checked_at: string | null }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // supervisor_checklist is a misnomer -- Site Incharge is the only writer of
  // this column anywhere in the repo (Supervisor's own SubstageCard.tsx only
  // ever reads a count). site_checklist is the correctly-named column added
  // alongside it (20260927_job_milestone_substages_site_columns.sql);
  // supervisor_checklist is kept in sync so out-of-scope readers (coordinator/
  // payments, supervisor/estimate+approvals+inspections, sub-coordinator/
  // approvals) keep working until they're migrated to the new name.
  const { error } = await (supabase as SupabaseAny)
    .from('job_milestone_substages')
    .update({
      supervisor_checklist: checklist,
      site_checklist: checklist,
      updated_at: new Date().toISOString(),
    })
    .eq('id', substageId)

  if (error) throw new Error(error.message)
  revalidatePath(`/site-incharge/substage/${substageId}`)
}

export async function uploadEvidence(
  substageId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const file = formData.get('file') as File
  const label = formData.get('label') as string
  const index = parseInt(formData.get('index') as string)

  if (!file) throw new Error('No file provided')

  const ext = file.name.split('.').pop()
  const path = `${substageId}/${Date.now()}-${index}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('site-photos')
    .upload(path, file, { upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  const { data: urlData } = supabase.storage
    .from('site-photos')
    .getPublicUrl(path)

  // Get current substage data
  const { data: substage } = await supabase
    .from('job_milestone_substages')
    .select('evidence_checklist, evidence_submitted')
    .eq('id', substageId)
    .single()

  if (!substage) throw new Error('Substage not found')

  // Update evidence_checklist confirmed flag
  const checklist = (substage.evidence_checklist as any[]) ?? []
  if (checklist[index]) {
    checklist[index].confirmed = true
    checklist[index].url = urlData.publicUrl
  }

  // Update evidence_submitted
  const submitted = (substage.evidence_submitted as any[]) ?? []
  submitted[index] = {
    label,
    url: urlData.publicUrl,
    uploaded_by: user.id,
    uploaded_at: new Date().toISOString(),
  }

  // Same dual-write discipline as updateSupervisorChecklist above -- see
  // 20260927_job_milestone_substages_site_columns.sql.
  const { error } = await (supabase as SupabaseAny)
    .from('job_milestone_substages')
    .update({
      evidence_checklist: checklist,
      evidence_submitted: submitted,
      site_evidence_checklist: checklist,
      site_evidence_submitted: submitted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', substageId)

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allConfirmed = checklist.length > 0 && checklist.every((c: any) => c.confirmed === true)
  if (allConfirmed) {
    // evidence_complete requires the migration in
    // supabase/migrations/20260912_evidence_complete.sql to have been applied —
    // don't fail the upload if the column isn't there yet.
    const { error: evidenceCompleteErr } = await (supabase as SupabaseAny)
      .from('job_milestone_substages')
      .update({ evidence_complete: true })
      .eq('id', substageId)
    if (evidenceCompleteErr) {
      // eslint-disable-next-line no-console
      console.error('[uploadEvidence] evidence_complete update failed:', evidenceCompleteErr.message)
    }
  }

  revalidatePath(`/site-incharge/substage/${substageId}`)
  return { success: true, url: urlData.publicUrl }
}