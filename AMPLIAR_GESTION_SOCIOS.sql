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