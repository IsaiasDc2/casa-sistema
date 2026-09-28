# Casa Isaias — POS

Sistema de punto de venta y gestión comercial. FASE 1: base de datos,
arquitectura y scaffold del cliente.

## Estructura

```
casa-isaias/
├── supabase/
│   ├── migrations/   # 001 → 013, aplicar en orden
│   ├── tests/        # shim_local.sql (solo Docker) + fase1.sql
│   └── README.md     # cómo aplicar y crear el admin
└── client/           # React + Vite (puerto 5174)
    └── src/
        ├── app/          # (FASE 2: providers, query client)
        ├── lib/          # supabase.js, formato.js
        ├── routes/       # RequireAuth, RequirePermiso
        ├── styles/       # tokens + base
        ├── components/ui # (FASE 2+: Button, Modal, Table…)
        ├── features/     # un módulo por fase (auth, pos, products…)
        └── App.jsx / main.jsx
```

## Estado por fase

- [x] FASE 1 — DB, funciones transaccionales, RLS, scaffold
- [ ] FASE 2 — Autenticación y roles (menú por permiso, gestión usuarios)
- [ ] FASE 3 — Productos y categorías
- [ ] FASE 4 — Inventario
- [ ] FASE 5 — Clientes y proveedores (+ CC)
- [ ] FASE 6 — Compras
- [ ] FASE 7 — Caja
- [ ] FASE 8 — POS y ventas
- [ ] FASE 9 — Devoluciones y gastos
- [ ] FASE 10 — Reportes
- [ ] FASE 11 — Auditoría y hardening
- [ ] FASE 12 — Producción

## Desarrollo

```bash
# 1. Aplicar migraciones en Supabase (ver supabase/README.md)
# 2. Cliente:
cd client
cp .env.example .env   # completar URL y anon key
npm install
npm run dev            # http://localhost:5174
```

## Decisiones de diseño (resumen)

- Turnos de caja unificados (apertura+cierre en una fila).
- Categorías auto-referenciadas (N niveles, no solo 2).
- Cuentas corrientes unificadas cliente/proveedor.
- Devoluciones unificadas con CHECK de referencia única.
- Ventas en `borrador` hasta confirmar; el número se asigna al pagar.
- Precios tomados de DB en el servidor (el cliente no fija precios).
- Escrituras críticas solo vía RPC (`SECURITY DEFINER`); RLS niega el resto.
- Auditoría inmutable (sin policies de UPDATE/DELETE, ni para admin).
