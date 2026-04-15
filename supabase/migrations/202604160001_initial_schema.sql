create extension if not exists pgcrypto with schema extensions;

create type public.incident_type as enum (
  'INJURED_ANIMAL',
  'DEAD_ANIMAL',
  'HUMAN_WILDLIFE_CONFLICT',
  'HABITAT_DAMAGE',
  'OTHER'
);

create type public.media_type as enum (
  'PHOTO',
  'VIDEO'
);

create type public.membership_status as enum (
  'ACTIVE',
  'CANCELLED'
);

create type public.observation_outcome as enum (
  'SIGHTED',
  'NOT_SIGHTED'
);

create type public.observation_status as enum (
  'DRAFT',
  'SUBMITTED'
);

create type public.round_status as enum (
  'DRAFT',
  'OPEN',
  'CLOSED'
);

create type public.species_type as enum (
  'RBL',
  'LTM',
  'DUSKY',
  'OTHER'
);

create type public.user_role as enum (
  'ADMIN',
  'VOLUNTEER'
);

create type public.user_status as enum (
  'PENDING',
  'ACTIVE',
  'REJECTED',
  'DISABLED'
);

create type public.walk_completion as enum (
  'COMPLETED',
  'PARTIAL',
  'ABORTED'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role public.user_role not null default 'VOLUNTEER',
  status public.user_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  required_walks_per_round integer not null default 4,
  late_cancel_hours integer not null default 48,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  max_media_per_report integer not null default 10,
  high_participation_threshold integer default 8
);

create table public.survey_rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  status public.round_status not null default 'DRAFT',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.walk_slots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.survey_rounds (id),
  location_name text not null,
  walk_date date not null,
  start_time time not null,
  end_time time not null,
  max_volunteers integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.slot_memberships (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.walk_slots (id),
  user_id uuid not null references public.profiles (id),
  status public.membership_status not null default 'ACTIVE',
  joined_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (slot_id, user_id)
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.walk_slots (id),
  user_id uuid not null references public.profiles (id),
  walk_completion public.walk_completion not null default 'PARTIAL',
  outcome public.observation_outcome not null default 'NOT_SIGHTED',
  notes text,
  lat double precision,
  lng double precision,
  status public.observation_status not null default 'DRAFT',
  client_draft_id text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_user_agent text,
  completion_comment text,
  unique (slot_id, user_id)
);

create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations (id) on delete cascade,
  species public.species_type not null,
  count text not null default '1',
  observed_at timestamptz,
  lat double precision not null,
  lng double precision not null,
  notes text,
  created_at timestamptz not null default now(),
  species_other text
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.walk_slots (id),
  reported_by uuid not null references public.profiles (id),
  incident_type public.incident_type not null,
  description text not null,
  lat double precision,
  lng double precision,
  resolved boolean not null default false,
  resolved_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid references public.observations (id) on delete cascade,
  sighting_id uuid references public.sightings (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  media_type public.media_type not null default 'PHOTO',
  file_size integer,
  exif_lat double precision,
  exif_lng double precision,
  exif_datetime timestamptz,
  created_at timestamptz not null default now(),
  incident_id uuid references public.incidents (id) on delete cascade
);

create index idx_profiles_role on public.profiles using btree (role);
create index idx_profiles_status on public.profiles using btree (status);
create index idx_survey_rounds_dates on public.survey_rounds using btree (start_date, end_date);
create index idx_survey_rounds_status on public.survey_rounds using btree (status);
create index idx_walk_slots_round_id on public.walk_slots using btree (round_id);
create index idx_walk_slots_walk_date on public.walk_slots using btree (walk_date);
create index idx_slot_memberships_slot_id on public.slot_memberships using btree (slot_id);
create index idx_slot_memberships_status on public.slot_memberships using btree (status);
create index idx_slot_memberships_user_id on public.slot_memberships using btree (user_id);
create index idx_observations_client_draft_id on public.observations using btree (client_draft_id);
create index idx_observations_slot_id on public.observations using btree (slot_id);
create index idx_observations_status on public.observations using btree (status);
create index idx_observations_user_id on public.observations using btree (user_id);
create index idx_sightings_observation_id on public.sightings using btree (observation_id);
create index idx_incidents_reported_by on public.incidents using btree (reported_by);
create index idx_incidents_slot_id on public.incidents using btree (slot_id);
create index idx_media_observation_id on public.media using btree (observation_id);
create index idx_media_sighting_id on public.media using btree (sighting_id);
create index media_incident_id_idx on public.media using btree (incident_id);

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$function$;

create or replace function public.enforce_slot_capacity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  current_count int;
  slot_max int;
