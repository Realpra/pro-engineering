@AGENTS.md

---

# PRO ENGINEERING — MASTER REFERENCE

Read this at the start of every session.

## PLATFORM
- Next.js + Supabase construction marketplace
- Live: https://pro-engineering.vercel.app
- GitHub: https://github.com/Realpra/pro-engineering
- Supabase project: xhlpdbcrncpznrqpcrht

## SCHEMA FREEZE IN PROGRESS (started 24 Sep 2026, Session 60)
docs/ENTITY_RELATIONSHIP_FREEZE.md is the master line-by-line list of every entity
relationship (29 items, R1-R29) awaiting the project owner's APPROVE / KEEP CURRENT
/ MODIFY decision. No schema migration work starts on any of it until marked. Read
this file before proposing any new FK, table, or relationship change.

## PROCESS FLOW — READ BEFORE ANY FIELD/SCHEMA DECISION (set 23 Sep 2026)
Real-life end-to-end flow this platform models, in order:
1. Client posts a job, OR any role sources one via local outreach -> a job record is created
2. Estimator/sub-coordinator drafts an estimate from the job description alone, OR
   (if a site survey is needed first) superadmin/admin/coordinator/sub-coordinator/
   supervisor/site-incharge is deputed to survey the site and fills the SITE SURVEY
   form (Flow i below)
3. Estimate is built from survey data + resources by whoever can estimate (estimator/
   coordinator/sub-coordinator)
4. Estimate flows up to admin/superadmin for approval per role hierarchy
5. Approved estimate is shared with the client (client-safe field subset only)
6. Client negotiates/corrects/responds -> flows back to admin/superadmin -> repeats
   until agreed
7. Admin/coordinator allocates workers day-wise/hour-wise, by type/skill/zone, from
   the onboarded worker pool
8. Execution: supervisor selects daily work (a supervisor_daily_routes slot) for
   inspection/checks/milestones, feeds the DAILY EXECUTION VISIT form (Flow ii
   below), monitors milestones and payments through to completion

ROLE HIERARCHY / ACT-CONCLUSION MODEL (confirmed by project owner 24 Sep 2026 Session 59):
The role/act mapping was specified at project start: most decisions/approvals/acts
conclude finally at ONE defined role level (not everything escalates). The exception
is core strategic/financial/business decisions (e.g. premium % or rebate on an
estimate) — these are decided by admin and then flow to superadmin for
information/and-or-correction. This exact mechanism already exists in the schema —
see "PREMIUM/REBATE ESCALATION" below — it is not a gap to design, it is a gap to
RE-LINK (the approval decision is captured but never applied back to the live
estimate). Two further role clarifications from the same session:
- SITE INCHARGE vs SUPERVISOR are NOT the same role and must not share a link.
  Site Incharge sits AT one job site for its duration, senior-most on-site person,
  observes every worker's act, posts evidence/reports and (should) request more
  resources at day's end. Supervisor oversees MANY jobs across a zone, doing
  periodic inspection visits fixed during estimate/work-methodology formulation
  by estimator/supervisor/coordinator, triggered by an LTF-ready signal from Site
  Incharge or by his own planned daily route. Today's code conflates them onto the
  single `guest_enquiries.supervisor_id` column — confirmed wrong, needs its own
  Site Incharge link (see PENDING).
- ESTIMATOR is a function, not one fixed role: a draft estimate can originate from
  Estimator, from Sub-Coordinator (if he is the labour/subcontractor source), or
  from Supervisor (on his first visit to a newly posted job). Today `generateBOQ`
  is callable only from admin's own page — confirmed too narrow, needs opening to
  Sub-Coordinator and Supervisor as valid draft-estimate sources.

PREMIUM/REBATE ESCALATION — ALREADY BUILT, DISCONNECTED AT THE LAST STEP (found
Session 59, 24 Sep 2026): `contingency_policy.admin_approval_limit_pct` defines the
per-vertical/category/tier threshold; `premium_approval_requests.status` runs
`pending -> approved_by_admin / approved_by_super_admin / rejected`; superadmin's
dashboard correctly filters `status='pending' AND boq_total>100000`. This is the
exact hierarchy the project owner describes. BUT `approved_by_admin` and
`approved_by_super_admin` are written in exactly 2 places
(app/admin/dashboard/premium-approval-actions.ts,
app/superadmin/dashboard/actions.ts) and read NOWHERE else in the codebase —
confirmed by repo-wide grep. Once approved, nothing writes the approved premium %
back into boq_generated or the client-facing estimate. This is the top-priority
re-link (see PENDING).

TWO DISTINCT VISIT FLOWS (confirmed 23 Sep 2026, do not merge back into one form):
- Flow (i) SITE SURVEY — one-time, pre-estimate, step 2 above. Correct
  implementation already exists but is orphaned (17 standalone Screen0X_*.tsx
  files in app/supervisor/site-visit/, zero imports anywhere — verified). Needs
  its own route, triggered off `confirmed`-status jobs with no survey yet.
- Flow (ii) DAILY EXECUTION VISIT — repeatable, post-agreement, step 8 above.
  This is what SiteVisitManager.tsx (the only thing wired to
  /supervisor/site-visit) actually is. Its trigger already exists
  (supervisor_daily_routes slot -> ?slot=<id>) but initReport() ignores the
  slot param, so multiple daily visits to the same booking collapse into one
  row. Supervisor can do both flows on the same job at different times.
See docs/SITE_VISIT_REBUILD_SPEC.md for full detail on both.

STANDING PRINCIPLE: every field is one conceptual thing with one real data type,
named the same way everywhere it appears, and must feed forward into every place
that logically needs it (estimation, payment decisions, milestone comparison, BOQ,
client-facing views) without being re-entered or silently dropped. Before adding,
renaming, or wiring any field: check what step of this flow it belongs to, who
enters it, and everywhere downstream that should consume it. This is the lens for
every decision in supabase/audits/field_naming_audit_v2.sql findings and the
SiteVisitManager rebuild (see docs/SITE_VISIT_REBUILD_SPEC.md).

## WORKING LOGINS
See .env.local for credentials
- admin@proengineering.in
- coordinator@proengineering.in
- subcoordinator@proengineering.in
- siteincharge62@proengineering.in
- supervisor62@proengineering.in

## BROKEN LOGINS (Supabase ticket SU-472225)
- superadmin@proengineering.in
- client1-7@proengineering.in

## SERVICE ROLE KEY
See .env.local for credentials

## ROLES BUILT
- Worker: /onboarding/[trade] — 6 screens, 9 trades, 34 fields
- Site Incharge: /site-incharge/dashboard + /substage/[id]
- Supervisor: 12 pages including 21-screen daily execution visit
  (/supervisor/site-visit, Flow ii) + 20-screen site survey
  (/site-survey/[bookingRef], Flow i, revived Session 58 continued)
- Sub-Coordinator: 7 pages
- Coordinator: 13 pages
- Admin: 7 pages (workers/policy/payments/zones/reports/scope/milestones)
- Client: /client/login + /client/dashboard/[bookingRef] (11 sections)
- Super Admin: stages 9-14 built
- Mktg Agent: /mktg-agent/dashboard (built Session 58 continued) — minimal,
  single-purpose: "+ New Job" link to /book. platform_role = 'mktg_agent'.
  No login provisioned yet — see PENDING for the SQL to create one.

