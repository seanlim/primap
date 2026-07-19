-- 1. Add incident_id to media
ALTER TABLE media ADD COLUMN incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE;
CREATE INDEX media_incident_id_idx ON media(incident_id);

-- 2. Replace 2-way XOR with 3-way XOR
ALTER TABLE media DROP CONSTRAINT media_parent_check;
ALTER TABLE media ADD CONSTRAINT media_parent_check CHECK (
  ((observation_id IS NOT NULL)::int
   + (sighting_id IS NOT NULL)::int
   + (incident_id IS NOT NULL)::int) = 1
);

-- 3. Update trigger function with incident branch
CREATE OR REPLACE FUNCTION public.enforce_max_media_per_report() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_max_media INT; v_current_count INT; v_parent_key TEXT;
BEGIN
  IF NEW.observation_id IS NOT NULL THEN
    v_parent_key := 'media:obs:' || NEW.observation_id::text;
  ELSIF NEW.sighting_id IS NOT NULL THEN
    v_parent_key := 'media:sight:' || NEW.sighting_id::text;
  ELSIF NEW.incident_id IS NOT NULL THEN
    v_parent_key := 'media:incident:' || NEW.incident_id::text;
  ELSE
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_parent_key));
  SELECT COALESCE(max_media_per_report, 10) INTO v_max_media FROM app_settings LIMIT 1;
  IF v_max_media IS NULL THEN v_max_media := 10; END IF;
  IF NEW.observation_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count FROM media WHERE observation_id = NEW.observation_id;
  ELSIF NEW.sighting_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count FROM media WHERE sighting_id = NEW.sighting_id;
  ELSE
    SELECT COUNT(*) INTO v_current_count FROM media WHERE incident_id = NEW.incident_id;
  END IF;
  IF v_current_count >= v_max_media THEN
    RAISE EXCEPTION 'Maximum of % media files allowed per report', v_max_media USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

-- 4. New RLS policies for incident_id
CREATE POLICY "Users can upload media for own incidents"
  ON media FOR INSERT WITH CHECK (
    incident_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = media.incident_id AND i.reported_by = auth.uid()
    )
  );

CREATE POLICY "Users can view media for accessible incidents"
  ON media FOR SELECT USING (
    incident_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = media.incident_id AND (
        i.reported_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM slot_memberships sm
          WHERE sm.slot_id = i.slot_id AND sm.user_id = auth.uid() AND sm.status = 'ACTIVE'
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = 'ADMIN'
        )
      )
    )
  );

CREATE POLICY "Users can delete own incident media"
  ON media FOR DELETE USING (
    incident_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = media.incident_id
        AND i.reported_by = auth.uid()
        AND i.resolved = false
    )
  );;
