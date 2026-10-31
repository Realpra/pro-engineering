// One writer/reader for policy_change_log (fixed 31 Oct 2026).
//
// Live columns (checked read-only 31 Oct 2026): id, policy_type, changed_by_role, changed_by,
// old_value jsonb, new_value jsonb, effective_from, approved_by_super_admin,
// approval_timestamp, created_at. Admin's Policy screen and Super Admin's dashboard both
// wrote table_name / record_id / field_name / change_reason / changed_at, none of which
// exist, so every repository change since those screens were built was silently not
// recorded, and the Admin page's "order by changed_at" read failed. The record id, field
// and reason now travel inside old_value / new_value.

export type PolicyChange = {
  policyType: string          // the repository table, e.g. 'contingency_policy'
  recordId: string
  field: string
  oldValue: unknown
  newValue: unknown
  reason: string
  changedBy: string
  changedByRole: 'admin' | 'super_admin'
  effectiveFrom?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writePolicyChange(supabase: any, c: PolicyChange): Promise<{ error?: string }> {
  const { error } = await supabase.from('policy_change_log').insert({
    policy_type: c.policyType,
    changed_by_role: c.changedByRole,
    changed_by: c.changedBy,
    old_value: { record_id: c.recordId, field: c.field, value: c.oldValue ?? null },
    new_value: { record_id: c.recordId, field: c.field, value: c.newValue ?? null, reason: c.reason },
    effective_from: c.effectiveFrom ?? null,
  })
  if (error) console.error('[policy_change_log] insert failed:', error.message)
  return error ? { error: error.message } : {}
}

type RawLog = {
  id: string
  policy_type: string | null
  changed_by: string | null
  changed_by_role: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string | null
}

const text = (v: unknown) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v))

// Shape used by Admin's Policy screen.
export function toAdminLogRow(r: RawLog) {
  return {
    id: r.id,
    table_name: r.policy_type,
    record_id: text(r.new_value?.record_id ?? r.old_value?.record_id),
    field_name: text(r.new_value?.field ?? r.old_value?.field),
    old_value: text(r.old_value?.value ?? r.old_value),
    new_value: text(r.new_value?.value ?? r.new_value),
    change_reason: text(r.new_value?.reason),
    changed_by: r.changed_by,
    changed_at: r.created_at,
  }
}

// Shape used by Super Admin's dashboard.
export function toSuperAdminLogRow(r: RawLog) {
  return {
    id: r.id,
    table_name: r.policy_type ?? '',
    old_value: r.old_value,
    new_value: r.new_value,
    change_reason: text(r.new_value?.reason),
    created_at: r.created_at ?? '',
  }
}
