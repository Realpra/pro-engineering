# Site Visit (SiteVisitManager) Rebuild Spec

Captured 23 Sep 2026 from the project owner's screen-by-screen review of
`/supervisor/site-visit` (supervisor62 login), against the real end-to-end
business flow in CLAUDE.md's PROCESS FLOW section. This is the reference for
rebuilding the 21-screen form so it collects real, typed, structured data that
feeds estimation, payment decisions, and milestone comparison consistently —
not the free-text/misnamed-column form that exists today (see SESSIONS.md
Session 58 for the specific column-mismatch evidence: `screenTitles` vs
`SCREEN_COLUMNS` vs what `generateBOQ`/`EstimateConsole.tsx`/`ScopeReportView.tsx`
actually read).

Do not treat this as a from-scratch feature list — several items below already
have a working implementation elsewhere in the codebase that just needs wiring
into the site-visit flow (noted per screen). Check before building new.

## Who fills this form
Any of superadmin/admin/coordinator/sub-coordinator/supervisor/site-incharge,
whoever is deputed for the site survey visit by coordinator/admin/superadmin.
The form and its data must be identical regardless of which role fills it, and
visible with the same field names/types to every role downstream.

## Per-screen requirements

**Screen 1 — Check In**
- Missing: site/job identification before check-in (which booking, which
  site/work area). Currently jumps straight to a check-in toggle with no
  context of which job/site is being visited.
- Check-in time capture already works correctly.

**Screen 2 — Ground Feed (LTF)**
- Current: one global "LTF Status Confirmed? YES/NO" toggle.
- Needed: loop over every sub-stage (LTF) of the job — one Yes/No per
  sub-stage, not one for the whole job. Every answer opens a remarks box
  (e.g. "material did not come" type free text).
- Data source: job_milestone_substages for the booking_ref (substage_code/
  substage_name already exist and are used this way elsewhere — see
  coordinator/supervisor pages that list substages per booking).

**Screen 3 — Workers Present**
- "Workers planned" should auto-populate from the deployment plan, not be
  manually typed. Data source already exists:
  job_milestone_substages.skilled_workers_per_day /
  .unskilled_workers_per_day (set by admin's milestone plan, see
  app/admin/estimate/[bookingRef]/milestonePlanActions.ts).
- If that figure isn't available for some reason, show "Other" -> opens a
  free-text remark box for the supervisor to state actuals/explain.

**Screen 4 — Safety Conditions** / **Screen 5 — PPE Compliance** /
**Screen 10 — Physical Completion** / **Screen 13 — Quality Check**
- Same pattern across all four: any "No" answer on a checklist item must open
  a remarks entry box for that item. Currently these are bare booleans with
  no remarks capture on failure.

**Screen 11 — Test Results**
- Current: free-text fields (pressureTestValue, holdTimeMinutes,
  slopeMeasurement, otherTestNotes).
