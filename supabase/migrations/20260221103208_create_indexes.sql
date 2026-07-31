
-- Profiles
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Survey rounds
CREATE INDEX idx_survey_rounds_status ON public.survey_rounds(status);
CREATE INDEX idx_survey_rounds_dates ON public.survey_rounds(start_date, end_date);

-- Walk slots
CREATE INDEX idx_walk_slots_round_id ON public.walk_slots(round_id);
CREATE INDEX idx_walk_slots_walk_date ON public.walk_slots(walk_date);

-- Slot memberships
CREATE INDEX idx_slot_memberships_slot_id ON public.slot_memberships(slot_id);
CREATE INDEX idx_slot_memberships_user_id ON public.slot_memberships(user_id);
CREATE INDEX idx_slot_memberships_status ON public.slot_memberships(status);

-- Observations
CREATE INDEX idx_observations_slot_id ON public.observations(slot_id);
CREATE INDEX idx_observations_user_id ON public.observations(user_id);
CREATE INDEX idx_observations_status ON public.observations(status);
CREATE INDEX idx_observations_client_draft_id ON public.observations(client_draft_id);

-- Sightings
CREATE INDEX idx_sightings_observation_id ON public.sightings(observation_id);

-- Media
CREATE INDEX idx_media_observation_id ON public.media(observation_id);
CREATE INDEX idx_media_sighting_id ON public.media(sighting_id);

-- Incidents
CREATE INDEX idx_incidents_slot_id ON public.incidents(slot_id);
CREATE INDEX idx_incidents_reported_by ON public.incidents(reported_by);
;
