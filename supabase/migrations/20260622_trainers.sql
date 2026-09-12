CREATE TABLE IF NOT EXISTS trainers (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL, specialisation TEXT[] NOT NULL, zone TEXT DEFAULT 'Noida', is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_trainers" ON trainers FOR SELECT TO authenticated USING (true);
INSERT INTO trainers (name, specialisation) VALUES ('Trainer_Civil_1', '{M1,M2,M3,M4,M5,M6}'), ('Trainer_Civil_2', '{M1,M2,M4}'), ('Trainer_Civil_3', '{M3,M5,M6}');
