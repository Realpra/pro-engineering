# Phase I · Package 1 — Milestones, payment decisions and quality tests

Status: **proposal for the owner's agreement — nothing built yet.** Written 30 Oct 2026 (Session 72).

Sources, in order of authority:
1. Owner's replies of 30 Oct 2026 (CLAUDE.md Owner Decisions Register D13, D14).
2. `docs/original/Supervisor_Visit_REBUILT_v3_27Sep26.xlsx` (owner's 27 Sep decisions).
3. `docs/original/2026-07-04_Milestone_stage_instructions.docx` (owner's 4 Jul edits).
4. July milestone design (Layers 1–7) and `docs/original/2026-06-20_1229_Final_blueprint_platform_model_v3.docx`.

Rule for every item: reuse an existing field where the concept already exists; add a new table only
for a genuinely new concept; nothing existing is deleted (old paths are deprecated in place).

---

## 1. What already exists (checked in code, 30 Oct 2026)

| Concept | Where it lives today | Note |
|---|---|---|
| Stage template library | `milestone_stage_templates` (Admin CRUD at `/admin/milestones`) | live-only table, no migration file |
| Sub-stage templates | `milestone_substage_templates` (read only) | live-only, no ordering column |
| Per-job sub-stages | `job_milestone_substages` (27 bathroom sub-stages from `generateSubstagesFromBOQ`) | already has role checklists (`subcoordinator_checklist`, `coordinator_checklist`), CPM fields |
| Per-job stage (payment) | `milestone_payment_schedule` (%, amount, status, Decision 5 fields) | **this is the "job_milestone_stages" concept of the July design** — not duplicated |
| Supervisor's payment proposal | Daily visit Screen 18 (Decisions 1–5, partial/hold reasons) | saved inside the visit report only; only Decision 5 reaches a table |
| Quality tests | Daily visit Screen 11, three plain number fields | no test bank, no record per test |
| Second milestone path | `/supervisor/milestone/[bookingRef]` writes stage status directly | 27 Sep decision: one path only |
| Sub-stage proposal | `/supervisor/milestone-tracker/propose` | dead link, no table |

## 2. What gets built

### 2.1 Stage and sub-stage structure (4 Jul edits)
- Stage count, names and default % come from `milestone_stage_templates` per job type — **never
  hard-coded**. Default bathroom set: M0 20%, M1 25%, M2 20%, M3 25%, M4 10% (Super Admin may change).
- Coordinator fixes the stages for a job and may send them to Admin for approval; Coordinator or
  Admin may add stages. Sub-stages: 2–3 per stage by default, Admin may increase.
- Per stage, the estimate carries (new columns on `milestone_payment_schedule`, names checked against
  the live table first):
  - billing split by service type: `labour_amount`, `material_amount` (turnkey = both);
  - work done up to the milestone (text) and the day/time it is reached.
- Per sub-stage (`job_milestone_substages`): skilled and unskilled count per day **down to hours and
  time slot** (reuse `planned_hours` / `start_time_slot` if live, else add).

### 2.2 Milestone reporting form (4 Jul)
- One form per stage, listing its sub-stages as items. For each item the reporter taps:
  **Done / Quality OK / Rework needed / Rectification needed**, with photo and (optional) video.
- This becomes the **single milestone path** (27 Sep). `/supervisor/milestone/[bookingRef]` is kept
  but deprecated; it will open the same form.
- Incomplete items are recorded and stay on the pending list (27 Sep: never silently passed).

### 2.3 Payment decisions 1–5 (July Layers 5–6, 4 Jul edit)
New table **`milestone_payment_decisions`** — one row per decision:
- links: `booking_ref`, `milestone_payment_schedule_id`, optional `substage_id`
- `decision_type` 1–5 (Full release / Partial – rectification / Partial – redo / Hold – material loss / Reject)
- `proposed_release_pct` + `proposed_by` / `proposed_at` (supervisor, from the reporting form or Screen 18)
- `decided_release_pct`, `release_amount`, `held_amount` + `decided_by` / `decided_at` (Coordinator)
- `rectification_items`, `redo_items`, `affected_substage_ids`, `revised_timeline_days`
- `material_loss_amount`, `responsible_party_type` / `responsible_party_id`, `earlier_payment_adjustment`
- `reason`, `remedy`, `status`
- Calculation: value = stage % × contract value (÷ number of sub-stages when decided per sub-stage).
  D1 100%; D2/D3 Coordinator's %; D4 0% + material-loss deduction; D5 0%, reset, Admin notified.
- Existing `decision_5_*` columns stay; `raiseDecision5` also writes a decision row (Addition).
- Approvals above Coordinator's limit (Admin ₹1L–5L, Super Admin above ₹5L) and Finance payment
  are **Package 2**; this package records the decision and holds it for that chain.

### 2.4 Retention pool (July Layer 6)
New table **`retention_pool`**: `booking_ref`, `decision_id`, `held_amount`,
`release_condition_substage_id`, `released_amount`, `released_at`, `released_by`, `status`.
Held money is released when the linked rectification is approved.

### 2.5 Sub-stage proposals (July Layer 4)
New table **`substage_proposals`**: proposer (Supervisor / Sub-Coordinator), proposed name,
description, checklist, duration, `current_approver_role`, approval trail, status.
Route: Supervisor → Sub-Coordinator → Coordinator (→ Admin → Super Admin if undecided).
Never blocks work. On approval a `job_milestone_substages` row is added.
The dead `/propose` link becomes this screen.

### 2.6 Admin-editable quality tests (D13)
New tables:
- **`quality_test_templates`**: test name, sector/vertical, job type, linked stage or sub-stage,
  hold time (hours), active flag.
- **`quality_test_questions`**: step order, question text, answer type (yes/no, options, number +
  unit, photo, timer start/end), options list, required flag.
- **`quality_test_runs`**: booking, test, who, start / end timestamps, answers (per question),
  photos, result (pass / fail), fail location note.
- Admin screen `/admin/quality-tests` (same pattern as `/admin/trade-questions`): add, edit,
  reorder, activate, add new tests.
- Supervisor: Screen 11 shows the tests linked to this job's current stage, step by step.
- **No hard block** (27 Sep). A fail raises a risk flag and notifies Coordinator.

### 2.7 Screens touched
- `/admin/milestones` (stage templates: add sub-stage templates and billing split)
- `/admin/estimate/[bookingRef]` Milestone Plan tab (per-stage billing split, hours/time slot)
- Supervisor milestone tracker + new reporting form; Screen 11 and Screen 18 of the daily visit
- `/admin/payments` and Coordinator: decision queue with release %, retention pool view
- `/admin/quality-tests` (new)
- Client dashboard: milestone shows paid / held amount (outcome only, per client-visibility rule)

## 3. Order of work
1. Read the live columns of `milestone_stage_templates`, `milestone_substage_templates`,
   `job_milestone_substages`, `milestone_payment_schedule` (needs network access, or the owner runs
   one query I provide).
2. One migration for 2.1–2.6, tested twice on a local Postgres copy, then given to the owner to run.
3. Code in the order 2.6 → 2.2 → 2.3/2.4 → 2.5 → 2.1 screens, `npx tsc --noEmit` clean each step.
4. Local click-through checklist for the owner. Push only after asking.

## 4. Questions for the owner (answers needed before building)
1. **Decision level**: is the payment decision taken per **stage** (your 4 Jul edit changed the
   heading to "stage level") or per **sub-stage** (July design)? Proposed: per stage, with sub-stages
   as the items on the reporting form.
2. **Number of bathroom stages**: 5 (M0–M4, July) or 6 (27 Sep note "build the full 6")? Proposed:
   keep the count in the template so either works; bathroom stays 5 unless you say 6.
3. **Seed data**: may I enter the ponding test and the pressure test, step by step from your 20 Jun
   blueprint, as the first two Admin-editable tests? (No other data will be invented.)
