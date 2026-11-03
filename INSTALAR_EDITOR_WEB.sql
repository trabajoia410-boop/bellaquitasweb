-- Instalar DESPUÉS de supabase.sql (o después de AMPLIAR_PANEL_ADMIN.sql).
-- Mantiene todas las cuentas y contenidos reales. No inserta ningún dato de ejemplo.
-- Ejecutar una sola vez; también se puede volver a ejecutar sin borrar datos.

-- Contenido que ve todo el mundo. Los permisos de administrador ya están en supabase.sql.
alter table public.site_content add column if not exists page_settings jsonb not null default '{}'::jsonb;

-- El borrador se almacena POR SEPARADO y NUNCA se publica ni se consulta desde anon.
create table if not exists public.site_drafts (
  key text primary key check (key='homepage'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
  updated_at timestamptz not null default now()
);
alter table public.site_drafts enable row level security;

drop policy if exists "editor_select_drafts" on public.site_drafts;
create policy "editor_select_drafts" on public.site_drafts for select to authenticated
using (public.is_admin());
drop policy if exists "editor_insert_drafts" on public.site_drafts;
create policy "editor_insert_drafts" on public.site_drafts for insert to authenticated
with check (public.is_admin());
drop policy if exists "editor_update_drafts" on public.site_drafts;
create policy "editor_update_drafts" on public.site_drafts for update to authenticated
using (public.is_admin()) with check (public.is_admin());

revoke all on public.site_drafts from anon, authenticated;
grant select,insert,update on public.site_drafts to authenticated;

-- Publicar modificaciones en site_content sigue protegido por su política
-- admin_site_content_insert / admin_site_content_update.
-- Los datos anteriores hero_text y announcement permanecen intactos.