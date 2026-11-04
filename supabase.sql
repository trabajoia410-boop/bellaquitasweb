-- Bellaquitas Fest — base de datos para cuentas reales (PostgreSQL / Supabase)
-- Ejecutar una sola vez en el SQL Editor de un proyecto NUEVO.
-- Revisión de seguridad necesaria antes de utilizar información personal real en producción.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 2 and 80),
  role text not null default 'socio' check (role in ('socio','puerta','admin')),
  member_code text unique not null,
  points integer not null default 0 check (points >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  visits integer not null default 0 check (visits >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date_label text not null,
  location text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Premios',
  cost integer not null check(cost > 0),
  symbol text not null default '✦',
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bonus integer not null check(bonus > 0),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards(id),
  cost integer not null check(cost > 0),
  status text not null default 'pendiente' check(status in ('pendiente','validado','cancelado')),
  created_at timestamptz not null default now(),
  validated_at timestamptz
);
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  delta integer not null default 0,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ix_redemptions_user on public.redemptions(user_id);
create index if not exists ix_redemptions_status on public.redemptions(status);
create index if not exists ix_activity_user_date on public.activity(user_id, created_at desc);

-- Los nuevos usuarios siempre empiezan como socios; nunca se acepta un rol aportado por el navegador.
create or replace function public.create_member_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  v_name := left(trim(coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), split_part(coalesce(new.email,''),'@',1))),80);
  if length(v_name) < 2 then v_name := 'Nuevo socio'; end if;
  insert into public.profiles(id, name, role, member_code)
  values(new.id, v_name, 'socio', 'MBR-' || upper(substr(replace(new.id::text,'-',''),1,10)));
  return new;
end $$;
drop trigger if exists on_auth_user_created_bf on auth.users;
create trigger on_auth_user_created_bf after insert on auth.users
for each row execute function public.create_member_profile();

-- Solo se usan funciones definer de lectura para determinar permisos.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = (select auth.uid()) and role in ('puerta','admin'));
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.rewards enable row level security;
alter table public.promos enable row level security;
alter table public.redemptions enable row level security;
alter table public.activity enable row level security;

-- Permite reinstalar las políticas con el mismo nombre.
drop policy if exists "read_profile" on public.profiles;
create policy "read_profile" on public.profiles for select to authenticated
using (id=(select auth.uid()) or public.is_staff());
-- No se permiten escrituras directas en profiles, redemptions ni activity desde el navegador.

drop policy if exists "read_events" on public.events;
create policy "read_events" on public.events for select to anon,authenticated
using (active or public.is_admin());
drop policy if exists "admin_events_insert" on public.events;
create policy "admin_events_insert" on public.events for insert to authenticated
with check (public.is_admin());
drop policy if exists "admin_events_update" on public.events;
create policy "admin_events_update" on public.events for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read_rewards" on public.rewards;
create policy "read_rewards" on public.rewards for select to anon,authenticated
using (active or public.is_admin());
drop policy if exists "admin_rewards_insert" on public.rewards;
create policy "admin_rewards_insert" on public.rewards for insert to authenticated
with check (public.is_admin());
drop policy if exists "admin_rewards_update" on public.rewards;
create policy "admin_rewards_update" on public.rewards for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read_promos" on public.promos;
create policy "read_promos" on public.promos for select to anon,authenticated
using (active or public.is_admin());
drop policy if exists "admin_promos_insert" on public.promos;
create policy "admin_promos_insert" on public.promos for insert to authenticated
with check (public.is_admin());
drop policy if exists "admin_promos_update" on public.promos;
create policy "admin_promos_update" on public.promos for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read_redemptions" on public.redemptions;
create policy "read_redemptions" on public.redemptions for select to authenticated
using (user_id=(select auth.uid()) or public.is_staff());
drop policy if exists "read_activity" on public.activity;
create policy "read_activity" on public.activity for select to authenticated
using (user_id=(select auth.uid()) or public.is_staff());

