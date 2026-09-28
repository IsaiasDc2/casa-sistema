-- FASE 1 · 009_cuentas_devoluciones_reclamos.sql
-- Cuentas corrientes unificadas, devoluciones (cliente+proveedor) y reclamos.

create table cuentas_corrientes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('cliente','proveedor')),
  cliente_id uuid references clientes(id) on delete restrict,
  proveedor_id uuid references proveedores(id) on delete restrict,
  saldo numeric(12,2) not null default 0, -- + a favor del negocio, - deuda
  created_at timestamptz not null default now(),
  check (
    (tipo = 'cliente' and cliente_id is not null and proveedor_id is null) or
    (tipo = 'proveedor' and proveedor_id is not null and cliente_id is null)
  ),
  unique (tipo, cliente_id, proveedor_id)
);

create table movimientos_cc (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references cuentas_corrientes(id) on delete restrict,
  tipo text not null check (tipo in ('cargo','pago')),
  monto numeric(12,2) not null check (monto > 0),
  concepto text not null,
  referencia_tipo text,
  referencia_id uuid,
  usuario_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_mov_cc_cuenta on movimientos_cc (cuenta_id, created_at desc);

create table devoluciones (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  tipo text not null check (tipo in ('cliente','proveedor')),
  venta_id uuid references ventas(id) on delete restrict,
  compra_id uuid references compras(id) on delete restrict,
  motivo text not null,
  reingresa_stock boolean not null default true,
  reintegro_monto numeric(12,2) not null default 0 check (reintegro_monto >= 0),
  estado text not null default 'solicitada' check (estado in (
    'solicitada','aprobada','rechazada','procesada')),
  autoriza_id uuid references profiles(id) on delete set null,
  procesa_id uuid references profiles(id) on delete set null,
  turno_id uuid references turnos_caja(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (tipo = 'cliente' and venta_id is not null and compra_id is null) or
    (tipo = 'proveedor' and compra_id is not null and venta_id is null)
  )
);

create table devolucion_items (
  id uuid primary key default gen_random_uuid(),
  devolucion_id uuid not null references devoluciones(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  cantidad numeric(12,3) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0)
);

create table reclamos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid references ventas(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  producto_id uuid references productos(id) on delete set null,
  motivo text not null,
  estado text not null default 'abierto' check (estado in (
    'abierto','en_revision','respondido','resuelto','rechazado')),
  usuario_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reclamo_mensajes (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references reclamos(id) on delete cascade,
  autor_id uuid references profiles(id) on delete set null,
  mensaje text not null,
  evidencia_url text,
  created_at timestamptz not null default now()
);
