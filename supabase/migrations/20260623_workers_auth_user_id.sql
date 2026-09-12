ALTER TABLE workers ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE INDEX IF NOT EXISTS workers_auth_user_id_idx ON workers (auth_user_id);
