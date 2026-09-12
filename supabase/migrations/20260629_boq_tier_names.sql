-- =============================================================================
-- Update BOQ tier naming: standard → budget, add luxury tier
-- Update job card types to include 'L'
-- =============================================================================

-- Rename all 'standard' SKU tier entries to 'budget', add 'luxury'
UPDATE boq_sku_catalogue
SET applicable_tiers = ARRAY['budget', 'premium', 'luxury']
WHERE is_active = true;

-- Add 'L' to applicable_job_types on all active SKUs
UPDATE boq_sku_catalogue
SET applicable_job_types = array_append(applicable_job_types, 'L')
WHERE is_active = true
  AND NOT ('L' = ANY(applicable_job_types));

-- Rename 'standard' milestone templates to 'budget'
UPDATE milestone_payment_templates SET tier = 'budget' WHERE tier = 'standard';

-- Add luxury tier milestone templates (7 milestones, sum = 100%)
INSERT INTO milestone_payment_templates
  (tier, job_card_type, milestone_name, sequence_order, payment_pct, trigger_event)
VALUES
  ('luxury', 'general', 'Advance / Mobilisation',   1, 10.00, 'booking_confirmed'),
  ('luxury', 'general', 'Demolition Complete',       2, 15.00, 'demolition_complete'),
  ('luxury', 'general', 'Rough-ins Complete',        3, 15.00, 'rough_ins_complete'),
  ('luxury', 'general', 'First Fix Complete',        4, 15.00, 'first_fix_complete'),
  ('luxury', 'general', 'Tiling Complete',           5, 20.00, 'tiling_complete'),
  ('luxury', 'general', 'Finishing & Handover',      6, 15.00, 'handover'),
  ('luxury', 'general', 'Snagging & Final Sign-off', 7, 10.00, 'snag_complete');
