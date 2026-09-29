# Pro Engineering — Developer Knowledge Transfer

This is the onboarding document for a developer joining this project. It covers what
`README.md` doesn't: how this specific codebase is wired together, how to actually get it
running against the real (or a fresh) database, and where the rest of the project's
documentation lives. Read this once, then use `CLAUDE.md` as your day-to-day reference.

---

## 1. What this project is

A Next.js + Supabase marketplace platform for a construction/renovation business. A client
posts a job (or staff logs one from a phone call), it gets surveyed, estimated, approved,
priced, staffed, executed day-by-day by a Supervisor/Site Incharge, and paid out against
milestones. Nine roles use this system: Worker, Site Incharge, Supervisor, Sub-Coordinator,
Coordinator, Admin, Client, Super Admin, and a minimal Marketing Agent role.

- **Live site**: https://pro-engineering.vercel.app
- **Repo**: https://github.com/Realpra/pro-engineering
- **Supabase project ref**: `xhlpdbcrncpznrqpcrht`
- **Deployed from**: the `master` branch (Vercel's configured Production Branch). Day-to-day
  development happens on `claude/gracious-knuth-vxwkc3`; `master` is fast-forwarded to it
  deliberately once a batch of work is confirmed safe to go live (see §7).

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components + Server Actions) |
| UI | React 19, Tailwind CSS 4 |
| Database | Supabase (hosted Postgres 17.6) |
| Auth | Supabase Auth (email/password, magic link, phone OTP) |
| File storage | Supabase Storage (`worker-selfies`, `site-photos` buckets) |
| Hosting | Vercel, with Vercel Cron for two scheduled jobs |
| Language | TypeScript throughout, `npx tsc --noEmit` is the project's own gate on every change |

There is **no ORM**. Every table is queried directly through the `@supabase/supabase-js` /
`@supabase/ssr` client — you'll see `supabase.from('table_name').select(...)` everywhere. There
is also **no automated test suite** — correctness is established by `tsc` passing plus live
manual verification against the real database (see §8, this matters a lot on this project).

---

## 3. Local setup

```bash
git clone https://github.com/Realpra/pro-engineering.git
cd pro-engineering
npm install
```

