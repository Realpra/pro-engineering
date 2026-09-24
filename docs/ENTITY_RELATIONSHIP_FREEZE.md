# Entity-Relationship Freeze — Pending Owner Approval

Status: DRAFT — every row below needs the project owner's decision before any schema
migration work starts. This is the master list; CLAUDE.md's ROLE HIERARCHY /
PROCESS FLOW sections summarize the confirmed parts, this file is where the
line-by-line freeze happens.

How to use this file: for each row, mark a decision in the **Decision** column —
`APPROVE` (build the Proposed column as-is), `KEEP CURRENT` (leave as-is, do not
touch), or `MODIFY: ...` (write the correction). Reply in chat referencing the ID
(e.g. "R7 APPROVE, R12 MODIFY: ...") or edit this file directly and push — either
works.

Evidence for every "Current" cell below was verified by reading the live
migrations/code in this session and prior sessions (Session 58-59), not assumed.
Tables with no migration file are marked **[LIVE-ONLY]** — they exist in Supabase
but nothing in the repo defines them.

---

## A. Role ↔ Job relationships

| ID | Relationship | Current state | Proposed | Decision |
|---|---|---|---|---|
| R1 | Job ↔ Supervisor | Real FK: `guest_enquiries.supervisor_id → workers.id` | Keep as the correct pattern — template for R2. | ☐ |
| R2 | Job ↔ Site Incharge | **No dedicated link** — shares R1's `supervisor_id` column. Confirmed wrong (Session 59): Site Incharge is one embedded person per job; Supervisor covers many jobs. | Add `guest_enquiries.site_incharge_id UUID REFERENCES workers(id)`, separate from `supervisor_id`. | ☐ |
| R3 | Job ↔ Coordinator | No FK, no filter anywhere in code. Universal access to every job. | **Your call**: keep universal (oversight role by design), or add a per-job/per-zone assignment column? | ☐ |
| R4 | Job ↔ Sub-Coordinator | Same — no FK, universal access. | Same question as R3. | ☐ |
| R5 | Job ↔ Admin | Same — no FK, universal access. | Same question as R3 — likely universal is correct for Admin specifically (final approval authority), confirm. | ☐ |
| R6 | Job ↔ Super Admin | No FK, universal read access; the one place Super Admin *is* scoped is `premium_approval_requests` filtered to `boq_total > 100000` (a value threshold, not a job link). | Keep universal for oversight; keep the value-threshold escalation pattern for premium/rebate (R19). | ☐ |
| R7 | Job ↔ Client | **[LIVE-ONLY]** `client_user_id`, `contact_email`, `client_phone` — none exist in any migration. | Add a migration documenting these columns as they actually live today (no behavior change, just stop them being undocumented). | ☐ |
| R8 | Job ↔ Mktg Agent | **No relationship at all.** A job created via a Mktg Agent's "+ New Job" link looks identical to any other source. | Add `guest_enquiries.created_by_user_id`, set on insert from `/book`, so lead source is traceable (this is PENDING #13). | ☐ |
| R9 | Job ↔ Worker (general, non-supervisor) | Split three ways — see Section D (R20-R22). | See Section D. | ☐ |

## B. Core process-flow entities

