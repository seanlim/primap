drop extension if exists "pg_net";

create type "public"."user_audit_event_type" as enum ('LATE_WALK_CANCELLATION');

alter table "public"."observations" alter column "outcome" drop default;

alter table "public"."observations" alter column "walk_completion" drop default;


  create table "public"."user_audit_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null default gen_random_uuid(),
    "actor_id" uuid,
    "event_type" public.user_audit_event_type not null,
    "reason" text,
    "slot_id" uuid,
    "round_id" uuid,
    "metadata" jsonb not null default '{}'::jsonb,
    "occurred_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."user_audit_logs" enable row level security;

alter table "public"."observations" alter column outcome type "public"."observation_outcome" using outcome::text::"public"."observation_outcome";

alter table "public"."observations" alter column walk_completion type "public"."walk_completion" using walk_completion::text::"public"."walk_completion";

alter table "public"."observations" alter column "outcome" set default null;

alter table "public"."observations" alter column "walk_completion" set default null;

alter table "public"."app_settings" drop column "late_cancel_hours";

alter table "public"."app_settings" add column "high_participation_threshold" integer default 8;

alter table "public"."app_settings" add column "reminder_send_time" time without time zone not null default '13:00:00'::time without time zone;

alter table "public"."app_settings" add column "reminder_send_weekday" integer not null default 3;

alter table "public"."app_settings" add column "reminder_window_length_days" integer not null default 7;

alter table "public"."app_settings" add column "reminder_window_start_offset_days" integer not null default 2;

alter table "public"."observations" alter column "outcome" set default 'NOT_SIGHTED'::public.observation_outcome;

alter table "public"."observations" alter column "outcome" set not null;

alter table "public"."observations" alter column "walk_completion" set default 'PARTIAL'::public.walk_completion;

alter table "public"."observations" alter column "walk_completion" set not null;

alter table "public"."walk_slots" drop column "notes";

alter table "public"."walk_slots" add column "reminder_sent_at" timestamp with time zone;

CREATE INDEX user_audit_logs_actor_id_idx ON public.user_audit_logs USING btree (actor_id);

CREATE INDEX user_audit_logs_event_type_idx ON public.user_audit_logs USING btree (event_type);

CREATE UNIQUE INDEX user_audit_logs_pkey ON public.user_audit_logs USING btree (id);

CREATE INDEX user_audit_logs_user_id_occurred_at_idx ON public.user_audit_logs USING btree (user_id, occurred_at);

alter table "public"."user_audit_logs" add constraint "user_audit_logs_pkey" PRIMARY KEY using index "user_audit_logs_pkey";

alter table "public"."user_audit_logs" add constraint "user_audit_logs_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."user_audit_logs" validate constraint "user_audit_logs_actor_id_fkey";