begin
  if new.status = 'ACTIVE' then
    select max_volunteers
    into slot_max
    from public.walk_slots
    where id = new.slot_id;

    select count(*)
    into current_count
    from public.slot_memberships
    where slot_id = new.slot_id
      and status = 'ACTIVE'
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if current_count >= slot_max then
      raise exception 'Slot is full. Maximum % volunteers allowed.', slot_max;
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_observation_immutability()
returns trigger
language plpgsql
as $function$
begin
  if current_setting('role') = 'service_role' then
    return new;
  end if;

  if old.status = 'SUBMITTED' and new.status = 'SUBMITTED' then
    raise exception 'Cannot modify a submitted observation.';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_max_media_per_report()
returns trigger
language plpgsql
as $function$
declare
  v_max_media int;
  v_current_count int;
  v_parent_key text;
begin
  if new.observation_id is not null then
    v_parent_key := 'media:obs:' || new.observation_id::text;
  elsif new.sighting_id is not null then
    v_parent_key := 'media:sight:' || new.sighting_id::text;
  elsif new.incident_id is not null then
    v_parent_key := 'media:incident:' || new.incident_id::text;
  else
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_parent_key));

  select coalesce(max_media_per_report, 10)
  into v_max_media
  from public.app_settings
  limit 1;

  if v_max_media is null then
    v_max_media := 10;
  end if;

  if new.observation_id is not null then
    select count(*)
    into v_current_count
    from public.media
    where observation_id = new.observation_id;
  elsif new.sighting_id is not null then
    select count(*)
    into v_current_count
    from public.media
    where sighting_id = new.sighting_id;
  else
    select count(*)
    into v_current_count
    from public.media
    where incident_id = new.incident_id;
  end if;

  if v_current_count >= v_max_media then
    raise exception 'Maximum of % media files allowed per report', v_max_media using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

create or replace function public.join_slot_with_observation(p_slot_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_max_volunteers int;
  v_active_count int;
  v_existing_membership_id uuid;
  v_existing_status text;
  v_membership_id uuid;
  v_observation_id uuid;
begin
  select max_volunteers
  into v_max_volunteers
  from public.walk_slots
  where id = p_slot_id
  for update;

  if v_max_volunteers is null then
    return jsonb_build_object('error', 'Slot not found');
  end if;

  select count(*)
  into v_active_count
  from public.slot_memberships
  where slot_id = p_slot_id
    and status = 'ACTIVE';

  if v_active_count >= v_max_volunteers then
    return jsonb_build_object('error', 'This walk slot is full.');
  end if;

  select id, status
  into v_existing_membership_id, v_existing_status
  from public.slot_memberships
  where slot_id = p_slot_id
    and user_id = p_user_id;

  if v_existing_membership_id is not null then
    if v_existing_status = 'ACTIVE' then
      return jsonb_build_object('error', 'You have already joined this walk.');
    end if;

    update public.slot_memberships
    set status = 'ACTIVE',
        cancelled_at = null,
        joined_at = now()
    where id = v_existing_membership_id;

    v_membership_id := v_existing_membership_id;
  else
    insert into public.slot_memberships (slot_id, user_id, status)
    values (p_slot_id, p_user_id, 'ACTIVE')
    returning id into v_membership_id;
  end if;

  insert into public.observations (slot_id, user_id, status)
  values (p_slot_id, p_user_id, 'DRAFT')
  on conflict (slot_id, user_id) do nothing
  returning id into v_observation_id;

  if v_observation_id is null then
    select id
    into v_observation_id
    from public.observations
    where slot_id = p_slot_id
      and user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'observation_id', v_observation_id
  );
end;
$function$;

create or replace function public.cancel_slot_with_draft_cleanup(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_has_submitted boolean;
  v_draft_ids uuid[];
  v_file_paths text[];
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

  select exists (
    select 1
    from public.observations
    where slot_id = p_slot_id
      and user_id = v_user_id
      and status = 'SUBMITTED'
  )
  into v_has_submitted;

  if v_has_submitted then
    return jsonb_build_object(
      'error',
      'You can''t cancel this walk after submitting your report.'
    );
  end if;

  select coalesce(array_agg(o.id), '{}'::uuid[])
  into v_draft_ids
  from public.observations o
  where o.slot_id = p_slot_id
    and o.user_id = v_user_id
    and o.status = 'DRAFT';

  select coalesce(array_agg(distinct m.file_path), '{}'::text[])
  into v_file_paths
  from public.media m
  where m.observation_id = any(v_draft_ids)
     or m.sighting_id in (
       select s.id
       from public.sightings s
       where s.observation_id = any(v_draft_ids)
     );

  update public.slot_memberships
  set status = 'CANCELLED',
      cancelled_at = now()
  where id = v_membership_id;

  delete from public.observations
  where id = any(v_draft_ids);

  return jsonb_build_object(
    'success', true,
    'deleted_draft_count', coalesce(array_length(v_draft_ids, 1), 0),
    'file_paths', v_file_paths
  );
end;
$function$;

alter table public.app_settings enable row level security;
alter table public.incidents enable row level security;
alter table public.media enable row level security;
alter table public.observations enable row level security;
alter table public.profiles enable row level security;
alter table public.sightings enable row level security;
alter table public.slot_memberships enable row level security;
alter table public.survey_rounds enable row level security;
alter table public.walk_slots enable row level security;

create policy "Admins can manage app settings"
on public.app_settings
as permissive
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'::public.user_role
  )
);

