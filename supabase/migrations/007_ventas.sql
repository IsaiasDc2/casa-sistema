-- FASE 1 · 007_ventas.sql
-- Ventas inmutables con precio histórico + pagos divididos.

create table ventas (
  id uuid primary key default gen_random_uuid(),
  numero text unique, -- NULL en borrador (UNIQUE admite varios NULL); se asigna al confirmar
  sucursal_id uuid not null references sucursales(id) on delete restrict,
  turno_id uuid, -- FK a turnos_caja (se crea en 008; se agrega la FK allí)
  cliente_id uuid references clientes(id) on delete set null, -- NULL = consumidor final
  vendedor_id uuid references empleados(id) on delete restrict,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  impuesto numeric(12,2) not null default 0 check (impuesto >= 0),
  total numeric(12,2) not null check (total > 0),
  estado text not null default 'borrador' check (estado in (
    'borrador','pagada','anulada','devuelta','parcialmente_devuelta')),
  motivo_anulacion text,
  created_at timestamptz not null default now()
);
create index idx_ventas_fecha on ventas (created_at desc);
create index idx_ventas_cliente on ventas (cliente_id, created_at desc);
create index idx_ventas_vendedor on ventas (vendedor_id, created_at desc);
create index idx_ventas_turno on ventas (turno_id);

create table venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  cantidad numeric(12,3) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0), -- histórico
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0)
);
create index idx_venta_items_venta on venta_items (venta_id);
create index idx_venta_items_producto on venta_items (producto_id);

create table venta_pagos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  metodo_id uuid not null references metodos_pago(id) on delete restrict,
  monto numeric(12,2) not null check (monto > 0),
  referencia text, -- nro autorización, comprobante transferencia, etc (NUNCA datos de tarjeta)
  created_at timestamptz not null default now()
);
create index idx_venta_pagos_venta on venta_pagos (venta_id);
