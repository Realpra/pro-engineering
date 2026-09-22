-- =============================================================================
-- FIELD NAMING AUDIT v2 — fixes the "join explosion" in the old
-- "Supabase Snippet Untitled query (9)" style audits.
--
-- ROOT CAUSE OF THE OLD BUG:
--   The old query built one DISTINCT list of field names per role, then
--   joined those lists together (directly or via a shared LIKE '%amount%'
--   bucket). Any role with N unrelated fields in the same bucket produced
--   N x M x K... duplicate rows when joined against other roles' buckets —
--   e.g. one real admin/coordinator pairing exploded into 95 rows because
--   it was cross-joined against every CLIENT *_amount and WORKER *_amount
--   field that also matched "numeric" type / "%amount%" name.
--
-- FIX IN THIS VERSION:
--   1. role_tables below is a CODE-DERIVED map (grepped from `.from('table')`
--      calls under each app/<role>/ directory on 2026-09-22) — not a guess,
--      not a fuzzy name match.
--   2. columns_by_role flattens (role, table, column, type) with DISTINCT —
--      no join between roles happens here, so there is nothing to explode.
--   3. type_mismatches groups by EXACT column_name only (no LIKE) to find
--      real, confirmed cross-role type mismatches — safe to act on directly.
--   4. candidates groups by a normalized "root" to surface same-concept-
--      different-name LEADS ONLY — not confirmed mismatches. Verify against
--      actual code (does one value get copied into the other column
--      anywhere?) before renaming. See app/client/payment/actions.ts for how
--      that was done for payment_confirmations.amount vs
--      milestone_payment_schedule.payment_amount.
--
-- This whole file is ONE statement (no semicolons, one result set) so it
-- can't be accidentally split or run partially by a SQL editor's
-- "run statement under cursor" shortcut — select the whole file and run it.
--
-- Finance role has no pages built yet (per CLAUDE.md ROLES BUILT), so it
-- has no code-derived table list. If finance tables exist in the live DB,
-- add them to role_tables manually before running.
-- =============================================================================

