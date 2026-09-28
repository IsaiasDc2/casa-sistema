# Supabase — Casa Isaias (FASE 1)

## Aplicar migraciones

Opción A — Dashboard: pegar cada archivo de `migrations/` en orden
(`001` → `013`) en el SQL Editor y ejecutar.

Opción B — Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Primer usuario administrador

1. En `Authentication → Users`, crear el usuario con el email elegido.
2. Antes, poner ese email en `configuracion.bootstrap_admin_email`:
   ```sql
   update configuracion set valor = 'admin@casaisaias.com'
   where clave = 'bootstrap.admin_email';
   ```
3. Al registrarse, el trigger `handle_new_user` le asigna rol `admin`.
4. Vaciar el bootstrap después:
   ```sql
   update configuracion set valor = '' where clave = 'bootstrap.admin_email';
   ```

## Verificación local (Docker)

```bash
docker run -d --name pg-casa-isaias -e POSTGRES_PASSWORD=pos -p 5433:5432 postgres:16
for f in supabase/tests/shim_local.sql supabase/migrations/*.sql supabase/tests/fase1.sql; do
  docker exec -i pg-casa-isaias psql -U postgres -f - < "$f"
done
```

`shim_local.sql` simula `auth.uid()` y es **solo local**: nunca aplicarlo
en Supabase. `fase1.sql` ejecuta el ciclo venta → stock → caja →
anulación → cierre y dos casos negativos (sin stock, pagos inconsistentes).