- Needed: what to test should come from a **test-type bank** — a reference
  table keyed by trade/sub-stage, defining the required tests and their
  parameters (e.g. seepage check needs "time since applied" + "ponding
  time"). This bank is maintained by coordinator/sub-coordinator. If a
  needed test isn't in the bank, supervisor selects "Other" and enters
  manually. **New table needed** (no existing equivalent found).

**Screen 12 — Measurements**
- Current: free-text (actualDimensions as a raw string, siteConditions,
  varianceFromPlan) — this is the field Session 55 already flagged as the
  root cause of wrong BOQ quantities.
- Needed: same repository pattern as Screen 11 — a bank of what to measure
  per sub-stage (length, breadth, height, etc.), fed by coordinator/
  sub-coordinator, "Other" fallback for supervisor. Values must be **typed
  numeric with units**, not strings, and must flow via formula/extraction
  into estimation and payment-quantity calculations — this is exactly what
  generateBOQ/EstimateConsole.tsx currently expect from
  `screen14_measurements` and never get. **Likely shares the same bank table
  as Screen 11**, or a closely related one (test bank vs measurement bank
  per sub-stage) — decide during design, don't build two disconnected
  systems.

**Screen 14 — Risk Flags**
- Duplicate of Screen 6 (Hazard Check in current screenTitles). **Recommendation:
  remove Screen 14 as a separate screen.** Wherever "risk flag" fields are
  referenced downstream in code, replace them with Screen 6's fields —
  consolidate to one canonical hazard/risk field set, not two parallel ones.
  (Note: there is also a standalone Screen17_RiskFlags.tsx file in the repo —
  check whether that's the abandoned-implementation source of this
  duplication before removing anything.)

**Screen 15 — Client Decisions**
- Needed: live-populate any client-raised request in the system on this
  screen (Trigger B — Client Demand: Client -> Trade Skill Head ->
  Coordinator -> Client Yes/No; original baseline stays active until the
  client explicitly accepts). If the client has raised a scope change at
  site, capture what they requested in a remarks box, then either create a
  sub-job request (if the job is already approved/underway) or fold it into
  the estimate still being drafted.
- **This already exists and works — it needs wiring, not building.**
  `app/supervisor/extra-works/actions.ts` (`submitExtraWork`) already:
  captures `client_request` text, tags `trigger_type: 'client_demand'`,
  inserts into `scope_change_requests` (`change_type`, `change_status`,
  `raised_by_role`, `justification_cos`, etc.), and flips
  `guest_enquiries.status` to `scope_change_pending`. The approval routing
  (coordinator/admin decision, client accept/reject) also already exists on
  `scope_change_requests` via `admin_decision`/`client_decision` fields
  (confirmed in Session 58's field audit). Screen 15 should call this same
  action (or route to `/supervisor/extra-works`) instead of being a dead
  Yes/No toggle.

**Screen 18 — Payment Proposal**
- Needed: structured reasons per payment decision:
  - Decision 2 (release slabs 70/75/80/85/90%): add "Reasons for partial
    release" box.
  - Decision 4 (hold): add "Reasons for Holding release" box.
  - Decision 5 (reject): two-part structured reason:
    - "Why Rejected": bad quality / not as per design / not as per sequence
      / others (free text on "Others")
    - "What to do": Redo Complete / Redo part affected / Create a
      substage_job / others (free text)
- **This is the missing raise-side of an existing, already-orphaned
  mechanism.** Session 58 found `milestone_payment_schedule` already has
  `decision_5_raised_at` / `decision_5_raised_by` / `decision_5_reason` /
  `decision_5_admin_decision` / `decision_5_admin_remarks`, and admin's
  resolution side (`app/admin/payments/actions.ts`) is fully wired — but
  nothing anywhere raises a case (PENDING #9). Screen 18's reject flow is
  that missing raise action: it should write `decision_5_raised_at`,
  `decision_5_raised_by` (this visit's role/user), and `decision_5_reason`
  (structured from the two-part reason above) onto the relevant
  `milestone_payment_schedule` row. Confirm the exact reason field shape
  needed (may need a new `decision_5_remedy` column alongside the existing
  `decision_5_reason` for the "what to do" half) before writing the
  migration.

## Cross-cutting requirements (apply to every screen)
- Every field is typed correctly (numeric measurements as numeric, dates as
  date, booleans as boolean) — not free text standing in for structured data.
- Every field name is the same wherever it's read, across every role's page
  and every downstream consumer (generateBOQ, EstimateConsole.tsx,
  ScopeReportView.tsx, payment/milestone views) — this is the same audit
  discipline as supabase/audits/field_naming_audit_v2.sql, applied here at
  design time instead of after the fact.
- Data entered by whichever role visits the site must be visible identically
  to every other role that needs it downstream — no role-specific shadow
  copies of the same concept.

## Not yet designed (needs a decision before building)
- Exact schema for the test-type bank (Screen 11) and measurement bank
  (Screen 12) — one shared table or two, keyed by trade + sub-stage type.
- Exact shape of `decision_5` "what to do" remedy field (Screen 18).
- Whether Screen 14's removal requires a data migration for any already-
  submitted site_visit_reports rows with risk-flag data, or if it's clean
  (no live data yet, per Session 58's site_visit_reports audit still being
  in progress — this needs the live-data check pattern used throughout
  Session 58 before dropping/consolidating anything).
