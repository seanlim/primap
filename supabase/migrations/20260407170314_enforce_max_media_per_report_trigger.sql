-- Atomically enforce app_settings.max_media_per_report on media inserts.
-- Closes the count-then-insert race in app/api/media/route.ts where two
-- concurrent requests could both observe count=N-1 and both insert,
-- producing N+1 rows. A transaction-scoped advisory lock per parent
-- serializes concurrent inserts targeting the same observation/sighting,
-- so the count and insert become effectively atomic from the perspective
-- of the limit check.

CREATE OR REPLACE FUNCTION enforce_max_media_per_report()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_media INT;
  v_current_count INT;
  v_parent_key TEXT;
BEGIN
  IF NEW.observation_id IS NOT NULL THEN
    v_parent_key := 'media:obs:' || NEW.observation_id::text;
  ELSIF NEW.sighting_id IS NOT NULL THEN
    v_parent_key := 'media:sight:' || NEW.sighting_id::text;
  ELSE
    -- Neither parent set; nothing to enforce here. The route handler
    -- already rejects requests with no parentId, but be defensive.
    RETURN NEW;
  END IF;

  -- Serialize concurrent inserts for the same parent within a transaction.
  -- Released automatically at COMMIT/ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtext(v_parent_key));

  SELECT COALESCE(max_media_per_report, 10) INTO v_max_media
  FROM app_settings
  LIMIT 1;
  IF v_max_media IS NULL THEN
    v_max_media := 10;
  END IF;

  IF NEW.observation_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM media
    WHERE observation_id = NEW.observation_id;
  ELSE
    SELECT COUNT(*) INTO v_current_count
    FROM media
    WHERE sighting_id = NEW.sighting_id;
  END IF;

  IF v_current_count >= v_max_media THEN
    RAISE EXCEPTION 'Maximum of % media files allowed per report', v_max_media
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_max_media_per_report_trigger ON media;
CREATE TRIGGER enforce_max_media_per_report_trigger
BEFORE INSERT ON media
FOR EACH ROW
EXECUTE FUNCTION enforce_max_media_per_report();;