create or replace function public.update_display_name(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null then raise exception 'Acceso requerido'; end if;
 if length(trim(p_name)) < 2 or length(trim(p_name)) > 80 then raise exception 'Nombre no válido'; end if;
 update public.profiles set name=trim(p_name) where id=(select auth.uid());
end $$;

create or replace function public.request_redemption(p_reward_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_points integer; v_cost integer; v_name text; v_code text;
begin
 v_user := (select auth.uid());
 if v_user is null then raise exception 'Acceso requerido'; end if;
 select points into v_points from public.profiles where id=v_user for update;
 if not found then raise exception 'Ficha no encontrada'; end if;
 select cost,name into v_cost,v_name from public.rewards where id=p_reward_id and active=true;
 if not found then raise exception 'Recompensa no disponible'; end if;
 if v_points < v_cost then raise exception 'Puntos insuficientes'; end if;
 v_code := 'CNJ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 update public.profiles set points=points-v_cost where id=v_user;
 insert into public.redemptions(code,user_id,reward_id,cost) values(v_code,v_user,p_reward_id,v_cost);
 insert into public.activity(user_id,type,delta,detail) values(v_user,'canje_solicitado',-v_cost,v_name);
 return v_code;
end $$;

create or replace function public.register_visit(p_member_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
 if not public.is_staff() then raise exception 'Solo el personal autorizado puede registrar visitas'; end if;
 select id into v_user from public.profiles
 where upper(member_code)=upper(trim(p_member_code)) and role='socio' for update;
 if not found then raise exception 'Socio no encontrado'; end if;
 if exists(select 1 from public.activity where user_id=v_user and type='visita'
      and created_at >= date_trunc('day',now()) and created_at < date_trunc('day',now())+interval '1 day')
 then raise exception 'Esta visita ya se ha validado hoy'; end if;
 update public.profiles set points=points+10,lifetime_points=lifetime_points+10,visits=visits+1 where id=v_user;
 insert into public.activity(user_id,type,delta,detail) values(v_user,'visita',10,'Visita validada');
end $$;

create or replace function public.validate_redemption(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid;
begin
 if not public.is_staff() then raise exception 'Solo el personal autorizado puede validar canjes'; end if;
 select id,user_id into v_id,v_user from public.redemptions
 where upper(code)=upper(trim(p_code)) and status='pendiente' for update;
 if not found then raise exception 'Canje no encontrado o ya validado'; end if;
 update public.redemptions set status='validado',validated_at=now() where id=v_id;
 insert into public.activity(user_id,type,delta,detail) values(v_user,'canje_validado',0,'Canje ' || upper(trim(p_code)) || ' validado');
end $$;

-- Permisos explícitos: ni usuarios anónimos ni socios pueden modificar balances o roles directamente.
revoke all on public.profiles,public.redemptions,public.activity from anon,authenticated;
grant select on public.profiles,public.redemptions,public.activity to authenticated;
grant select on public.events,public.rewards,public.promos to anon,authenticated;
grant insert,update on public.events,public.rewards,public.promos to authenticated;
revoke all on function public.create_member_profile() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.update_display_name(text) from public;
revoke all on function public.request_redemption(uuid) from public;
revoke all on function public.register_visit(text) from public;
revoke all on function public.validate_redemption(text) from public;
grant execute on function public.is_staff(),public.is_admin() to anon,authenticated;
grant execute on function public.update_display_name(text),public.request_redemption(uuid),public.register_visit(text),public.validate_redemption(text) to authenticated;

-- No se precargan cuentas, eventos, recompensas, promociones ni movimientos.

-- DESPUÉS de crear tu primera cuenta real, otórgale el rol admin EN EL SQL EDITOR:
-- update public.profiles set role='admin' where id = 'UUID-DE-TU-CUENTA';
-- Para un trabajador concreto: update public.profiles set role='puerta' where id='UUID-DEL-TRABAJADOR';
-- Nunca configures permisos desde código público del navegador.
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


-- Bellaquitas Fest · Gestión segura de socios por administradores.
-- Ejecutar en un proyecto existente. No modifica perfiles ni puntos actuales.
-- Aplicar también la parte final de este archivo al SQL de instalaciones nuevas.

create table if not exists public.admin_member_changes (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.profiles(id) on delete restrict,
 admin_id uuid not null references public.profiles(id) on delete restrict,
 before_data jsonb not null,
 after_data jsonb not null,
 reason text not null check (length(btrim(reason)) between 5 and 250),
 created_at timestamptz not null default now()
);
create index if not exists ix_admin_member_changes_member_date
  on public.admin_member_changes(member_id, created_at desc);
create index if not exists ix_admin_member_changes_date
  on public.admin_member_changes(created_at desc);

alter table public.admin_member_changes enable row level security;
drop policy if exists "only_admin_read_member_changes" on public.admin_member_changes;
create policy "only_admin_read_member_changes" on public.admin_member_changes
for select to authenticated using (public.is_admin());
revoke all on table public.admin_member_changes from public,anon,authenticated;
grant select on table public.admin_member_changes to authenticated;

-- Esta función es el único punto de escritura desde la web.
-- No admite cambio de ID, correo, código de socio ni contraseñas.
-- El actor se obtiene de auth.uid(), NUNCA del navegador.
create or replace function public.admin_update_member(
  p_member_id uuid,
  p_name text,
  p_role text,
  p_points integer,
  p_lifetime_points integer,
  p_visits integer,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid := (select auth.uid());
 v_member public.profiles%rowtype;
 v_new_name text := btrim(coalesce(p_name,''));
 v_new_role text := btrim(coalesce(p_role,''));
 v_reason text := btrim(coalesce(p_reason,''));
 v_lifetime integer;
 v_before jsonb;
 v_after jsonb;
begin
 if v_actor is null or not exists (
   select 1 from public.profiles where id=v_actor and role='admin'
 ) then
   raise exception 'Solo un administrador puede modificar socios' using errcode='42501';
 end if;
 if p_member_id is null then raise exception 'Selecciona una cuenta válida'; end if;
 if char_length(v_new_name) not between 2 and 80 then
   raise exception 'El nombre debe tener entre 2 y 80 caracteres';
 end if;
 if v_new_role not in ('socio','puerta','admin') then
   raise exception 'El rol seleccionado no es válido';
 end if;
 if p_points is null or p_points < 0 or p_points > 100000000
    or p_lifetime_points is null or p_lifetime_points < 0 or p_lifetime_points > 100000000
    or p_visits is null or p_visits < 0 or p_visits > 1000000 then
   raise exception 'Introduce puntos y visitas válidos (sin negativos)';
 end if;
 if char_length(v_reason) not between 5 and 250 then
   raise exception 'Explica el motivo del cambio (mínimo 5 caracteres)';
 end if;
 -- Evita perder el último administrador ante cambios simultáneos.
 perform pg_catalog.pg_advisory_xact_lock(80424, 9102);
 if not exists (select 1 from public.profiles where id=v_actor and role='admin') then
   raise exception 'Ya no tienes permisos de administración' using errcode='42501';
 end if;
 select * into v_member from public.profiles where id=p_member_id for update;
 if not found then raise exception 'La cuenta ya no existe'; end if;
 if v_member.id=v_actor and v_new_role<>'admin' then
   raise exception 'No puedes quitarte a ti mismo el acceso de administrador';
 end if;
 if v_member.role='admin' and v_new_role<>'admin' and
    (select count(*) from public.profiles where role='admin') < 2 then
   raise exception 'Debe existir al menos un administrador';
 end if;
 -- Los puntos históricos no pueden quedar por debajo del saldo actual.
 v_lifetime := greatest(p_lifetime_points,p_points);
 if v_member.name=v_new_name and v_member.role=v_new_role and
    v_member.points=p_points and v_member.lifetime_points=v_lifetime and
    v_member.visits=p_visits then
   raise exception 'No hay cambios que guardar';
 end if;
 v_before := jsonb_build_object('name',v_member.name,'role',v_member.role,
   'points',v_member.points,'lifetime_points',v_member.lifetime_points,'visits',v_member.visits);
 update public.profiles set name=v_new_name,role=v_new_role,points=p_points,
   lifetime_points=v_lifetime,visits=p_visits where id=p_member_id;
 v_after := jsonb_build_object('name',v_new_name,'role',v_new_role,
   'points',p_points,'lifetime_points',v_lifetime,'visits',p_visits);
 insert into public.admin_member_changes(member_id,admin_id,before_data,after_data,reason)
 values(p_member_id,v_actor,v_before,v_after,v_reason);
 if v_member.points<>p_points or v_member.lifetime_points<>v_lifetime then
   insert into public.activity(user_id,type,delta,detail)
   values(p_member_id,'ajuste_admin',p_points-v_member.points,
     left('Ajuste de administración: '||v_reason,400));
 end if;
 return v_after;
end $$;

revoke all on function public.admin_update_member(uuid,text,text,integer,integer,integer,text)
 from public,anon,authenticated;
grant execute on function public.admin_update_member(uuid,text,text,integer,integer,integer,text)
 to authenticated;

-- Los administradores acceden a los perfiles solo mediante SELECT con RLS;
-- ninguna cuenta del navegador recibe permisos directos de UPDATE sobre profiles.