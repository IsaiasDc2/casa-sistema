-- FASE 1 · 006_compras.sql
-- Compras a proveedores con recepción parcial/total.

create table compras (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  proveedor_id uuid not null references proveedores(id) on delete restrict,
  usuario_id uuid references profiles(id) on delete set null,
  sucursal_id uuid references sucursales(id) on delete restrict,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  impuesto numeric(12,2) not null default 0 check (impuesto >= 0),
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  estado text not null default 'borrador' check (estado in (
    'borrador','pendiente','parcialmente_recibida','recibida','cancelada')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_compras_proveedor on compras (proveedor_id, created_at desc);
create index idx_compras_estado on compras (estado);

create table compra_items (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  cantidad numeric(12,3) not null check (cantidad > 0),
  cantidad_recibida numeric(12,3) not null default 0 check (cantidad_recibida >= 0),
  costo_unitario numeric(12,2) not null check (costo_unitario >= 0), -- histórico
  subtotal numeric(12,2) not null check (subtotal >= 0),
  check (cantidad_recibida <= cantidad)
);
create index idx_compra_items_compra on compra_items (compra_id);
