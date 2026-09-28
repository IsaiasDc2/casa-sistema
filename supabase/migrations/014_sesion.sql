-- FASE 2 · 014_sesion.sql
-- 1. mi_rol() ignora usuarios no activos → bloqueo real a nivel DB
--    (un bloqueado conserva sesión de Auth pero pierde todos los permisos).
-- 2. mis_permisos(): códigos de permiso del usuario actual (para el menú).
-- 3. Grants explícitos de ejecución a authenticated.

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select r.nombre
  from profiles p join roles r on r.id = p.rol_id
  where p.id = auth.uid() and p.estado = 'activo'
$$;

create or replace function public.mis_permisos()
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(pe.codigo), '{}')
  from profiles p
  join rol_permisos rp on rp.rol_id = p.rol_id
  join permisos pe on pe.id = rp.permiso_id
  where p.id = auth.uid() and p.estado = 'activo'
$$;

grant execute on function public.mi_rol() to authenticated;
grant execute on function public.soy_admin() to authenticated;
grant execute on function public.es_staff() to authenticated;
grant execute on function public.tiene_permiso(text) to authenticated;
grant execute on function public.mis_permisos() to authenticated;
