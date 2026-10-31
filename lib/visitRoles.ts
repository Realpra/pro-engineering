// Site Visit Manager (owner, 31 Oct 2026; Supervisor visit spec 27 Sep 2026): a separate login
// role that substitutes for a Supervisor when the Supervisor is unavailable. Performs the same
// visit screens and always submits up to the job's Supervisor. Like a Supervisor, a Site Visit
// Manager has a workers row (trade 'Site Visit Manager') so route slots can be assigned to him.
export const VISIT_ROLES = ['supervisor', 'site_visit_manager']

export function isVisitRole(role: string | null | undefined): boolean {
  return VISIT_ROLES.includes(role ?? '')
}

export const SITE_VISIT_MANAGER_TRADE = 'Site Visit Manager'
