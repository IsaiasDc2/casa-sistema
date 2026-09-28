-- FASE 1 · 002_organizacion.sql
-- Sucursales, depósitos, configuración, secuencias de comprobantes, métodos de pago.

create table sucursales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  telefono text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table depositos (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete restrict,
  nombre text not null,
  es_principal boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (sucursal_id, nombre)
);

create table configuracion (
  clave text primary key,
  valor text not null,
  descripcion text,
  updated_at timestamptz not null default now()
);

create table secuencias_comprobantes (
  tipo text primary key check (tipo in ('venta','compra','devolucion')),
  punto_venta int not null default 1 check (punto_venta > 0),
  ultimo_numero bigint not null default 0 check (ultimo_numero >= 0)
);

create table metodos_pago (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  es_efectivo boolean not null default false,
  requiere_referencia boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seeds base
insert into sucursales (nombre, direccion) values
  ('Casa Central', 'Dirección principal');

insert into depositos (sucursal_id, nombre, es_principal)
select id, 'Depósito principal', true from sucursales where nombre = 'Casa Central';

insert into configuracion (clave, valor, descripcion) values
  ('negocio.nombre', 'Casa Isaias', 'Nombre del comercio'),
  ('negocio.direccion', '', 'Dirección fiscal'),
  ('negocio.telefono', '', 'Teléfono'),
  ('negocio.email', '', 'Email'),
  ('negocio.moneda', 'ARS', 'Código ISO de moneda'),
  ('negocio.impuesto_defecto', '0', 'Alícuota % por defecto'),
  ('bootstrap.admin_email', '', 'Email que recibe rol admin al registrarse (vaciar en producción)'),
  ('ticket.lineas_pie', 'Gracias por su compra', 'Pie del ticket'),
  ('caja.exige_arqueo', 'true', 'El cierre exige conteo físico');

insert into secuencias_comprobantes (tipo, punto_venta, ultimo_numero) values
  ('venta', 1, 0), ('compra', 1, 0), ('devolucion', 1, 0);

insert into metodos_pago (nombre, es_efectivo, requiere_referencia) values
  ('Efectivo', true, false),
  ('Débito', false, true),
  ('Crédito', false, true),
  ('Transferencia', false, true),
  ('QR', false, true),
  ('Cuenta corriente', false, false);
