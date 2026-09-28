# Pruebas manuales FASE 2

Requiere migraciones aplicadas + bootstrap de admin (ver supabase/README.md).

## Registro y roles

1. `/registro` con email normal → crea cuenta; en `profiles` nace con rol
   `vendedor` y sin empleado.
2. `/registro` con el email de `bootstrap.admin_email` → nace `admin`.
3. Vaciar el bootstrap y verificar que un tercer registro nace `vendedor`.

## Matriz aplicada

4. Como vendedor: el menú muestra POS, Productos, Caja, Clientes, Reportes.
   `/app/admin/usuarios` muestra "Sin permiso".
5. Como admin: el menú muestra Usuarios; cambiar el rol de otro usuario
   funciona; intentar cambiar el propio rol falla con
   "No puedes cambiar tu propio rol" (trigger, ni por SQL directo).
6. Bloquear un usuario (estado `bloqueado`): aunque conserve sesión,
   el menú queda vacío y ve la pantalla de cuenta bloqueada
   (`mi_rol()` devuelve NULL).

## Intento de escalada (SQL Editor como usuario no admin)

```sql
-- debe fallar por RLS + trigger:
update profiles set rol_id = (select id from roles where nombre='admin')
where id = auth.uid();
```