Create `.env.local` in the project root (never commit this file — it's gitignored) with:

```
NEXT_PUBLIC_SUPABASE_URL=https://xhlpdbcrncpznrqpcrht.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/public key, from Supabase Dashboard -> Settings -> API>
SUPABASE_SERVICE_ROLE_KEY=<service-role key, same page -- keep this one secret, it bypasses RLS>
```

Ask the project owner for the actual key values (or find them in whatever secrets manager the
team uses) — they are **not** in this repo, on purpose, and CLAUDE.md deliberately doesn't
record them either (it was checked into a public/shared file at one point and the service-role
key was rotated afterward as a precaution — see CLAUDE.md's Session 66 entry). A few server
actions optionally read `CRON_SECRET` too (only used by the two Vercel Cron endpoints, safe to
leave unset locally).

```bash
npm run dev
```

Open http://localhost:3000. You're now running against the **real, shared, live Supabase
database** — there is no separate local/staging database for this project. Be careful with
writes; this is the same database `pro-engineering.vercel.app` uses. See §9 for working test
logins that won't disturb real customer data.

`npm run build` and `npx tsc --noEmit` are the two commands to run before pushing anything —
`tsc` is the faster one and is what every session in this project's history has used as its
pass/fail gate.

---

## 4. Database & schema setup

**There is no local database and no ORM migration runner (no Prisma, no Drizzle, nothing that
auto-applies migrations).** All schema changes are plain `.sql` files in `supabase/migrations/`,
named `YYYYMMDD_description.sql`, applied **by hand** by pasting them into the Supabase
Dashboard's SQL Editor and running them once. There is no `supabase db push` workflow in use.

This has a real, load-bearing consequence for how you write migrations on this project:

- **Every migration must be idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT
  EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`) — because a migration might be
  re-run partway through if an earlier statement in the same file failed.
- **Migration files are the only record of what changed** — `git log -- supabase/migrations/`
  is how you find out when and why a column was added. Several of this project's oldest and
  most heavily-used tables (`workers`, `users`, `job_milestone_substages`,
  `supervisor_daily_routes`, `scope_change_requests`) have **no migration file at all** — they
  were created directly in the Supabase Dashboard early in the project and never had their
  `CREATE TABLE` captured. **Do not guess these tables' columns or constraints from the code
  alone** — if you need to know a live-only table's real shape, run:
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'the_table_name';

  SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid = 'the_table_name'::regclass AND contype = 'c';
  ```
  This project has been burned twice by a developer assuming a `CHECK` constraint's allowed
  values from the code instead of checking the live database (see CLAUDE.md's `instruction_type`
  incident). Treat that as a hard rule, not a suggestion.
- **To set up a fresh database from scratch**, run every file in `supabase/migrations/` in
  filename (chronological) order. Nobody has done this from zero in this project's life — it has
  always evolved against one continuously-running production database — so treat a from-scratch
  run as untested territory and go slowly, checking each statement's own success message.
- **`supabase/schema.sql`** looks like a clean, complete schema file but is **stale and
  intentionally not used** — it's an earlier, abandoned normalized design that the live schema
  diverged from early on. Do not use it as a setup script or a reference for what's real.

**Row Level Security**: every table has RLS enabled with policies scoped by `platform_role` (a
column on the `users` table) or, for public-facing inserts like `/book` and `/onboarding`, an
`anon` INSERT-only policy. When a server action needs to read across role boundaries (e.g. an
unauthenticated `/book` page needing to read `geo_hierarchy`, or a Supervisor session needing to
look up another user's id to send them a notification), it uses a service-role client instead of
the request-scoped one — see the `adminClient()` helper pattern repeated across many
`actions.ts` files, e.g. `app/supervisor/dashboard/actions.ts`.

**Storage buckets**: `worker-selfies` (worker profile photos + work samples) and `site-photos`
(supervisor visit/handover evidence). Both need to exist in Supabase Storage with appropriate
public-read policies for the app's photo uploads to work.

---

## 5. API / server architecture

There is no separate API server or REST/GraphQL layer you need to run. Every mutation is a
Next.js **Server Action** — an `async function` marked `'use server'` at the top of an
`actions.ts` file, called directly from a Client Component like a normal function. Reads happen
directly inside Server Components (`page.tsx` files do `await supabase.from(...).select(...)`
at the top of the async component function, before returning JSX).

The one exception is the two **Vercel Cron** endpoints under `app/api/cron/`, which are real
HTTP routes (`GET` handlers) because Vercel Cron can only invoke a URL, not call a function
directly:
- `app/api/cron/daily-log-deadline-check/route.ts` — checks Supervisor daily-log submission
  deadlines (09:30 / 19:00 IST), escalates missing ones to Coordinator.
- `app/api/cron/ltf-route-compile/route.ts` — compiles tomorrow's Supervisor route from LTF
  ("ready for tomorrow") signals and carries forward overdue "overhang" work.

Both are registered in `vercel.json` with cron schedules in **UTC** (IST is UTC+5:30 — the
comments in each file do the conversion for you). Both accept an optional `CRON_SECRET` bearer
token for auth; if that env var isn't set in Vercel, the endpoint runs unauthenticated (a known,
flagged gap — set `CRON_SECRET` in Vercel's project settings before relying on this in
production).

**Directory convention**: `app/<role>/<feature>/page.tsx` + `actions.ts` + any client
components that feature needs, one folder per screen. `app/<role>/dashboard/` is always that
role's home screen after login. `app/login/actions.ts` is the single entry point that reads
`users.platform_role` and redirects to the right role's dashboard.

---

## 6. Roles, logins, and how auth maps to the app

`users.platform_role` is the single source of truth for what a logged-in person can see —
every `page.tsx` checks it near the top and redirects to `/login` if it doesn't match. Values
in use: `worker`, `site_incharge`, `supervisor`, `sub_coordinator`, `coordinator`, `admin`,
`super_admin`, `client` (not stored the same way — see below), `mktg_agent`.

Three different account-provisioning patterns exist side by side, and it matters which one a
given login uses:

1. **Staff logins** (`admin@proengineering.in`, `coordinator@proengineering.in`, etc.) — real
   Supabase Auth users with a matching row in `users`, created once by hand in the Supabase
   Dashboard. See CLAUDE.md's WORKING LOGINS list.
2. **Worker logins** — every worker registered via `/onboarding/[trade]` gets a real, distinct
   `auth.users` row automatically, with a systematically generated email
   (`<name>_<trade>_<code suffix>@proengineering.in`) and a shared dev-stage password,
   `Worker2026`. This is deliberate (project owner's decision, not a shortcut) — every worker
   still has their own row and id, only the password is shared for ease of testing.
3. **Client logins** — two independent, non-competing paths writing the same
   `guest_enquiries.client_user_id` column: a real production path (Supabase Auth's
   `signInWithOtp`, either Email Link or Phone OTP — Phone OTP needs an SMS provider configured
   in Supabase's Auth settings, not yet done as of this writing) and a dev/beta path
   (`createClientDevAuthAccount`, mirroring the Worker pattern: `<name>_client_<suffix>
   @proengineering.in` / `Client2026`, created automatically after every `/book` submission).

**Two logins are currently known-broken** (Supabase ticket SU-472225):
`superadmin@proengineering.in` and `client1-7@proengineering.in`. Don't spend time debugging
these without checking CLAUDE.md's BROKEN LOGINS note first — it's a tracked, known issue.

---

## 7. Branching, deploys, and why `master` sometimes lags

- **`claude/gracious-knuth-vxwkc3`** is where day-to-day development happens.
- **`master`** is Vercel's configured Production Branch — a push to `master` triggers a real
  production deploy to `pro-engineering.vercel.app`.
- These two branches are **deliberately not kept in lockstep**. Work lands on the working
  branch first; `master` gets fast-forwarded to it only once a batch is confirmed safe — in
  particular, once any migration that new code depends on has actually been run in Supabase.
  Pushing code that references a column/table before its migration has run will break whatever
  live feature depends on it (this has happened at least twice in this project's history — see
  CLAUDE.md's "stale master" and go-live-blocker incidents). **Before fast-forwarding `master`,
  always check**: has every migration this batch of commits needs already been run live?
- If `pro-engineering.vercel.app` looks stale after a real fix was merged, check whether
  `master` is actually caught up (`git log -1 origin/master` vs. `origin/claude/gracious-knuth-vxwkc3`)
  before assuming the code itself is wrong — this exact false alarm has happened multiple times.

---

## 8. The project's own development discipline (read this before changing schema)

This codebase has a documented, hard-won process for schema/field changes, written up in full
in **`docs/SCHEMA_FREEZE_METHODOLOGY.md`** — read that file before adding any column, table, or
FK. The short version:

- Changes are frozen **one whole business process at a time** (e.g. "Worker Onboarding,"
  "Client," "Supervisor Visit"), validated by an actual live run against the real database, not
  by reading the schema on paper.
- When two fields/tables seem to serve the same concept, the canonical one is whichever the
  **live, currently-running code actually depends on** — never "whichever was created first."
  (`contingency_policy`'s two competing column sets is the textbook example of why this rule
  exists — the first-created columns turned out to be the dead ones.)
- A field is never silently deleted or renamed out from under existing code — a superseded
  field is deprecated in place with a comment explaining why, and a genuinely new need gets a
  **new** column added alongside, never a repurposed old one.
- Before adding a new column for a concept, search for whether one already exists serving it
  (grep the codebase, check `information_schema.columns` on the live table) — this project has
  independently reinvented the same concept 2-3 times in different tables more than once
  (`worker_day_slots` / `worker_shift_schedule` / `supervisor_daily_routes` all modeling worker
  routing independently is the clearest example).
- **Never guess a live-only table's schema.** If it has no migration file, query
  `information_schema.columns` / `pg_constraint` before writing code against it.

`CLAUDE.md` (repo root) is the single most important file in this project for a new developer —
read it in full before touching code. It's a running log of every session's findings, fixes,
and open items, kept intentionally verbose and current. `SESSIONS.md` is its older, longer-form
predecessor. `docs/ORIGINAL_SPEC_AUDIT.md` and `docs/ENTITY_RELATIONSHIP_FREEZE.md` are the
evidence catalogues behind the freeze methodology. `docs/SUPERVISOR_INFEED_ACT_OUTPUT.md` and
`docs/SITE_VISIT_REBUILD_SPEC.md` are deep-dive specs for the Supervisor role and the two
distinct site-visit forms (Site Survey vs. Daily Execution Visit) respectively.

---

## 9. Quick reference: test logins (working as of this writing)

| Role | Login |
|---|---|
| Admin | `admin@proengineering.in` |
| Coordinator | `coordinator@proengineering.in` |
| Sub-Coordinator | `subcoordinator@proengineering.in` (currently returns "invalid credentials" — open, untriaged issue, see CLAUDE.md) |
| Site Incharge | `siteincharge62@proengineering.in` |
| Supervisor | `supervisor62@proengineering.in` |

Passwords are in `.env.local`/the team's credential store, not in this repo. Worker and Client
logins are self-service dev accounts as described in §6 — register one via `/onboarding/[trade]`
or `/book` respectively rather than asking for a shared credential.

---

## 10. Where to go next

1. Read `CLAUDE.md` top to bottom.
2. Read `docs/SCHEMA_FREEZE_METHODOLOGY.md`.
3. Pick a role's folder under `app/` and read every file in it before changing anything in it —
   that's this project's own standing rule, and the codebase is small enough per-role that it's
   genuinely feasible.
4. Before writing to any table with no migration file, check its live schema — don't guess.
5. Run `npx tsc --noEmit` after every change, no exceptions.
