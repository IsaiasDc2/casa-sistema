-- FASE 1 · 008_caja.sql
-- Cajas físicas, turnos (apertura+cierre unificados), movimientos y gastos.

create table cajas (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete restrict,
  nombre text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (sucursal_id, nombre)
);

-- La FK ventas.turno_id se agrega DESPUÉS de crear turnos_caja
-- (Postgres exige que la tabla referenciada exista).

create table turnos_caja (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references cajas(id) on delete restrict,
  usuario_apertura uuid references profiles(id) on delete set null,
  usuario_cierre uuid references profiles(id) on delete set null,
  fecha_apertura timestamptz not null default now(),
  fecha_cierre timestamptz,
  monto_inicial numeric(12,2) not null default 0 check (monto_inicial >= 0),
  total_ventas numeric(12,2) not null default 0,
  total_ingresos numeric(12,2) not null default 0,
  total_egresos numeric(12,2) not null default 0,
  total_devoluciones numeric(12,2) not null default 0,
  efectivo_esperado numeric(12,2),
  efectivo_contado numeric(12,2) check (efectivo_contado is null or efectivo_contado >= 0),
  diferencia numeric(12,2),
  estado text not null default 'abierta' check (estado in ('abierta','cerrada')),
  observaciones text,
  check ((estado = 'abierta' and fecha_cierre is null) or
         (estado = 'cerrada' and fecha_cierre is not null))
);
-- Una sola caja abierta por caja física (los cerrados no colisionan):
create unique index uq_turno_abierto_por_caja on turnos_caja (caja_id)
  where estado = 'abierta';

-- FK diferida de ventas → turnos (la tabla ya existe a esta altura):
alter table ventas
  add constraint fk_ventas_turno
  foreign key (turno_id) references turnos_caja(id) on delete restrict;
create index idx_turnos_caja on turnos_caja (caja_id, fecha_apertura desc);

create table movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references turnos_caja(id) on delete restrict,
  tipo text not null check (tipo in (
    'venta','ingreso','egreso','gasto','devolucion','retiro','deposito','ajuste')),
  monto numeric(12,2) not null, -- signo según tipo (venta/ingreso/deposito +, resto -)
  es_efectivo boolean not null default true,
  descripcion text,
  referencia_tipo text, -- 'venta','gasto','devolucion','compra'
  referencia_id uuid,
  usuario_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_mov_caja_turno on movimientos_caja (turno_id, created_at);

create table categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true
);

create table gastos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categorias_gasto(id) on delete restrict,
  descripcion text not null,
  monto numeric(12,2) not null check (monto > 0),
  metodo_id uuid references metodos_pago(id) on delete restrict,
  turno_id uuid references turnos_caja(id) on delete restrict,
  usuario_id uuid references profiles(id) on delete set null,
  comprobante_url text,
  created_at timestamptz not null default now()
);

insert into categorias_gasto (nombre) values
  ('Alquiler'),('Servicios'),('Limpieza'),('Transporte'),
  ('Mantenimiento'),('Insumos'),('Sueldos'),('Otros');
