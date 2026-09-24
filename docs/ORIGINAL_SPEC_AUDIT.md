# Original Spec Audit — 48 Entities from the Founding Design Conversation

Source: three chat logs the project owner uploaded (Claude_Log_June26.docx,
Claude_Log_July_2026.docx, August_2026_Log.docx) — the actual original design
conversation for this platform, not inferred from code. Extracted by pulling every
`CREATE TABLE` statement out of the June log (the project-inception conversation)
and cross-checking each one against the live repo (`supabase/migrations/*.sql` and
every `app/**/*.ts(x)` file) for what is actually built today.

Full detail (per-entity purpose, exact field lists, live-vs-spec diff, and a
recommendation) is in three Excel workbooks delivered directly to the project
owner (not committed here — they are working review documents with a blank
Decision column for the owner to mark up):
1. `1_Entity_Relationship_Model.xlsx` — 51 rows (48 entities + 3 curtailment rows)
2. `2_Canonical_Field_List.xlsx` — 685 rows, one per field
3. `3_Live_Schema_Mapping.xlsx` — same 51 rows, classified by build status

This file is the permanent, git-tracked summary so the finding survives beyond
those working files.

## Classification of all 48 originally-specified entities (verified against live repo)

**BUILT (real migration file exists) — 23:**
assessment_slots, assessment_bookings, policy_change_log, guest_enquiries,
worker_competency, trainers, site_visit_reports, supervisor_schedule, geo_hierarchy,
rate_card, calculation_rules_engine, boq_sku_catalogue, boq_generated,
milestone_payment_schedule, estimate_client_responses, platform_premium_policy,
contingency_policy, premium_approval_requests, payment_confirmations,
daily_site_logs (+ `estimates`, built under the name `client_estimates` — see
duplication finding below).

**LIVE-ONLY (used in real code, but NO migration file — undocumented drift) — 10:**
job_type_config, sector_config, concern_audit_log, supervisor_daily_routes,
ltf_feeds, scope_change_requests, labour_rate_config, report_reviews,
report_submissions, client_wastage_log.

**NOT BUILT AT ALL (confirmed by repo-wide grep — zero migration, zero code
reference anywhere in `app/` or `lib/`) — 17:**
job_status_labels, assessment_gate_config, milestone_templates,
compliance_field_config, empanelled_firms, labour_contractors,
contractor_compliance_log, compliance_records, professional_indemnity,
worker_concerns, qip_templates, qip_template_checks, field_validation_reports,
qip_check_results, rate_surcharge, daily_labour_utilisation, material_catalogue.

These were fully specified with complete field lists in the original design and
simply never implemented — not a guess, a repo-wide search result. Each one needs
a deliberate owner decision: build it (it was designed for a real reason — check
the business context it came from) or formally retire it from the spec.

## Real findings from this pass (not inferred, checked)

1. **Two live estimate tables doing overlapping jobs.** The spec's `estimates`
   table was built — under the name `client_estimates`
   (`supabase/migrations/20260628_estimate_console.sql`), and is a near
   field-for-field match to the original spec (booking_ref, report_id, version,
   status, line_items, contingency_pct/amount, discount_pct/amount, total_amount,
   created_by, sent_to_client_at). But `boq_generated` also exists, live, doing
   the same conceptual job. This is the same "specified once, built twice under
   different names" pattern already found in worker-routing (Session 59:
   `worker_day_slots` / `worker_shift_schedule` / `supervisor_daily_routes`).

2. **Genuine curtailment — 3 confirmed cases** (not the ~7 an automated field-count
   diff first suggested; 2 of those 7 turned out to be docx-export artifacts —
   a truncated paste and a collapsed "N lines hidden" code block — not real
   content, and were excluded rather than reported as false findings):
   - `assessment_slots`: an earlier 10-field version had per-slot capacity
     tracking (`max_candidates`/`booked_count`), a `module_code` link, and a
     `status` field. The final 5-field version dropped all of it.
   - `assessment_bookings`: an earlier 9-field version captured the actual
     **assessment result** (`result`, `result_notes`, `assessor_photos_json`,
     `result_entered_at`). The final 5-field version doesn't record outcomes at
     all — a worker can be booked into an assessment slot but nothing live
     records whether they passed.
   - `policy_change_log`: not simple shrinkage — two genuinely different
     competing designs for the same audit-log concept (one generic
     table+id+field-diff; one policy-type-keyed with full JSONB snapshots and a
     mandatory Super Admin approval gate). Live schema
     (`table_name, record_id, changed_by, old_value, new_value, change_reason`)
     matches neither exactly.

3. **`site_visit_reports` confirms the two-flow conflation with hard historical
   evidence.** The original spec had 18 clean screen columns, one row per
   (supervisor, booking). Live has 40+, across the union of at least two more
   implementations added later — direct confirmation of the Session 55/58
   finding, now with the original clean baseline to rebuild from if the
   Flow (i)/(ii) split (already agreed) uses this as its reference shape.

4. **`boq_sku_catalogue.client_description` and `estimator_remarks`** are
   live-only additions with no trace in the original spec — real data
   (Session 58 already flagged `client_description` as unused downstream,
   PENDING #10).

## New PENDING items from this audit

See CLAUDE.md PENDING #21 (decide on the 17 not-built entities, table by table)
and #22 (resolve the `client_estimates`/`boq_generated` duplication).
