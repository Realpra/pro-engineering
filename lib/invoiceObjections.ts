// Client invoice objections (owner, 31 Oct 2026, D30) -- shared rules.
//
// The objection moves Site Head > Supervisor > Coordinator > Admin > Super Admin, each level
// adding the factual position, and is decided ONE LEVEL ABOVE the role that routinely handles
// the job's value: below Rs 1L the Coordinator handles the job, so Admin decides; Rs 1L-5L Admin
// handles it, so Super Admin decides; above Rs 5L Super Admin handles it and also decides.

export const OBJECTION_CHAIN = ['site_incharge', 'supervisor', 'coordinator', 'admin', 'super_admin'] as const
export type ObjectionRole = (typeof OBJECTION_CHAIN)[number]

export const ROLE_LABEL: Record<ObjectionRole, string> = {
  site_incharge: 'Site Head',
  supervisor: 'Supervisor',
  coordinator: 'Coordinator',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export const OBJECTION_TYPES: { value: string; label: string }[] = [
  { value: 'item_not_done', label: 'Item billed but not done' },
  { value: 'inferior_work', label: 'Work is inferior / defective' },
  { value: 'quantity_wrong', label: 'Quantity is wrong' },
  { value: 'rate_wrong', label: 'Rate / amount is wrong' },
  { value: 'other', label: 'Other' },
]

export function decidingRoleForJobValue(jobValue: number | null | undefined): 'admin' | 'super_admin' {
  return (Number(jobValue) || 0) < 100000 ? 'admin' : 'super_admin'
}

export function nextRole(role: ObjectionRole): ObjectionRole | null {
  const i = OBJECTION_CHAIN.indexOf(role)
  return i >= 0 && i < OBJECTION_CHAIN.length - 1 ? OBJECTION_CHAIN[i + 1] : null
}
