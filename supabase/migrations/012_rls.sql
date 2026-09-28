-- FASE 1 · 012_rls.sql
-- Seguridad a nivel fila. Regla de oro: la app NUNCA escribe directo en
-- ventas/stock/caja/movimientos (sin policy = denegado); todo pasa por RPC.
-- Las funciones SECURITY DEFINER (dueño postgres) no están sujetas a RLS.

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in
    ('admin','encargado','vendedor','inventario','auditor'), false)
$$;

-- ============ habilitación ============
alter table roles enable row level security;
alter table permisos enable row level security;
alter table rol_permisos enable row level security;
alter table sucursales enable row level security;
alter table depositos enable row level security;
alter table cajas enable row level security;
alter table configuracion enable row level security;
alter table secuencias_comprobantes enable row level security;
alter table metodos_pago enable row level security;
alter table categorias enable row level security;
alter table marcas enable row level security;
alter table unidades_medida enable row level security;
alter table categorias_gasto enable row level security;
alter table profiles enable row level security;
alter table empleados enable row level security;
alter table clientes enable row level security;
alter table proveedores enable row level security;
alter table productos enable row level security;
alter table producto_imagenes enable row level security;
alter table stock enable row level security;
alter table movimientos_stock enable row level security;
alter table compras enable row level security;
alter table compra_items enable row level security;
alter table ventas enable row level security;
alter table venta_items enable row level security;
alter table venta_pagos enable row level security;
alter table turnos_caja enable row level security;
alter table movimientos_caja enable row level security;
alter table gastos enable row level security;
alter table devoluciones enable row level security;
alter table devolucion_items enable row level security;
alter table cuentas_corrientes enable row level security;
alter table movimientos_cc enable row level security;
alter table reclamos enable row level security;
alter table reclamo_mensajes enable row level security;
alter table auditoria enable row level security;

-- ============ catálogos y organización ============
-- Lectura: cualquier autenticado. Escritura: permiso o admin.
create policy lectura on roles for select to authenticated using (true);
create policy lectura on permisos for select to authenticated using (true);
create policy lectura on rol_permisos for select to authenticated using (true);
create policy escritura_admin on roles for all using (public.soy_admin()) with check (public.soy_admin());
create policy escritura_admin on permisos for all using (public.soy_admin()) with check (public.soy_admin());
create policy escritura_admin on rol_permisos for all using (public.soy_admin()) with check (public.soy_admin());

create policy lectura on sucursales for select using (public.es_staff());
create policy lectura on depositos for select using (public.es_staff());
create policy lectura on cajas for select using (public.es_staff());
create policy escritura_admin on sucursales for all using (public.soy_admin()) with check (public.soy_admin());
create policy escritura_admin on depositos for all using (public.soy_admin()) with check (public.soy_admin());
create policy escritura_admin on cajas for all using (public.soy_admin()) with check (public.soy_admin());

create policy lectura on configuracion for select using (public.es_staff());
create policy escritura_admin on configuracion for all using (public.soy_admin()) with check (public.soy_admin());
create policy lectura on secuencias_comprobantes for select using (public.es_staff());
-- secuencias solo las toca siguiente_comprobante(); sin escritura app.

create policy lectura on metodos_pago for select to authenticated using (true);
create policy escritura on metodos_pago for all
  using (public.tiene_permiso('configuracion.gestionar')) with check (public.tiene_permiso('configuracion.gestionar'));

create policy lectura on categorias for select to authenticated using (true);
create policy escritura on categorias for all
  using (public.tiene_permiso('categorias.gestionar')) with check (public.tiene_permiso('categorias.gestionar'));
create policy lectura on marcas for select to authenticated using (true);
create policy escritura on marcas for all
  using (public.tiene_permiso('categorias.gestionar')) with check (public.tiene_permiso('categorias.gestionar'));
create policy lectura on unidades_medida for select to authenticated using (true);
create policy escritura_admin on unidades_medida for all using (public.soy_admin()) with check (public.soy_admin());
create policy lectura on categorias_gasto for select using (public.es_staff());
create policy escritura on categorias_gasto for all
  using (public.tiene_permiso('gastos.gestionar')) with check (public.tiene_permiso('gastos.gestionar'));

-- ============ productos ============
create policy lectura on productos for select to authenticated using (true);
create policy escritura on productos for insert with check (public.tiene_permiso('productos.gestionar'));
create policy escritura_upd on productos for update
  using (public.tiene_permiso('productos.gestionar')) with check (public.tiene_permiso('productos.gestionar'));
