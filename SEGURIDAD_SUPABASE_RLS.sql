-- Bellaquitas Fest - refuerzo RLS reproducible
-- Instalado previamente en Supabase el 4 de noviembre de 2026.
-- Idempotente: solo afecta a políticas de lectura pública y permisos de is_admin().
BEGIN;
DROP POLICY IF EXISTS read_events ON public.events;
DROP POLICY IF EXISTS read_rewards ON public.rewards;
DROP POLICY IF EXISTS read_promos ON public.promos;
DROP POLICY IF EXISTS read_public_events ON public.events;
DROP POLICY IF EXISTS read_public_rewards ON public.rewards;
DROP POLICY IF EXISTS read_public_promos ON public.promos;
DROP POLICY IF EXISTS read_admin_events ON public.events;
DROP POLICY IF EXISTS read_admin_rewards ON public.rewards;
DROP POLICY IF EXISTS read_admin_promos ON public.promos;
CREATE POLICY read_public_events ON public.events FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY read_admin_events ON public.events FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY read_public_rewards ON public.rewards FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY read_admin_rewards ON public.rewards FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY read_public_promos ON public.promos FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY read_admin_promos ON public.promos FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
COMMIT;
