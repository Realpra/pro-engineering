# SCHEMA FREEZE METHODOLOGY — FINAL (agreed 26 Sep 2026, Session 64)

Supersedes the pure R1-R29 relationship-by-relationship review as the mechanism for
deciding and locking down schema/relationships. `docs/ENTITY_RELATIONSHIP_FREEZE.md`'s
29 items remain valid as an evidence catalogue (what's wrong, where), but the project
owner correctly rejected item-by-item paper review as "too casual" for a project this
entangled — deciding one relationship in isolation loses the process context it lives
inside, and several of the worst confirmed bugs (`contingency_policy`'s column split,
`workers.current_job_id`'s dual meaning) can only be correctly decided by seeing the
whole process they sit inside, not by reading one relationship line at a time.

This document is the methodology that replaces it, arrived at by the project owner
directly challenging and correcting three specific weaknesses in an initial
Expand-Contract proposal. It is the process to run from here on for every schema/
relationship decision, until the project is live.

## THE CORE PROCESS (project owner's design)

1. **Take up one process at a time.** Use the process groupings already mapped in
   `MASTER_FLOW_STRINGS.xlsx` (Job Lifecycle, Client Interaction, Payment Flow, Worker
   Onboarding, Worker Allotment & Skill, Job Schedule/Routes, Substages & Milestones,
   Supervisor Visit, Superadmin Flow, Admin Flow, Coordinator Flow, Sub-Coordinator
   Flow, Site Incharge Flow, Estimator) — do not invent new groupings without reason.
2. **Expand only what that process touches, only when it's taken up.** No up-front,
   whole-database expand. If the process needs a field that doesn't exist yet or isn't
   frozen yet, create it fresh at that point — small, scoped, reviewable.
3. **Run the process live and observe it.** A live run is the validation signal, not
   a paper review of an abstract relationship table.
4. **Where two things already exist for one concept and disagree:** document both
   sides' actual real use (in process, code, and data) before deciding anything. If
   they serve genuinely different concepts, freeze both, separately, each for its own
   use. If they serve the same concept, keep one and do not let the other pass into
   the frozen contract.
5. **Agree the run is correct → freeze.** The code path is fixed. The fields it used
   get their final place in the DB structure. Frozen means stable and correct for what
   it was validated against.
6. **Move to the next process.** Reuse whatever's already frozen from prior processes
   for any shared field/concept — do not re-decide it. For whatever in this new
   process is still unfrozen, apply step 4's rule again.
7. **Continue process by process until everything is frozen.** Never unfreeze
   something already frozen. If a later process needs something a frozen field
   doesn't provide, add a new field alongside it — the frozen one stays untouched.

## THE THREE AMENDMENTS (added after the project owner's challenge exposed real gaps)

### Amendment 1 — fix the tie-break in step 4
"Same concept, keep one" is decided by **which one the live consuming code actually
reads and depends on today**, verified by tracing every reader end to end — never by
which one was created first chronologically.

*Why this was necessary, proven by this project's own data:* `contingency_policy`'s
`contingency_pct`/`max_deviation_pct` (Admin's edit path) were created FIRST. A later
revision renamed the concept to `max_contingency_pct`/`admin_approval_limit_pct` and
updated `getPolicyRate` (the only reader) to match — but `app/admin/policy/actions.ts`
was never updated to follow the rename. "First created wins" would freeze the dead,
unread columns and discard the ones actually driving live BOQ generation today. Only
"which one does the running system actually depend on" gives the right answer here.

### Amendment 2 — a data-integrity check before any field is truly frozen
After the column/field decision is made in step 4-5, query the EXISTING live rows for
that field: does the canonical column actually hold valid data on every row, or are
some rows null/stale because only the deprecated side was ever populated for them
historically. A field is not frozen until this is confirmed — not just the name
decision. (Structural correctness and data correctness are two different checks; a
correct column-name decision can still sit on top of silently incomplete historical data.)

### Amendment 3 — split "new field needed" from "prior freeze was wrong" at step 7
When a later process's live run produces a finding that touches an already-frozen
field, it must be explicitly classified as one of exactly two things before acting:
- **Addition** — a genuinely new need. Add a fresh field alongside it. The frozen
  process stays untouched. Proceed as in step 7.
- **Contradiction** — the finding disproves something the earlier freeze assumed was
  correct. That earlier process must be explicitly reopened, fixed, and re-frozen. It
  may NEVER be quietly relabeled as an "addition" just to avoid reopening it.

Without this explicit split, the easy answer ("just add a fresh field") will always
be chosen under time pressure even when the correct answer is "the earlier freeze was
actually wrong" — silently letting an incorrect frozen process survive permanently
under the appearance of a clean, additive history.

## EXECUTION CHECKLIST — HOW TO ACTUALLY RUN EACH AMENDMENT (added 26 Sep 2026)

The three amendments above state what must be true. This section is the concrete
procedure for making it true, step by step, so a session actually running the
methodology has something operational to follow rather than re-deriving it each time.

### Amendment 1 — functional-canonical tie-break, procedure
1. When a conflict surfaces (two fields/columns for one concept), list every
   candidate column. (Worked example: `contingency_pct`/`max_deviation_pct` vs
   `max_contingency_pct`/`admin_approval_limit_pct`.)
2. For each candidate, grep the entire codebase for every place it is READ — not
   just written. Every `.select`, destructure, or reference.
3. Trace each read site forward: does it feed a live, reachable decision (e.g.
   `getPolicyRate`, used in BOQ generation), or is it only read by orphaned/
   unrendered code? Cross-check against the orphaned-code findings already recorded
   (MASTER_FLOW_STRINGS.xlsx, CLAUDE.md) so an orphaned reader is never mistaken for
   the live one.
4. Whichever candidate is read by live, reachable logic is canonical. Record the
   decision with file:line evidence in that process's freeze record.
5. The losing candidate is NOT deleted. Mark it deprecated in the record; leave it
   in the database.
6. Fix the code path that was writing to the deprecated column so it writes to the
   canonical one instead (this is the actual code change this amendment produces).

### Amendment 2 — data-integrity check, procedure
1. Once a column is declared canonical (via step 4 above, or even when there was no
   naming conflict at all), query the live table before calling the field frozen:
   how many existing rows have the canonical column NULL/stale while the
   deprecated column (or any other historical source) holds a real value.
2. If such rows exist, backfill them: `UPDATE ... SET canonical_col = deprecated_col
   WHERE canonical_col IS NULL AND deprecated_col IS NOT NULL` (adapt per field).
3. Re-run the query. It must return zero rows before the field counts as frozen.
4. Record the before/after row counts as evidence in the freeze record, alongside
   the Amendment 1 tie-break decision.
5. Run this for every field in the process being frozen, not only ones that had a
   naming conflict — a correctly-named field can still carry silent legacy gaps
   from before it existed.

### Amendment 3 — addition-vs-contradiction split, procedure
1. Whenever a later process's live run touches an already-frozen field, STOP before
   acting and classify the finding first.
2. The test: can the new need be met by adding a new field alongside, with every
   existing reader/writer of the frozen field behaving exactly as before? →
   **Addition**. Does meeting it require changing what the frozen field means, or
   reveal that Amendment 1's tie-break picked the wrong canonical source? →
   **Contradiction**.
3. If Addition: create the new field via the normal small, scoped "create fresh"
   step (per the core process's step 2). Note it in the record. The earlier
   process's freeze record is untouched.
4. If Contradiction: explicitly reopen that earlier process's freeze record, cite
   the new evidence, and re-run Amendment 1's tie-break and Amendment 2's
   integrity check for that field before re-freezing it. This step may never be
   shortcut into "just add a field" to avoid reopening something.
5. Log every contradiction as its own dated entry: which process found it, which
   earlier process it reopened, what changed. This is the audit trail that stops a
   field from silently drifting again without a record.

## TWO SUPPORTING CHECKS CARRIED OVER FROM THE DISCUSSION (apply within the core process, not as separate phases)

- **Coverage check before declaring a process's run sufficient.** Cross-reference the
  live run actually observed against the full branch map for that process (the
  exhaustive tracing already done for `MASTER_FLOW_STRINGS.xlsx`) to see which
  branches were NOT exercised. A branch that is orphaned code (never imported/
  rendered by any route — e.g. `app/admin/dashboard`'s 5 unrendered approval panels)
  will never be reached by any live run at all; finding this must force an explicit
  decision (wire it up and validate it, or explicitly discard it) — it can never be
  silently treated as "unexercised, therefore doesn't matter."
- **Search before creating "fresh."** Before adding any new field under step 2 or
  step 7's addition path, check whether an existing-but-not-yet-frozen field already
  serves that concept under a different name, using Amendment 1's same tracing
  discipline. This is exactly how `client_estimates`/`boq_generated` and the
  worker-routing triplication (`worker_day_slots`/`worker_shift_schedule`/
  `supervisor_daily_routes`) happened — each was created fresh without this check.

## STATUS

- Agreed methodology, 26 Sep 2026. No process has been run/frozen under it yet.
- `docs/ENTITY_RELATIONSHIP_FREEZE.md` (R1-R29) and `docs/ORIGINAL_SPEC_AUDIT.md`
  remain the evidence base to draw on when a process's freeze needs to know what's
  already been found wrong in the tables it touches.
- `MASTER_FLOW_STRINGS.xlsx` (delivered Session 63) is the process map to work
  through, one sheet/process at a time, per step 1 above.
- Recommended starting order (by risk, not yet confirmed by the project owner):
  1. Shared core entities pass first — `guest_enquiries` (Job), `workers`, `users` —
     since almost every other process reads or writes these.
  2. Payment Flow (highest financial risk: premium/rebate re-link, `contingency_policy`
     drift, the `milestone_payment_schedule` orphaned-panel chain).
  3. Substages & Milestones (the two disconnected "milestone submitted" records).
  4. Worker Onboarding + Worker Allotment together (they share
     `workers.approval_status` and cannot be split cleanly).
  5. Remaining processes by the project owner's priority.
