-- 2026-11-19 · Readable Session URLs: /sessions/icp-focuser instead of /sessions/<id>.
-- Paste into the Neon SQL Editor and run once, BEFORE the code that uses it deploys
-- (the new code reads this column). Old /sessions/<id> links keep working and
-- redirect to the new URL.

ALTER TABLE "LibraryTraining" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "LibraryTraining_slug_key" ON "LibraryTraining"("slug");

UPDATE "LibraryTraining" AS t SET slug = v.slug
FROM (VALUES
  ('c0d7ddf31e0dcb5d45b56a068', 'icp-to-close'),
  ('c61d0c8582b4918cf39fe301e', 'irresistible-offers'),
  ('cd1c05981df84904339be021a', 'linkedin-network'),
  ('cfbadbd39cfc2eccc02042039', 'icp-focuser'),
  ('cmwaz4e7z0000coe6nua24mlk', 'double-your-leads'),
  ('cmwaz4exz0005coe6cmepudqf', 'linkedin-engine'),
  ('cmwaz4fdl0009coe6sx7n9r8q', 'rock-discovery-calls'),
  ('cmwazeecc0000nte6gr4d5zdv', 'strategy-calls'),
  ('cmwaz4fsp000ecoe6mvs4iqwp', 'website-funnel'),
  ('c509a05addfe76ab2c5e670aa', 'leads-by-christmas'),
  ('c31ea5a09575e24e05ed2bfca', 'agency-business-model')
) AS v(id, slug)
WHERE t.id = v.id;
