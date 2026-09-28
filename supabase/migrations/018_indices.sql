-- 018_indices.sql — Índices de producción (FASE 12).
-- Las PK/UNIQUE ya indexan; aquí solo lo que filtran los reportes y el POS.

create index if not exists idx_ventas_estado on ventas (estado, created_at desc);
create index if not exists idx_ventas_sucursal on ventas (sucursal_id, created_at desc);
create index if not exists idx_turnos_estado on turnos_caja (estado, caja_id);
create index if not exists idx_mov_caja_tipo on movimientos_caja (turno_id, tipo);
create index if not exists idx_devoluciones_estado on devoluciones (estado);
create index if not exists idx_reclamos_estado on reclamos (estado);
create index if not exists idx_compras_fecha on compras (created_at desc);
create index if not exists idx_stock_deposito on stock (deposito_id, cantidad);
create index if not exists idx_productos_sku_estado on productos (estado) where estado = 'activo';
create index if not exists idx_clientes_email on clientes (email);
create index if not exists idx_gastos_fecha on gastos (created_at desc);
