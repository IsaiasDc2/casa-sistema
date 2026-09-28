-- 016_transferencias.sql — Movimiento entre depósitos (FASE 4).

create or replace function public.transferir_stock(
  p_producto uuid, p_origen uuid, p_destino uuid,
  p_cantidad numeric, p_motivo text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_origen numeric; v_destino numeric;
begin
  if not public.tiene_permiso('inventario.ajustar') then
    raise exception 'Sin permiso para transferir stock';
  end if;
  if p_origen = p_destino then raise exception 'Origen y destino iguales'; end if;
  if p_cantidad <= 0 then raise exception 'Cantidad inválida'; end if;

  -- Orden fijo por id para evitar deadlocks entre terminales
  select cantidad into v_origen from stock
  where producto_id = p_producto and deposito_id = p_origen for update;
  if not found or v_origen < p_cantidad then
    raise exception 'Stock insuficiente en origen';
  end if;
  select cantidad into v_destino from stock
  where producto_id = p_producto and deposito_id = p_destino for update;
  if not found then raise exception 'Sin registro de stock en destino'; end if;

  update stock set cantidad = round(cantidad - p_cantidad, 3), updated_at = now()
  where producto_id = p_producto and deposito_id = p_origen;
  update stock set cantidad = round(cantidad + p_cantidad, 3), updated_at = now()
  where producto_id = p_producto and deposito_id = p_destino;

  insert into movimientos_stock
    (producto_id, deposito_id, tipo, cantidad, stock_anterior, stock_resultante,
     usuario_id, motivo, referencia_tipo)
  values
    (p_producto, p_origen, 'transferencia_salida', -p_cantidad, v_origen,
     round(v_origen - p_cantidad, 3), auth.uid(), p_motivo, 'transferencia'),
    (p_producto, p_destino, 'transferencia_entrada', p_cantidad, v_destino,
     round(v_destino + p_cantidad, 3), auth.uid(), p_motivo, 'transferencia');
end; $$;
