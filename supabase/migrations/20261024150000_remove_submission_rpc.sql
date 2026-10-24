-- Deploy the TypeScript submission action before applying this migration.
-- Keep the existing cancellation function and the dashboard's observations RLS fix.
-- Inline the path check so the upload safeguard no longer depends on a function.
ALTER POLICY "Media inserts must match uploader and parent" ON public.media
WITH CHECK (
  pg_catalog.split_part(file_path, '/', 1) = auth.uid()::text
  AND pg_catalog.array_length(pg_catalog.string_to_array(file_path, '/'), 1) = 3
  AND pg_catalog.split_part(file_path, '/', 2) = COALESCE(observation_id, sighting_id, incident_id)::text
  AND pg_catalog.split_part(file_path, '/', 3) NOT IN ('', '.', '..')
  AND pg_catalog.strpos(file_path, pg_catalog.chr(92)) = 0
);
DROP FUNCTION IF EXISTS public.submit_observation_with_cleanup(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_media_path_for_parent(text, uuid);
