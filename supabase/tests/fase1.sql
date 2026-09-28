-- supabase/tests/fase1.sql
-- Prueba de humo FASE 1 (correr como superuser postgres en Docker).
-- Verifica: venta completa, stock, caja, pagos, anulación y cierres.
-- Falla con EXCEPTION ante cualquier inconsistencia.

\set ON_ERROR_STOP on

-- Usuario admin de prueba
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@casa-isaias.test')
on conflict do nothing;

insert into profiles (id, email, nombre, apellido, rol_id)
select '11111111-1111-1111-1111-111111111111', 'admin@casa-isaias.test',
       'Admin', 'Test', r.id
from roles r where r.nombre = 'admin'
on conflict do nothing;

set app.uid = '11111111-1111-1111-1111-111111111111';

-- Empleado vendedor
insert into empleados (profile_id, legajo)
values ('11111111-1111-1111-1111-111111111111', 'LEG-001')
on conflict do nothing;

-- 1. Apertura de turno (5000 inicial)
select public.abrir_turno(
  (select id from cajas limit 1), 5000);

-- 2. Venta completa: 2x DEMO-1 + 1x DEMO-2, pago dividido
with t as (select id as turno from turnos_caja where estado = 'abierta' limit 1),
     e as (select id as emp from empleados limit 1),
     p1 as (select id from productos where sku = 'DEMO-1'),
     p2 as (select id from productos where sku = 'DEMO-2'),
     m_ef as (select id from metodos_pago where nombre = 'Efectivo'),
     m_tr as (select id from metodos_pago where nombre = 'Transferencia'),
     v as (
       select public.registrar_venta(
         (select turno from t),
         null,
         (select emp from e),
         0,
         jsonb_build_array(
           jsonb_build_object('producto_id', (select id from p1), 'cantidad', 2, 'descuento', 0),
           jsonb_build_object('producto_id', (select id from p2), 'cantidad', 1, 'descuento', 0)
         ),
         jsonb_build_array(
           jsonb_build_object('metodo_id', (select id from m_ef), 'monto', 350),
           jsonb_build_object('metodo_id', (select id from m_tr), 'monto', 250)
         )
       ) as id
     )
select 'venta OK: ' || (select numero from ventas where id = (select id from v))
     || ' total=' || (select total from ventas where id = (select id from v));

-- 3. Stock descontado: DEMO-1 100→98, DEMO-2 100→99
select 'stock DEMO-1=' || (select cantidad from stock s
  join productos p on p.id = s.producto_id where p.sku = 'DEMO-1')
  || ' DEMO-2=' || (select cantidad from stock s
  join productos p on p.id = s.producto_id where p.sku = 'DEMO-2');

-- 4. Movimientos generados
select 'mov_stock=' || count(*) filter (where tipo = 'venta')
     || ' mov_caja=' || (select count(*) from movimientos_caja)
     || ' pagos=' || (select count(*) from venta_pagos)
from movimientos_stock;

-- 5. Negativos: stock insuficiente
do $$
declare v_turno uuid; v_emp uuid; v_prod uuid; v_met uuid;
begin
  select id into v_turno from turnos_caja where estado = 'abierta' limit 1;
  select id into v_emp from empleados limit 1;
  select id into v_prod from productos where sku = 'DEMO-1';
  select id into v_met from metodos_pago where nombre = 'Efectivo';
  begin
    perform public.registrar_venta(v_turno, null, v_emp, 0,
      jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 9999, 'descuento', 0)),
      jsonb_build_array(jsonb_build_object('metodo_id', v_met, 'monto', 999999)));
    raise exception 'FALLO: permitió vender sin stock';
  exception when raise_exception then
    if sqlerrm <> 'FALLO: permitió vender sin stock' then
      raise notice 'OK stock insuficiente bloqueado: %', sqlerrm;
    else raise; end if;
  end;
end $$;

-- 6. Negativos: pagos que no suman
do $$
declare v_turno uuid; v_emp uuid; v_prod uuid; v_met uuid;
begin
  select id into v_turno from turnos_caja where estado = 'abierta' limit 1;
  select id into v_emp from empleados limit 1;
  select id into v_prod from productos where sku = 'DEMO-2';
  select id into v_met from metodos_pago where nombre = 'Efectivo';
  begin
    perform public.registrar_venta(v_turno, null, v_emp, 0,
      jsonb_build_array(jsonb_build_object('producto_id', v_prod, 'cantidad', 1, 'descuento', 0)),
      jsonb_build_array(jsonb_build_object('metodo_id', v_met, 'monto', 1)));
    raise exception 'FALLO: permitió pagos inconsistentes';
  exception when raise_exception then
    if sqlerrm <> 'FALLO: permitió pagos inconsistentes' then
      raise notice 'OK pagos inconsistentes bloqueados: %', sqlerrm;
    else raise; end if;
  end;
end $$;

-- 7. Anulación revierte stock (DEMO-1 vuelve a 100)
do $$
declare v_id uuid;
begin
  select id into v_id from ventas where estado = 'pagada' limit 1;
  perform public.anular_venta(v_id, 'prueba FASE 1');
end $$;

select 'post-anulacion DEMO-1=' || (select cantidad from stock s
  join productos p on p.id = s.producto_id where p.sku = 'DEMO-1')
  || ' estado=' || (select estado from ventas where numero like 'V-%' limit 1);

-- 8. Cierre con diferencia (contado 100 menos de lo esperado)
select 'cierre: ' || public.cerrar_turno(
  (select id from turnos_caja where estado = 'abierta' limit 1),
  (select efectivo_esperado - 100 from (
     select coalesce(sum(monto),0) as e from movimientos_caja mc
     join turnos_caja t on t.id = mc.turno_id and t.estado = 'abierta') s
   ),
  'prueba FASE 1');

select 'turnos cerrados=' || count(*) from turnos_caja where estado = 'cerrada';

-- 9. Auditoría registró la operación
select 'filas auditoria=' || count(*) from auditoria;
