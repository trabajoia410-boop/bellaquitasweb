-- Seguridad de puerta: prevenir autoaprobación y registrar al personal.
-- Re-ejecutable, no elimina datos ni modifica registros existentes.
BEGIN;
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.register_visit(p_member_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid; v_staff uuid := (select auth.uid());
begin
 if v_staff is null or not public.is_staff() then
  raise exception 'Solo el personal autorizado puede registrar visitas';
 end if;
 if p_member_code is null or upper(trim(p_member_code)) !~ '^MBR-[A-Z0-9-]{5,80}$' then
  raise exception 'Código de socio no válido';
 end if;
 select id into v_user from public.profiles
 where upper(member_code)=upper(trim(p_member_code)) for update;
 if not found then raise exception 'Tarjeta no encontrada'; end if;
 if v_user=v_staff then
  raise exception 'No puedes validar tu propia tarjeta. Pide a otro miembro del personal que la escanee';
 end if;
 if exists(select 1 from public.activity where user_id=v_user and type='visita'
   and created_at >= date_trunc('day',now()) and created_at < date_trunc('day',now())+interval '1 day')
 then raise exception 'Esta visita ya se ha validado hoy'; end if;
 update public.profiles set points=points+10,lifetime_points=lifetime_points+10,visits=visits+1 where id=v_user;
 insert into public.activity(user_id,type,delta,detail,staff_id)
 values(v_user,'visita',10,'Visita validada',v_staff);
end $function$;

CREATE OR REPLACE FUNCTION public.validate_redemption(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_user uuid; v_staff uuid := (select auth.uid());
begin
 if v_staff is null or not public.is_staff() then
  raise exception 'Solo el personal autorizado puede validar canjes';
 end if;
 if p_code is null or upper(trim(p_code)) !~ '^CNJ-[A-F0-9]{10}$' then
  raise exception 'Código de canje inválido';
 end if;
 select id,user_id into v_id,v_user from public.redemptions
 where upper(code)=upper(trim(p_code)) and status='pendiente' for update;
 if not found then raise exception 'Canje no encontrado o ya validado'; end if;
 if v_user=v_staff then
  raise exception 'No puedes validar tu propio canje. Pide a otra persona autorizada que lo valide';
 end if;
 update public.redemptions set status='validado',validated_at=now(),validated_by=v_staff where id=v_id;
 insert into public.activity(user_id,type,delta,detail,staff_id)
 values(v_user,'canje_validado',0,'Canje ' || upper(trim(p_code)) || ' validado',v_staff);
end $function$;

REVOKE EXECUTE ON FUNCTION public.register_visit(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.validate_redemption(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_visit(text), public.validate_redemption(text) TO authenticated;
COMMIT;
