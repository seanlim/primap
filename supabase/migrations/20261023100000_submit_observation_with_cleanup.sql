CREATE OR REPLACE FUNCTION public.is_media_path_for_parent(p_file_path text, p_parent_id uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO 'pg_catalog'
AS $function$
  SELECT pg_catalog.array_length(pg_catalog.string_to_array(p_file_path, '/'), 1) = 3
    AND pg_catalog.split_part(p_file_path, '/', 1)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND pg_catalog.split_part(p_file_path, '/', 2) = p_parent_id::text
    AND pg_catalog.split_part(p_file_path, '/', 3) NOT IN ('', '.', '..')
    AND pg_catalog.strpos(p_file_path, pg_catalog.chr(92)) = 0;
$function$;

-- Restrictive policies AND with the existing membership/parent permissions.
-- Service-role imports can restore legacy paths; cleanup must distrust those too.
DROP POLICY IF EXISTS "Media inserts must match uploader and parent" ON public.media;
CREATE POLICY "Media inserts must match uploader and parent"
ON public.media AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  pg_catalog.split_part(file_path, '/', 1) = auth.uid()::text
  AND public.is_media_path_for_parent(file_path, COALESCE(observation_id, sighting_id, incident_id))
);

-- Submit the draft and remove observation-level media records in one database
-- transaction. Storage objects are removed by the server action only after
-- this function has committed successfully.
CREATE OR REPLACE FUNCTION public.submit_observation_with_cleanup(
  p_observation_id uuid,
  p_walk_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_observation public.observations%ROWTYPE;
  v_file_paths text[] := ARRAY[]::text[];
  -- ECMAScript String.trim whitespace, including non-breaking spaces and BOM.
  v_trim_characters CONSTANT text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('error', 'Not authenticated');
  END IF;

  PERFORM 1
  FROM public.slot_memberships
  WHERE slot_id = p_walk_id
    AND user_id = v_user_id
    AND status = 'ACTIVE'::public.membership_status
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('error', 'You are not actively joined to this walk.');
  END IF;

  SELECT *
  INTO v_observation
  FROM public.observations
  WHERE id = p_observation_id
    AND slot_id = p_walk_id
    AND status = 'DRAFT'::public.observation_status
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('error', 'Observation not found or already submitted.');
  END IF;

  IF v_observation.walk_completion IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('error', 'Walk completion is required.');
  END IF;

  IF v_observation.outcome IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('error', 'Outcome is required.');
  END IF;

  IF v_observation.outcome = 'SIGHTED'::public.observation_outcome THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.sightings
      WHERE observation_id = p_observation_id
    ) THEN
      RETURN pg_catalog.jsonb_build_object('error', 'At least one sighting is required when outcome is Sighted.');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.sightings
      WHERE observation_id = p_observation_id
        AND (lat IS NULL OR lat = 0 OR lng IS NULL OR lng = 0)
    ) THEN
      RETURN pg_catalog.jsonb_build_object('error', 'GPS location is required for each sighting.');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.sightings
      WHERE observation_id = p_observation_id
        AND species = 'OTHER'::public.species_type
        AND pg_catalog.btrim(COALESCE(species_other, ''), v_trim_characters) = ''
    ) THEN
      RETURN pg_catalog.jsonb_build_object('error', 'Species name is required when "Other" is selected.');
    END IF;

    -- Legacy rows may reference another parent's file. Never return those paths,
    -- or any file still referenced by media that this transaction will retain.
    SELECT COALESCE(pg_catalog.array_agg(DISTINCT m.file_path), ARRAY[]::text[])
    INTO v_file_paths
    FROM public.media m
    WHERE m.observation_id = p_observation_id
      AND public.is_media_path_for_parent(m.file_path, p_observation_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.media retained
        WHERE retained.file_path = m.file_path
          AND retained.observation_id IS DISTINCT FROM p_observation_id
      );

    UPDATE public.observations
    SET status = 'SUBMITTED'::public.observation_status,
        submitted_at = pg_catalog.now(),
        lat = NULL,
        lng = NULL
    WHERE id = p_observation_id
      AND status = 'DRAFT'::public.observation_status;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Observation not found or already submitted.';
    END IF;

    DELETE FROM public.media
    WHERE observation_id = p_observation_id;
  ELSIF v_observation.outcome = 'NOT_SIGHTED'::public.observation_outcome THEN
    IF v_observation.lat IS NULL OR v_observation.lat = 0
      OR v_observation.lng IS NULL OR v_observation.lng = 0 THEN
      RETURN pg_catalog.jsonb_build_object('error', 'GPS location is required for Not Sighted reports.');
    END IF;

    UPDATE public.observations
    SET status = 'SUBMITTED'::public.observation_status,
        submitted_at = pg_catalog.now()
    WHERE id = p_observation_id
      AND status = 'DRAFT'::public.observation_status;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Observation not found or already submitted.';
    END IF;
  ELSE
    RETURN pg_catalog.jsonb_build_object('error', 'Unsupported report outcome.');
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'file_paths', pg_catalog.to_jsonb(v_file_paths)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_observation_with_cleanup(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_observation_with_cleanup(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_observation_with_cleanup(uuid, uuid) TO authenticated;