-- Sin DELETE: el borrado es lógico (estado). Sin policy = denegado para todos.
create policy lectura on producto_imagenes for select to authenticated using (true);
create policy escritura on producto_imagenes for all
  using (public.tiene_permiso('productos.gestionar')) with check (public.tiene_permiso('productos.gestionar'));

-- ============ personas ============
-- profiles: cada uno lee el suyo; admin todo. UPDATE propio o admin
-- (el trigger impedir_cambio_rol blinda rol/estado).
create policy lectura_propia on profiles for select
  using (id = auth.uid() or public.soy_admin());
create policy actualizacion on profiles for update
  using (id = auth.uid() or public.soy_admin())
  with check (id = auth.uid() or public.soy_admin());
-- Sin INSERT app: lo crea el trigger de Auth. Sin DELETE.

create policy lectura on empleados for select using (public.es_staff());
create policy escritura on empleados for all
  using (public.tiene_permiso('usuarios.gestionar')) with check (public.tiene_permiso('usuarios.gestionar'));

create policy lectura on clientes for select using (public.es_staff());
create policy escritura on clientes for insert with check (public.tiene_permiso('clientes.gestionar'));
create policy escritura_upd on clientes for update
  using (public.tiene_permiso('clientes.gestionar')) with check (public.tiene_permiso('clientes.gestionar'));

create policy lectura on proveedores for select using (public.es_staff());
create policy escritura on proveedores for insert with check (public.tiene_permiso('compras.gestionar'));
create policy escritura_upd on proveedores for update
  using (public.tiene_permiso('compras.gestionar')) with check (public.tiene_permiso('compras.gestionar'));

-- ============ documentos operativos (solo lectura app; escritura vía RPC) ============
create policy lectura on stock for select using (public.es_staff());
create policy lectura on movimientos_stock for select using (public.es_staff());
create policy lectura on ventas for select using (public.es_staff());
create policy lectura on venta_items for select using (public.es_staff());
create policy lectura on venta_pagos for select using (public.es_staff());
create policy lectura on turnos_caja for select using (public.es_staff());
create policy lectura on movimientos_caja for select using (public.es_staff());

create policy lectura on compras for select using (public.es_staff());
create policy escritura on compras for insert with check (public.tiene_permiso('compras.gestionar'));
create policy escritura_upd on compras for update
  using (public.tiene_permiso('compras.gestionar')) with check (public.tiene_permiso('compras.gestionar'));
create policy lectura on compra_items for select using (public.es_staff());
create policy escritura on compra_items for all
  using (public.tiene_permiso('compras.gestionar')) with check (public.tiene_permiso('compras.gestionar'));
-- La recepción que mueve stock es SOLO vía recibir_compra().

create policy lectura on gastos for select using (public.es_staff());
-- Gastos solo vía registrar_gasto() (toca caja).

create policy lectura on devoluciones for select using (public.es_staff());
create policy escritura on devoluciones for insert with check (public.tiene_permiso('devoluciones.crear'));
create policy escritura_upd on devoluciones for update
  using (public.tiene_permiso('devoluciones.aprobar')) with check (public.tiene_permiso('devoluciones.aprobar'));
create policy lectura on devolucion_items for select using (public.es_staff());
create policy escritura on devolucion_items for all
  using (public.tiene_permiso('devoluciones.crear')) with check (public.tiene_permiso('devoluciones.crear'));
-- El procesamiento que mueve stock/caja es SOLO vía procesar_devolucion().

create policy lectura on cuentas_corrientes for select using (public.es_staff());
create policy escritura on cuentas_corrientes for insert with check (
  public.tiene_permiso('clientes.gestionar') or public.tiene_permiso('compras.gestionar'));
create policy lectura on movimientos_cc for select using (public.es_staff());
-- Movimientos de CC solo vía registrar_movimiento_cc().

create policy lectura on reclamos for select using (public.es_staff());
create policy escritura on reclamos for all
  using (public.tiene_permiso('reclamos.gestionar')) with check (public.tiene_permiso('reclamos.gestionar'));
create policy lectura on reclamo_mensajes for select using (public.es_staff());
create policy escritura on reclamo_mensajes for all
  using (public.tiene_permiso('reclamos.gestionar')) with check (public.tiene_permiso('reclamos.gestionar'));

-- ============ auditoría: solo lectura admin/auditor, escritura nadie (triggers) ============
create policy lectura on auditoria for select
  using (public.soy_admin() or public.mi_rol() = 'auditor');
