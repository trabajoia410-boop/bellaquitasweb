-- Bellaquitas staging: el bucket R2 fue eliminado el 13/11/2026.
-- Revertir ÚNICAMENTE enlaces a las tres imágenes originales públicas,
-- que siguen disponibles en Supabase Storage.
-- Aplicado a D1 staging 13/11/2026; script idempotente y documentado
-- para reconstruir un entorno nuevo desde la base original.
-- No modificar tablas profiles, activity, points, visits, auth ni Supabase.
UPDATE site_content SET page_settings=replace(
  page_settings,
  '/v1/assets/logos/',
  'https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/logos/'
) WHERE instr(page_settings,'/v1/assets/logos/')>0;
UPDATE site_drafts SET settings=replace(
  settings,
  '/v1/assets/logos/',
  'https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/logos/'
) WHERE instr(settings,'/v1/assets/logos/')>0;
