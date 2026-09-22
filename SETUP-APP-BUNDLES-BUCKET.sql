-- ============================================
-- Supabase Storage Setup for Live App Updates
-- ============================================
--
-- Holds the over-the-air web bundles for the Android POS, plus one manifest per
-- channel telling the backend which bundle is current. See
-- scripts/release-android.mjs and apps/backend/src/routes/appUpdates.ts.
--
-- Public on purpose. The updater on the Sunmi has no Supabase session, and the
-- contents are the same compiled JS that already ships inside the APK - nothing in
-- a bundle is secret. Writes stay restricted to the service role, which only the
-- release script holds.
--
-- Idempotent: safe to run more than once.
--
-- Run it in the Supabase SQL editor, or:
--   psql "$DIRECT_URL" -f SETUP-APP-BUNDLES-BUCKET.sql
-- ============================================

-- Bundles are ~500 KiB today; 50 MiB leaves room without letting a runaway upload
-- eat the storage quota
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-bundles',
  'app-bundles',
  true,
  52428800,
  ARRAY['application/zip', 'application/json']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anyone may read: this is how the tills download a bundle
DROP POLICY IF EXISTS "App bundles are publicly readable" ON storage.objects;
CREATE POLICY "App bundles are publicly readable"
ON storage.objects FOR SELECT
USING ( bucket_id = 'app-bundles' );

-- Nothing else is granted, so writes fall to the service role alone, which bypasses
-- RLS. Staff logins deliberately cannot publish a release.
