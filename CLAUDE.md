@AGENTS.md

---

# PRO ENGINEERING — MASTER REFERENCE

Read this at the start of every session.

## PLATFORM
- Next.js + Supabase construction marketplace
- Live: https://pro-engineering.vercel.app
- GitHub: https://github.com/Realpra/pro-engineering
- Supabase project: xhlpdbcrncpznrqpcrht

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
- Supervisor: 12 pages including 21-screen site visit
- Sub-Coordinator: 7 pages
- Coordinator: 13 pages
- Admin: 7 pages (workers/policy/payments/zones/reports/scope/milestones)
- Client: /client/login + /client/dashboard/[bookingRef] (11 sections)
- Super Admin: stages 9-14 built

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
