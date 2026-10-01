-- Section C Skill Questions for the 8 remaining trades, seeded verbatim from the project
-- owner's filled-in Worker_Onboarding_All_Trades_Field_Template (30 Sep 2026), per the
-- explicit decision "let us use what is given in table" -- the question bank is now
-- admin-editable (see the companion migration's RLS write policy), so these are a real
-- starting point, not a final/locked set; Carpenter/False Ceiling Installer/Helper's rows
-- are deliberately the template's own placeholder questions ("some are just for format"),
-- to be refined by Admin through the new editable screen, not guessed at here.
--
-- Mason's own 10 live questions (seeded by 20260926_worker_onboarding_full_spec.sql) are left
-- untouched -- Worker Onboarding is a frozen process and this migration makes no claim their
-- content needs to change, only extends the same mechanism to the other 8 trades.
--
-- display_order values are preserved exactly as given in the workbook (including gaps, e.g.
-- Plumber has no order=2, Electrician no order=3/10) -- not resequenced, since Admin can now
-- reorder freely through the editable UI. Trailing/internal whitespace in a few of the
-- workbook's own question_code values (e.g. "low_pressure ", "False_Ceil_Q1 ") is trimmed here
-- since question_code is a real lookup key (worker_skill_answers.question_code) -- the
-- question_text content itself is unchanged.

INSERT INTO trade_skill_questions (trade, question_code, question_text, display_order) VALUES
  ('Plumber', 'waterproofing_basement', 'have you ever done work of waterproofing a basement. (i) Yes (ii) No', 1),
  ('Plumber', 'low_pressure', 'what do you do if a client complains about low water pressure?. (i) check main shutoff valve (ii) check pipe damage (iii) check all joints (iv) all of these', 3),
  ('Plumber', 'max_distance', 'What is the maximum distance that a lavatory faucet for accessible use can be placed from the front edge of a lavatory? (i) 16 inch (ii) 18 inch (iii) 25 inch (iv) 28 inch', 4),
  ('Plumber', 'pipe_material', 'what do you prefer for water mains. (i)metal pipe (ii) PVC (iii) copper ( any of these', 5),
  ('Plumber', 'waste_vent', 'Which of the following types of fixtures can be served by a combination-waste-and-vent system? (i) Urinals (ii) Toilets (iii) Sinks (iv) Bidets', 6),
  ('Plumber', 'clogged_drain', 'What is the first step to clear a primary clogged drain? (i) Flushing with hot water (ii) use a mechanical hand auger/snake (iii) do nothing (iv) joint by joint', 7),
  ('Plumber', 'depth_trap', 'What is the minimum depth of a trap seal? (i) 1 inch (ii) 1.25 (iii) 1.5 inches (iv) 2 inches', 8),
  ('Plumber', 'certificate_award', 'Do you hold any plumbing license or certification or commendation ?', 9),
  ('Plumber', 'grade_liner', 'What is the typical amount of grade required per liner foot on a household drainage pipe? (i) 1/8 inch (ii) 1/4 inch (iii) 3/4 inch (iv) 1 inch', 10),
  ('Plumber', 'pipeline_start', 'If you had to install a new system for an entire floor of a building, where would you start? (i) main drain-waste-vent (ii) supply lines (iii) read drawings', 11),
  ('Plumber', 'test_gas', 'Which of the following mediums is not allowed for use in testing gas pipe installations? (i) Air (ii) Oxygen (iii) Nitrogen (iv) Carbon dioxide', 12),

  ('Electrician', 'ground_conductor', 'No grounded conductor shall be attached to any terminal or lead so as to _____ the designated polarity. (i) change (ii) reverse (iii) energize (iv) ground', 1),
  ('Electrician', 'ciling_fan', 'Ceiling-suspended (paddle) fans weighing more than _____ shall be supported independently of the outlet box. (i) 15 Kg (ii) 20 Kg (iii) 25 Kg ( 30 Kg)', 2),
  ('Electrician', 'ACB_use', 'What is the purpose of using an Air Circuit Breaker (ACB)? (i) protects electrical circuits from overloads (ii) stop electricity in a circuit ( iii) both', 4),
  ('Electrician', 'safety_breaker', 'What safety steps do you take before working on a live residential circuit? (i) de-energize the circuit at the main breaker panel (ii) voltage tester to verify zero voltage before touching any wires (iii) both', 5),
  ('Electrician', 'ac_dc', 'In houses you have ( i) AC curernt (ii) DC current', 6),
  ('Electrician', 'cert_govt', 'Do you have certificate of government for working as an electrician ? (i) Yes (ii) No', 7),
  ('Electrician', 'electric_task', 'What tasks have you performed mainly as an electrician (i) Installation (ii) maintenace & repair (iii) Troubleshooting (iv) all', 8),
  ('Electrician', 'battery_care', 'What are the steps to maintain a battery periodically? (i) Check leaks, bulging, or corrosion (ii) baking soda solution and wire brush (iii) coat of anti-corrosion grease (iv) all', 9),
  ('Electrician', 'wiring_type', 'Which do you have experience of doing (i) complete panel wiring (ii) power wiring (iii) None (iv) both', 11),
  ('Electrician', 'motor_start', 'If a motor does not start, what could be the problem in the (i) Starter: Battery/Power supply (ii) Starter solenoid/relay (iii) Starter motor mechanical fault (iv) any of these', 12),

  ('Waterproofer', 'seepage_cause', 'How can I tell where the water in my bedroom is coming from? (i) discolouration or chipping of wall paints (ii) change in wall texture (iii) leakages in other walls like the rooftop, basement, adjoining bathroom, etc. (iv) all of these', 1),
  ('Waterproofer', 'water_proffing', 'What is the best method of waterproofing? (i) Polyurethane material on surface (ii) cement based adhesive (iii) Bitumen-based membranes (iv) Liquid-applied membranes', 2),
  ('Waterproofer', 'cert_waterproofer', 'Do you have any certificate for training as a waterproofer? (i) Yes (ii) No', 3),
  ('Waterproofer', 'waterprro_material', 'Which waterproofing solution have you used for leak-free bathroom? (i) Polymer tile adhesive (ii) cement-based polymer tile adhesive (iii) Bitumen-based membranes (iv) Liquid-applied membranes', 4),
  ('Waterproofer', 'company_use', 'Which company waterproofing products have you used? (i) Asian paints (ii) Dr Fixit (iii) Sika India (iv) All of these', 5),
  ('Waterproofer', 'repair_exp', 'What waterproofing systems failures have you attended? (i) Remove blisters and apply new layer of waterproofing material (ii) Filling cracks with sealant or new layer of waterproofing material (iii) Replacing damaged sections and redo (iv) all of these', 6),
  ('Waterproofer', 'steps_treat', 'What are the essential steps involved in waterproofing a concrete structure? (i) Surface preparation (ii) Priming (iii) Waterproofing application (iv) all of these', 7),
  ('Waterproofer', 'warranty_material', 'How much life warranty is given by waterproofing material products? (i) 7 years (ii) 10 Years (iii) 15 Years (iv) 20 Years', 8),
  ('Waterproofer', 'basement_seepage', 'Why do basements have seepage problems ? (i) leaking wall due to hydrostaic pressure (ii) dampness from the ground (iii) flooding during rains (iv) all of these', 9),
  ('Waterproofer', 'tech_method', 'What bathroom seepage techniques have you applied? (i) cementatious waterprrofing (ii) epoxy treatment (iii) integral mixing in concrete during construction (iv) all of these', 10),

  ('Painter', 'color_change', 'What would you do if you started painting a room and the client changed their mind about the color? (i) Stop painting immediately (ii) Sample the new color he suggests (iii) proceed only on consent of color and cost with preparation and then paint (iv) all o f these', 1),
  ('Painter', 'protect_site', 'How do you protect floors, furniture, and landscaping? (i) a specific masking system (ii) drop cloths (iii) plastic (iv) all of these', 2),
  ('Painter', 'coat_dry', 'how long do you wait between coats? (i) 30 minutes - 1 hour (iii) 2-4 hours (iv) as per paint manufacture directions', 3),
  ('Painter', 'expert_work', 'What''s your speciality as a painter? (i) restoration painter (ii) design painter (iii) industrial painter (iv) decorating painter', 4),
  ('Painter', 'output_day', 'Roughly how much can you produce per 8 hours for Distemper / Emulsion Painting (2 Full Coats) in a day ? (i) 200-225 sq ft (ii) 225-250 sq ft (iii) 250-260 sq ft (iii) 260-275 sq ft', 5),
  ('Painter', 'prepare_paint', 'How would you prepare a surface for painting? (i) clean surface (ii) smoothen the surface by sanding down (iii) apply a primer before paint (iv) all of these', 6),
  ('Painter', 'output_distemper', 'Roughly how much can you produce per 8 hours for Distemper / Emulsion Painting (1st Coat) in a day ? (i)160- 175 sq ft (ii) 175-200 sq ft (iii) 200-225 sq ft (iii) 225-300 sq ft', 7),
  ('Painter', 'output_primer', 'Roughly how much can you produce per 8 hours for Primer Application (Smooth surface) in a day ? (i) 300-325 sq ft (ii) 325-350 sq ft (iii) 350- 375 sq ft (iii) 375- 400 sq ft', 8),
  ('Painter', 'paint_area', 'How much does 1 liter paint cover area in painting ? (i) 125 sq ft (ii) 150 sq ft ( 170 sq ft (iv) 200 Sq ft.', 9),
  ('Painter', 'room_qty', 'How much paint is required for a room of 300 sq ft paint area ? (i) 5 litre (ii) 5-6 Litre (iii) 7-8 Litre (iv) 10 litre', 10),

  ('Carpenter', 'carpenter_q1', 'Do you know reply of Q1? (i) a (ii) b iii) c (iv) d', 1),
  ('Carpenter', 'carpenter_q2', 'Do you know reply of Q2? (i) a (ii) b iii) c (iv) d', 2),
  ('Carpenter', 'carpenter_q3', 'Do you know reply of Q3? (i) a (ii) b iii) c (iv) d', 3),
  ('Carpenter', 'carpenter_q4', 'Do you know reply of Q4? (i) a (ii) b iii) c (iv) d', 4),
  ('Carpenter', 'carpenter_q5', 'Do you know reply of Q5? (i) a (ii) b iii) c (iv) d', 5),
  ('Carpenter', 'carpenter_q6', 'Do you know reply of Q6? (i) a (ii) b iii) c (iv) d', 6),
  ('Carpenter', 'carpenter_q7', 'Do you know reply of Q7? (i) a (ii) b iii) c (iv) d', 7),
  ('Carpenter', 'carpenter_q8', 'Do you know reply of Q8? (i) a (ii) b iii) c (iv) d', 8),
  ('Carpenter', 'carpenter_q9', 'Do you know reply of Q9? (i) a (ii) b iii) c (iv) d', 9),
  ('Carpenter', 'carpenter_q10', 'Do you know reply of Q10? (i) a (ii) b iii) c (iv) d', 10),

  ('False Ceiling Installer', 'false_ceil_q1', 'Do you know reply of Q1? (i) a (ii) b iii) c (iv) d', 1),
  ('False Ceiling Installer', 'false_ceil_q2', 'Do you know reply of Q2? (i) a (ii) b iii) c (iv) d', 2),
  ('False Ceiling Installer', 'false_ceil_q3', 'Do you know reply of Q3? (i) a (ii) b iii) c (iv) d', 3),
  ('False Ceiling Installer', 'false_ceil_q4', 'Do you know reply of Q4? (i) a (ii) b iii) c (iv) d', 4),
  ('False Ceiling Installer', 'false_ceil_q5', 'Do you know reply of Q5? (i) a (ii) b iii) c (iv) d', 5),
  ('False Ceiling Installer', 'false_ceil_q6', 'Do you know reply of Q6? (i) a (ii) b iii) c (iv) d', 6),
  ('False Ceiling Installer', 'false_ceil_q7', 'Do you know reply of Q7? (i) a (ii) b iii) c (iv) d', 7),
  ('False Ceiling Installer', 'false_ceil_q8', 'Do you know reply of Q8? (i) a (ii) b iii) c (iv) d', 8),
  ('False Ceiling Installer', 'false_ceil_q9', 'Do you know reply of Q9? (i) a (ii) b iii) c (iv) d', 9),
  ('False Ceiling Installer', 'false_ceil_q10', 'Do you know reply of Q10? (i) a (ii) b iii) c (iv) d', 10),

  ('Helper', 'helper_skill_q1', 'Do you know reply of Q1? (i) a (ii) b iii) c (iv) d', 1),
  ('Helper', 'helper_skill_q2', 'Do you know reply of Q2? (i) a (ii) b iii) c (iv) d', 2),
  ('Helper', 'helper_skill_q3', 'Do you know reply of Q3? (i) a (ii) b iii) c (iv) d', 3),
  ('Helper', 'helper_skill_q4', 'Do you know reply of Q4? (i) a (ii) b iii) c (iv) d', 4),
  ('Helper', 'helper_skill_q5', 'Do you know reply of Q5? (i) a (ii) b iii) c (iv) d', 5),
  ('Helper', 'helper_skill_q6', 'Do you know reply of Q6? (i) a (ii) b iii) c (iv) d', 6),
  ('Helper', 'helper_skill_q7', 'Do you know reply of Q7? (i) a (ii) b iii) c (iv) d', 7),
  ('Helper', 'helper_skill_q8', 'Do you know reply of Q8? (i) a (ii) b iii) c (iv) d', 8),
  ('Helper', 'helper_skill_q9', 'Do you know reply of Q9? (i) a (ii) b iii) c (iv) d', 9),
  ('Helper', 'helper_skill_q10', 'Do you know reply of Q10? (i) a (ii) b iii) c (iv) d', 10),

  ('Supervisor', 'diff_wall', 'Can you explain the difference between a load-bearing wall and a partition wall on BUILDING FLOOR PLAN ? (i) Yes (ii) No', 1),
  ('Supervisor', 'output_paint_primer', 'Roughly how much can you produce per 8 hours for Primer Application (Smooth surface) in a day ? (i) 300-325 sq ft (ii) 325-350 sq ft (iii) 350- 375 sq ft (iii) 375- 400 sq ft', 2),
  ('Supervisor', 'warranty_product', 'How much life warranty is given by waterproofing material products? (i) 7 years (ii) 10 Years (iii) 15 Years (iv) 20 Years', 3),
  ('Supervisor', 'test_material', 'Which of the following mediums is not allowed for use in testing gas pipe installations? (i) Air (ii) Oxygen (iii) Nitrogen (iv) Carbon dioxide', 4),
  ('Supervisor', 'mortar_ratio', 'What specific sand-to-cement ratios do you use for structural brickwork? (i) 1:2 (ii) 1:3 (iii) 1:4 (iv) 1:6', 5),
  ('Supervisor', 'battery_mtce', 'What are the steps to maintain a battery periodically? (i) Check leaks, bulging, or corrosion (ii) baking soda solution and wire brush (iii) coat of anti-corrosion grease (iv) all', 6),
  ('Supervisor', 'vent_system', 'Which of the following types of fixtures can be served by a combination-waste-and-vent system? (i) Urinals (ii) Toilets (iii) Sinks (iv) Bidets', 7),
  ('Supervisor', 'grade_reqd', 'What is the typical amount of grade required per liner foot on a household drainage pipe? (i) 1/8 inch (ii) 1/4 inch (iii) 3/4 inch (iv) 1 inch', 8),
  ('Supervisor', 'circuit_safety', 'What safety steps do you take before working on a live residential circuit? (i) de-energize the circuit at the main breaker panel (ii) voltage tester to verify zero voltage before touching any wires (iii) both', 9),
  ('Supervisor', 'cert_license', 'Do you have valid certificate or license ? (i) Yes (ii) No', 10)
ON CONFLICT (trade, question_code) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  display_order = EXCLUDED.display_order,
  is_active = true;
