-- FASE 1 · 013_seeds.sql
-- Datos mínimos para operar y probar: caja, categorías y productos demo.

insert into cajas (sucursal_id, nombre)
select id, 'Caja 1' from sucursales where nombre = 'Casa Central';

insert into categorias (nombre) values
  ('Almacén'), ('Limpieza'), ('Bazar'), ('Ferretería')
on conflict do nothing;

insert into marcas (nombre) values
  ('Genérica'), ('La Casa')
on conflict do nothing;

-- Productos demo (el trigger crea su stock en cada depósito)
with cat as (select id from categorias where nombre = 'Almacén' limit 1),
     mar as (select id from marcas where nombre = 'Genérica' limit 1),
     und as (select id from unidades_medida where codigo = 'UND' limit 1)
insert into productos
  (sku, codigo_barras, nombre, descripcion, categoria_id, marca_id, unidad_id,
   precio_compra, precio_venta, impuesto_pct, stock_minimo)
select
  'DEMO-' || g, '77900000000' || g,
  'Producto demo ' || g, 'Producto de prueba FASE 1',
  (select id from cat), (select id from mar), (select id from und),
  100 * g, 150 * g, 0, 5
from generate_series(1, 3) g
on conflict (sku) do nothing;

-- Stock inicial demo: 100 unidades de cada producto en el depósito principal
insert into stock (producto_id, deposito_id, cantidad)
select p.id, d.id, 100
from productos p
cross join depositos d
where p.sku like 'DEMO-%' and d.es_principal
on conflict (producto_id, deposito_id) do update set cantidad = 100;
