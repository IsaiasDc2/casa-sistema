-- FASE 1 · 005_inventario.sql
-- Stock por depósito + movimientos (la película histórica del stock).

create table stock (
  producto_id uuid not null references productos(id) on delete restrict,
  deposito_id uuid not null references depositos(id) on delete restrict,
  cantidad numeric(12,3) not null default 0 check (cantidad >= 0),
  reservado numeric(12,3) not null default 0 check (reservado >= 0),
  updated_at timestamptz not null default now(),
  primary key (producto_id, deposito_id)
);

create table movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete restrict,
  deposito_id uuid not null references depositos(id) on delete restrict,
  tipo text not null check (tipo in (
    'compra','venta','devolucion_cliente','devolucion_proveedor',
    'ajuste','perdida','rotura','vencimiento','transferencia_entrada',
    'transferencia_salida','anulacion_venta'
  )),
  cantidad numeric(12,3) not null check (cantidad <> 0),
  stock_anterior numeric(12,3) not null,
  stock_resultante numeric(12,3) not null,
  usuario_id uuid references profiles(id) on delete set null,
  motivo text,
  referencia_tipo text, -- 'venta','compra','devolucion','ajuste'
  referencia_id uuid,
  created_at timestamptz not null default now()
);
create index idx_mov_stock_producto on movimientos_stock (producto_id, created_at desc);
create index idx_mov_stock_referencia on movimientos_stock (referencia_tipo, referencia_id);

-- Al crear un producto: fila de stock en cada depósito existente.
create or replace function public.init_stock_producto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into stock (producto_id, deposito_id)
  select new.id, d.id from depositos d
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists trg_init_stock_producto on productos;
create trigger trg_init_stock_producto
  after insert on productos for each row execute function public.init_stock_producto();

-- Al crear un depósito: filas de stock para cada producto existente.
create or replace function public.init_stock_deposito()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into stock (producto_id, deposito_id)
  select p.id, new.id from productos p
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists trg_init_stock_deposito on depositos;
create trigger trg_init_stock_deposito
  after insert on depositos for each row execute function public.init_stock_deposito();