WITH role_tables (role, table_name) AS (
  VALUES
    -- admin
    ('admin','assessment_bookings'), ('admin','assessment_slots'), ('admin','boq_generated'),
    ('admin','boq_sku_catalogue'), ('admin','business_rules_config'), ('admin','calculation_rules_engine'),
    ('admin','client_wastage_log'), ('admin','compliance_config'), ('admin','concern_audit_log'),
    ('admin','contingency_policy'), ('admin','daily_site_logs'), ('admin','estimate_client_responses'),
    ('admin','estimates'), ('admin','geo_hierarchy'), ('admin','guest_enquiries'),
    ('admin','job_milestone_substages'), ('admin','job_type_config'), ('admin','labour_rate_config'),
    ('admin','milestone_payment_schedule'), ('admin','milestone_stage_templates'),
    ('admin','milestone_substage_templates'), ('admin','payment_policy'), ('admin','pi_tracker'),
    ('admin','platform_premium_policy'), ('admin','policy_change_log'), ('admin','pre_delivery_assessment'),
    ('admin','premium_approval_requests'), ('admin','rate_card'), ('admin','regions'),
    ('admin','report_reviews'), ('admin','report_submissions'), ('admin','scope_change_requests'),
    ('admin','site_instructions'), ('admin','site_visit_reports'), ('admin','trade_config'),
    ('admin','trainers'), ('admin','users'), ('admin','worker_competency'),
    ('admin','worker_zone_assignments'), ('admin','workers'), ('admin','zone_proposals'),

    -- super_admin
    ('super_admin','boq_generated'), ('super_admin','boq_sku_catalogue'), ('super_admin','contingency_policy'),
    ('super_admin','geo_hierarchy'), ('super_admin','guest_enquiries'), ('super_admin','milestone_stage_templates'),
    ('super_admin','platform_premium_policy'), ('super_admin','policy_change_log'),
    ('super_admin','premium_approval_requests'), ('super_admin','substage_checklist_templates'),
    ('super_admin','users'), ('super_admin','workers'),

    -- coordinator
    ('coordinator','boq_generated'), ('coordinator','estimate_client_responses'), ('coordinator','geo_hierarchy'),
    ('coordinator','guest_enquiries'), ('coordinator','job_milestone_substages'), ('coordinator','site_instructions'),
    ('coordinator','supervisor_daily_routes'), ('coordinator','users'), ('coordinator','worker_zone_assignments'),
    ('coordinator','workers'),

    -- sub_coordinator
    ('sub_coordinator','guest_enquiries'), ('sub_coordinator','job_milestone_substages'),
    ('sub_coordinator','ltf_feeds'), ('sub_coordinator','site_instructions'),
    ('sub_coordinator','supervisor_daily_routes'), ('sub_coordinator','users'),
    ('sub_coordinator','worker_shift_schedule'), ('sub_coordinator','workers'),

    -- supervisor
    ('supervisor','daily_site_logs'), ('supervisor','geo_hierarchy'), ('supervisor','guest_enquiries'),
    ('supervisor','job_milestone_substages'), ('supervisor','labour_rate_config'),
    ('supervisor','milestone_payment_schedule'), ('supervisor','pre_delivery_assessment'),
    ('supervisor','scope_change_requests'), ('supervisor','scope_snag_items'), ('supervisor','site_instructions'),
    ('supervisor','site_visit_reports'), ('supervisor','supervisor_daily_routes'), ('supervisor','trade_config'),
    ('supervisor','users'), ('supervisor','worker_day_slots'), ('supervisor','workers'),

    -- site_incharge
    ('site_incharge','guest_enquiries'), ('site_incharge','job_milestone_substages'),
    ('site_incharge','milestone_payment_schedule'), ('site_incharge','site_instructions'),
    ('site_incharge','substage_checklist_templates'), ('site_incharge','users'),
    ('site_incharge','worker_shift_schedule'), ('site_incharge','workers'),

    -- client
    ('client','boq_generated'), ('client','estimate_client_responses'), ('client','guest_enquiries'),
    ('client','job_milestone_substages'), ('client','milestone_payment_schedule'),
    ('client','payment_confirmations'), ('client','scope_change_requests'), ('client','users'),
    ('client','workers'),

    -- worker
    ('worker','users'), ('worker','workers')
),
columns_by_role AS (
  SELECT DISTINCT
    rt.role,
    c.table_name,
    c.column_name,
    c.data_type
  FROM role_tables rt
  JOIN information_schema.columns c
    ON c.table_name = rt.table_name
   AND c.table_schema = 'public'
),
type_mismatches AS (
  SELECT
    'TYPE_MISMATCH' AS finding_type,
    column_name AS key,
    array_agg(DISTINCT role || ':' || table_name || '[' || data_type || ']'
              ORDER BY role || ':' || table_name || '[' || data_type || ']') AS detail
  FROM columns_by_role
  GROUP BY column_name
  HAVING COUNT(DISTINCT data_type) > 1
),
normalized AS (
  SELECT
    *,
    regexp_replace(column_name, '^(admin_|coordinator_|sub_coordinator_|supervisor_|site_incharge_|client_|worker_|actual_|total_|net_|gross_)', '', 'g') AS root
  FROM columns_by_role
),
candidates AS (
  SELECT
    'CANDIDATE_ROOT_MATCH' AS finding_type,
    root AS key,
    array_agg(DISTINCT column_name || ' (' || role || '.' || table_name || ':' || data_type || ')'
              ORDER BY column_name || ' (' || role || '.' || table_name || ':' || data_type || ')') AS detail
  FROM normalized
  GROUP BY root
  HAVING COUNT(DISTINCT column_name) > 1
)
SELECT finding_type, key, detail FROM type_mismatches
UNION ALL
SELECT finding_type, key, detail FROM candidates
ORDER BY finding_type, key;
