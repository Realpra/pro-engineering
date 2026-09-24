# Supervisor In-Feed / Act / Output — Corrected Audit Summary

Source: full read of all three original design-conversation logs (Claude_Log_June26.docx,
Claude_Log_July_2026.docx, August_2026_Log.docx) plus a full read of all 32 files under
`app/supervisor/`. This is the permanent, git-tracked summary of the corrected pass — the
working file with the complete per-process WRITTEN / CODED / GAP breakdown (field-level,
with a "Fields Name Associated in Coding" column paired to each Act) was delivered directly
to the project owner as `SUPERVISOR_INFEED_ACT_OUTPUT_v2.xlsx` (19 processes, 59 rows) and is
not committed here — this doc is what persists.

## The correction that drove this rebuild

An earlier pass wrote Supervisor's first process as "Job Offer Accept/Decline within a
30-minute countdown." The project owner correctly rejected this as wrong and pointed to the
real process instead. Root cause, confirmed this session by reading the raw log text:

- The June log's **WA-2** screen (Worker App, not Supervisor App) specifies exactly this:
  "New job offer as a full-screen card with ACCEPT / DECLINE buttons and a 30-minute
  countdown... Decline reason required... No response in 60 minutes: job reassigned" — this
  is what the earlier pass mistakenly attributed to Supervisor.
- Supervisor's own early-spec **SA-2 Job Pipeline** (line 10465-10468) does independently
  describe a near-identical accept/decline gate for Supervisor. This is a genuine artifact of
  the original design conversation, not fabricated — but it was superseded later in the same
  conversation by **SA-ROUTE** (the Predictive Daily Route Sheet: reads from
  `supervisor_schedule`/`ltf_feeds`/`site_visit_reports`, shows fixed obligations then overdue
  visits then LTF-driven visits then free slots, with a "Confirm Day Plan" lock button), and
  it was never built for Supervisor in live code — confirmed by a full read of every
  Supervisor file: no accept/decline UI exists anywhere.
- The real, live, project-owner-confirmed Act 1 is: **Supervisor visits the site as per the
  slot in the day fixed by Admin/Coordinator** (`supervisor_daily_routes`, rendered on
  `app/supervisor/dashboard/page.tsx` and `app/supervisor/route/plan/page.tsx`), followed by
  physical inspection across the Flow (i)/(ii) site-visit screens — not an offer-acceptance
  gate.

Both the superseded SA-2 text and the corrected SA-ROUTE-based process are kept as separate
rows in the delivered workbook, per the standing instruction to preserve curtailed/superseded
spec versions rather than silently drop them.

## Supervisor App's 9 canonical modules (per the June log, verified against live code)

The June log states the final recommended feature set as **"Supervisor App — 9 modules: Job
Dashboard, Site Visit App (19 screens), Daily Site Log, Milestone Gate Submission, Crew
Management, Quality Gate Log, Scope Change Request, Earnings, SOS & Safety"** (also itemised
screen-by-screen as SA-1 through SA-14, plus SA-ROUTE added later). Status of each against the
live repo:

| Module | Spec ref | Live status |
|---|---|---|
| Job Dashboard | SA-1 | Built — `app/supervisor/dashboard` |
| Site Visit App (19 screens) | SA-3, SA-4 to SA-22 | Built, but split into two flows (20 + 21 screens) that don't match the original 19, with several screen-title/storage-column mismatches still open (PENDING #8) |
| Daily Site Log | SA-5 | Built — `app/supervisor/daily-log` (morning/evening/LTF), but no 09:30/19:00 deadline enforcement or coordinator-alert exists |
| Milestone Gate Submission | SA-6 | Built, but as **two disconnected paths** — see PENDING #27 |
| Crew Management | SA-11 | **Not built as its own screen.** Only exists folded into Daily Log attendance and Milestone Tracker's worker-assignment panel — and inverts the spec's core rule (see PENDING #28) |
| Quality Gate Log | SA-7, SA-8 | **Not built as specified.** Collapses into one generic "Test Results" screen with no hold-timer/blocking logic (PENDING #29) |
| Scope Change Request | SA-10 | Built — `app/supervisor/extra-works`, but the ₹5,000/2-day auto-escalation threshold and 50-character minimum are not enforced |
| Earnings | SA-14 | **Not built at all.** No route anywhere under `app/supervisor/` |
| SOS & Safety | nav-bar spec | **Not built at all.** No SOS button anywhere; combined with the dead `/supervisor/reports/new` route, Supervisor has no working safety-escalation path of any kind |

Also confirmed NOT built: **SA-13 Client Handover Sign-Off** (12-point checklist + digital
signature, gates Milestone 6) — no trace anywhere in live code.

## Live-only additions (not in the original 9-module spec)

Approvals, Inspections, Estimate Preparation, Scope Verification, Certificate, Reports &
Proposals, Directives, and the separate Milestone Evidence route
(`/supervisor/milestone/[bookingRef]`) all exist live with no corresponding SA-number. Of
these, **Approvals, Estimate Preparation, Scope Verification, Reports & Proposals, Directives'
Acknowledge button, and Route Plan's manual slot-add** are confirmed fully or partially dead —
real data is fetched and displayed, but the primary action button on each has no `onClick`
handler and no backing `actions.ts` exists. See CLAUDE.md PENDING #25-26 for the full list with
exact file references.

## Full detail

The delivered workbook (`SUPERVISOR_INFEED_ACT_OUTPUT_v2.xlsx`) has the complete field-level
breakdown for all 19 processes: exact `useState`/interface field names per screen, exact
`site_visit_reports`/`job_milestone_substages`/`daily_site_logs`/etc. column names written by
each action, and a paired "Fields Name Associated in Coding" column next to every Act, per the
project owner's corrected format requirement.