create policy "Anyone can read app settings"
on public.app_settings
as permissive
for select
to authenticated
using (true);

create policy "Admins can manage incidents"
on public.incidents
as permissive
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'::public.user_role
  )
);

create policy "Users can report incidents"
on public.incidents
as permissive
for insert
to authenticated
with check (reported_by = auth.uid());

create policy "Users can view incidents for their slots"
on public.incidents
as permissive
for select
to authenticated
using (
  reported_by = auth.uid()
  or exists (
    select 1
    from public.slot_memberships
    where slot_memberships.slot_id = incidents.slot_id
      and slot_memberships.user_id = auth.uid()
      and slot_memberships.status = 'ACTIVE'::public.membership_status
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'::public.user_role
  )
);

create policy "Users can delete own incident media"
on public.media
as permissive
for delete
to public
using (
  incident_id is not null
  and exists (
    select 1
    from public.incidents i
    where i.id = media.incident_id
      and i.reported_by = auth.uid()
      and i.resolved = false
  )
);

create policy "Users can delete own media"
on public.media
as permissive
for delete
to authenticated
using (
  (
    observation_id is not null
    and exists (
      select 1
      from public.observations
      where observations.id = media.observation_id
        and observations.user_id = auth.uid()
        and observations.status = 'DRAFT'::public.observation_status
    )
  )
  or (
    sighting_id is not null
    and exists (
      select 1
      from public.sightings
      join public.observations on observations.id = sightings.observation_id
      where sightings.id = media.sighting_id
        and observations.user_id = auth.uid()
        and observations.status = 'DRAFT'::public.observation_status
    )
  )
);

create policy "Users can upload media for own draft observations"
on public.media
as permissive
for insert
to authenticated
with check (
  (
    observation_id is not null
    and exists (
      select 1
      from public.observations
      where observations.id = media.observation_id
        and observations.user_id = auth.uid()
        and observations.status = 'DRAFT'::public.observation_status
    )
  )
  or (
    sighting_id is not null
    and exists (
      select 1
      from public.sightings
      join public.observations on observations.id = sightings.observation_id
      where sightings.id = media.sighting_id
        and observations.user_id = auth.uid()
        and observations.status = 'DRAFT'::public.observation_status
    )
  )
);

create policy "Users can upload media for own incidents"
on public.media
as permissive
for insert
to public
with check (
  incident_id is not null
  and exists (
    select 1
    from public.incidents i
    where i.id = media.incident_id
      and i.reported_by = auth.uid()
  )
);

create policy "Users can view media for accessible incidents"
on public.media
as permissive
for select
to public
using (
  incident_id is not null
  and exists (
    select 1
    from public.incidents i
    where i.id = media.incident_id
      and (
        i.reported_by = auth.uid()
        or exists (
          select 1
          from public.slot_memberships sm
          where sm.slot_id = i.slot_id
            and sm.user_id = auth.uid()
            and sm.status = 'ACTIVE'::public.membership_status
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'ADMIN'::public.user_role
        )
      )
  )
);

create policy "Users can view media for accessible observations"
on public.media
as permissive
for select
to authenticated
using (
  (
    observation_id is not null
    and exists (
      select 1
      from public.observations
      where observations.id = media.observation_id
        and (
          observations.user_id = auth.uid()
          or exists (
            select 1
            from public.slot_memberships
            where slot_memberships.slot_id = observations.slot_id
              and slot_memberships.user_id = auth.uid()
              and slot_memberships.status = 'ACTIVE'::public.membership_status
          )
          or exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = 'ADMIN'::public.user_role
          )
        )
    )
  )
  or (
    sighting_id is not null
    and exists (
      select 1
      from public.sightings
      join public.observations on observations.id = sightings.observation_id
      where sightings.id = media.sighting_id
        and (
          observations.user_id = auth.uid()
          or exists (
            select 1
            from public.slot_memberships
            where slot_memberships.slot_id = observations.slot_id
              and slot_memberships.user_id = auth.uid()
              and slot_memberships.status = 'ACTIVE'::public.membership_status
          )
          or exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = 'ADMIN'::public.user_role
          )
        )
    )
  )
);

create policy "Admins can view all observations"
on public.observations
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'::public.user_role
  )
);

