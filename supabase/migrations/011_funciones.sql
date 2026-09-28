-- FASE 1 · 011_funciones.sql
-- Helpers de rol + funciones transaccionales. Todo SECURITY DEFINER:
-- el frontend NUNCA escribe directo en ventas/stock/caja (RLS lo niega).

-- ---------- helpers ----------
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select r.nombre from profiles p join roles r on r.id = p.rol_id where p.id = auth.uid()
$$;

create or replace function public.soy_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'admin', false)
$$;

create or replace function public.tiene_permiso(p_codigo text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    join rol_permisos rp on rp.rol_id = p.rol_id
    join permisos pe on pe.id = rp.permiso_id
    where p.id = auth.uid() and pe.codigo = p_codigo
  )
$$;

-- Nadie (ni admin sobre sí mismo sin otro control) cambia roles sin permiso.
-- Backstop a nivel DB aunque RLS falle: solo admin/encargado con permiso.
create or replace function public.impedir_cambio_rol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.rol_id is distinct from new.rol_id or old.estado is distinct from new.estado then
    if not public.tiene_permiso('usuarios.gestionar') then
      raise exception 'Sin permiso para cambiar rol o estado de usuario';
    end if;
    if old.id = auth.uid() and old.rol_id is distinct from new.rol_id then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_impedir_cambio_rol on profiles;
create trigger trg_impedir_cambio_rol
  before update on profiles for each row execute function public.impedir_cambio_rol();