alter table "public"."user_audit_logs" add constraint "user_audit_logs_round_id_fkey" FOREIGN KEY (round_id) REFERENCES public.survey_rounds(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."user_audit_logs" validate constraint "user_audit_logs_round_id_fkey";

alter table "public"."user_audit_logs" add constraint "user_audit_logs_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES public.walk_slots(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."user_audit_logs" validate constraint "user_audit_logs_slot_id_fkey";

alter table "public"."user_audit_logs" add constraint "user_audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."user_audit_logs" validate constraint "user_audit_logs_user_id_fkey";

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
  profile_date_of_birth date;
  raw_date_of_birth text;
begin
  raw_date_of_birth := new.raw_user_meta_data ->> 'date_of_birth';

  if raw_date_of_birth ~ '^\d{4}-\d{2}-\d{2}$'
    and raw_date_of_birth = to_char(to_date(raw_date_of_birth, 'YYYY-MM-DD'), 'YYYY-MM-DD')
  then
    profile_date_of_birth := to_date(raw_date_of_birth, 'YYYY-MM-DD');
  else
    profile_date_of_birth := null;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone_number,
    date_of_birth,
    guardian_name,
    guardian_email,
    guardian_phone_number
  )
  values (
    new.id,
    coalesce(new.email, new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    profile_date_of_birth,
    nullif(new.raw_user_meta_data ->> 'guardian_name', ''),
    nullif(lower(new.raw_user_meta_data ->> 'guardian_email'), ''),
    nullif(new.raw_user_meta_data ->> 'guardian_phone_number', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
    date_of_birth = coalesce(excluded.date_of_birth, public.profiles.date_of_birth),
    guardian_name = coalesce(excluded.guardian_name, public.profiles.guardian_name),
    guardian_email = coalesce(excluded.guardian_email, public.profiles.guardian_email),
    guardian_phone_number = coalesce(excluded.guardian_phone_number, public.profiles.guardian_phone_number),
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

grant delete on table "public"."app_settings" to "anon";

grant insert on table "public"."app_settings" to "anon";

grant select on table "public"."app_settings" to "anon";

grant update on table "public"."app_settings" to "anon";

grant delete on table "public"."app_settings" to "authenticated";

grant insert on table "public"."app_settings" to "authenticated";

grant select on table "public"."app_settings" to "authenticated";

grant update on table "public"."app_settings" to "authenticated";

grant delete on table "public"."app_settings" to "service_role";

grant insert on table "public"."app_settings" to "service_role";

grant select on table "public"."app_settings" to "service_role";

grant update on table "public"."app_settings" to "service_role";

grant delete on table "public"."incidents" to "anon";

grant insert on table "public"."incidents" to "anon";

grant select on table "public"."incidents" to "anon";

grant update on table "public"."incidents" to "anon";

grant delete on table "public"."incidents" to "authenticated";

grant insert on table "public"."incidents" to "authenticated";

grant select on table "public"."incidents" to "authenticated";

grant update on table "public"."incidents" to "authenticated";

grant delete on table "public"."incidents" to "service_role";

grant insert on table "public"."incidents" to "service_role";

grant select on table "public"."incidents" to "service_role";

grant update on table "public"."incidents" to "service_role";

grant delete on table "public"."media" to "anon";

grant insert on table "public"."media" to "anon";

grant select on table "public"."media" to "anon";

grant update on table "public"."media" to "anon";

grant delete on table "public"."media" to "authenticated";

grant insert on table "public"."media" to "authenticated";

grant select on table "public"."media" to "authenticated";

grant update on table "public"."media" to "authenticated";

grant delete on table "public"."media" to "service_role";

grant insert on table "public"."media" to "service_role";

grant select on table "public"."media" to "service_role";

grant update on table "public"."media" to "service_role";

grant delete on table "public"."observations" to "anon";

grant insert on table "public"."observations" to "anon";

grant select on table "public"."observations" to "anon";

grant update on table "public"."observations" to "anon";

grant delete on table "public"."observations" to "authenticated";

grant insert on table "public"."observations" to "authenticated";

grant select on table "public"."observations" to "authenticated";

grant update on table "public"."observations" to "authenticated";

grant delete on table "public"."observations" to "service_role";

grant insert on table "public"."observations" to "service_role";

grant select on table "public"."observations" to "service_role";

grant update on table "public"."observations" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."sightings" to "anon";

grant insert on table "public"."sightings" to "anon";

grant select on table "public"."sightings" to "anon";

grant update on table "public"."sightings" to "anon";

grant delete on table "public"."sightings" to "authenticated";

grant insert on table "public"."sightings" to "authenticated";

grant select on table "public"."sightings" to "authenticated";

grant update on table "public"."sightings" to "authenticated";

grant delete on table "public"."sightings" to "service_role";

grant insert on table "public"."sightings" to "service_role";

grant select on table "public"."sightings" to "service_role";

grant update on table "public"."sightings" to "service_role";

grant delete on table "public"."slot_memberships" to "anon";

grant insert on table "public"."slot_memberships" to "anon";

grant select on table "public"."slot_memberships" to "anon";

grant update on table "public"."slot_memberships" to "anon";

grant delete on table "public"."slot_memberships" to "authenticated";

grant insert on table "public"."slot_memberships" to "authenticated";

grant select on table "public"."slot_memberships" to "authenticated";

grant update on table "public"."slot_memberships" to "authenticated";

grant delete on table "public"."slot_memberships" to "service_role";

grant insert on table "public"."slot_memberships" to "service_role";

grant select on table "public"."slot_memberships" to "service_role";

grant update on table "public"."slot_memberships" to "service_role";

grant delete on table "public"."survey_rounds" to "anon";

grant insert on table "public"."survey_rounds" to "anon";

grant select on table "public"."survey_rounds" to "anon";

grant update on table "public"."survey_rounds" to "anon";

grant delete on table "public"."survey_rounds" to "authenticated";

grant insert on table "public"."survey_rounds" to "authenticated";

grant select on table "public"."survey_rounds" to "authenticated";

grant update on table "public"."survey_rounds" to "authenticated";

grant delete on table "public"."survey_rounds" to "service_role";

grant insert on table "public"."survey_rounds" to "service_role";

grant select on table "public"."survey_rounds" to "service_role";

grant update on table "public"."survey_rounds" to "service_role";

grant delete on table "public"."user_audit_logs" to "anon";

grant insert on table "public"."user_audit_logs" to "anon";

grant references on table "public"."user_audit_logs" to "anon";

grant select on table "public"."user_audit_logs" to "anon";

grant trigger on table "public"."user_audit_logs" to "anon";

grant truncate on table "public"."user_audit_logs" to "anon";

grant update on table "public"."user_audit_logs" to "anon";

grant delete on table "public"."user_audit_logs" to "authenticated";

grant insert on table "public"."user_audit_logs" to "authenticated";

grant references on table "public"."user_audit_logs" to "authenticated";

grant select on table "public"."user_audit_logs" to "authenticated";

grant trigger on table "public"."user_audit_logs" to "authenticated";

grant truncate on table "public"."user_audit_logs" to "authenticated";

grant update on table "public"."user_audit_logs" to "authenticated";

grant delete on table "public"."user_audit_logs" to "service_role";

grant insert on table "public"."user_audit_logs" to "service_role";

grant references on table "public"."user_audit_logs" to "service_role";

grant select on table "public"."user_audit_logs" to "service_role";

grant trigger on table "public"."user_audit_logs" to "service_role";

grant truncate on table "public"."user_audit_logs" to "service_role";

grant update on table "public"."user_audit_logs" to "service_role";

grant delete on table "public"."walk_slots" to "anon";

grant insert on table "public"."walk_slots" to "anon";

grant select on table "public"."walk_slots" to "anon";

grant update on table "public"."walk_slots" to "anon";

grant delete on table "public"."walk_slots" to "authenticated";

grant insert on table "public"."walk_slots" to "authenticated";

grant select on table "public"."walk_slots" to "authenticated";

grant update on table "public"."walk_slots" to "authenticated";

grant delete on table "public"."walk_slots" to "service_role";

grant insert on table "public"."walk_slots" to "service_role";

grant select on table "public"."walk_slots" to "service_role";

grant update on table "public"."walk_slots" to "service_role";


  create policy "Admins can view audit logs"
  on "public"."user_audit_logs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ADMIN'::public.user_role)))));



