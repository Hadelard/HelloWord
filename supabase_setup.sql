-- ============================================================
-- DotArt Access Table Setup
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS dotart_access (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text        UNIQUE NOT NULL,
  key         text        NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT '3000-01-01 00:00:00+00',
  redeemed    boolean     NOT NULL DEFAULT false,
  redeemed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE dotart_access ENABLE ROW LEVEL SECURITY;

-- Anon pode ler (para verificar chave e status redeemed)
CREATE POLICY "anon_select_access" ON dotart_access
  FOR SELECT TO anon USING (true);

-- Anon pode atualizar apenas para marcar como redeemed
CREATE POLICY "anon_redeem_access" ON dotart_access
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (redeemed = true);

-- ============================================================
-- Migração dos dados do access.csv
-- expires_at = 3000-01-01 = acesso vitalício
-- ============================================================

INSERT INTO dotart_access (email, key, expires_at) VALUES
  ('hadelard@gmail.com',       '123-456-789', '3000-01-01 00:00:00+00'),
  ('teste@example.com',        'ABC-DEF-GHI', '3000-01-01 00:00:00+00'),
  ('teste@teste.com',          '123-123-123', '3000-01-01 00:00:00+00'),
  ('barboza.felipes@gmail.com','999-888-777', '3000-01-01 00:00:00+00')
ON CONFLICT (email) DO NOTHING;