| ID | Relationship | Current state | Proposed | Decision |
|---|---|---|---|---|
| R10 | Job ↔ Site Survey (Flow i) | `booking_ref` TEXT match, no FK. `site_visit_reports` shared with Flow ii. | Split into its own table, FK'd to `guest_enquiries.id`. | ☐ |
| R11 | Job ↔ Daily Execution Visit (Flow ii) | `booking_ref` TEXT + real FK `slot_id → supervisor_daily_routes.id` (added this session). | Once split from Flow i, also add a direct FK to `guest_enquiries.id`. | ☐ |
| R12 | Job ↔ Estimate/BOQ | `booking_ref` TEXT match. A `job_id` FK existed once, was found dead, and was dropped (Session 58) rather than fixed. | Re-add a real FK to `guest_enquiries.id`; version estimates (one job, many revisions) instead of overwriting. | ☐ |
| R13 | Estimate ↔ BOQ Sub-parts | `boq_generated` → `boq_sku_catalogue` via `sku_code` (**real FK, correct**). Rate lookups via `rate_card` (zone-specific with fallback). | No change — this part is already correctly modeled. | ☐ |
| R14 | Job/Estimate ↔ Milestone/Sub-stage | `job_milestone_substages` **[LIVE-ONLY, no migration file]**. Linked only by `booking_ref` TEXT. | Add migration + real FK to `guest_enquiries.id`. | ☐ |
| R15 | Estimate ↔ Payment Schedule | `milestone_payment_schedule.boq_id → boq_generated.id` (**real FK, correct**). | No change. | ☐ |
| R16 | Payment Schedule ↔ Milestone | `milestone_code` TEXT match, no FK. | Add real FK once R14 gives Milestone a proper primary key relationship to key against. | ☐ |
| R17 | Payment Schedule ↔ Client Payment Receipt | `payment_confirmations.milestone_code` TEXT match, no FK. | Add FK to the specific `milestone_payment_schedule` row. | ☐ |
| R18 | Job ↔ Scope Change Request | `scope_change_requests` **[LIVE-ONLY]**, `booking_ref` TEXT. | Add migration + real FK. | ☐ |
| R19 | Estimate ↔ Premium/Rebate Escalation | `premium_approval_requests` (`booking_ref` + `boq_id`) → policy match against `contingency_policy`/`platform_premium_policy` by vertical/category/tier attributes (not ID). **Approval chain is fully built and correctly threshold-gated, but `approved_by_admin`/`approved_by_super_admin` are never read anywhere — the approved premium never reaches the live estimate.** (Confirmed Session 59 — this is PENDING #15, top priority.) | Re-link: the approve actions must also update `boq_generated`'s live total. Schema/relationship itself is fine — this is a code-wiring fix, not a schema change. | ☐ |
| R20 | Estimate ↔ Client Negotiation | `estimate_client_responses`, `client_estimates` — TEXT-linked. | FK to the specific Estimate revision (depends on R12's versioning). | ☐ |

## C. Already-correct clusters (use as templates, no change needed)

| ID | Relationship | Current state | Decision |
|---|---|---|---|
| R21 | Worker ↔ Onboarding/Assessment (`trainers`, `assessment_slots`, `assessment_bookings`, `worker_competency`) | Real FKs throughout, migration-backed. | ☐ Confirm no change |
| R22 | Policy/Approval framework (`platform_premium_policy`, `contingency_policy`, `premium_approval_requests`, `policy_change_log`) | Real FKs/constraints throughout, migration-backed. | ☐ Confirm no change |
| R23 | Worker ↔ Zone coverage (`worker_zone_assignments`) | Real FK to `workers.id`. Note: this is *capability* (which zones a worker covers), separate from R25-27's *deployment* (which job a worker is on right now). | ☐ Confirm no change |

## D. Worker deployment / routing — needs a scope decision before anything else in this section

Your own example ("one job, many skilled workers, partial-day, moved between jobs
with travel between") maps to this section, and it's the most tangled part of the
whole schema.

| ID | Relationship | Current state | Proposed | Decision |
|---|---|---|---|---|
| R24 | Worker ↔ Job (day slot) | `worker_day_slots` — supervisor-written, `worker_id` FK real, `booking_ref`+`substage_code` TEXT, no travel/time concept. | Superseded by R27. | ☐ |
| R25 | Worker ↔ Job (shift + route legs) | `worker_shift_schedule` — sub-coordinator-written, `enquiry_id` real FK (rare correct one), `booking_ref` TEXT redundant, `legs` JSONB column matches your travel-then-work-then-travel description exactly **but is confirmed never written anywhere in the codebase** — pure read-only decoration on the Site Incharge dashboard. | Superseded by R27. | ☐ |
| R26 | Worker ↔ Job (supervisor daily route) | `supervisor_daily_routes` **[LIVE-ONLY]** — coordinator-written, real time fields (`depart_time`/`arrive_time`/`work_start`/`work_end`), real FK on `supervisor_id`, but scoped to supervisors only. Best-normalized of the three. | Superseded by R27, generalized to all worker types. | ☐ |
| R27 | **Proposed new entity**: `worker_route_legs` | Does not exist yet. | One entity replacing R24-26: `worker_id`(FK) + `route_date` + `leg_sequence` + `job_id`(FK) + `substage_id`(FK, nullable) + `depart_time` + `travel_minutes` + `arrive_time` + `work_start` + `work_end` + `status`. One worker, one day → many ordered legs across possibly-different jobs. | ☐ **This is the one that needs your explicit go-ahead before any migration work starts — it's a redesign, not a drip-fix.** |
| R28 | Job requirement (which skill/trade/headcount a job still needs, by day) | **No entity exists.** `job_milestone_substages.skilled_workers_per_day`/`unskilled_workers_per_day` are bare counts, not a needs list, and not linked to R27. | New entity: `job_worker_requirements` (job_id, substage_id, trade, skill_level, date, hours_needed, headcount_needed) — makes "which open jobs need which skill today" a real query. | ☐ |
| R29 | `workers.current_job_id` / `workers.current_job_booking_ref` | Manually maintained fields, set inconsistently — one code path (`supervisor/milestone-tracker`) sets `current_job_id` to a **substage id**, another (`sub-coordinator/actions.ts`) sets it to an **enquiry id**. Same column, two different meanings depending on which flow last touched it. | Remove both fields once R27 exists — "what is a worker doing right now" becomes a query against `worker_route_legs`, not a stored, driftable field. | ☐ |

## E. Standing findings (not relationships to approve, but context for the above)

- **`supabase/schema.sql`** contains an abandoned, cleaner entity design (`jobs`, `job_modules`, `scope_reports`, `estimates`, `milestones`, etc.) that was never used. It should not be referenced for anything live — flagged so nobody accidentally treats it as current.
- **RLS on `guest_enquiries` is `USING (true)` for any authenticated user** — every staff role can read every job regardless of the FK decisions above, until R3-R6 are decided and (if scoping is chosen) RLS is tightened to match.
- Every **[LIVE-ONLY]** table above has zero migration file — before any FK is added, that table's current live definition needs to be captured in a baseline migration first, or the FK migration has nothing to attach to.

---

**Recommended order once you've marked decisions**: R1/R2 (Site Incharge FK) and R19 (premium re-link) first — smallest, highest-value, no redesign risk. R27-29 (worker routing) last — it's the one genuine redesign in this list and should wait until everything else is frozen so it isn't built on shifting ground.