-- ---------- secuencias ----------
create or replace function public.siguiente_comprobante(p_tipo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_pv int; v_num bigint; v_prefijo text;
begin
  select punto_venta, ultimo_numero + 1 into v_pv, v_num
  from secuencias_comprobantes where tipo = p_tipo for update;
  if not found then raise exception 'Tipo de comprobante desconocido: %', p_tipo; end if;
  update secuencias_comprobantes set ultimo_numero = v_num where tipo = p_tipo;
  v_prefijo := case p_tipo when 'venta' then 'V' when 'compra' then 'C' else 'D' end;
  return v_prefijo || '-' || lpad(v_pv::text, 4, '0') || '-' || lpad(v_num::text, 8, '0');
end; $$;

-- ---------- ventas ----------
-- Crea borrador (sin tocar stock/caja). Precios desde DB (no se confía en el cliente).
create or replace function public.crear_borrador(
  p_turno uuid, p_cliente uuid, p_vendedor uuid,
  p_descuento numeric default 0, p_items jsonb default '[]'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_suc uuid; v_sub numeric := 0; v_imp numeric := 0;
  it jsonb; v_precio numeric; v_pct numeric; v_cant numeric; v_desc numeric; v_linea numeric;
begin
  if jsonb_array_length(p_items) = 0 then raise exception 'La venta debe tener al menos un producto'; end if;
  if coalesce(p_descuento, 0) < 0 then raise exception 'Descuento inválido'; end if;

  select c.sucursal_id into v_suc from turnos_caja t
  join cajas c on c.id = t.caja_id
  where t.id = p_turno and t.estado = 'abierta';
  if not found then raise exception 'Turno inexistente o cerrado'; end if;

  if not exists (select 1 from empleados where id = p_vendedor) then
    raise exception 'Vendedor inválido';
  end if;

  insert into ventas (sucursal_id, turno_id, cliente_id, vendedor_id, descuento, estado)
  values (v_suc, p_turno, p_cliente, p_vendedor, round(p_descuento, 2), 'borrador')
  returning id into v_id;

  for it in select v from jsonb_array_elements(p_items) as e(v) loop
    v_cant := (it.v->>'cantidad')::numeric;
    v_desc := coalesce((it.v->>'descuento')::numeric, 0);
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    if v_desc < 0 then raise exception 'Descuento por ítem inválido'; end if;

    select precio_venta, impuesto_pct into v_precio, v_pct
    from productos where id = (it.v->>'producto_id')::uuid and estado = 'activo';
    if not found then raise exception 'Producto inexistente o inactivo'; end if;

    v_linea := round(v_precio * v_cant - v_desc, 2);
    if v_linea < 0 then raise exception 'El descuento supera el valor de la línea'; end if;
    v_sub := v_sub + v_linea;
    v_imp := v_imp + round(v_linea * v_pct / 100, 2);

    insert into venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal)
    values (v_id, (it.v->>'producto_id')::uuid, v_cant, v_precio, v_desc, v_linea);
  end loop;

  update ventas set
    subtotal = round(v_sub, 2),
    impuesto = round(v_imp, 2),
    total = round(v_sub - p_descuento + v_imp, 2)
  where id = v_id;

  return v_id;
end; $$;

-- Confirma borrador: valida pagos, descuenta stock, mueve caja. Todo o nada.
create or replace function public.confirmar_venta(p_venta uuid, p_pagos jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v record; v_dep uuid; v_suma numeric := 0; pg jsonb;
  it record; v_stock numeric; v_met record;
begin
  select * into v from ventas where id = p_venta for update;
  if not found then raise exception 'Venta inexistente'; end if;
  if v.estado <> 'borrador' then raise exception 'La venta ya fue procesada'; end if;
  if jsonb_array_length(p_pagos) = 0 then raise exception 'La venta debe tener al menos un pago'; end if;

  select id into v_dep from depositos
  where sucursal_id = v.sucursal_id and es_principal and activo
  order by created_at limit 1;
  if not found then raise exception 'Sucursal sin depósito principal'; end if;

  for pg in select v from jsonb_array_elements(p_pagos) as e(v) loop
    if (pg.v->>'monto')::numeric <= 0 then raise exception 'Monto de pago inválido'; end if;
    v_suma := v_suma + (pg.v->>'monto')::numeric;
  end loop;
  if abs(round(v_suma, 2) - v.total) > 0.01 then
    raise exception 'La suma de pagos (%) no coincide con el total (%)', round(v_suma, 2), v.total;
  end if;

  -- Stock con bloqueo pesimista (dos terminales no venden lo mismo)
  for it in select * from venta_items where venta_id = p_venta loop
    select cantidad into v_stock from stock
    where producto_id = it.producto_id and deposito_id = v_dep for update;
    if not found or v_stock < it.cantidad then
      raise exception 'Stock insuficiente para el producto %', it.producto_id;
    end if;
    update stock set cantidad = round(cantidad - it.cantidad, 3), updated_at = now()
    where producto_id = it.producto_id and deposito_id = v_dep;
    insert into movimientos_stock
      (producto_id, deposito_id, tipo, cantidad, stock_anterior, stock_resultante,
       usuario_id, motivo, referencia_tipo, referencia_id)
    values (it.producto_id, v_dep, 'venta', -it.cantidad, v_stock,
            round(v_stock - it.cantidad, 3), auth.uid(), 'Venta ' || v.numero, 'venta', p_venta);
  end loop;

  for pg in select v from jsonb_array_elements(p_pagos) as e(v) loop
    select * into v_met from metodos_pago
    where id = (pg.v->>'metodo_id')::uuid and activo;
    if not found then raise exception 'Método de pago inválido'; end if;
    insert into venta_pagos (venta_id, metodo_id, monto, referencia)
    values (p_venta, v_met.id, round((pg.v->>'monto')::numeric, 2), pg->>'referencia');
    insert into movimientos_caja
      (turno_id, tipo, monto, es_efectivo, descripcion, referencia_tipo, referencia_id, usuario_id)
    values (v.turno_id, 'venta', round((pg.v->>'monto')::numeric, 2), v_met.es_efectivo,
            'Venta ' || v.numero || ' (' || v_met.nombre || ')', 'venta', p_venta, auth.uid());
  end loop;

  update ventas set numero = public.siguiente_comprobante('venta'), estado = 'pagada'
  where id = p_venta;

  return p_venta;
end; $$;

-- Atajo: borrador + confirmación en una llamada.
create or replace function public.registrar_venta(
  p_turno uuid, p_cliente uuid, p_vendedor uuid,
  p_descuento numeric, p_items jsonb, p_pagos jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := public.crear_borrador(p_turno, p_cliente, p_vendedor, p_descuento, p_items);
  perform public.confirmar_venta(v_id, p_pagos);
  return v_id;
end; $$;

create or replace function public.anular_venta(p_venta uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v record; v_dep uuid; it record; v_stock numeric;
begin
  if not public.tiene_permiso('ventas.anular') then
    raise exception 'Sin permiso para anular ventas';
  end if;
  select * into v from ventas where id = p_venta for update;
  if not found then raise exception 'Venta inexistente'; end if;
  if v.estado <> 'pagada' then raise exception 'Solo se pueden anular ventas pagadas'; end if;

  select id into v_dep from depositos
  where sucursal_id = v.sucursal_id and es_principal and activo
  order by created_at limit 1;

  for it in select * from venta_items where venta_id = p_venta loop
    select cantidad into v_stock from stock
    where producto_id = it.producto_id and deposito_id = v_dep for update;
    update stock set cantidad = round(cantidad + it.cantidad, 3), updated_at = now()
    where producto_id = it.producto_id and deposito_id = v_dep;
    insert into movimientos_stock
      (producto_id, deposito_id, tipo, cantidad, stock_anterior, stock_resultante,
       usuario_id, motivo, referencia_tipo, referencia_id)
    values (it.producto_id, v_dep, 'anulacion_venta', it.cantidad, v_stock,
            round(v_stock + it.cantidad, 3), auth.uid(), 'Anulación ' || v.numero, 'venta', p_venta);
  end loop;

  insert into movimientos_caja
    (turno_id, tipo, monto, es_efectivo, descripcion, referencia_tipo, referencia_id, usuario_id)
  select v.turno_id, 'devolucion', -vp.monto, m.es_efectivo,
         'Anulación ' || v.numero, 'venta', p_venta, auth.uid()
  from venta_pagos vp join metodos_pago m on m.id = vp.metodo_id
  where vp.venta_id = p_venta;

  update ventas set estado = 'anulada', motivo_anulacion = p_motivo where id = p_venta;
end; $$;

-- ---------- caja ----------
create or replace function public.abrir_turno(p_caja uuid, p_monto numeric)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.tiene_permiso('caja.operar') then
    raise exception 'Sin permiso para operar caja';
  end if;
  if coalesce(p_monto, 0) < 0 then raise exception 'Monto inicial inválido'; end if;
  if not exists (select 1 from cajas where id = p_caja and activa) then
    raise exception 'Caja inexistente o inactiva';
  end if;
  insert into turnos_caja (caja_id, usuario_apertura, monto_inicial)
  values (p_caja, auth.uid(), round(p_monto, 2))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'La caja ya tiene un turno abierto';
end; $$;

create or replace function public.cerrar_turno(p_turno uuid, p_contado numeric, p_obs text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t record; v_ventas numeric := 0; v_ing numeric := 0; v_egr numeric := 0;
  v_dev numeric := 0; v_esp numeric; v_dif numeric;
begin
  select * into t from turnos_caja where id = p_turno for update;
  if not found then raise exception 'Turno inexistente'; end if;
  if t.estado <> 'abierta' then raise exception 'El turno ya está cerrado'; end if;
  if t.usuario_apertura <> auth.uid() and not public.tiene_permiso('caja.cerrar_ajena') then
    raise exception 'Solo el responsable o un superior puede cerrar este turno';
  end if;
  if coalesce(p_contado, -1) < 0 then raise exception 'Monto contado inválido'; end if;

  select coalesce(sum(monto), 0) into v_ventas from movimientos_caja
  where turno_id = p_turno and tipo = 'venta';
  select coalesce(sum(monto), 0) into v_ing from movimientos_caja
  where turno_id = p_turno and tipo in ('ingreso','deposito') and es_efectivo;
  select coalesce(sum(monto), 0) into v_egr from movimientos_caja
  where turno_id = p_turno and tipo in ('egreso','gasto','retiro') and es_efectivo;
  select coalesce(sum(monto), 0) into v_dev from movimientos_caja
  where turno_id = p_turno and tipo = 'devolucion' and es_efectivo;

  v_esp := round(t.monto_inicial + v_ventas + v_ing - v_egr - v_dev, 2);
  v_dif := round(p_contado - v_esp, 2);

  update turnos_caja set
    usuario_cierre = auth.uid(), fecha_cierre = now(),
    total_ventas = v_ventas, total_ingresos = v_ing,
    total_egresos = v_egr, total_devoluciones = v_dev,
    efectivo_esperado = v_esp, efectivo_contado = round(p_contado, 2),
    diferencia = v_dif, estado = 'cerrada', observaciones = p_obs
  where id = p_turno;

  return jsonb_build_object('esperado', v_esp, 'contado', round(p_contado, 2), 'diferencia', v_dif);
end; $$;

-- ---------- cuentas corrientes ----------
create or replace function public.registrar_movimiento_cc(
  p_cuenta uuid, p_tipo text, p_monto numeric, p_concepto text,
  p_ref_tipo text default null, p_ref_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_signo int;
begin
  if p_tipo not in ('cargo','pago') then raise exception 'Tipo inválido'; end if;
  if p_monto <= 0 then raise exception 'Monto inválido'; end if;
  if not public.tiene_permiso('clientes.gestionar') and
     not public.tiene_permiso('compras.gestionar') then
    raise exception 'Sin permiso para mover cuentas corrientes';
  end if;

  insert into movimientos_cc
    (cuenta_id, tipo, monto, concepto, referencia_tipo, referencia_id, usuario_id)
  values (p_cuenta, p_tipo, round(p_monto, 2), p_concepto, p_ref_tipo, p_ref_id, auth.uid());

  -- cargo suma saldo a favor del negocio, pago lo reduce
  v_signo := case when p_tipo = 'cargo' then 1 else -1 end;
  update cuentas_corrientes
  set saldo = round(saldo + v_signo * p_monto, 2)
  where id = p_cuenta;
end; $$;

create or replace function public.registrar_gasto(
  p_turno uuid, p_categoria uuid, p_descripcion text, p_monto numeric, p_metodo uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ef boolean;
begin
  if not public.tiene_permiso('gastos.gestionar') then
    raise exception 'Sin permiso para registrar gastos';
  end if;
  if p_monto <= 0 then raise exception 'Monto inválido'; end if;
  if not exists (select 1 from turnos_caja where id = p_turno and estado = 'abierta') then
    raise exception 'Turno inexistente o cerrado';
  end if;
  select es_efectivo into v_ef from metodos_pago where id = p_metodo and activo;
  if not found then raise exception 'Método de pago inválido'; end if;

  insert into gastos (categoria_id, descripcion, monto, metodo_id, turno_id, usuario_id)
  values (p_categoria, p_descripcion, round(p_monto, 2), p_metodo, p_turno, auth.uid())
  returning id into v_id;

  insert into movimientos_caja
    (turno_id, tipo, monto, es_efectivo, descripcion, referencia_tipo, referencia_id, usuario_id)
  values (p_turno, 'gasto', round(p_monto, 2), v_ef, p_descripcion, 'gasto', v_id, auth.uid());
  return v_id;
end; $$;

-- ---------- inventario y compras ----------
create or replace function public.ajustar_stock(
  p_producto uuid, p_deposito uuid, p_nueva_cantidad numeric, p_motivo text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_ant numeric;
begin
  if not public.tiene_permiso('inventario.ajustar') then
    raise exception 'Sin permiso para ajustar stock';
  end if;
  if p_nueva_cantidad < 0 then raise exception 'Stock inválido'; end if;
  if p_motivo is null or p_motivo = '' then raise exception 'El ajuste requiere motivo'; end if;

  select cantidad into v_ant from stock
  where producto_id = p_producto and deposito_id = p_deposito for update;
  if not found then raise exception 'Sin registro de stock'; end if;
  if v_ant = p_nueva_cantidad then return; end if;

  update stock set cantidad = round(p_nueva_cantidad, 3), updated_at = now()
  where producto_id = p_producto and deposito_id = p_deposito;

  insert into movimientos_stock
    (producto_id, deposito_id, tipo, cantidad, stock_anterior, stock_resultante,
     usuario_id, motivo, referencia_tipo)
  values (p_producto, p_deposito, 'ajuste', round(p_nueva_cantidad - v_ant, 3),
          v_ant, round(p_nueva_cantidad, 3), auth.uid(), p_motivo, 'ajuste');
end; $$;

create or replace function public.recibir_compra(
  p_compra uuid, p_deposito uuid, p_items jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  c record; it jsonb; v_pid uuid; v_cant numeric; v_fila record; v_stock numeric;
  v_total_pedida numeric := 0; v_total_recibida numeric := 0;
begin
  if not public.tiene_permiso('compras.gestionar') then
    raise exception 'Sin permiso para recibir compras';
  end if;
  select * into c from compras where id = p_compra for update;
  if not found then raise exception 'Compra inexistente'; end if;
  if c.estado not in ('pendiente','parcialmente_recibida') then
    raise exception 'La compra no admite recepción (estado: %)', c.estado;
  end if;

  for it in select v from jsonb_array_elements(p_items) as e(v) loop
    v_pid := (it.v->>'producto_id')::uuid;
    v_cant := (it.v->>'cantidad')::numeric;
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;

    select * into v_fila from compra_items
    where compra_id = p_compra and producto_id = v_pid for update;
    if not found then raise exception 'El producto no está en la orden'; end if;
    if v_fila.cantidad_recibida + v_cant > v_fila.cantidad then
      raise exception 'Se recibe más de lo pedido';
    end if;

    update compra_items
    set cantidad_recibida = round(cantidad_recibida + v_cant, 3)
    where id = v_fila.id;

    select cantidad into v_stock from stock
    where producto_id = v_pid and deposito_id = p_deposito for update;
    update stock set cantidad = round(cantidad + v_cant, 3), updated_at = now()
    where producto_id = v_pid and deposito_id = p_deposito;

    insert into movimientos_stock
      (producto_id, deposito_id, tipo, cantidad, stock_anterior, stock_resultante,
       usuario_id, motivo, referencia_tipo, referencia_id)
    values (v_pid, p_deposito, 'compra', v_cant, v_stock,
            round(v_stock + v_cant, 3), auth.uid(), 'Recepción ' || c.numero, 'compra', p_compra);
  end loop;

  select coalesce(sum(cantidad), 0), coalesce(sum(cantidad_recibida), 0)
  into v_total_pedida, v_total_recibida from compra_items where compra_id = p_compra;

  update compras set estado = case
    when v_total_recibida >= v_total_pedida then 'recibida'::text
    else 'parcialmente_recibida'::text end,
    updated_at = now()
  where id = p_compra;
end; $$;

-- ---------- devoluciones ----------
create or replace function public.procesar_devolucion(p_devolucion uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d record; it record; v_dep uuid; v_stock numeric; v_suc uuid;
begin
  if not public.tiene_permiso('devoluciones.aprobar') then
    raise exception 'Sin permiso para procesar devoluciones';
  end if;
  select * into d from devoluciones where id = p_devolucion for update;
  if not found then raise exception 'Devolución inexistente'; end if;
  if d.estado <> 'aprobada' then raise exception 'La devolución debe estar aprobada'; end if;

  if d.tipo = 'cliente' then
    select sucursal_id into v_suc from ventas where id = d.venta_id;
    select id into v_dep from depositos
    where sucursal_id = v_suc and es_principal and activo order by created_at limit 1;
  end if;

  for it in select * from devolucion_items where devolucion_id = p_devolucion loop
    if d.tipo = 'cliente' and d.reingresa_stock then
      select cantidad into v_stock from stock
      where producto_id = it.producto_id and deposito_id = v_dep for update;
      update stock set cantidad = round(cantidad + it.cantidad, 3), updated_at = now()
      where producto_id = it.producto_id and deposito_id = v_dep;
      insert into movimientos_stock
        (producto_id, deposito_id, tipo, cantidad, stock_anterior, stock_resultante,
         usuario_id, motivo, referencia_tipo, referencia_id)
      values (it.producto_id, v_dep, 'devolucion_cliente', it.cantidad, v_stock,
              round(v_stock + it.cantidad, 3), auth.uid(), 'Devolución ' || d.numero, 'devolucion', p_devolucion);
    elsif d.tipo = 'proveedor' then
      -- sale del depósito principal de la primera sucursal (documentar si hay más)
      select id into v_dep from depositos where es_principal and activo order by created_at limit 1;
      select cantidad into v_stock from stock
      where producto_id = it.producto_id and deposito_id = v_dep for update;
      if v_stock < it.cantidad then raise exception 'Stock insuficiente para devolver al proveedor'; end if;
      update stock set cantidad = round(cantidad - it.cantidad, 3), updated_at = now()
      where producto_id = it.producto_id and deposito_id = v_dep;
      insert into movimientos_stock
        (producto_id, deposito_id, tipo, cantidad, stock_anterior, stock_resultante,
         usuario_id, motivo, referencia_tipo, referencia_id)
      values (it.producto_id, v_dep, 'devolucion_proveedor', -it.cantidad, v_stock,
              round(v_stock - it.cantidad, 3), auth.uid(), 'Devolución ' || d.numero, 'devolucion', p_devolucion);
    end if;
  end loop;

  if d.reintegro_monto > 0 then
    if d.turno_id is null then raise exception 'El reintegro exige turno de caja'; end if;
    insert into movimientos_caja
      (turno_id, tipo, monto, es_efectivo, descripcion, referencia_tipo, referencia_id, usuario_id)
    values (d.turno_id, 'devolucion', round(d.reintegro_monto, 2), true,
            'Reintegro ' || d.numero, 'devolucion', p_devolucion, auth.uid());
  end if;

  update devoluciones
  set estado = 'procesada', procesa_id = auth.uid()
  where id = p_devolucion;

  -- Estado de la venta según cobertura de la devolución
  if d.tipo = 'cliente' then
    update ventas v set estado = (
      select case when bool_and(cub.cubierta) then 'devuelta' else 'parcialmente_devuelta' end
      from (
        select vi.producto_id,
               sum(vi.cantidad) <= coalesce(sum(di.cantidad), 0) as cubierta
        from venta_items vi
        left join devolucion_items di on di.producto_id = vi.producto_id
          and di.devolucion_id in (
            select id from devoluciones
            where venta_id = d.venta_id and estado = 'procesada')
        where vi.venta_id = d.venta_id
        group by vi.producto_id
      ) cub
    )
    where v.id = d.venta_id;
  end if;
end; $$;