## WORKER FIELDS (34 total across 6 screens)
Screen 1: fullName, phone, email, aadhaarLast4, pan, state, district
Screen 2: address, city, pincode
Screen 3: skillLevel, sector, labourType, employmentType, secondaryTrades, yearsExperience, jobsCompleted
Screen 4: zones, isAvailable, dailyWage, hourlyRate
Screen 5: bocwRegistered, bocwNumber, pfUan, esicIp, bankAccount, ifscCode, emergencyName, emergencyPhone
Screen 6: heightRestriction, dustRestriction, deploymentRestriction, teamName, teamNumber, declared, agreed

## PENDING
1. Auth fix — Supabase SU-472225
2. Worker phone duplicate check on Vercel
3. Real rate card data — Noida Sector 62/63/64 in /admin/zones
4. Sub-coordinator complete build
5. Rate Intelligence form — /admin/rates/update
6. End-to-end test — real worker registration
7. Test Flow (i) Site Survey end to end on a real confirmed-status booking, verify generateBOQ output actually changes
8. Flow (ii) SiteVisitManager.tsx (/supervisor/site-visit) still needs: test/measurement banks (screens 11/12 — needs a schema decision, see docs/SITE_VISIT_REBUILD_SPEC.md "Not yet designed"), Screen 14 duplicate-of-Screen-6 consolidation (confirmed Screen17_RiskFlags.tsx was NOT the source of the duplication — it was an already-discarded Flow (i) draft, now deleted; the actual consolidation — removing Screen 14 from Flow (ii) and renumbering 15-21 down — is still undone because it would shift which SCREEN_COLUMNS index each screen writes to, risky to do blind against any already-submitted live rows without testing). (initReport() slot-scoping DONE — commit 9863c24, migration 20260924_site_visit_reports_slot_scoping.sql needs to be run in Supabase; Screen 15/17->extra-works wiring DONE; Screen 18->decision_5 wiring DONE; remarks-on-No pattern DONE for screens 4/5/10/13; LTF per-substage loop DONE for screen 2; deployment auto-populate DONE for screen 3 — see Session 58 continued-further log below)
9. Run migration supabase/migrations/20260924_milestone_payment_schedule_decision_5_remedy.sql in Supabase (adds decision_5_remedy column, needed by the Decision 5 raise action now built)
10. Wire boq_sku_catalogue.client_description into client-facing estimate view (real data, currently unused — Session 58 finding)
11. Extend Flow (i) Site Survey to admin/coordinator/sub_coordinator/superadmin — needs a decision on identifying "who filled this" for roles with no workers row (give them one, or move actions off workers.id onto users.id)
12. Provision a real mktg_agent login: in Supabase Dashboard -> Authentication -> Users -> Add User (email + password), copy the generated UUID, then run: INSERT INTO users (id, email, full_name, platform_role) VALUES ('<uuid>', '<email>', '<name>', 'mktg_agent'); (exact pattern verified from app/onboarding/actions.ts's worker-creation insert — do not use supabase/schema.sql's users table definition, it's the stale legacy schema with a different role column entirely)
13. Decide whether "+ New Job" created by staff/Mktg Agents should be tagged with who created it (no created_by/raised_by column exists on guest_enquiries currently — every job looks the same regardless of source)
14. Run migration supabase/migrations/20260924_site_visit_reports_slot_scoping.sql in Supabase (adds slot_id column, needed by the initReport() slot-scoping fix)
15. [Session 59 finding, HIGHEST PRIORITY — confirmed built-but-disconnected] Re-link premium/rebate approval: once premium_approval_requests.status is set to approved_by_admin or approved_by_super_admin, nothing applies the approved premium % back into boq_generated/the client-facing estimate. Fix in app/admin/dashboard/premium-approval-actions.ts + app/superadmin/dashboard/actions.ts's approve actions — each needs to also update the live BOQ total, not just the request row.
16. [Session 59 finding] Give Site Incharge its own FK on guest_enquiries (e.g. site_incharge_id), separate from supervisor_id — confirmed they are two different roles/cardinalities (one Site Incharge embedded per job vs one Supervisor across many jobs), currently forced to share one column.
17. [Session 59 finding] Build an outbound "request more resources" channel for Site Incharge — today site_instructions only flows INTO Site Incharge (issued_to) from Sub-Coordinator; there is no code path for Site Incharge to raise a request outward. daily_site_logs, despite sounding like Site Incharge's daily report, is actually built for and used by Supervisor only (confirmed via migration comment + code).
18. [Session 59 finding] Open generateBOQ (app/admin/estimate/[bookingRef]/actions.ts) to Sub-Coordinator and Supervisor as valid draft-estimate sources — today it's callable only from admin's own page, contradicting the confirmed business rule that Estimator/Sub-Coordinator(if labour source)/Supervisor(on first visit) can all draft an estimate.
19. Build the Rate Intelligence form (/admin/rates/update, PENDING #5) — still doesn't exist as a route. Without it, rate_card/calculation_rules_engine are frozen at their original migration seed, never refreshed from CPWD/market-intelligence sources as the business design (and an earlier session's rate-sourcing work) intended.
20. [Session 59, broader finding — not yet actioned, needs a decision before any schema migration work] Nearly every cross-entity link in the live schema is a TEXT match (booking_ref, milestone_code) rather than a real foreign key — confirmed via repo-wide grep of every CREATE TABLE/REFERENCES in supabase/migrations/. Tables workers, users, job_milestone_substages, supervisor_daily_routes, scope_change_requests, trade_config, payment_policy have NO migration file at all (live-only, undocumented). A parallel, cleaner entity design once existed in supabase/schema.sql (jobs, job_modules, scope_reports, estimates, milestones etc.) but was abandoned in favor of the current ad hoc live schema built session-by-session — that file is now stale/misleading and should not be used as a reference. "One job, many skilled workers, partial-day/multi-leg routing" is itself modeled THREE separate, uncoordinated ways: worker_day_slots (supervisor-written, TEXT-keyed), worker_shift_schedule (sub-coordinator-written, has a `legs` JSONB column matching the travel-then-work-then-travel route concept exactly, but confirmed NEVER WRITTEN anywhere — read-only decoration on site-incharge's dashboard), and supervisor_daily_routes (coordinator-written, best-normalized of the three, real FK on the worker side, but supervisor-only). Full detail in SESSIONS.md Session 59. A proper fix (one worker_route_legs entity, real FKs throughout) is a deliberate schema-redesign project, not a drip-fix — needs the project owner's go-ahead on scope before starting.
21. [Session 61 finding] Decide, table by table, on the 17 originally-specified entities confirmed NOT BUILT AT ALL (zero migration, zero live code reference — repo-wide grep, not a guess): job_status_labels, assessment_gate_config, milestone_templates, compliance_field_config, empanelled_firms, labour_contractors, contractor_compliance_log, compliance_records, professional_indemnity, worker_concerns, qip_templates, qip_template_checks, field_validation_reports, qip_check_results, rate_surcharge, daily_labour_utilisation, material_catalogue. Each needs a deliberate build-it-or-retire-it call, not silent neglect. Full detail in docs/ORIGINAL_SPEC_AUDIT.md.
22. [Session 61 finding] Resolve the client_estimates/boq_generated duplication — the original spec's "estimates" table was built live under the name client_estimates (migration 20260628_estimate_console.sql, near field-for-field match to spec), but boq_generated also exists doing an overlapping job. Same "specified once, built twice under different names" pattern as the worker-routing duplication (PENDING #20) — needs the same fix discipline: decide which is canonical, or merge them.
23. [Session 61 finding] assessment_bookings' live schema (migration 20260622_assessment_slots.sql) does not capture the assessment result at all (no result/result_notes/photo columns) — a worker can be booked into an assessment slot but nothing live records whether they passed. An earlier, richer version of this table (found in the original design conversation) did capture this. Decide whether to restore result-capture fields.
24. [Session 61 finding] site_visit_reports' ORIGINAL spec (18 clean, single-purpose screen columns) is now available as a clean reference baseline for the Flow (i)/(ii) split already agreed on (PENDING #8) — see docs/ORIGINAL_SPEC_AUDIT.md for the exact original field shape to rebuild from, instead of designing the split from scratch.
25. [Session 62 finding, HIGH PRIORITY] /supervisor/approval/[id] does not exist as a route at all — confirmed via repo-wide file search. Every "Review & Approve" and "Send Back" action across app/supervisor/dashboard, app/supervisor/approvals, and app/supervisor/inspections links to this URL. The entire Supervisor approval gate in the Site Head → Supervisor → Sub-Coordinator → Finance payment chain is a fully-styled read-only view with no working approve/reject action anywhere.
26. [Session 62 finding] Four more Supervisor routes are dead links, confirmed by file search: /supervisor/reports/new (all 6 report types, including Safety Critical, unreachable — Supervisor has no working incident/safety-escalation path at all once combined with #28 below), /supervisor/instruction (linked from critical-path alerts), /supervisor/milestone-tracker/propose (the only write action offered on the Milestone Tracker screen beyond viewing). Also confirmed fully dead with real data displayed but no backend: app/supervisor/estimate (no actions.ts, no onClick on any input/button) and app/supervisor/scope-verification (same — already flagged Session 58, reconfirmed). app/supervisor/route/plan's manual "Add Slot to Route" button and app/supervisor/directives' "Acknowledge Directive" button are also inert (no onClick, no actions.ts).
27. [Session 62 finding] job_milestone_substages (substage-level, written by app/supervisor/milestone-tracker) and milestone_payment_schedule (milestone-level, written independently by app/supervisor/milestone/[bookingRef]) are two separately-writable "milestone submitted" records for the same booking/milestone, linked only one-way (substage-complete syncs forward into payment-schedule; the [bookingRef] route can set payment-schedule status without ever touching the substage table). The two can disagree. Needs the same "which is canonical" decision as PENDING #22.
28. [Session 62 finding] SA-11 Crew Management's core rule ("Supervisor cannot add workers independently — must request via coordinator") is inverted in live code: SubstageCard.tsx's assignWorkerToSubstage()/removeWorkerFromSubstage() let Supervisor unilaterally add/remove crew with no coordinator-approval step, and no BOCW/safety-induction/deployment-clearance compliance status is ever shown when picking a worker. Also confirmed not built at all: SA-13 Client Handover Sign-Off (digital signature, 12-point checklist), SA-14 Earnings and Payments (no self-service pay view for Supervisor anywhere), and the always-on SOS button (spec: "cannot be disabled by anyone" during work hours) — none exist in app/supervisor/ at all.
29. [Session 62 finding] SA-7 Ponding Test Log (24-hr hold, timestamped start/end photos, hard block on tiling) and SA-8 Plumbing Pressure Test (3-hr hold, gauge photos, hard block on wall-chase closure) both collapse into one generic Flow (ii) Screen 11 ("Test Results") with plain numeric fields (pressureTestValue, holdTimeMinutes, slopeMeasurement) and no start/end-tap workflow or blocking logic — quality-critical trade sequencing is not enforced in code at all.
30. [Session 62 finding] Root cause of an earlier session's Supervisor "Job Offer Accept/Decline" write-up (now corrected): the June log's WA-2 (Worker App) screen — Accept/Decline with a 30-minute countdown, 60-minute auto-reassignment — was mistakenly attributed to Supervisor. Supervisor's own early-spec SA-2 (line 10465-10468) does independently describe a similar accept/decline gate, but this was superseded by the later SA-ROUTE mechanism (predictive daily route, Confirm Day Plan lock) and was never built for Supervisor in live code — confirmed no accept/decline UI exists anywhere in app/supervisor/. The real, live, and project-owner-confirmed Act 1 is: Supervisor visits site per the slot fixed by Admin/Coordinator in supervisor_daily_routes. See docs/SUPERVISOR_INFEED_ACT_OUTPUT.md.
31. [Session 63 finding, CONFIRMED REGRESSION — introduced by this project's own Session 58] `supervisor_daily_routes.slot_type` (6 options: inspection, overhang, client_visit, scope_survey, estimate_visit, hq) is fully modeled in the route-planning UI and database, but nothing downstream reads it — every route slot, regardless of stated purpose, links to the same `/supervisor/site-visit?slot={id}` (Flow ii, the post-job-confirmed Daily Execution form). A `scope_survey` or `client_visit`/`estimate_visit` slot (which should open the pre-job-confirmed Site Survey form at `/site-survey/[bookingRef]`) opens the wrong screen set. Confirmed by grep: `app/supervisor/dashboard/page.tsx:575,589` and `app/supervisor/route/plan/page.tsx:310` all hard-code the same href with no branch on `slot.slot_type`. Fix: branch the slot's report link on `slot_type` (client_visit/scope_survey/estimate_visit → Site Survey; inspection/overhang → Daily Execution; hq → no site-visit link).
32. [Session 63 finding, CONFIRMED REGRESSION — introduced by this project's own Session 58, commit b50a5697] `Screen17_RiskFlags.tsx` was deleted in Session 58's "dead draft cleanup" on the reasoning that it was "an unrelated, already-discarded Flow (i) draft with zero importers." That's true that nothing imported it, but false that it was a draft: per the original June spec (june.md lines 37217-37238) it was a real, deliberately-specified "Risk Flag Summary" screen that aggregates every risk flag raised across Screens 2-13, shows them to Coordinator, and on a "SUBMIT RISK FLAGS FOR COORDINATOR REVIEW" button writes `site_visit_reports.risk_flag_count`. That column is STILL ACTIVELY READ today by `app/admin/scope-report/[id]/page.tsx:70` and `ScopeReportView.tsx:852`, displayed to Admin as every job's "Risk Flags" count — which has been silently stuck at 0 since the only writer was deleted. Needs the aggregation+write-back logic restored (revived screen, or folded into an existing one) before this is considered closed. Full context in docs/SUPERVISOR_INFEED_ACT_OUTPUT.md.
33. [Session 63 finding] SA-11 Crew Management ambiguity from Session 62 resolved by the project owner: Supervisor MAY move workers unilaterally between HIS OWN controlled/active jobs (deliberate flexibility) — the actual gap is narrower than first flagged: `app/supervisor/milestone-tracker/page.tsx:59-62`'s worker pool query has NO scoping to the requesting supervisor's own controlled jobs at all (`SELECT ... FROM workers` with only zone/trade/skill filters) — it should be restricted to workers already earmarked/assigned to one of THIS supervisor's active jobs (`guest_enquiries.supervisor_id`) for that day, not the entire workers table.

## SESSION RULES
- Never write code without explicit permission per change
- Read files before editing — never guess schema
- Run npx tsc --noEmit after every change — exit 0 required
- Always push after TSC passes

## START OF SESSION
First command in Claude Code every session:
Read CLAUDE.md and SESSIONS.md. Tell me what was last built and what is pending.

## UPDATED SESSION 54 — 20 Sep 2026
- Supervisor dropdown FK bug fixed — sources workers.id not users.id (commit 6031fbd)
- NODE 2 DONE — coordinator assigns supervisor via dashboard and jobs pages
- NODE 3 NEXT — assign supervisor62 to PE-2026-0002 then test supervisor dashboard
- guest_enquiries.supervisor_id FK → workers.id CONFIRMED
- Supervisor filter: workers.trade='Supervisor' AND is_active=true
- workers.approval_status DOES exist (confirmed live: real values are coordinator_approved, admin_approved) — 'approved' is not a valid value, that's why it's excluded from the filter

## SESSION 54 FINAL — 20 Sep 2026
- NODE 2 DONE: coordinator assigns supervisor via dashboard (commit 6031fbd)
- NODE 3 DONE: supervisor62 sees PE-2026-0002 in dashboard (verified live)
- NODE 4 IN PROGRESS: site visit backend wiring done (commits bf2311e 0dc968f 14d4e69) — empty workerId guard fixed — TEST NEEDED: go to supervisor site visit for PE-2026-0002 fill screens click AUTHORIZE AND APPROVE then check site_visit_reports table
- NEXT: SELECT id booking_ref status submitted_at FROM site_visit_reports WHERE booking_ref = PE-2026-0002
- THEN: coordinator generates BOQ for PE-2026-0002 at /admin/estimate/PE-2026-0002
- PENDING: worker phone duplicate check in app/onboarding/[trade]/actions.ts
- PENDING: remove debug console.log from app/onboarding/[trade]/page.tsx

## SESSION 55 — 21 Sep 2026 — SCHEMA AUDIT & SITE VISIT DATA MODEL GAP
- Supabase_SCHEMA_AUDIT.CSV added to repo — 1151 field rows, cross-table field-name/type-mismatch audit
- ROOT CAUSE FOUND (verified against live DB via Supabase OpenAPI schema, not just migration files):
  - site_visit_reports has 40 screenNN_* columns — the union of at least 2 abandoned site-visit
    implementations (standalone Screen02_ScopeIntent.tsx etc. files, unused) plus the current
    SiteVisitManager.tsx (21-screen single-file version, currently live)
  - SiteVisitManager.tsx's SCREEN_COLUMNS array maps each of its 21 screens to a real column, but
    the column names don't semantically match what that screen actually collects (e.g. Screen 12
    "Measurements" saves to screen12_compliance; Screen 13 "Quality Check" saves to the
    confusingly-named screen13_measurements)
  - BIGGER ISSUE: generateBOQ (admin/estimate/[bookingRef]/actions.ts), EstimateConsole.tsx, and
    ScopeReportView.tsx (admin/scope-report/[id]/) all expect a rich structured data model
    (floorArea, totalWallArea, tilesScope/plumbingScope/electricalScope dropdowns, per-trade
    labour-days, electrical new-point counts, etc.) that the current 21-screen SiteVisitManager
    form never collects — it only has free-text fields (e.g. actualDimensions as a raw string)
  - This means PE-2026-0002's BOQ (boq_generated row exists, status admin_review, created
    2026-09-21T02:31:05) has wrong/incomplete quantities — not a quick column-mapping fix
- DECISION: Option 3 selected — rewrite SiteVisitManager to collect structured fields, not just
  reroute existing free-text fields
- PENDING: Read SCHEMA_AUDIT CSV for TYPE MISMATCH rows, write one SQL script to fix
- PENDING: Rewrite SiteVisitManager screens (esp. 2, 12) with structured inputs matching what
  generateBOQ/EstimateConsole/ScopeReportView actually need
- PENDING: Fix SCREEN_COLUMNS to point each screen at a real, semantically-correct column
- PENDING: Fix generateBOQ to read from the corrected columns/field names
- Node 4 DONE: site_visit_reports row confirmed for PE-2026-0002, status=submitted
- Node 5 PARTIAL: BOQ row generated for PE-2026-0002 but quantities are wrong (data model gap above)
- Next: design + implement the site-visit data model fix end to end, then re-test full flow

## SESSION 56 — 21 Sep 2026 — FIELD AUDIT PROGRESS
- SUPER_ADMIN_FIELD_AUDIT.csv created and uploaded to GitHub
- master_field_registry view created in Supabase
- SUPER_ADMIN_FIELD_FIXES_WITH_SQL.numbers created — needs CSV export on Windows
- Strategy: SUPER_ADMIN fields are master — all lower roles must match
- Hierarchy: SUPER_ADMIN > ADMIN > COORDINATOR > SUB_COORDINATOR > SUPERVISOR > SITE_INCHARGE > FINANCE > CLIENT > WORKER
- PENDING: Export SUPER_ADMIN_FIELD_FIXES_WITH_SQL.numbers to CSV on Windows
- PENDING: Run awk command to extract mismatches and SQL fixes
- PENDING: Apply SQL fixes in Supabase for all type mismatches
- PENDING: Apply code replacements in all role files
- PENDING: Rewrite SiteVisitManager.tsx with structured fields
- PENDING: Fix SCREEN_COLUMNS to correct DB columns
- PENDING: Fix generateBOQ to read correct fields

## SESSION 56 CONTINUED — 21 Sep 2026 evening
- CamelCase to snake_case renamed in Supabase DB via DO block
- Same renamed in all code files (commit 96b9b33) — 5 files changed
- Files changed: app/onboarding/[trade]/actions.ts, app/onboarding/[trade]/page.tsx, app/admin/dashboard/page.tsx, app/admin/payments/PaymentTabs.tsx, app/admin/reports/ReportTabs.tsx
- TYPE 2 mismatches pending SQL fix in Supabase: years_experience, zones, certifications, amount, allocated_hours, created_at, updated_at
- NEXT: Run TYPE 2 SQL fixes in Supabase then update SESSIONS.md
- PENDING: Rewrite SiteVisitManager.tsx screens with structured fields
- PENDING: Fix SCREEN_COLUMNS to correct DB columns
- PENDING: Fix generateBOQ to read correct screen columns
- PENDING: Test full flow PE-2026-0002 end to end

## SESSION 57 — 22 Sep 2026
- ADMIN field audit running — Supabase query with DISTINCT ON to fix join explosion
- Only 2 real mismatches found in ADMIN: admin_acknowledged_at and amount
- ADMIN_FIELD_AUDIT_CLEAN.csv to be uploaded to GitHub after Supabase query runs
- Previous join explosion issue fixed by removing LIKE joins — using exact column_name match only
- SUPER_ADMIN done — camelCase fixed in DB and code — commit 96b9b33
- TYPE 2 fixes done in Supabase — years_experience, zones, active_workers, allocated_hours, amount
- PENDING: ADMIN clean audit — fix 2 mismatches in Supabase and code
- PENDING: Run same for COORDINATOR, SUB_COORDINATOR, SUPERVISOR, SITE_INCHARGE, FINANCE, CLIENT, WORKER
- PENDING: Rewrite SiteVisitManager.tsx with structured fields
- PENDING: Fix SCREEN_COLUMNS and generateBOQ
- PENDING: Test full flow PE-2026-0002

## SESSION 58 — 22 Sep 2026 — FIELD-NAMING AUDIT REBUILT, FIRST REAL CROSS-ROLE BUG FOUND
- Old CSV/LIKE-join/sed workflow (Session 56-57) superseded — it's what caused the
  join explosion. Replaced with supabase/audits/field_naming_audit_v2.sql: one
  single-statement query, table-to-role map is code-derived (grepped every
  `.from('table')` under each app/<role>/ dir), no fuzzy joins
- Audit's root-matching has a known blind spot: can't catch two totally different
  words for the same concept (e.g. contact_name vs full_name). Those need a manual
  walk of every .select/.update/.insert against a table across all role files
- Fixed via audit: guest_enquiries.scheduled_date TEXT->DATE; dropped dead columns
  boq_generated.job_id/approved_at/client_notes, site_instructions.acknowledged_at,
  premium_approval_requests.actioned_at, job_milestone_substages.admin_approved_at
- Fixed via manual walk: guest_enquiries never captured a client name at all (no
  form field existed) — added one to app/book/payment/page.tsx, unified 5 files
  on contact_name, dropped full_name after backfill confirmed no conflicts
- REAL BUG (the important find): job_milestone_substages had two disconnected
  approval systems. 10+ pages across 4 roles read coordinator_approved_at as the
  final-approval gate; nothing ever wrote it. admin's actual approve/reject action
  wrote to separate substage_* fields only its own page read. Fixed: that action
  now also sets coordinator_approved_at (approve) / status: 'sent_back' (reject)
- Flagged, not fixed: boq_sku_catalogue.client_description has real unused data
  (feature gap); admin/payments "Decision 5 Queue" can never populate — nothing
  raises a case, only admin's resolution side was ever built
- Tables fully walked and clean: guest_enquiries, job_milestone_substages,
  boq_generated, milestone_payment_schedule
- site_visit_reports SCOPED with hard evidence (not fixed): all 21 screen titles
  in SiteVisitManager.tsx mismatch their SCREEN_COLUMNS storage column, 3
  different overlapping column sets exist across 2 migrations + live-only
  columns, SCREEN_COLUMNS is even 1 short (20 entries for 21 screens). Still
  unconfirmed whether generateBOQ reads these columns by name expecting specific
  content (would make it a live data-correctness bug, not just confusing names)
  — check that first next session. See SESSIONS.md Session 58 for full mapping.
- NEXT: confirm generateBOQ/EstimateConsole/ScopeReportView reading against
  site_visit_reports, then decide on the SiteVisitManager rewrite; smaller tables
  still unwalked: daily_site_logs, scope_change_requests, worker_shift_schedule
- All work on PR #1 (github.com/Realpra/pro-engineering/pull/1), branch
  claude/gracious-knuth-vxwkc3

## SESSION 58 CONTINUED — 23-24 Sep 2026 — TWO-FLOW ARCHITECTURE CONFIRMED, FLOW (I) SITE SURVEY BUILT
- Project owner walked supervisor62 through /supervisor/site-visit live and confirmed the
  real-world model: site visits are actually TWO separate activities that got conflated into
  one 21-screen form. See CLAUDE.md's PROCESS FLOW section (top of file) and
  docs/SITE_VISIT_REBUILD_SPEC.md for full detail. Do not merge these back into one form.
- Investigated the 23 "abandoned" standalone screen files in app/supervisor/site-visit/
  (Screen01.tsx..Screen20_Submit.tsx) — confirmed zero imports anywhere in the app (Next.js
  doesn't auto-wire component files, only SiteVisitManager.tsx's own imports mattered, and it
  imports none of them). But they already save to exactly the columns generateBOQ/
  EstimateConsole.tsx/ScopeReportView.tsx read, with properly typed structured fields
  (floorArea, wallAreaNorth/South/East/West, newExhaustPoints/newSocketPoints bundled into a
  newPoints object) — this is the correct Flow (i) implementation, just never wired up.
- Resolved 4 screen-number collisions by comparing field content: kept Screen16_Timeline (not
  Screen16_Materials, an early draft of Screen19_Materials), Screen17_RiskDecisions (not
  Screen17_RiskFlags, an earlier draft), Screen18_ClientScope (not Screen18_Timeline, an early
  draft of Screen16_Timeline), Screen20_Submit (not Screen19_Submit, stale before Materials
  moved to slot 19) — 20 screens total, not 21.
- Found + fixed 3 more internal bugs while wiring: Screen04_Walls, Screen10_Tiles, and
  Screen11_Fixtures each called saveScreen() with a column name matching neither their own
  screen number nor ScopeReportView.tsx's SCOPE_SCREENS array (screen06_walls, screen08_tiles,
  screen09_fixtures) — corrected to screen04_walls/screen10_tiles/screen11_fixtures.
- BUILT: /site-survey/[bookingRef] — new route + SiteSurveyManager.tsx orchestrating the 20
  screens in sequence, threading scopeIntent/measurements/labourData between screens exactly as
  each screen's own Props interface already expected. Entry point added to supervisor
  dashboard for confirmed-status jobs ("Start Site Survey" button).
- LIMITATION (not guessed around, needs a decision): only supervisor + site_incharge can access
  it today, since both have a workers row the actions key off of ("who filled this"). admin/
  coordinator/sub_coordinator/superadmin were named as eligible by the project owner but have no
  workers row in this codebase — extending needs a decision on how to identify them (give them a
  workers row, or move the actions off workers.id onto users.id).
- NOT YET TESTED end to end against a real booking (needs a live confirmed-status job — try
  reassigning PE-2026-0002 or a fresh booking to 'confirmed' status, or wait for a real one).
- NEXT: end-to-end test Flow (i), then verify generateBOQ output actually changes with real
  survey data behind it. Flow (ii)'s initReport() slot-scoping bug and the per-screen fixes in
  docs/SITE_VISIT_REBUILD_SPEC.md are still open (PENDING #8).
- All work on PR #1, branch claude/gracious-knuth-vxwkc3

## SESSION 58 CONTINUED FURTHER — 24 Sep 2026 — NO UPFRONT PAYMENT + INTERNAL JOB CREATION + MKTG AGENT ROLE
- BUSINESS LOGIC CORRECTION: real process is no payment is levied until the job is surveyed,
  estimated, negotiated with the client, and approved by admin/superadmin. The public /book flow
  was collecting an "advance token" payment before any of that. Fixed: app/book/payment renamed
  to app/book/submit, payment method UI (UPI/card/netbanking) removed entirely, insert no longer
  sets payment_method/token_amount, payment_status left to its 'pending' default. Updated the
  token/payment messaging in app/book/estimate and app/book/confirmation to match (milestone
  schedule there is now labeled as an indicative preview, not something due now). Removed
  lib/booking.ts's now-unused tokenAmount field. Verified via grep that nothing downstream reads
  payment_status or token_amount, so this was a safe, contained change.
- NEW: "+ New Job" link added to admin, coordinator, sub-coordinator, supervisor, and superadmin
  dashboards, pointing straight at /book -- since payment is gone, /book already IS "the job
  card" for staff to fill on a client's behalf (from local outreach, a phone call, etc.), no
  separate internal form needed.
- NEW ROLE: Mktg Agent (platform_role = 'mktg_agent'). Added the login.actions.ts redirect case
  and a minimal /mktg-agent/dashboard whose only feature is the same "+ New Job" link, matching
  what this role is for. Code side only -- the actual login (Supabase Auth user + a users row)
  needs to be provisioned in Supabase; exact SQL is in PENDING #12 (verified against the real
  insert pattern in app/onboarding/actions.ts, not the stale supabase/schema.sql).
- OPEN QUESTION for later: no created_by/raised_by column exists on guest_enquiries, so a job
  created by a Mktg Agent looks identical to one from any other source -- fine for now, but
  worth deciding if per-agent lead tracking becomes needed (PENDING #13).
- All work on PR #1, branch claude/gracious-knuth-vxwkc3

## SESSION 58 CONTINUED FURTHER — 24 Sep 2026 — FLOW (II) SCREEN 17/18 WIRING, DECISION 5 RAISE BUILT
- Per user instruction to keep working ahead without live testing (deferred to Windows PC),
  continued Flow (ii) PENDING #8 fixes in app/supervisor/site-visit/SiteVisitManager.tsx.
- SCREEN 18 PAYMENT PROPOSAL: added the reason fields the project owner specified. Decision 2
  (Partial Release) now has a "Reasons for Partial Release" box (form.partialReleaseReason).
  Decision 4 (Hold) now has a "Reasons for Holding Release" box (form.holdReason). Decision 5
  (Reject), which previously had ZERO conditional UI, now has the full two-part structure: "Why
  Rejected" (bad quality / not as per design / not as per sequence / others+textbox) and "What to
  Do" (redo complete / redo part affected / create a substage job / others+textbox).
- DECISION 5 RAISE ACTION BUILT (closes PENDING #9 -- the missing raise-side of an
  already-orphaned mechanism first flagged Session 58): new `raiseDecision5()` in
  app/supervisor/site-visit/actions.ts. Finds the matching milestone_payment_schedule row by
  booking_ref + milestone_code (from substageData, not yet decision-5-raised), writes
  decision_5_raised_at/decision_5_raised_by/decision_5_reason and a NEW decision_5_remedy column
  (migration supabase/migrations/20260924_milestone_payment_schedule_decision_5_remedy.sql --
  the existing decision_5_reason column only had room for the "why" half, the "what to do" half
  needed its own column per the spec in docs/SITE_VISIT_REBUILD_SPEC.md). Wired into Screen 21's
  AUTHORIZE & APPROVE button, the same finalization point submitReport() already uses. Also added
  decision_5_remedy to app/admin/payments/PaymentCard.tsx (type, NIL_PAYMENT, the live Decision 5
  queue view, and the resolved-history Cell grid) so admin can actually see the supervisor's
  recommended remedy, not just the reason -- per the standing CLAUDE.md principle that a field
  must feed forward into every place that needs it.
- SCREEN 17 SCOPE CHANGE WIRED to the existing, previously-orphaned submitExtraWork() action
  (app/supervisor/extra-works/actions.ts) -- also called from Screen 21's AUTHORIZE & APPROVE
  button, mapping scopeChangeTrigger (Trigger A/B/No Scope Change) to
  technical_recommendation/client_demand, scopeChangeDesc/scopeChangeTechnicalReason/
  scopeChangeCostImpact into submitExtraWork's description/justification/rough_items shape.
- SCREEN 15 CLIENT DECISIONS: its "Client has raised a scope change request (Trigger B)"
  checkbox was a dead toggle with no backend effect. Rather than give it a second, competing
  submission path, it now feeds forward into Screen 17 instead (sets scopeChangeTrigger to
  Trigger B and pre-fills scopeChangeDesc from clientDecisionsPending if empty) -- one scope
  change submission per visit, at the same Screen 21 finalization point as everything else,
  per the "one conceptual thing, one entry point" principle rather than two disconnected forms
  both claiming to raise the same kind of request.
- `npx tsc --noEmit` run: only the pre-existing environmental noise (node_modules not installed
  in this remote session -- TS2307/TS7026/TS2875/TS2591/TS7006/TS7031 across lib/supabase*,
  next.config.ts, proxy.ts, etc., same as every prior session's baseline). No new errors from
  this change.
- NOT TESTED, per explicit user instruction ("no testing... work ahead... test when on windows
  pc"). Two migrations now pending for the user to run in Supabase: PENDING #9 (decision_5_remedy)
  and PENDING #14 (slot_id, from the earlier initReport() fix).
- STILL OPEN in PENDING #8 at that point: remarks-on-No pattern (screens 4/5/10/13), LTF
  per-substage loop (screen 2), deployment auto-populate (screen 3), test/measurement banks
  (screens 11/12), Screen 14 duplicate-of-Screen-6 consolidation.
- All work on PR #1, branch claude/gracious-knuth-vxwkc3

## SESSION 58 CONTINUED FURTHER — 24 Sep 2026 — REMAINING SCREEN FIXES, DEAD DRAFT CLEANUP
- Continued working ahead per user instruction, no live testing. Picked up the remaining
  additive (non-renumbering) items from PENDING #8.
- REMARKS-ON-NO PATTERN (screens 4/5/10/13): these screens already had a couple of
  half-built remarks boxes, but they were dead -- e.g. Screen 4's hazard box and Screen 10's
  snag box were `textArea('...', '', () => {}, ...)`: a hardcoded empty value and a no-op
  onChange, so anything typed there was silently discarded, and most checklist items (all of
  Screen 5, most of Screen 13) had no remarks capture at all. Added a `checkRowWithRemarks()`
  helper (wraps the existing `checkRow`) and a single `form.checklistRemarks: Record<string,
  string>` keyed by field name, so every checklist item across all four screens opens a real,
  saved remarks box on "No" -- not just one item per screen.
- Screen 3's "Reason for Mismatch" box had the exact same dead-textarea bug -- fixed with a new
  `attendanceMismatchReason` field.
- SCREEN 3 DEPLOYMENT AUTO-POPULATE: "Workers Planned" now defaults from
  job_milestone_substages.skilled_workers_per_day + unskilled_workers_per_day (added to the
  substage query in page.tsx and the SubstageData type) instead of being typed by hand, with
  a fallback to manual entry when no substage/deployment figure is available -- per spec.
- SCREEN 2 LTF PER-SUBSTAGE LOOP: was one global "LTF Status Confirmed? YES/NO" toggle for the
  whole job. page.tsx now also loads every job_milestone_substages row for the booking
  (`allSubstages` prop), and Screen 2 renders one Yes/No + conditional remarks box per
  sub-stage (`form.ltfBySubstage`, keyed by substage id), replacing the single `ltfConfirmed`
  boolean.
- SCREEN 14 CONSOLIDATION -- investigated, not executed: confirmed Screen17_RiskFlags.tsx
  (flagged in the spec as needing a check first) is NOT related to Flow (ii)'s Screen 14 --
  it's an already-discarded Flow (i) draft (superseded by Screen17_RiskDecisions.tsx per
  Session 58's earlier collision-resolution work), never imported anywhere. Deleted it along
  with 3 other confirmed-dead draft files in the same state (Screen16_Materials.tsx,
  Screen18_Timeline.tsx, Screen19_Submit.tsx -- verified zero importers repo-wide before
  deleting). The actual Screen 14/Screen 6 consolidation is left undone: SCREEN_COLUMNS is
  positional (index = screen number - 1), so removing Screen 14 and renumbering 15-21 down to
  14-20 would shift which column every later screen writes to -- risky to do blind against
  whatever's already in site_visit_reports for bookings already visited under the current
  numbering, without the ability to test. Left for a session where live verification is
  possible.
- `npx tsc --noEmit`: no new errors introduced (checked with a targeted grep against these two
  files specifically, since the untouched baseline noise elsewhere in the repo is large --
  same pre-existing TS2307/TS7006/TS7026 environmental noise as every prior session).
- NOT TESTED, per explicit user instruction.
- All work on PR #1, branch claude/gracious-knuth-vxwkc3

## SESSION 59 — 24 Sep 2026 — FULL ENTITY-RELATIONSHIP / ROLE-HIERARCHY REVIEW (NO CODE CHANGES)
Pure investigation and documentation session, at the project owner's explicit direction, before
any further code work: establish the real entity-relationship map and role-hierarchy across the
whole schema, evidence-first (grep/read against live migrations and code, not assumption).
- Confirmed via repo-wide grep of every CREATE TABLE/REFERENCES in supabase/migrations/:
  `workers`, `users`, `job_milestone_substages`, `supervisor_daily_routes`,
  `scope_change_requests`, `trade_config`, `payment_policy` have NO migration file at all --
  pure live-only schema, undocumented in the repo, despite `workers`/`users` being the two most
  heavily FK-referenced tables in the system.
- Confirmed `guest_enquiries` (the de facto Job entity) is the target of a real FK from
  essentially nowhere -- every other table links to it via `booking_ref` TEXT match, not a
  foreign key. Its own migration comment says a job should convert into a real `jobs` row once
  qualified by staff -- never built; guest_enquiries has been the permanent Job entity for the
  system's whole life.
- Found `supabase/schema.sql`: a clean, normalized, FK-correct entity design (`users`, `workers`,
  `jobs`, `job_modules`, `scope_reports`, `estimates`, `zone_cost_database`, `milestones`,
  `deployment_ratings`, `bocw_cess_records`, `worker_day_tracker`, `risk_flags`) that was
  abandoned in favor of the current organically-grown live schema. It still sits in the repo and
  is stale/misleading -- do not use it as a reference for anything live.
- Built a full role x Job relationship table from evidence (grep of every role folder's
  `.from('guest_enquiries')` calls + the table's RLS policy): Super Admin, Admin, Coordinator,
  and Sub-Coordinator all have UNIVERSAL, UNSCOPED access to every job today -- no FK, no
  `.eq()` filter on any role identity anywhere in their code, and the table's own RLS policy is
  `USING (true)` for any authenticated user. Supervisor is the ONLY role with real per-job
  scoping (`guest_enquiries.supervisor_id -> workers.id`). Site Incharge shares that exact same
  column. Client scopes via live-only `client_user_id`/`contact_email`/`client_phone`. Mktg
  Agent has no relationship to jobs at all beyond linking out to /book.
- Project owner confirmed (see updated ROLE HIERARCHY section above): most acts/approvals
  conclude at ONE fixed role by original design (not universal-access-by-accident) -- the
  exception is strategic/financial decisions (premium/rebate on an estimate) which escalate to
  superadmin. Investigated and CONFIRMED this exact mechanism already exists, fully built,
  correctly threshold-gated (`contingency_policy.admin_approval_limit_pct`,
  `premium_approval_requests.status` chain, superadmin dashboard filtered by
  `boq_total > 100000`) -- but disconnected at the last step: `approved_by_admin` /
  `approved_by_super_admin` are written in exactly 2 files and read nowhere else in the
  repo, so an approved premium never reaches the live estimate. Top-priority fix, see PENDING
  #15.
- Project owner confirmed Site Incharge and Supervisor are structurally different (one embedded
  per-job presence vs. one person covering many jobs' periodic inspections) and must not share
  a link. Investigated `daily_site_logs` as a candidate Site-Incharge entity -- it's actually
  built for and used by Supervisor only (per its own migration comment), not Site Incharge.
  Site Incharge's real activity is on `job_milestone_substages` (evidence/checklist) plus
  read-only `site_instructions` -- confirmed there is no code path for Site Incharge to send a
  resource request outward, only to receive instructions. See PENDING #16-17.
- Project owner confirmed Estimator is a function performable by Estimator, Sub-Coordinator (if
  labour-sourcing), or Supervisor (on first visit to a new job) -- not one fixed role.
  Investigated `generateBOQ`: callable only from `app/admin/estimate/`, confirmed too narrow.
  Also confirmed PENDING #5's Rate Intelligence form (`/admin/rates/update`) still doesn't exist
  as a route -- `rate_card`/`calculation_rules_engine` are frozen at their original seed. See
  PENDING #18-19.
- Investigated the "one job, many skilled workers, partial-day/multi-leg routing" requirement
  (project owner's own example): found it modeled THREE separate, uncoordinated ways --
  `worker_day_slots` (supervisor-written, TEXT-keyed, no travel concept), `worker_shift_schedule`
  (sub-coordinator-written, has a `legs` JSONB column matching the travel-then-work-then-travel
  concept exactly, but confirmed via repo-wide grep to be NEVER WRITTEN anywhere -- pure
  read-only decoration on the site-incharge dashboard), and `supervisor_daily_routes`
  (coordinator-written, best-normalized of the three with real time fields and a real FK, but
  scoped to supervisors only). None of the three know the other two exist. See PENDING #20 --
  flagged as a deliberate schema-redesign item, not a drip-fix, pending the project owner's
  go-ahead on scope.
- NO CODE CHANGED this session -- purely investigation and documentation, per explicit
  instruction to fully establish the record before further work.
- All work on PR #1, branch claude/gracious-knuth-vxwkc3

## SESSION 60 — 24 Sep 2026 — ENTITY-RELATIONSHIP FREEZE LIST CREATED
- Project owner asked to finalise the schema/relationship map before any more code work --
  built docs/ENTITY_RELATIONSHIP_FREEZE.md: 29 individual relationship items (R1-R29) across
  4 sections (Role<->Job, core process entities, already-correct clusters, worker
  deployment/routing), each with current state, a proposed fix, and a blank decision box.
  No schema migration work starts on any R-item until the owner marks it.
- Pushed for review; no code changed.
- All work on PR #1, branch claude/gracious-knuth-vxwkc3

## SESSION 61 — 24 Sep 2026 — ORIGINAL DESIGN LOGS MINED, 48-ENTITY SPEC VS LIVE AUDIT, 3 EXCEL DELIVERABLES
- Project owner uploaded the actual original design conversation as three .docx chat logs
  (June/July/August 2026) and asked for the real role descriptions/entity relationships to be
  built FROM THOSE, not from this session's own code-inference (which had been correctly
  called out as "casual" / not grounded in what the project actually specified).
- Converted all three logs to text (pandoc), extracted every `CREATE TABLE` statement out of
  the June log programmatically (paren-matching parser, cleaned of pandoc markup) -- found
  48 distinct originally-specified entities with complete field lists, taking each table's
  LAST/most-refined version where it was revised multiple times across the conversation.
- Cross-checked all 48 against the LIVE repo (supabase/migrations/*.sql + repo-wide grep of
  every `.from('table')` call in app/ and lib/) -- not assumed. Result: 23 BUILT (real
  migration file), 10 LIVE-ONLY (used in code, no migration -- undocumented drift), 17 NOT
  BUILT AT ALL (zero migration, zero code reference, confirmed by grep), 1 built-under-a-
  different-name-and-duplicated (see below). Full list in docs/ORIGINAL_SPEC_AUDIT.md and
  PENDING #21.
- REAL FINDING: the spec's `estimates` table WAS built -- live as `client_estimates`
  (migration 20260628_estimate_console.sql), a near field-for-field match to the original
  design -- but `boq_generated` also exists doing an overlapping job. Same
  "specified-once-built-twice" pattern as the worker-routing duplication found Session 59.
  See PENDING #22.
- Per explicit instruction not to silently take only the latest version when scope was
  curtailed across revisions: re-checked every multi-version entity for field-count drops.
  Of 7 candidates an automated diff flagged, 2 were docx-export artifacts (a truncated paste,
  a collapsed "N lines hidden" code block) and excluded as such rather than reported as false
  findings. 3 were genuine: assessment_slots (10 fields -> 5, lost capacity tracking),
  assessment_bookings (9 fields -> 5, the earlier version captured the actual assessment
  RESULT -- the live table does not record outcomes at all, PENDING #23), and
  policy_change_log (not simple shrinkage -- two competing designs for the same audit-log
  concept, neither matching what's live). These are recorded as separate rows in the
  deliverables, not merged away.
- Built and delivered THREE Excel workbooks directly to the project owner (not committed to
  the repo -- they are working review files with a blank yellow Decision column):
  1_Entity_Relationship_Model.xlsx, 2_Canonical_Field_List.xlsx (685 field-level rows),
  3_Live_Schema_Mapping.xlsx. After feedback that the first pass didn't check what's actually
  coded, rebuilt all three with added columns: "What Is Actually Coded/Built" (real migration/
  code evidence per entity), "Difference: Spec vs Coded" (computed field-set diff, not
  asserted), and a refined "Claude Recommendation" -- Decision column stays last, blank.
- Wrote docs/ORIGINAL_SPEC_AUDIT.md as the permanent, git-tracked summary of this audit (the
  Excel files themselves live only in the delivery/scratchpad and will not survive session
  end -- this doc is what persists).
- No app code changed this session -- pure archaeology/audit + deliverable-building, per the
  project owner's explicit direction.
- All work on PR #1, branch claude/gracious-knuth-vxwkc3

## SESSION 62 — 24 Sep 2026 — SUPERVISOR IN-FEED/ACT/OUTPUT REBUILT AFTER CORRECTION, FULL CODE RE-READ
- Project owner rejected a prior-session Supervisor in-feed/act/output deliverable as
  "rubbish and deceitful," correctly identifying that Process 1 ("Job Offer Accept/Decline
  within a 30-minute countdown") was wrong, and that the table needed field-level detail
  (not screen-level abstraction) plus a paired "Fields Name Associated in Coding" column next
  to every Act, and a 3-row WRITTEN/CODED/GAP structure per process.
- ROOT CAUSE FOUND, confirmed against raw log text: the accept/decline/30-min-countdown
  language belongs to **WA-2** (Worker App), not Supervisor -- the prior pass had conflated
  the two apps. Supervisor's own early SA-2 does independently describe a similar gate, but
  it was superseded later in the same conversation by SA-ROUTE (predictive daily route,
  Confirm Day Plan lock) and was never built for Supervisor in live code. Both versions are
  preserved as separate rows in the rebuilt workbook, per the standing "list curtailed scope
  twice" instruction. Full writeup in docs/SUPERVISOR_INFEED_ACT_OUTPUT.md.
- Did a full read of all 32 files under app/supervisor/ this session (dashboard, daily-log x6,
  milestone-tracker x3, extra-works x3, route/plan, certificate, pre-delivery x3, approvals,
  directives, estimate, inspections, reports, scope-verification, milestone/[bookingRef] x3),
  not spot checks -- confirmed several new findings the prior pass missed entirely:
  - /supervisor/approval/[id] does not exist as a route at all, despite being the target of
    every "Review & Approve"/"Send Back" action across 3 different Supervisor pages -- the
    entire Site-Head-to-Supervisor approval gate in the payment chain is non-functional
    (PENDING #25).
  - /supervisor/reports/new, /supervisor/instruction, and /supervisor/milestone-tracker/propose
    are also confirmed dead routes; app/supervisor/estimate and app/supervisor/scope-verification
    are entirely non-functional mockups (real data fetched, zero onClick/actions.ts anywhere in
    either file); route/plan's manual slot-add and directives' Acknowledge button are also inert
    (PENDING #26).
  - job_milestone_substages and milestone_payment_schedule are two independently-writable
    "milestone submitted" records for the same booking/milestone (one via milestone-tracker,
    one via the separate milestone/[bookingRef] route), linked only one-way -- same
    "specified/built twice" pattern as PENDING #22 (PENDING #27).
  - SA-11 Crew Management's core rule ("Supervisor cannot add workers independently") is
    inverted in live code -- SubstageCard.tsx lets Supervisor unilaterally assign/remove crew
    with no coordinator step and no compliance-status visibility. SA-13 (Client Handover
    Sign-Off), SA-14 (Earnings), and the always-on SOS button are all confirmed not built at
    all (PENDING #28).
  - SA-7 Ponding Test Log and SA-8 Plumbing Pressure Test (both hard quality gates with
    start/end-tap timestamps and blocking logic on downstream trades) collapse into one
    generic "Test Results" screen with plain numeric fields and no enforcement (PENDING #29).
- Rebuilt and delivered SUPERVISOR_INFEED_ACT_OUTPUT_v2.xlsx directly to the project owner (not
  committed -- working review file with a blank Decision column): 19 processes, 59 rows,
  covering all 9 original Supervisor App modules (SA-1 to SA-14 + SA-ROUTE) plus 8 live-only
  screens with no original spec match, each with paired "Fields Name Associated in Coding"
  columns next to every Act.
- Wrote docs/SUPERVISOR_INFEED_ACT_OUTPUT.md as the permanent, git-tracked summary.
- No app code changed this session -- pure audit/correction + deliverable-building, per the
  project owner's explicit instruction.
- All work on PR #1, branch claude/gracious-knuth-vxwkc3
