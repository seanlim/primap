-- Observation media and every sighting share one report allowance.
-- Invoker permissions preserve the existing media/sighting RLS policies.
CREATE OR REPLACE FUNCTION public.get_report_media_count(p_parent_type text, p_parent_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_observation_id uuid;
  v_count integer;
BEGIN
  IF p_parent_type = 'incident' THEN
    SELECT count(*) INTO v_count FROM public.media WHERE incident_id = p_parent_id;
    RETURN v_count;
  ELSIF p_parent_type = 'observation' THEN
    v_observation_id := p_parent_id;
  ELSIF p_parent_type = 'sighting' THEN
    SELECT observation_id INTO STRICT v_observation_id FROM public.sightings WHERE id = p_parent_id;
  ELSE
    RAISE EXCEPTION 'Invalid media parent type';
  END IF;

  SELECT count(*) INTO v_count FROM public.media
  WHERE observation_id = v_observation_id
     OR sighting_id IN (SELECT id FROM public.sightings WHERE observation_id = v_observation_id);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_report_media_count(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_media_count(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_max_media_per_report()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_max_media integer;
  v_observation_id uuid;
  v_parent_type text;
  v_parent_id uuid;
  v_parent_key text;
BEGIN
  IF NEW.incident_id IS NOT NULL THEN
    v_parent_type := 'incident';
    v_parent_id := NEW.incident_id;
    v_parent_key := 'media:incident:' || v_parent_id::text;
  ELSE
    IF NEW.observation_id IS NOT NULL THEN
      v_observation_id := NEW.observation_id;
    ELSIF NEW.sighting_id IS NOT NULL THEN
      SELECT observation_id INTO STRICT v_observation_id FROM public.sightings WHERE id = NEW.sighting_id;
    ELSE
      RETURN NEW;
    END IF;
    v_parent_type := 'observation';
    v_parent_id := v_observation_id;
    v_parent_key := 'media:obs:' || v_observation_id::text;
  END IF;

  -- Every parent in a report takes the same transaction lock. Count after
  -- acquiring it; the volatile function sees uploads committed while waiting.
  PERFORM pg_advisory_xact_lock(hashtext(v_parent_key));
  SELECT max_media_per_report INTO v_max_media FROM public.app_settings LIMIT 1;
  v_max_media := coalesce(v_max_media, 10);
  IF public.get_report_media_count(v_parent_type, v_parent_id) >= v_max_media THEN
    RAISE EXCEPTION 'Maximum of % media files allowed per report', v_max_media USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
