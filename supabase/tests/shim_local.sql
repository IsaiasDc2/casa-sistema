-- supabase/tests/shim_local.sql
-- SOLO para verificación local con Docker. NUNCA aplicar en Supabase
-- (allí ya existen el esquema auth y auth.uid()).
--
-- Simula auth.uid() leyendo el setting de sesión 'app.uid':
--   set app.uid = '<uuid-del-usuario-de-prueba>';

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.uid', true), '')::uuid
$$;
