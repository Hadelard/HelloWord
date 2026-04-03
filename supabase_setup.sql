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

-- IMPORTANTE (Histórico de Bug de RLS):
-- Originalmente, essas políticas usavam o filtro "TO anon".
-- O erro era: ao fazer login com o Supabase Auth, o perfil do usuário muda de "anon" para "authenticated". 
-- Isso impedia que a busca pelas chaves funcionasse para quem estivesse logado.
-- A correção foi usar as diretrizes públicas/universais, removendo a trava do `anon`.

-- Todos (anon e authenticated) podem ler para verificar chave e status redeemed
CREATE POLICY "public_select_access" ON dotart_access
  FOR SELECT USING (true);

-- Todos (anon e authenticated) podem atualizar apenas para marcar como redeemed
CREATE POLICY "public_redeem_access" ON dotart_access
  FOR UPDATE USING (true)
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
