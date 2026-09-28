-- FASE 1 · 010_auditoria.sql
-- Log inmutable (sin UPDATE/DELETE ni siquiera para admin: sin policies).

create table auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references profiles(id) on delete set null,
  accion text not null check (accion in ('INSERT','UPDATE','DELETE')),
  tabla text not null,
  registro_id uuid,
  anteriores jsonb,
  nuevos jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index idx_auditoria_tabla on auditoria (tabla, registro_id, created_at desc);
create index idx_auditoria_usuario on auditoria (usuario_id, created_at desc);

create or replace function public.auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
begin
  begin
    v_ip := (current_setting('request.headers', true)::json ->> 'x-forwarded-for');
  exception when others then
    v_ip := null;
  end;

  insert into auditoria (usuario_id, accion, tabla, registro_id, anteriores, nuevos, ip)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end,
    v_ip
  );
  if TG_OP = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Tablas auditadas (solo las de alto valor; movimientos_* ya son su propio trail)
create trigger trg_aud_productos
  after insert or update or delete on productos
  for each row execute function public.auditar();
create trigger trg_aud_ventas
  after insert or update on ventas
  for each row execute function public.auditar();
create trigger trg_aud_compras
  after insert or update on compras
  for each row execute function public.auditar();
create trigger trg_aud_turnos
  after insert or update on turnos_caja
  for each row execute function public.auditar();
create trigger trg_aud_profiles
  after update on profiles
  for each row execute function public.auditar();
create trigger trg_aud_devoluciones
  after insert or update on devoluciones
  for each row execute function public.auditar();

-- updated_at automático en maestras
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_ts_productos before update on productos
  for each row execute function public.set_updated_at();
create trigger trg_ts_clientes before update on clientes
  for each row execute function public.set_updated_at();
create trigger trg_ts_proveedores before update on proveedores
  for each row execute function public.set_updated_at();
create trigger trg_ts_compras before update on compras
  for each row execute function public.set_updated_at();
create trigger trg_ts_reclamos before update on reclamos
  for each row execute function public.set_updated_at();
