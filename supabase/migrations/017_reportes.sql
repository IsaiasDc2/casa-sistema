-- 017_reportes.sql — Vistas de agregación (FASE 10).
-- security_invoker: respetan el RLS del usuario que consulta.

create or replace view v_ventas_dia as
select date_trunc('day', created_at)::date as dia,
       sucursal_id, count(*) as cantidad,
       sum(total) as total, avg(total) as ticket_promedio
from ventas where estado = 'pagada'
group by 1, 2;

create or replace view v_ventas_vendedor as
select v.vendedor_id, e.legajo,
       p.nombre || ' ' || p.apellido as vendedor,
       date_trunc('day', v.created_at)::date as dia,
       count(*) as cantidad, sum(v.total) as total
from ventas v
join empleados e on e.id = v.vendedor_id
join profiles p on p.id = e.profile_id
where v.estado = 'pagada'
group by 1, 2, 3, 4;

create or replace view v_top_productos as
select vi.producto_id, pr.nombre, pr.sku,
       sum(vi.cantidad) as cantidad,
       sum(vi.subtotal) as total,
       sum(vi.subtotal - vi.cantidad * pr.precio_compra) as ganancia_estimada
from venta_items vi
join ventas v on v.id = vi.venta_id and v.estado = 'pagada'
join productos pr on pr.id = vi.producto_id
group by 1, 2, 3;

create or replace view v_stock_bajo as
select s.producto_id, pr.nombre, pr.sku, pr.stock_minimo,
       d.nombre as deposito, s.cantidad
from stock s
join productos pr on pr.id = s.producto_id
join depositos d on d.id = s.deposito_id
where pr.estado = 'activo' and s.cantidad <= pr.stock_minimo;

create or replace view v_valorizacion as
select pr.id, pr.nombre, pr.sku,
       sum(s.cantidad) as cantidad_total,
       sum(s.cantidad * pr.precio_compra) as valorizado_compra,
       sum(s.cantidad * pr.precio_venta) as valorizado_venta
from stock s join productos pr on pr.id = s.producto_id
group by 1, 2, 3;

create or replace view v_saldos_cc as
select cc.id, cc.tipo,
       coalesce(c.nombre || ' ' || c.apellido, pv.razon_social) as titular,
       cc.saldo
from cuentas_corrientes cc
left join clientes c on c.id = cc.cliente_id
left join proveedores pv on pv.id = cc.proveedor_id;

create or replace view v_compras_proveedor as
select c.proveedor_id, pv.razon_social,
       date_trunc('day', c.created_at)::date as dia,
       count(*) as cantidad, sum(c.total) as total
from compras c join proveedores pv on pv.id = c.proveedor_id
where c.estado in ('pendiente','parcialmente_recibida','recibida')
group by 1, 2, 3;

alter view v_ventas_dia set (security_invoker = true);
alter view v_ventas_vendedor set (security_invoker = true);
alter view v_top_productos set (security_invoker = true);
alter view v_stock_bajo set (security_invoker = true);
alter view v_valorizacion set (security_invoker = true);
alter view v_saldos_cc set (security_invoker = true);
alter view v_compras_proveedor set (security_invoker = true);
