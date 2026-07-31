alter table "public"."profiles" drop constraint "profiles_guardian_phone_number_e164_check";

alter table "public"."profiles" drop constraint "profiles_guardian_phone_verified_requires_phone_check";


  create table "public"."round_participation_requirements" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "round_id" uuid not null,
    "indemnity_acknowledged_at" timestamp with time zone,
    "guardian_name" text,
    "guardian_email" text,
    "guardian_email_verified_at" timestamp with time zone,
    "guardian_phone_number" text,
    "guardian_phone_verified_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."round_participation_requirements" enable row level security;

alter table "public"."guardian_contact_otps" add column "round_id" uuid not null;

alter table "public"."profiles" drop column "date_of_birth";

alter table "public"."profiles" drop column "guardian_phone_number";

alter table "public"."profiles" drop column "guardian_phone_verified_at";

alter table "public"."profiles" add column "birth_month" date;

alter table "public"."survey_rounds" add column "indemnity_form_url" text;

CREATE INDEX guardian_contact_otps_lookup_idx ON public.guardian_contact_otps USING btree (user_id, round_id, channel, destination, created_at DESC);

CREATE UNIQUE INDEX round_participation_requirements_pkey ON public.round_participation_requirements USING btree (id);

CREATE INDEX round_participation_requirements_round_user_idx ON public.round_participation_requirements USING btree (round_id, user_id);

CREATE UNIQUE INDEX round_participation_requirements_user_round_key ON public.round_participation_requirements USING btree (user_id, round_id);

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_pkey" PRIMARY KEY using index "round_participation_requirements_pkey";

alter table "public"."guardian_contact_otps" add constraint "guardian_contact_otps_round_id_fkey" FOREIGN KEY (round_id) REFERENCES public.survey_rounds(id) ON DELETE CASCADE not valid;

alter table "public"."guardian_contact_otps" validate constraint "guardian_contact_otps_round_id_fkey";

alter table "public"."profiles" add constraint "profiles_birth_month_first_day_check" CHECK (((birth_month IS NULL) OR (birth_month = (date_trunc('month'::text, (birth_month)::timestamp with time zone))::date))) not valid;

alter table "public"."profiles" validate constraint "profiles_birth_month_first_day_check";

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_guardian_email_check" CHECK (((guardian_email IS NULL) OR ((guardian_email = lower(guardian_email)) AND (guardian_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)))) not valid;

alter table "public"."round_participation_requirements" validate constraint "round_participation_requirements_guardian_email_check";

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_guardian_email_verified_requir" CHECK (((guardian_email_verified_at IS NULL) OR (guardian_email IS NOT NULL))) not valid;

alter table "public"."round_participation_requirements" validate constraint "round_participation_requirements_guardian_email_verified_requir";

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_guardian_name_check" CHECK (((guardian_name IS NULL) OR (length(TRIM(BOTH FROM guardian_name)) > 0))) not valid;

alter table "public"."round_participation_requirements" validate constraint "round_participation_requirements_guardian_name_check";

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_guardian_phone_e164_check" CHECK (((guardian_phone_number IS NULL) OR (guardian_phone_number ~ '^\+[1-9][0-9]{7,14}$'::text))) not valid;

alter table "public"."round_participation_requirements" validate constraint "round_participation_requirements_guardian_phone_e164_check";

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_guardian_phone_verified_requir" CHECK (((guardian_phone_verified_at IS NULL) OR (guardian_phone_number IS NOT NULL))) not valid;

alter table "public"."round_participation_requirements" validate constraint "round_participation_requirements_guardian_phone_verified_requir";

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_round_id_fkey" FOREIGN KEY (round_id) REFERENCES public.survey_rounds(id) ON DELETE CASCADE not valid;

alter table "public"."round_participation_requirements" validate constraint "round_participation_requirements_round_id_fkey";

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."round_participation_requirements" validate constraint "round_participation_requirements_user_id_fkey";

alter table "public"."round_participation_requirements" add constraint "round_participation_requirements_user_round_key" UNIQUE using index "round_participation_requirements_user_round_key";

alter table "public"."survey_rounds" add constraint "survey_rounds_indemnity_form_url_check" CHECK (((indemnity_form_url IS NULL) OR (indemnity_form_url ~* '^https?://'::text))) not valid;

