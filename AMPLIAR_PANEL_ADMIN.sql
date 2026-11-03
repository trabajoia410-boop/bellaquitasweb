-- Bellaquitas Fest — ampliación del panel administrador.
-- Compatible con el SQL original. Ejecutar en Supabase SQL Editor con permisos de propietario.
-- No introduce cuentas ni contenido de ejemplo. Es idempotente.

alter table public.events add column if not exists start_time time;
alter table public.events add column if not exists image_url text not null default '';
alter table public.rewards add column if not exists image_url text not null default '';

-- Textos públicos editables; una única configuración, que se crea al pulsar Guardar.
create table if not exists public.site_content (
 key text primary key check (key = 'homepage'),
 hero_text text not null check (length(hero_text) between 10 and 400),
 announcement text not null check (length(announcement) between 1 and 160),
 updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
drop policy if exists "public_site_content_read" on public.site_content;
create policy "public_site_content_read" on public.site_content
for select to anon,authenticated using (true);
drop policy if exists "admin_site_content_insert" on public.site_content;
create policy "admin_site_content_insert" on public.site_content
for insert to authenticated with check (public.is_admin());
drop policy if exists "admin_site_content_update" on public.site_content;
create policy "admin_site_content_update" on public.site_content
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Permite borrar contenido desde el panel. Los premios con canjes históricos
-- NO se podrán borrar porque la referencia del canje los protege.
drop policy if exists "admin_events_delete" on public.events;
create policy "admin_events_delete" on public.events for delete to authenticated using (public.is_admin());
drop policy if exists "admin_rewards_delete" on public.rewards;
create policy "admin_rewards_delete" on public.rewards for delete to authenticated using (public.is_admin());
drop policy if exists "admin_promos_delete" on public.promos;
create policy "admin_promos_delete" on public.promos for delete to authenticated using (public.is_admin());

grant select on public.site_content to anon,authenticated;
grant insert,update on public.site_content to authenticated;
grant delete on public.events,public.rewards,public.promos to authenticated;

-- Carpeta pública de imágenes (solo administradores pueden subir o borrar).
-- Las fotos de eventos/premios son visibles en internet: no subir datos privados.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('bellaquitas-media','bellaquitas-media',true,5242880,
        array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public=true,file_size_limit=5242880,
 allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];

drop policy if exists "bellaquitas_admin_upload" on storage.objects;
create policy "bellaquitas_admin_upload" on storage.objects for insert to authenticated
with check (bucket_id='bellaquitas-media' and public.is_admin());
drop policy if exists "bellaquitas_admin_remove" on storage.objects;
create policy "bellaquitas_admin_remove" on storage.objects for delete to authenticated
using (bucket_id='bellaquitas-media' and public.is_admin());

-- La web existente seguirá funcionando; esta ampliación NO modifica los usuarios existentes.