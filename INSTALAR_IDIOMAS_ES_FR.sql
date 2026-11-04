-- Bellaquitas Fest: contenido independiente en español y francés.
-- Seguro para instalaciones existentes: columnas aditivas, sin eliminar datos.
alter table public.events add column if not exists localized_content jsonb not null default '{}'::jsonb;
alter table public.rewards add column if not exists localized_content jsonb not null default '{}'::jsonb;
alter table public.promos add column if not exists localized_content jsonb not null default '{}'::jsonb;
comment on column public.events.localized_content is 'Campos localizados por idioma; p.ej. {"fr":{"name":"...","description":"...","location":"..."}}';
comment on column public.rewards.localized_content is 'Campos localizados por idioma; p.ej. {"fr":{"name":"...","description":"...","category":"..."}}';
comment on column public.promos.localized_content is 'Campos localizados por idioma; p.ej. {"fr":{"name":"...","description":"..."}}';
