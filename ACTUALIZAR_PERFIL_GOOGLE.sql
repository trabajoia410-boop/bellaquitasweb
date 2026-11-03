-- Solo para proyectos que ya ejecutaron supabase.sql antes de añadir Google.
-- No crea usuarios, no borra cuentas y respeta los perfiles existentes.
-- Utiliza el nombre real ofrecido por Google para las altas nuevas.
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