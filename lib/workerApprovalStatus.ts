// A worker waiting for Admin's final approval carries one of two status values
// today: 'coordinator_approved' (written by Coordinator's Workers page,
// app/coordinator/workers/actions.ts) and 'pending_admin_approval' (written by
// the zone-registry assessment, app/coordinator/zone-registry/actions.ts).
// Both mean the same thing. Admin's screens read both, so no worker is hidden.
// Which single value to keep is an open decision for the owner (31 Oct 2026).
export const AWAITING_ADMIN_STATUSES = ['coordinator_approved', 'pending_admin_approval']

export function isAwaitingAdmin(status: string | null | undefined): boolean {
  return AWAITING_ADMIN_STATUSES.includes(status ?? '')
}
