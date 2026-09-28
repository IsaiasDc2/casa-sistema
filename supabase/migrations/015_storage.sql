-- 015_storage.sql — Buckets y políticas.
-- Aplicar DESPUÉS de crear el proyecto (el esquema storage lo crea Supabase).

insert into storage.buckets (id, name, public) values
  ('productos', 'productos', true),
  ('perfiles', 'perfiles', false),
  ('reclamos', 'reclamos', false),
  ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- Productos: lectura pública, escritura con permiso.
create policy lectura_publica on storage.objects for select
  using (bucket_id = 'productos');
create policy escritura on storage.objects for insert
  with check (bucket_id = 'productos' and public.tiene_permiso('productos.gestionar'));
create policy borrado on storage.objects for delete
  using (bucket_id = 'productos' and public.tiene_permiso('productos.gestionar'));

-- Privados: el dueño (carpeta = user id) o staff según caso.
create policy lectura_propia on storage.objects for select
  using (bucket_id in ('perfiles','reclamos','comprobantes')
    and (public.es_staff() or (storage.foldername(name))[1] = auth.uid()::text));
create policy escritura_propia on storage.objects for insert
  with check (bucket_id in ('perfiles','reclamos','comprobantes')
    and (public.es_staff() or (storage.foldername(name))[1] = auth.uid()::text));

-- Convención de rutas: {bucket}/{año}/{uuid}.{ext}
-- Ej: productos/2026/3f9a….webp · reclamos/2026/<user-id>/foto.jpg
