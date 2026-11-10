-- Repoint the R2-copied logos in the PRIVATE Cloudflare staging database.
-- Run ONLY after all three files are verified present in bellaquitas-media-staging.
-- Do not execute on Supabase production. This rewrites D1 staging content only.
UPDATE site_content
SET page_settings=replace(
  page_settings,
  'https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/logos/',
  '/v1/assets/logos/'
)
WHERE instr(page_settings,
  'https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/logos/')>0;
UPDATE site_drafts
SET settings=replace(
  settings,
  'https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/logos/',
  '/v1/assets/logos/'
)
WHERE instr(settings,
  'https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/logos/')>0;
