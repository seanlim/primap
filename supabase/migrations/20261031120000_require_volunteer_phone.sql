-- Issue #85: phone numbers are mandatory for volunteers.
--
-- The profiles.phone_number column and its E.164 check constraint already exist
-- (see 20260525020633_contact_profile_85.sql). This migration:
--   1. adds a shared normaliser so auth metadata cannot break signup,
--   2. stores normalised phone numbers when a profile is created,
--   3. blocks joining a walk until a phone number is present.
--
-- A table-level CHECK constraint is intentionally deferred until existing
-- volunteers have been backfilled; the application and join RPC enforce the
-- requirement in the meantime.

create or replace function public.normalize_phone_e164(raw text)
returns text
language sql
immutable
as $$
  with cleaned as (
    select
      btrim(raw) as trimmed,
      regexp_replace(coalesce(raw, ''), '\D', '', 'g') as digits
  )
  select case
    when cleaned.trimmed is null then null
    when cleaned.digits = '' then null
    when left(cleaned.trimmed, 1) = '+'
      then '+' || cleaned.digits
    when cleaned.digits ~ '^[3689][0-9]{7}$'
      then '+65' || cleaned.digits
    when cleaned.digits ~ '^65[3689][0-9]{7}$'
      then '+' || cleaned.digits
    else null
  end
  from cleaned
  where case
    when left(cleaned.trimmed, 1) = '+'
      then ('+' || cleaned.digits) ~ '^\+[1-9][0-9]{7,14}$'
    when cleaned.digits ~ '^[3689][0-9]{7}$'
      then true
    when cleaned.digits ~ '^65[3689][0-9]{7}$'
      then true
    else false
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
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
    public.normalize_phone_e164(new.raw_user_meta_data ->> 'phone_number'),
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
$$;

drop function if exists public.join_slot_with_observation(uuid, uuid) cascade;

create or replace function public.join_slot_with_observation(
  p_slot_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_max_volunteers int;
  v_active_count int;
  v_existing_membership_id uuid;
  v_existing_status text;
  v_membership_id uuid;
  v_observation_id uuid;
  v_phone_number text;
begin
  select profile.phone_number into v_phone_number
  from public.profiles profile
  where profile.id = p_user_id;

  if v_phone_number is null or btrim(v_phone_number) = '' then
    return jsonb_build_object(
      'error', 'Add a phone number to your profile before joining a walk.',
      'code', 'PHONE_REQUIRED'
    );
  end if;

  -- 1. Lock the slot row and get max_volunteers
  select max_volunteers into v_max_volunteers
  from public.walk_slots
  where id = p_slot_id
  for update;

  if v_max_volunteers is null then
    return jsonb_build_object('error', 'Slot not found');
  end if;

  -- 2. Count current ACTIVE memberships
  select count(*) into v_active_count
  from public.slot_memberships
  where slot_id = p_slot_id and status = 'ACTIVE';

  if v_active_count >= v_max_volunteers then
    return jsonb_build_object('error', 'This walk slot is full.');
  end if;

  -- 3. Check for existing membership (active or cancelled)
  select id, status into v_existing_membership_id, v_existing_status
  from public.slot_memberships
  where slot_id = p_slot_id and user_id = p_user_id;

  if v_existing_membership_id is not null then
    if v_existing_status = 'ACTIVE' then
      return jsonb_build_object('error', 'You have already joined this walk.');
    end if;

    -- Reactivate CANCELLED membership
    update public.slot_memberships
    set status = 'ACTIVE', cancelled_at = null, joined_at = now()
    where id = v_existing_membership_id;

    v_membership_id := v_existing_membership_id;
  else
    -- 4. Insert new membership
    insert into public.slot_memberships (slot_id, user_id, status)
    values (p_slot_id, p_user_id, 'ACTIVE')
    returning id into v_membership_id;
  end if;

  -- 5. Create or ensure DRAFT observation exists
  insert into public.observations (slot_id, status)
  values (p_slot_id, 'DRAFT')
  on conflict (slot_id) do nothing
  returning id into v_observation_id;

  -- If ON CONFLICT hit, fetch existing observation id
  if v_observation_id is null then
    select id into v_observation_id
    from public.observations
    where slot_id = p_slot_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'observation_id', v_observation_id
  );
end;
$$;
