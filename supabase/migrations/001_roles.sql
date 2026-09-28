-- FASE 1 · 001_roles.sql
-- Roles, permisos y matriz rol→permiso. Sin dependencias.

create extension if not exists "pgcrypto";

create table roles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
    check (nombre in ('admin','encargado','vendedor','inventario','auditor','cliente')),
  descripcion text,
  created_at timestamptz not null default now()
);

create table permisos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- ej: 'ventas.anular'
  descripcion text,
  created_at timestamptz not null default now()
);

create table rol_permisos (
  rol_id uuid not null references roles(id) on delete cascade,
  permiso_id uuid not null references permisos(id) on delete cascade,
  primary key (rol_id, permiso_id)
);

-- Catálogo de permisos (recurso.accion)
insert into permisos (codigo, descripcion) values
  ('dashboard.ver','Ver dashboard'),
  ('pos.operar','Operar el punto de venta'),
  ('ventas.ver','Ver ventas'), ('ventas.crear','Crear ventas'),
  ('ventas.anular','Anular ventas'), ('ventas.exportar','Exportar ventas'),
  ('productos.ver','Ver productos'), ('productos.gestionar','Crear/editar/desactivar productos'),
  ('categorias.gestionar','Gestionar categorías, marcas y unidades'),
  ('inventario.ver','Ver stock y movimientos'),
  ('inventario.ajustar','Ajustes, entradas, salidas y transferencias'),
  ('inventario.aprobar','Aprobar ajustes sensibles'),
  ('compras.ver','Ver compras'), ('compras.gestionar','Crear y recibir compras'),
  ('proveedores.gestionar','Gestionar proveedores'),
  ('clientes.ver','Ver clientes'), ('clientes.gestionar','Gestionar clientes'),
  ('caja.operar','Operar caja (apertura, movimientos)'),
  ('caja.cerrar','Cerrar caja propia'),
  ('caja.cerrar_ajena','Cerrar cajas de otros usuarios'),
  ('gastos.gestionar','Registrar gastos'),
  ('devoluciones.crear','Registrar devoluciones'),
  ('devoluciones.aprobar','Aprobar/procesar devoluciones'),
  ('reclamos.gestionar','Gestionar reclamos'),
  ('usuarios.gestionar','Gestionar usuarios y empleados'),
  ('roles.gestionar','Gestionar roles y permisos'),
  ('reportes.ver','Ver reportes'), ('reportes.exportar','Exportar reportes'),
  ('auditoria.ver','Consultar auditoría'),
  ('configuracion.gestionar','Modificar configuración');

insert into roles (nombre, descripcion) values
  ('admin','Acceso completo'),
  ('encargado','Supervisión operativa'),
  ('vendedor','POS, ventas y su caja'),
  ('inventario','Stock e inventario'),
  ('auditor','Solo lectura y reportes'),
  ('cliente','Reservado para futuro ecommerce');

-- Matriz: admin todo; encargado casi todo salvo usuarios/roles/config/auditoría(admin la ve);
-- vendedor: dashboard, pos, ventas(crear,ver), productos(ver), inventario(ver),
-- compras(no), clientes(ver+gestionar), caja propia, gastos(no), devoluciones(crear),
-- reportes(ver); inventario: productos(ver), inventario total, compras(ver);
-- auditor: lectura + reportes + auditoría; cliente: nada operativo.
with m(rol, permiso) as (values
  -- admin: todo
  ('admin','dashboard.ver'),('admin','pos.operar'),('admin','ventas.ver'),('admin','ventas.crear'),
  ('admin','ventas.anular'),('admin','ventas.exportar'),('admin','productos.ver'),
  ('admin','productos.gestionar'),('admin','categorias.gestionar'),('admin','inventario.ver'),
  ('admin','inventario.ajustar'),('admin','inventario.aprobar'),('admin','compras.ver'),
  ('admin','compras.gestionar'),('admin','proveedores.gestionar'),('admin','clientes.ver'),
  ('admin','clientes.gestionar'),('admin','caja.operar'),('admin','caja.cerrar'),
  ('admin','caja.cerrar_ajena'),('admin','gastos.gestionar'),('admin','devoluciones.crear'),
  ('admin','devoluciones.aprobar'),('admin','reclamos.gestionar'),('admin','usuarios.gestionar'),
  ('admin','roles.gestionar'),('admin','reportes.ver'),('admin','reportes.exportar'),
  ('admin','auditoria.ver'),('admin','configuracion.gestionar'),
  -- encargado
  ('encargado','dashboard.ver'),('encargado','pos.operar'),('encargado','ventas.ver'),
  ('encargado','ventas.crear'),('encargado','ventas.anular'),('encargado','ventas.exportar'),
  ('encargado','productos.ver'),('encargado','productos.gestionar'),('encargado','categorias.gestionar'),
  ('encargado','inventario.ver'),('encargado','inventario.ajustar'),('encargado','inventario.aprobar'),
  ('encargado','compras.ver'),('encargado','compras.gestionar'),('encargado','proveedores.gestionar'),
  ('encargado','clientes.ver'),('encargado','clientes.gestionar'),('encargado','caja.operar'),
  ('encargado','caja.cerrar'),('encargado','caja.cerrar_ajena'),('encargado','gastos.gestionar'),
  ('encargado','devoluciones.crear'),('encargado','devoluciones.aprobar'),('encargado','reclamos.gestionar'),
  ('encargado','reportes.ver'),
  -- vendedor
  ('vendedor','dashboard.ver'),('vendedor','pos.operar'),('vendedor','ventas.ver'),
  ('vendedor','ventas.crear'),('vendedor','productos.ver'),('vendedor','inventario.ver'),
  ('vendedor','clientes.ver'),('vendedor','clientes.gestionar'),('vendedor','caja.operar'),
  ('vendedor','caja.cerrar'),('vendedor','devoluciones.crear'),('vendedor','reportes.ver'),
  -- inventario
  ('inventario','dashboard.ver'),('inventario','productos.ver'),('inventario','inventario.ver'),
  ('inventario','inventario.ajustar'),('inventario','compras.ver'),('inventario','reportes.ver'),
  -- auditor
  ('auditor','dashboard.ver'),('auditor','ventas.ver'),('auditor','ventas.exportar'),
  ('auditor','productos.ver'),('auditor','inventario.ver'),('auditor','compras.ver'),
  ('auditor','clientes.ver'),('auditor','reportes.ver'),('auditor','reportes.exportar'),
  ('auditor','auditoria.ver')
)
insert into rol_permisos (rol_id, permiso_id)
select r.id, p.id from m
join roles r on r.nombre = m.rol
join permisos p on p.codigo = m.permiso;
