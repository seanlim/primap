DELETE FROM public.observations o1
WHERE o1.id NOT IN (
  SELECT DISTINCT ON (o2.slot_id) o2.id
  FROM public.observations o2
  ORDER BY o2.slot_id, o2.id
);

-- Drop policies that depend on user_id before dropping the column
DROP POLICY IF EXISTS "Users can create own observations" ON public.observations;
DROP POLICY IF EXISTS "Users can update own draft observations" ON public.observations;
DROP POLICY IF EXISTS "Users can view observations for their slots" ON public.observations;

DROP POLICY IF EXISTS "Users can view sightings for accessible observations" ON public.sightings;
DROP POLICY IF EXISTS "Users can manage own sightings" ON public.sightings;
DROP POLICY IF EXISTS "Users can update own sightings" ON public.sightings;
DROP POLICY IF EXISTS "Users can delete own sightings" ON public.sightings;

DROP POLICY IF EXISTS "Users can view media for accessible observations" ON public.media;
DROP POLICY IF EXISTS "Users can upload media for own draft observations" ON public.media;
DROP POLICY IF EXISTS "Users can delete own media" ON public.media;

ALTER TABLE public.observations DROP COLUMN user_id;

ALTER TABLE public.observations
ADD CONSTRAINT observations_slot_id_unique UNIQUE (slot_id);

-- Helper: returns true if the current user is an active member of the given slot
CREATE OR REPLACE FUNCTION public.is_active_slot_member(p_slot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM slot_memberships
    WHERE slot_memberships.slot_id = p_slot_id
      AND slot_memberships.user_id = auth.uid()
      AND slot_memberships.status = 'ACTIVE'::membership_status
  );
$$;

-- Helper: returns true if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'::user_role
  );
$$;

-- Observations policies
CREATE POLICY "Users can create own observations"
ON public.observations
FOR INSERT
WITH CHECK (is_active_slot_member(slot_id));

CREATE POLICY "Users can update own draft observations"
ON public.observations
FOR UPDATE
USING (status = 'DRAFT'::observation_status AND is_active_slot_member(slot_id));

CREATE POLICY "Users can view observations for their slots"
ON public.observations
FOR SELECT
USING (is_active_slot_member(slot_id) OR is_admin());

-- Sightings policies
CREATE POLICY "Users can view sightings for accessible observations"
ON public.sightings
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM observations WHERE observations.id = sightings.observation_id AND is_active_slot_member(observations.slot_id))
  OR is_admin()
);

CREATE POLICY "Users can manage own sightings"
ON public.sightings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM observations
    WHERE observations.id = sightings.observation_id
      AND observations.status = 'DRAFT'::observation_status
      AND is_active_slot_member(observations.slot_id)
  )
);

CREATE POLICY "Users can update own sightings"
ON public.sightings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM observations
    WHERE observations.id = sightings.observation_id
      AND observations.status = 'DRAFT'::observation_status
      AND is_active_slot_member(observations.slot_id)
  )
);

CREATE POLICY "Users can delete own sightings"
ON public.sightings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM observations
    WHERE observations.id = sightings.observation_id
      AND observations.status = 'DRAFT'::observation_status
      AND is_active_slot_member(observations.slot_id)
  )
);

-- Media policies
CREATE POLICY "Users can view media for accessible observations"
ON public.media
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM observations WHERE observations.id = media.observation_id AND is_active_slot_member(observations.slot_id))
  OR EXISTS (SELECT 1 FROM sightings JOIN observations ON observations.id = sightings.observation_id WHERE sightings.id = media.sighting_id AND is_active_slot_member(observations.slot_id))
  OR is_admin()
);

CREATE POLICY "Users can upload media for own draft observations"
ON public.media
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM observations WHERE observations.id = media.observation_id AND observations.status = 'DRAFT'::observation_status AND is_active_slot_member(observations.slot_id))
  OR EXISTS (SELECT 1 FROM sightings JOIN observations ON observations.id = sightings.observation_id WHERE sightings.id = media.sighting_id AND observations.status = 'DRAFT'::observation_status AND is_active_slot_member(observations.slot_id))
);

CREATE POLICY "Users can delete own media"
ON public.media
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM observations WHERE observations.id = media.observation_id AND observations.status = 'DRAFT'::observation_status AND is_active_slot_member(observations.slot_id))
  OR EXISTS (SELECT 1 FROM sightings JOIN observations ON observations.id = sightings.observation_id WHERE sightings.id = media.sighting_id AND observations.status = 'DRAFT'::observation_status AND is_active_slot_member(observations.slot_id))
);
