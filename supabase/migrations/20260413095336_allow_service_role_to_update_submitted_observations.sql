CREATE OR REPLACE FUNCTION enforce_observation_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role (admin operations) to update submitted observations
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'SUBMITTED' AND NEW.status = 'SUBMITTED' THEN
    RAISE EXCEPTION 'Cannot modify a submitted observation.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;;
