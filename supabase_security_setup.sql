-- ==========================================
-- SCRIPT DE SEGURANÇA MÁXIMA - SUPABASE RLS
-- Execute este script no SQL Editor do seu Supabase
-- ==========================================

-- 1. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_bebidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_precos_reserva ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas_log ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÃO AUXILIAR PARA CHECAR SE O USUÁRIO É ADMIN
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- POLÍTICAS PARA A TABELA: profiles
-- ==========================================

CREATE POLICY "Usuários podem ver o próprio perfil" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar o próprio perfil" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins podem ver todos os perfis" 
ON profiles FOR SELECT 
USING (is_admin());

-- ==========================================
-- POLÍTICAS PARA A TABELA: reservas
-- ==========================================

CREATE POLICY "Usuários podem ver as próprias reservas" 
ON reservas FOR SELECT 
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Usuários podem criar reservas" 
ON reservas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Apenas admins podem modificar reservas" 
ON reservas FOR ALL 
USING (is_admin());

-- ==========================================
-- POLÍTICAS PARA A TABELA: admins
-- ==========================================

CREATE POLICY "Acesso restrito à tabela admins" 
ON admins FOR SELECT 
USING (auth.uid() = user_id OR is_admin());

-- ==========================================
-- POLÍTICAS PARA TABELAS DE CONFIGURAÇÃO
-- ==========================================

CREATE POLICY "Ver bebidas ativa" ON config_bebidas FOR SELECT USING (true);
CREATE POLICY "Ver preços ativa" ON config_precos_reserva FOR SELECT USING (true);

CREATE POLICY "Admins modificam bebidas" ON config_bebidas FOR ALL USING (is_admin());
CREATE POLICY "Admins modificam preços" ON config_precos_reserva FOR ALL USING (is_admin());

-- ==========================================
-- POLÍTICAS PARA LOGS
-- ==========================================

CREATE POLICY "Apenas admins veem logs" ON reservas_log FOR SELECT USING (is_admin());
CREATE POLICY "Apenas admins inserem logs" ON reservas_log FOR INSERT WITH CHECK (is_admin());
