-- Issue #91: round-specific guardian requirements and walk accompaniment.
ALTER TABLE public.survey_rounds
  ADD COLUMN minor_workshop_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.round_participation_requirements
  ADD COLUMN guardian_workshop_attended_at timestamptz,
  ADD COLUMN guardian_accompaniment_acknowledged_at timestamptz;

ALTER TABLE public.slot_attendance
  ADD COLUMN guardian_present boolean;

-- Month-only birth dates are intentionally considered minor through the
-- volunteer's 18th birthday month, avoiding false adult classification when
-- the exact day of birth is not collected.
CREATE OR REPLACE FUNCTION public.is_minor_at_round_start(
  p_birth_month date,
  p_round_start date
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_birth_month IS NOT NULL
    AND p_round_start IS NOT NULL
    AND date_trunc('month', p_round_start)::date
      <= (p_birth_month + interval '18 years')::date;
$$;

-- Keep the database RPC as the final enforcement boundary, even if callers
-- bypass the application-level join action.
CREATE OR REPLACE FUNCTION public.join_slot_with_observation(
  p_slot_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_volunteers int;
  v_active_count int;
  v_existing_membership_id uuid;
  v_existing_status text;
  v_membership_id uuid;
  v_observation_id uuid;
  v_phone_number text;
  v_birth_month date;
  v_role public.user_role;
  v_round_id uuid;
  v_round_start date;
  v_workshop_required boolean;
  v_guardian_name text;
  v_guardian_email text;
  v_guardian_accompaniment_acknowledged_at timestamptz;
  v_guardian_workshop_attended_at timestamptz;
BEGIN
  SELECT profile.phone_number, profile.birth_month, profile.role
  INTO v_phone_number, v_birth_month, v_role
  FROM public.profiles profile
  WHERE profile.id = p_user_id;

  IF v_phone_number IS NULL OR btrim(v_phone_number) = '' THEN
    RETURN jsonb_build_object(
      'error', 'Add a phone number to your profile before joining a walk.',
      'code', 'PHONE_REQUIRED'
    );
  END IF;

  SELECT slot.round_id, round.start_date, round.minor_workshop_required
  INTO v_round_id, v_round_start, v_workshop_required
  FROM public.walk_slots slot
  JOIN public.survey_rounds round ON round.id = slot.round_id
  WHERE slot.id = p_slot_id;

  IF v_round_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Slot not found');
  END IF;

  IF v_role = 'VOLUNTEER' AND v_birth_month IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Add your birth month and year to your profile before joining a walk.',
      'code', 'BIRTH_MONTH_REQUIRED'
    );
  END IF;

  IF v_role = 'VOLUNTEER'
    AND public.is_minor_at_round_start(v_birth_month, v_round_start)
  THEN
    SELECT guardian_name, guardian_email, guardian_accompaniment_acknowledged_at,
      guardian_workshop_attended_at
    INTO v_guardian_name, v_guardian_email, v_guardian_accompaniment_acknowledged_at,
      v_guardian_workshop_attended_at
    FROM public.round_participation_requirements
    WHERE user_id = p_user_id AND round_id = v_round_id;

    IF v_guardian_name IS NULL OR btrim(v_guardian_name) = ''
      OR v_guardian_email IS NULL OR btrim(v_guardian_email) = ''
      OR v_guardian_accompaniment_acknowledged_at IS NULL
    THEN
      RETURN jsonb_build_object(
        'error', 'Add your guardian details for this survey round before joining a walk.',
        'code', 'GUARDIAN_DETAILS_REQUIRED'
      );
    END IF;

    IF v_workshop_required AND v_guardian_workshop_attended_at IS NULL THEN
      RETURN jsonb_build_object(
        'error', 'Your admin must confirm guardian workshop attendance before you can join a walk.',
        'code', 'GUARDIAN_WORKSHOP_REQUIRED'
      );
    END IF;
  END IF;

  -- Lock the slot row so concurrent joins cannot exceed capacity.
  SELECT max_volunteers INTO v_max_volunteers
  FROM public.walk_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF v_max_volunteers IS NULL THEN
    RETURN jsonb_build_object('error', 'Slot not found');
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.slot_memberships
  WHERE slot_id = p_slot_id AND status = 'ACTIVE';

  IF v_active_count >= v_max_volunteers THEN
    RETURN jsonb_build_object('error', 'This walk slot is full.');
  END IF;

  SELECT id, status INTO v_existing_membership_id, v_existing_status
  FROM public.slot_memberships
  WHERE slot_id = p_slot_id AND user_id = p_user_id;

  IF v_existing_membership_id IS NOT NULL THEN
    IF v_existing_status = 'ACTIVE' THEN
      RETURN jsonb_build_object('error', 'You have already joined this walk.');
    END IF;

    UPDATE public.slot_memberships
    SET status = 'ACTIVE', cancelled_at = NULL, joined_at = now()
    WHERE id = v_existing_membership_id;
    v_membership_id := v_existing_membership_id;
  ELSE
    INSERT INTO public.slot_memberships (slot_id, user_id, status)
    VALUES (p_slot_id, p_user_id, 'ACTIVE')
    RETURNING id INTO v_membership_id;
  END IF;

  INSERT INTO public.observations (slot_id, status)
  VALUES (p_slot_id, 'DRAFT')
  ON CONFLICT (slot_id) DO NOTHING
  RETURNING id INTO v_observation_id;

  IF v_observation_id IS NULL THEN
    SELECT id INTO v_observation_id
    FROM public.observations
    WHERE slot_id = p_slot_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'observation_id', v_observation_id
  );
END;
$$;
