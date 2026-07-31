
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walk_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- APP_SETTINGS
CREATE POLICY "Anyone can read app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage app settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- SURVEY_ROUNDS
CREATE POLICY "Active users can view rounds"
  ON public.survey_rounds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage rounds"
  ON public.survey_rounds FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- WALK_SLOTS
CREATE POLICY "Active users can view slots"
  ON public.walk_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage slots"
  ON public.walk_slots FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- SLOT_MEMBERSHIPS
CREATE POLICY "Users can view all memberships"
  ON public.slot_memberships FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join slots"
  ON public.slot_memberships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can cancel own membership"
  ON public.slot_memberships FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage memberships"
  ON public.slot_memberships FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- OBSERVATIONS
CREATE POLICY "Users can view observations for their slots"
  ON public.observations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.slot_memberships
      WHERE slot_memberships.slot_id = observations.slot_id
        AND slot_memberships.user_id = auth.uid()
        AND slot_memberships.status = 'ACTIVE'
    )
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Users can create own observations"
  ON public.observations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own draft observations"
  ON public.observations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'DRAFT')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all observations"
  ON public.observations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- SIGHTINGS
CREATE POLICY "Users can view sightings for accessible observations"
  ON public.sightings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.observations
      WHERE observations.id = sightings.observation_id
        AND (
          observations.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.slot_memberships
            WHERE slot_memberships.slot_id = observations.slot_id
              AND slot_memberships.user_id = auth.uid()
              AND slot_memberships.status = 'ACTIVE'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
        )
    )
  );

CREATE POLICY "Users can manage own sightings"
  ON public.sightings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.observations
      WHERE observations.id = sightings.observation_id
        AND observations.user_id = auth.uid()
        AND observations.status = 'DRAFT'
    )
  );

CREATE POLICY "Users can update own sightings"
  ON public.sightings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.observations
      WHERE observations.id = sightings.observation_id
        AND observations.user_id = auth.uid()
        AND observations.status = 'DRAFT'
    )
  );

CREATE POLICY "Users can delete own sightings"
  ON public.sightings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.observations
      WHERE observations.id = sightings.observation_id
        AND observations.user_id = auth.uid()
        AND observations.status = 'DRAFT'
    )
  );

-- MEDIA
CREATE POLICY "Users can view media for accessible observations"
  ON public.media FOR SELECT
  TO authenticated
  USING (
    (observation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.observations
      WHERE observations.id = media.observation_id
        AND (
          observations.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.slot_memberships
            WHERE slot_memberships.slot_id = observations.slot_id
              AND slot_memberships.user_id = auth.uid()
              AND slot_memberships.status = 'ACTIVE'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
        )
    ))
    OR
    (sighting_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.sightings
      JOIN public.observations ON observations.id = sightings.observation_id
      WHERE sightings.id = media.sighting_id
        AND (
          observations.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.slot_memberships
            WHERE slot_memberships.slot_id = observations.slot_id
              AND slot_memberships.user_id = auth.uid()
              AND slot_memberships.status = 'ACTIVE'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
        )
    ))
  );

CREATE POLICY "Users can upload media for own draft observations"
  ON public.media FOR INSERT
  TO authenticated
  WITH CHECK (
    (observation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.observations
      WHERE observations.id = media.observation_id
        AND observations.user_id = auth.uid()
        AND observations.status = 'DRAFT'
    ))
    OR
    (sighting_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.sightings
      JOIN public.observations ON observations.id = sightings.observation_id
      WHERE sightings.id = media.sighting_id
        AND observations.user_id = auth.uid()
        AND observations.status = 'DRAFT'
    ))
  );

CREATE POLICY "Users can delete own media"
  ON public.media FOR DELETE
  TO authenticated
  USING (
    (observation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.observations
      WHERE observations.id = media.observation_id
        AND observations.user_id = auth.uid()
        AND observations.status = 'DRAFT'
    ))
    OR
    (sighting_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.sightings
      JOIN public.observations ON observations.id = sightings.observation_id
      WHERE sightings.id = media.sighting_id
        AND observations.user_id = auth.uid()
        AND observations.status = 'DRAFT'
    ))
  );

-- INCIDENTS
CREATE POLICY "Users can view incidents for their slots"
  ON public.incidents FOR SELECT
  TO authenticated
  USING (
    reported_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.slot_memberships
      WHERE slot_memberships.slot_id = incidents.slot_id
        AND slot_memberships.user_id = auth.uid()
        AND slot_memberships.status = 'ACTIVE'
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Users can report incidents"
  ON public.incidents FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "Admins can manage incidents"
  ON public.incidents FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
;
