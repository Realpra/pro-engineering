// "Waiting for Admin's final approval" is one value: 'pending_admin_approval'
// (owner, 31 Oct 2026 -- onboarding is final only at Admin; Coordinator's interim
// allowance is the separate coordinator_deployable_at flag). Coordinator's Workers
// page used to write 'coordinator_approved' for the same state; it no longer does,
// but readers still accept it so no older row is hidden.
export const AWAITING_ADMIN_STATUSES = ['coordinator_approved', 'pending_admin_approval']

export function isAwaitingAdmin(status: string | null | undefined): boolean {
  return AWAITING_ADMIN_STATUSES.includes(status ?? '')
}
