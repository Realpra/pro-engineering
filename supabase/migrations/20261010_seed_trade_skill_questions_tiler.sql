-- Section C Skill Questions for Tiler, the trade added this entry (10 Oct 2026). Per the
-- project owner's explicit instruction ("tiler is one skill similar to mason. so same question
-- repeated"): Tiler's 10 questions are an exact copy of Mason's own 10 live questions (seeded
-- by 20260926_worker_onboarding_full_spec.sql), same question_code/question_text/display_order
-- -- a real starting point, not invented content, and freely editable by Admin afterward
-- through the already-built /admin/trade-questions screen (same discipline as the 8-trade seed
-- in 20261002_seed_trade_skill_questions_all_trades.sql). question_code is unique per (trade,
-- question_code), so reusing Mason's exact codes under trade='Tiler' is a distinct, valid row
-- in each case -- no collision with Mason's own rows.

INSERT INTO trade_skill_questions (trade, question_code, question_text, display_order) VALUES
  ('Tiler', 'reads_floor_plan', 'Can you read and understand a building floor plan?', 1),
  ('Tiler', 'mortar_mixes', 'What mortar mixes can you prepare correctly from memory (1:2, 1:3, 1:4, 1:6)?', 2),
  ('Tiler', 'tiling_experience', 'Have you laid tiles in addition to bricks and plasterwork? What types?', 3),
  ('Tiler', 'rcc_shuttering', 'Have you done RCC shuttering and deshuttering work?', 4),
  ('Tiler', 'plaster_finish', 'Have you applied plaster to a smooth finish, or only rough base coat?', 5),
  ('Tiler', 'pointing_work', 'Have you done pointing work on exposed brick or stone surfaces?', 6),
  ('Tiler', 'plumb_level_check', 'Can you check plumb and level using a spirit level and plumb bob independently?', 7),
  ('Tiler', 'crack_identification', 'Have you ever identified a crack during demolition and stopped work to get it assessed?', 8),
  ('Tiler', 'joint_tolerance', 'What is the thinnest joint tolerance you can maintain consistently in brick laying?', 9),
  ('Tiler', 'lightweight_block', 'Have you worked with lightweight block (AAC/Siporex) in addition to red brick?', 10)
ON CONFLICT (trade, question_code) DO NOTHING;
