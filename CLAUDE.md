@AGENTS.md

---

# PRO ENGINEERING — MASTER REFERENCE

Read this at the start of every session.

## PLATFORM
- Next.js + Supabase construction marketplace
- Live: https://pro-engineering.vercel.app
- GitHub: https://github.com/Realpra/pro-engineering
- Supabase project: xhlpdbcrncpznrqpcrht

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
8. Flow (ii) SiteVisitManager.tsx (/supervisor/site-visit) still needs: initReport() scoped by slot/substage instead of booking_ref (repeated daily visits currently overwrite each other), plus the per-screen fixes in docs/SITE_VISIT_REBUILD_SPEC.md (remarks-on-No, LTF per-substage loop, deployment auto-populate, test/measurement banks, Screen 15->extra-works wiring, Screen 18->decision_5 wiring, Screen 14 duplicate-of-Screen-6 consolidation)
9. Decide + build who raises a "Decision 5" payment case — likely Screen 18 of Flow (ii) once fixed (Session 58 finding, spec'd in docs/SITE_VISIT_REBUILD_SPEC.md)
10. Wire boq_sku_catalogue.client_description into client-facing estimate view (real data, currently unused — Session 58 finding)
11. Extend Flow (i) Site Survey to admin/coordinator/sub_coordinator/superadmin — needs a decision on identifying "who filled this" for roles with no workers row (give them one, or move actions off workers.id onto users.id)
12. Provision a real mktg_agent login: in Supabase Dashboard -> Authentication -> Users -> Add User (email + password), copy the generated UUID, then run: INSERT INTO users (id, email, full_name, platform_role) VALUES ('<uuid>', '<email>', '<name>', 'mktg_agent'); (exact pattern verified from app/onboarding/actions.ts's worker-creation insert — do not use supabase/schema.sql's users table definition, it's the stale legacy schema with a different role column entirely)
13. Decide whether "+ New Job" created by staff/Mktg Agents should be tagged with who created it (no created_by/raised_by column exists on guest_enquiries currently — every job looks the same regardless of source)

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
