-- FASE 1 · 003_personas.sql
-- Perfiles (1:1 auth.users), empleados, clientes, proveedores.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text not null,
  apellido text not null default '',
  telefono text,
  rol_id uuid not null references roles(id) on delete restrict,
  estado text not null default 'activo'
    check (estado in ('activo','bloqueado','suspendido','inactivo')),
  ultimo_acceso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table empleados (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id) on delete restrict,
  legajo text unique,
  sucursal_id uuid references sucursales(id) on delete restrict,
  fecha_alta date not null default current_date,
  created_at timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null default '',
  documento text,
  cuit text,
  telefono text,
  email text,
  direccion text,
  fecha_nacimiento date,
  profile_id uuid references profiles(id) on delete set null, -- vínculo futuro rol cliente
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (documento)
);

create table proveedores (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  nombre_comercial text,
  identificacion_fiscal text unique,
  telefono text,
  email text,
  direccion text,
  provincia text,
  ciudad text,
  contacto text,
  condiciones_pago text,
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Al registrarse en Auth se crea el perfil. Si el email coincide con el
-- bootstrap configurado, nace admin; si no, vendedor (un admin lo promueve).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol uuid;
  v_admin_email text;
begin
  select valor into v_admin_email from configuracion where clave = 'bootstrap.admin_email';
  if v_admin_email is not null and v_admin_email <> '' and new.email = v_admin_email then
    select id into v_rol from roles where nombre = 'admin';
  else
    select id into v_rol from roles where nombre = 'vendedor';
  end if;

  insert into public.profiles (id, email, nombre, apellido, rol_id)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
          coalesce(new.raw_user_meta_data->>'apellido', ''), v_rol);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