create policy "Users can create own observations"
on public.observations
as permissive
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own draft observations"
on public.observations
as permissive
for update
to authenticated
using (user_id = auth.uid() and status = 'DRAFT'::public.observation_status)
with check (user_id = auth.uid());

create policy "Users can view observations for their slots"
on public.observations
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.slot_memberships
    where slot_memberships.slot_id = observations.slot_id
      and slot_memberships.user_id = auth.uid()
      and slot_memberships.status = 'ACTIVE'::public.membership_status
  )
  or user_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'::public.user_role
  )
);

create policy "Admins can update any profile"
on public.profiles
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles_1
    where profiles_1.id = auth.uid()
      and profiles_1.role = 'ADMIN'::public.user_role
  )
);

create policy "Users can update own profile"
on public.profiles
as permissive
for update
to public
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (
    select p.role
    from public.profiles p
    where p.id = auth.uid()
  )
  and status = (
    select p.status
    from public.profiles p
    where p.id = auth.uid()
  )
);

create policy "Users can view all profiles"
on public.profiles
as permissive
for select
to authenticated
using (true);

create policy "Users can delete own sightings"
on public.sightings
as permissive
for delete
to authenticated
using (
  exists (
    select 1
    from public.observations
    where observations.id = sightings.observation_id
      and observations.user_id = auth.uid()
      and observations.status = 'DRAFT'::public.observation_status
  )
);

create policy "Users can manage own sightings"
on public.sightings
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from public.observations
    where observations.id = sightings.observation_id
      and observations.user_id = auth.uid()
      and observations.status = 'DRAFT'::public.observation_status
  )
);

create policy "Users can update own sightings"
on public.sightings
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from public.observations
    where observations.id = sightings.observation_id
      and observations.user_id = auth.uid()
      and observations.status = 'DRAFT'::public.observation_status
  )
);

create policy "Users can view sightings for accessible observations"
on public.sightings
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.observations
    where observations.id = sightings.observation_id
      and (
        observations.user_id = auth.uid()
        or exists (
          select 1
          from public.slot_memberships
          where slot_memberships.slot_id = observations.slot_id
            and slot_memberships.user_id = auth.uid()
            and slot_memberships.status = 'ACTIVE'::public.membership_status
        )
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'ADMIN'::public.user_role
        )
      )
  )
);

create policy "Admins can manage memberships"
on public.slot_memberships
as permissive
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'::public.user_role
  )
);

create policy "Users can cancel own membership"
on public.slot_memberships
as permissive
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can join slots"
on public.slot_memberships
as permissive
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can view all memberships"
on public.slot_memberships
as permissive
for select
to authenticated
using (true);

create policy "Active users can view rounds"
on public.survey_rounds
as permissive
for select
to authenticated
using (true);

create policy "Admins can manage rounds"
on public.survey_rounds
as permissive
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'::public.user_role
  )
);

create policy "Active users can view slots"
on public.walk_slots
as permissive
for select
to authenticated
using (true);

create policy "Admins can manage slots"
on public.walk_slots
as permissive
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'ADMIN'::public.user_role
  )
);

create trigger set_updated_at_app_settings
before update on public.app_settings
for each row
execute function public.update_updated_at();

create trigger set_updated_at_incidents
before update on public.incidents
for each row
execute function public.update_updated_at();

create trigger set_updated_at_observations
before update on public.observations
for each row
execute function public.update_updated_at();

create trigger set_updated_at_profiles
before update on public.profiles
for each row
execute function public.update_updated_at();

create trigger set_updated_at_survey_rounds
before update on public.survey_rounds
for each row
execute function public.update_updated_at();

create trigger set_updated_at_walk_slots
before update on public.walk_slots
for each row
execute function public.update_updated_at();

create trigger enforce_max_media_per_report_trigger
before insert on public.media
for each row
execute function public.enforce_max_media_per_report();

create trigger check_observation_immutability
before update on public.observations
for each row
execute function public.enforce_observation_immutability();

create trigger check_slot_capacity
before insert or update on public.slot_memberships
for each row
execute function public.enforce_slot_capacity();

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'incident-media',
    'incident-media',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
  ),
  (
    'observation-media',
    'observation-media',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can delete own incident media"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'incident-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own observation media"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'observation-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload incident media"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'incident-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload observation media"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'observation-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can view incident media"
on storage.objects
as permissive
for select
to public
using (
  bucket_id = 'incident-media'
  and exists (
    select 1
    from public.media m
    where m.file_path = objects.name
      and m.incident_id is not null
  )
);

create policy "Users can view observation media"
on storage.objects
as permissive
for select
to public
using (
  bucket_id = 'observation-media'
  and exists (
    select 1
    from public.media m
    where m.file_path = objects.name
      and (m.observation_id is not null or m.sighting_id is not null)
  )
);
