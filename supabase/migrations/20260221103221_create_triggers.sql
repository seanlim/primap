
-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enforce slot capacity (max ACTIVE members per slot)
CREATE OR REPLACE FUNCTION public.enforce_slot_capacity()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  slot_max INT;
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    SELECT max_volunteers INTO slot_max
    FROM public.walk_slots
    WHERE id = NEW.slot_id;

    SELECT COUNT(*) INTO current_count
    FROM public.slot_memberships
    WHERE slot_id = NEW.slot_id
      AND status = 'ACTIVE'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF current_count >= slot_max THEN
      RAISE EXCEPTION 'Slot is full. Maximum % volunteers allowed.', slot_max;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_slot_capacity
  BEFORE INSERT OR UPDATE ON public.slot_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_slot_capacity();

-- Enforce observation immutability (reject edits on SUBMITTED observations)
CREATE OR REPLACE FUNCTION public.enforce_observation_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'SUBMITTED' AND NEW.status = 'SUBMITTED' THEN
    RAISE EXCEPTION 'Cannot modify a submitted observation.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_observation_immutability
  BEFORE UPDATE ON public.observations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_observation_immutability();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_app_settings
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_survey_rounds
  BEFORE UPDATE ON public.survey_rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_walk_slots
  BEFORE UPDATE ON public.walk_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_observations
  BEFORE UPDATE ON public.observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_incidents
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
;
