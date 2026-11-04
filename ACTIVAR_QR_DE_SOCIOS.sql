-- Bellaquitas Fest — QR para todos los roles reales (socio, puerta, admin).
-- Esta migración no inserta cuentas, visitas ni puntos. Solo corrige la validación de tarjetas.
-- Un trabajador NO puede escanear su propia tarjeta; otro usuario autorizado debe validarla.
create or replace function public.register_visit(p_member_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
 if (select auth.uid()) is null or not public.is_staff() then
  raise exception 'Solo el personal autorizado puede registrar visitas';
 end if;
 if p_member_code is null or upper(trim(p_member_code)) !~ '^MBR-[A-Z0-9-]{5,80}$' then
  raise exception 'Código de socio no válido';
 end if;
 select id into v_user from public.profiles
 where upper(member_code)=upper(trim(p_member_code))
 for update;
 if not found then raise exception 'Tarjeta no encontrada'; end if;
 if v_user=(select auth.uid()) then
  raise exception 'No puedes validar tu propia tarjeta. Pide a otro miembro del personal que la escanee';
 end if;
 if exists(select 1 from public.activity where user_id=v_user and type='visita'
      and created_at >= date_trunc('day',now()) and created_at < date_trunc('day',now())+interval '1 day')
 then raise exception 'Esta visita ya se ha validado hoy'; end if;
 update public.profiles set points=points+10,lifetime_points=lifetime_points+10,visits=visits+1 where id=v_user;
 insert into public.activity(user_id,type,delta,detail) values(v_user,'visita',10,'Visita validada');
end $$;
revoke all on function public.register_visit(text) from public,anon;
grant execute on function public.register_visit(text) to authenticated;
