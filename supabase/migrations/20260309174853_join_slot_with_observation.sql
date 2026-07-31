
CREATE OR REPLACE FUNCTION public.join_slot_with_observation(
  p_slot_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_volunteers int;
  v_active_count int;
  v_existing_membership_id uuid;
  v_existing_status text;
  v_membership_id uuid;
  v_observation_id uuid;
BEGIN
  -- 1. Lock the slot row and get max_volunteers
  SELECT max_volunteers INTO v_max_volunteers
  FROM public.walk_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF v_max_volunteers IS NULL THEN
    RETURN jsonb_build_object('error', 'Slot not found');
  END IF;

  -- 2. Count current ACTIVE memberships
  SELECT count(*) INTO v_active_count
  FROM public.slot_memberships
  WHERE slot_id = p_slot_id AND status = 'ACTIVE';

  IF v_active_count >= v_max_volunteers THEN
    RETURN jsonb_build_object('error', 'This walk slot is full.');
  END IF;

  -- 3. Check for existing membership (active or cancelled)
  SELECT id, status INTO v_existing_membership_id, v_existing_status
  FROM public.slot_memberships
  WHERE slot_id = p_slot_id AND user_id = p_user_id;

  IF v_existing_membership_id IS NOT NULL THEN
    IF v_existing_status = 'ACTIVE' THEN
      RETURN jsonb_build_object('error', 'You have already joined this walk.');
    END IF;

    -- Reactivate CANCELLED membership
    UPDATE public.slot_memberships
    SET status = 'ACTIVE', cancelled_at = NULL, joined_at = now()
    WHERE id = v_existing_membership_id;

    v_membership_id := v_existing_membership_id;
  ELSE
    -- 4. Insert new membership
    INSERT INTO public.slot_memberships (slot_id, user_id, status)
    VALUES (p_slot_id, p_user_id, 'ACTIVE')
    RETURNING id INTO v_membership_id;
  END IF;

  -- 5. Create or ensure DRAFT observation exists
  INSERT INTO public.observations (slot_id, user_id, status)
  VALUES (p_slot_id, p_user_id, 'DRAFT')
  ON CONFLICT (slot_id, user_id) DO NOTHING
  RETURNING id INTO v_observation_id;

  -- If ON CONFLICT hit, fetch existing observation id
  IF v_observation_id IS NULL THEN
    SELECT id INTO v_observation_id
    FROM public.observations
    WHERE slot_id = p_slot_id AND user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'observation_id', v_observation_id
  );
END;
$$;
;