alter table "public"."survey_rounds" validate constraint "survey_rounds_indemnity_form_url_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cancel_slot_with_draft_cleanup(p_slot_id uuid, p_cancellation_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_now timestamptz := now();
  v_slot record;
  v_is_late boolean := false;
  v_reason text := nullif(btrim(p_cancellation_reason), '');
  v_draft_observation_ids uuid[] := '{}';
  v_file_paths text[] := '{}';
  v_deleted_draft_count integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select id
  into v_membership_id
  from public.slot_memberships
  where slot_id = p_slot_id
    and user_id = v_user_id
    and status = 'ACTIVE'
  limit 1
  for update;

  if v_membership_id is null then
    return jsonb_build_object('error', 'You are not actively joined to this walk.');
  end if;

  if exists (
    select 1
    from public.observations
    where slot_id = p_slot_id
      and user_id = v_user_id
      and status = 'SUBMITTED'
  ) then
    return jsonb_build_object('error', 'You can''t cancel this walk after submitting your report.');
  end if;

  select id, round_id, walk_date, start_time, location_name, reminder_sent_at
  into v_slot
  from public.walk_slots
  where id = p_slot_id;

  if v_slot.id is null then
    return jsonb_build_object('error', 'Walk slot not found.');
  end if;

  v_is_late := v_slot.reminder_sent_at is not null;

  if v_is_late and v_reason is null then
    return jsonb_build_object('error', 'Please provide a reason for this late cancellation.');
  end if;

  if length(coalesce(v_reason, '')) > 1000 then
    return jsonb_build_object('error', 'Cancellation reason must be 1000 characters or fewer.');
  end if;

  select coalesce(array_agg(o.id), '{}'::uuid[])
  into v_draft_observation_ids
  from public.observations o
  where o.slot_id = p_slot_id
    and o.user_id = v_user_id
    and o.status = 'DRAFT';

  select coalesce(array_agg(distinct m.file_path), '{}'::text[])
  into v_file_paths
  from public.media m
  where m.observation_id = any(v_draft_observation_ids)
      or m.sighting_id in (
        select s.id
        from public.sightings s
        where s.observation_id = any(v_draft_observation_ids)
      );

  v_deleted_draft_count := coalesce(array_length(v_draft_observation_ids, 1), 0);

  update public.slot_memberships
  set status = 'CANCELLED',
      cancelled_at = v_now
  where id = v_membership_id;

  delete from public.observations
  where id = any(v_draft_observation_ids);

  if v_is_late then
    insert into public.user_audit_logs (
      user_id,
      actor_id,
      event_type,
      reason,
      slot_id,
      round_id,
      metadata,
      occurred_at
    )
    values (
      v_user_id,
      v_user_id,
      'LATE_WALK_CANCELLATION',
      v_reason,
      p_slot_id,
      v_slot.round_id,
      jsonb_build_object(
        'location_name', v_slot.location_name,
        'walk_date', v_slot.walk_date,
        'start_time', v_slot.start_time,
        'reminder_sent_at', v_slot.reminder_sent_at
      ),
      v_now
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'deleted_draft_count', v_deleted_draft_count,
    'file_paths', coalesce(to_jsonb(v_file_paths), '[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_max_media_per_report()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.enforce_observation_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_slot_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  profile_birth_month date;
  raw_birth_month text;
  candidate_birth_month text;
begin
  raw_birth_month := coalesce(
    nullif(new.raw_user_meta_data ->> 'birth_month', ''),
    nullif(new.raw_user_meta_data ->> 'date_of_birth', '')
  );

  if raw_birth_month ~ '^\d{4}-\d{2}$' then
    candidate_birth_month := raw_birth_month || '-01';
  elsif raw_birth_month ~ '^\d{4}-\d{2}-\d{2}$' then
    candidate_birth_month := to_char(to_date(raw_birth_month, 'YYYY-MM-DD'), 'YYYY-MM') || '-01';
  else
    candidate_birth_month := null;
  end if;

  if candidate_birth_month is not null
    and candidate_birth_month = to_char(to_date(candidate_birth_month, 'YYYY-MM-DD'), 'YYYY-MM-DD')
    and candidate_birth_month <= to_char(current_date, 'YYYY-MM') || '-01'
  then
    profile_birth_month := to_date(candidate_birth_month, 'YYYY-MM-DD');
  else
    profile_birth_month := null;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone_number,
    birth_month
  )
  values (
    new.id,
    coalesce(new.email, new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    profile_birth_month
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
    birth_month = coalesce(excluded.birth_month, public.profiles.birth_month),
    updated_at = now();

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.join_slot_with_observation(p_slot_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."round_participation_requirements" to "service_role";

grant insert on table "public"."round_participation_requirements" to "service_role";

grant references on table "public"."round_participation_requirements" to "service_role";

grant select on table "public"."round_participation_requirements" to "service_role";

grant trigger on table "public"."round_participation_requirements" to "service_role";

grant truncate on table "public"."round_participation_requirements" to "service_role";

grant update on table "public"."round_participation_requirements" to "service_role";


