-- Tighten the SELECT policies on storage.objects for both media buckets so
-- that a stale signed-URL or known file_path doesn't grant cross-user access.
--
-- Previously: bucket_id = '<bucket>' (any authenticated user could read any
-- file in either bucket if they knew/guessed the path).
--
-- New: delegate to public.media RLS via an EXISTS subquery. The inner SELECT
-- runs in the same security context as the caller, so the existing media
-- table policies (reporter / active slot member / admin for incidents;
-- observation owner / active slot member / admin for observations) are
-- automatically reused — single source of truth for who can read what.

DROP POLICY IF EXISTS "Users can view observation media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view incident media" ON storage.objects;

CREATE POLICY "Users can view observation media"
ON storage.objects FOR SELECT USING (
  bucket_id = 'observation-media'
  AND EXISTS (
    SELECT 1 FROM public.media m
    WHERE m.file_path = name
      AND (m.observation_id IS NOT NULL OR m.sighting_id IS NOT NULL)
  )
);

CREATE POLICY "Users can view incident media"
ON storage.objects FOR SELECT USING (
  bucket_id = 'incident-media'
  AND EXISTS (
    SELECT 1 FROM public.media m
    WHERE m.file_path = name
      AND m.incident_id IS NOT NULL
  )
);;
