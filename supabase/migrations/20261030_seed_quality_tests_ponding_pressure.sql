-- 30 Oct 2026 (Session 72) — first two Admin-editable quality tests.
--
-- Owner's consent (30 Oct 2026): Admin can edit existing, add or delete. Content is taken
-- step by step from the owner's Final Blueprint (docs/original/
-- 2026-06-20_1229_Final_blueprint_platform_model_v3.docx, SA-7 Ponding Test and SA-8 Plumbing
-- Pressure Test). Nothing invented. Per the owner's 27 Sep decision, a FAIL does not hard-block
-- the job; it raises a risk flag and notifies Coordinator.
--
-- Needs 20261030_admin_structure_quality_tests.sql first. Safe to run more than once (skips a
-- test whose template_code already exists).

DO $$
DECLARE
  t_id UUID;
BEGIN
  -- SA-7 Ponding Test (bathroom, M2 Mid Works — Waterproofing & Screed)
  IF NOT EXISTS (SELECT 1 FROM qip_templates WHERE template_code = 'TST-PONDING-01') THEN
    INSERT INTO qip_templates (job_type, vertical, milestone_number, milestone_code, template_name,
                               template_code, version, description, hold_hours, is_active)
    VALUES ('bathroom-renovation', 'civil-engineering', 3, 'M2', 'Ponding Test', 'TST-PONDING-01', 'v1',
            'Waterproofing ponding test. Tiling should begin only after PASS.', 24, true)
    RETURNING id INTO t_id;

    INSERT INTO qip_template_checks (template_id, check_number, sequence_order, check_description,
                                     answer_type, options, minimum_standard, evidence_type, is_mandatory)
    VALUES
      (t_id, '1', 1, 'Have you confirmed the waterproofing is fully dry and ready for ponding test?',
       'options', '["Yes", "Not yet"]', NULL, NULL, true),
      (t_id, '2', 2, 'Is the entire floor area covered with water?',
       'options', '["Yes", "Partial — need more water"]', NULL, NULL, true),
      (t_id, '3', 3, 'Is the water depth adequate across the floor?',
       'options', '["Yes — at least 2.5 cm", "No — insufficient"]', 'At least 2.5 cm', NULL, true),
      (t_id, '4', 4, 'Take the ponding test start photograph now — show the water level clearly. The 24-hour timer starts.',
       'timer_start', '[]', 'Water visible on floor with depth marker', 'photograph', true),
      (t_id, '5', 5, 'Has 24 hours passed and the water absorbed or evaporated naturally?',
       'timer_end', '["Yes", "Not yet — I will return"]', 'Minimum 24 hours', NULL, true),
      (t_id, '6', 6, 'Check the floor below and adjacent walls. Is there any dampness or water seepage visible?',
       'options', '["No — Test PASS", "Yes — Test FAIL (describe location)"]', 'No dampness', NULL, true),
      (t_id, '7', 7, 'Take the pass photograph now — show the dry ceiling/floor below.',
       'photo', '[]', NULL, 'photograph', true);
  END IF;

  -- SA-8 Plumbing Pressure Test (bathroom, M1 First Fix — Civil & MEP Rough-in)
  IF NOT EXISTS (SELECT 1 FROM qip_templates WHERE template_code = 'TST-PRESSURE-01') THEN
    INSERT INTO qip_templates (job_type, vertical, milestone_number, milestone_code, template_name,
                               template_code, version, description, hold_hours, is_active)
    VALUES ('bathroom-renovation', 'civil-engineering', 2, 'M1', 'Plumbing Pressure Test', 'TST-PRESSURE-01', 'v1',
            'Plumbing pressure test. Wall-chase closure should begin only after PASS.', 3, true)
    RETURNING id INTO t_id;

    INSERT INTO qip_template_checks (template_id, check_number, sequence_order, check_description,
                                     answer_type, options, minimum_standard, evidence_type, is_mandatory)
    VALUES
      (t_id, '1', 1, 'Which pipe sections are you testing?',
       'options', '["Supply lines only", "Drain lines only", "Both supply and drain"]', NULL, NULL, true),
      (t_id, '2', 2, 'What test pressure have you applied?',
       'options', '["2 bar", "3 bar", "4 bar"]', 'Standard residential is 3 bar', NULL, true),
      (t_id, '3', 3, 'Take the pressure gauge photograph now showing the applied pressure. The 3-hour timer starts.',
       'timer_start', '[]', NULL, 'photograph', true),
      (t_id, '4', 4, 'Check the pressure gauge now. Is the reading within acceptable range?',
       'timer_end', '["Yes — within 5% of initial reading", "No — pressure has dropped significantly"]', 'Within 5% of initial reading', NULL, true),
      (t_id, '5', 5, 'Take the end-of-test pressure gauge photograph now.',
       'photo', '[]', NULL, 'photograph', true),
      (t_id, '6', 6, 'If FAIL: describe where the leak or failure was found.',
       'options', '["Supply side", "Drain side", "Specific location (describe)"]', NULL, NULL, false);
  END IF;
END $$;
