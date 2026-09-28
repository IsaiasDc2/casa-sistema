# FASE 12 — Puesta en producción

## Checklist

- [ ] Migraciones 001→018 aplicadas en el proyecto Supabase.
- [ ] `bootstrap.admin_email` vaciado en `configuracion`.
- [ ] Buckets de Storage creados (migración 015) con políticas activas.
- [ ] RLS verificado: pruebas de `supabase/tests/fase2-manual.md`.
- [ ] `EXPLAIN ANALYZE` en `registrar_venta` y reportes con datos reales.
- [ ] Backups: activar Point-in-Time Recovery en el plan de Supabase.
- [ ] Variables del cliente en el hosting (`VITE_SUPABASE_URL`, `VITE_API_URL`
      apuntando a la API pública o deshabilitar respaldo).
- [ ] Build de producción sin warnings propios (`npm run build`).

## Rutina diaria sugerida

1. Abrir turno con conteo inicial (foto del cajón si hay disputa).
2. Operar POS; suspender en lugar de cancelar ventas en curso.
3. Cierre con arqueo: diferencia ≠ 0 exige observación obligatoria.
4. Revisar `v_stock_bajo` y generar orden de compra.
5. Revisar auditoría semanal (FASE 11: cambios de precio y anulaciones).

## Incidentes comunes

| Síntoma | Causa probable | Acción |
|---|---|---|
| `Stock insuficiente` en venta válida | Otro turno vendió lo mismo / recepción pendiente | Verificar movimientos_stock del producto |
| Pagos no suman | Descuento global mal cargado | Revisar borrador antes de confirmar |
| Caja no abre | Turno anterior sin cerrar | Cerrar o pedir cierre ajeno (encargado) |
| Usuario sin menú | Rol sin permisos o perfil bloqueado | Admin → Usuarios |
| Diferencia de caja recurrente | Vuelto mal calculado o gasto sin registrar | Auditar movimientos del turno |

## Extensiones futuras (sin reescribir)

- Facturación fiscal: tabla `comprobantes_fiscales` + `secuencias_comprobantes`.
- Mercado Pago: fila en `metodos_pago` + guardar `referencia` en `venta_pagos`.
- Ecommerce: tablas `pedidos/envios` reutilizando productos, stock y clientes.
- Listas de precios: `lista_precios` + `producto_precios`; el POS elige lista.
