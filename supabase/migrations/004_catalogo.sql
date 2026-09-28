-- FASE 1 · 004_catalogo.sql
-- Categorías (auto-referencia = N niveles), marcas, unidades, productos, imágenes.

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  parent_id uuid references categorias(id) on delete restrict,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (parent_id, nombre),
  check (id <> parent_id)
);

create table marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table unidades_medida (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- UND, KG, LT, PAR, CAJA
  descripcion text,
  permite_decimales boolean not null default false
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  codigo_barras text unique, -- NULL permitido: PG acepta varios NULL en UNIQUE
  nombre text not null,
  descripcion text,
  categoria_id uuid references categorias(id) on delete restrict,
  marca_id uuid references marcas(id) on delete restrict,
  unidad_id uuid references unidades_medida(id) on delete restrict,
  precio_compra numeric(12,2) not null default 0 check (precio_compra >= 0),
  precio_venta numeric(12,2) not null default 0 check (precio_venta >= 0),
  precio_mayorista numeric(12,2) check (precio_mayorista is null or precio_mayorista >= 0),
  impuesto_pct numeric(5,2) not null default 0 check (impuesto_pct >= 0 and impuesto_pct <= 100),
  stock_minimo int not null default 0 check (stock_minimo >= 0),
  stock_maximo int check (stock_maximo is null or stock_maximo >= 0),
  proveedor_id uuid references proveedores(id) on delete set null,
  estado text not null default 'activo'
    check (estado in ('activo','inactivo','discontinuado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_productos_nombre on productos using gin (to_tsvector('spanish', nombre));
create index idx_productos_categoria on productos (categoria_id);
create index idx_productos_estado on productos (estado);

create table producto_imagenes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  url text not null,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

insert into unidades_medida (codigo, descripcion, permite_decimales) values
  ('UND','Unidad',false), ('PAR','Par',false), ('CAJA','Caja',false),
  ('KG','Kilogramo',true), ('LT','Litro',true), ('MT','Metro',true);
