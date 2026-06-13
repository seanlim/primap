create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.slot_invitation_status as enum (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED'
);

grant usage on type public.slot_invitation_status to authenticated, service_role;

create table public.slot_invitations (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.walk_slots(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status public.slot_invitation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint slot_invitations_no_self_invite check (invited_user_id <> invited_by)
);

create index slot_invitations_slot_id_idx on public.slot_invitations(slot_id);
create index slot_invitations_invited_user_id_idx on public.slot_invitations(invited_user_id);
create index slot_invitations_invited_by_idx on public.slot_invitations(invited_by);
create unique index slot_invitations_pending_slot_user_key
  on public.slot_invitations(slot_id, invited_user_id)
  where status = 'PENDING';

alter table public.slot_invitations enable row level security;

grant select on public.slot_invitations to authenticated;
grant select, insert, update, delete on public.slot_invitations to service_role;

create policy "Slot participants can read related invitations"
  on public.slot_invitations
  for select
  to authenticated
  using (
    invited_user_id = auth.uid()
    or invited_by = auth.uid()
    or exists (
      select 1
      from public.slot_memberships sm
      where sm.slot_id = slot_invitations.slot_id
        and sm.user_id = auth.uid()
        and sm.status = 'ACTIVE'
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

create or replace function private.join_slot_with_observation_impl(
  p_slot_id uuid,
  p_user_id uuid,
  p_accept_invitation_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slot record;
  v_membership record;
  v_active_count integer;
  v_pending_count integer;
  v_membership_id uuid;
  v_observation_id uuid;
  v_pending_invitation_id uuid := p_accept_invitation_id;
begin
  select
    ws.id,
    ws.walk_date,
    ws.start_time,
    ws.max_volunteers,
    sr.status as round_status
  into v_slot
  from public.walk_slots ws
  join public.survey_rounds sr on sr.id = ws.round_id
  where ws.id = p_slot_id
  for update of ws;

  if not found then
    return json_build_object('error', 'Walk slot not found.');
  end if;

  if v_slot.round_status <> 'OPEN' then
    return json_build_object('error', 'This survey round is no longer open for volunteer signup.');
  end if;

  if (v_slot.walk_date + v_slot.start_time) <= (now() at time zone 'Asia/Singapore') then
    return json_build_object('error', 'This walk has already started.');
  end if;

  select *
  into v_membership
  from public.slot_memberships
  where slot_id = p_slot_id
    and user_id = p_user_id
  for update;

  if found and v_membership.status = 'ACTIVE' then
    return json_build_object('error', 'You have already joined this walk.');
  end if;

  if v_pending_invitation_id is null then
    select id
    into v_pending_invitation_id
    from public.slot_invitations
    where slot_id = p_slot_id
      and invited_user_id = p_user_id
      and status = 'PENDING'
    order by created_at asc
    limit 1
    for update;
  end if;

  select count(*)
  into v_active_count
  from public.slot_memberships
  where slot_id = p_slot_id
    and status = 'ACTIVE';

  select count(*)
  into v_pending_count
  from public.slot_invitations
  where slot_id = p_slot_id
    and status = 'PENDING'
    and (v_pending_invitation_id is null or id <> v_pending_invitation_id);

  if v_active_count + v_pending_count >= v_slot.max_volunteers then
    return json_build_object('error', 'This walk has reached its volunteer limit.');
  end if;

  if v_membership.id is not null then
    update public.slot_memberships
    set status = 'ACTIVE',
        joined_at = now(),
        cancelled_at = null
    where id = v_membership.id
    returning id into v_membership_id;
  else
    insert into public.slot_memberships (slot_id, user_id, status)
    values (p_slot_id, p_user_id, 'ACTIVE')
    returning id into v_membership_id;
  end if;

  select id
  into v_observation_id
  from public.observations
  where slot_id = p_slot_id
    and user_id = p_user_id
  order by created_at asc
  limit 1;

  if v_observation_id is null then
    insert into public.observations (slot_id, user_id)
    values (p_slot_id, p_user_id)
    returning id into v_observation_id;
  end if;

  if v_pending_invitation_id is not null then
    update public.slot_invitations
    set status = 'ACCEPTED',
        responded_at = now(),
        updated_at = now()
    where id = v_pending_invitation_id
      and status = 'PENDING';
  end if;

  return json_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'observation_id', v_observation_id,
    'invitation_id', v_pending_invitation_id
  );
end;
$$;

create or replace function private.join_slot_with_observation(
  p_slot_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  if p_user_id <> auth.uid() then
    return json_build_object('error', 'Not authorized');
  end if;

  return private.join_slot_with_observation_impl(p_slot_id, p_user_id, null);
end;
$$;

create or replace function private.create_slot_invitation(
  p_slot_id uuid,
  p_invited_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_slot record;
  v_active_count integer;
  v_pending_count integer;
  v_invitation_id uuid;
  v_invitee_ok boolean;
begin
  if v_actor_id is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  if p_invited_user_id = v_actor_id then
    return json_build_object('error', 'You cannot invite yourself.');
  end if;

  select
    ws.id,
    ws.walk_date,
    ws.start_time,
    ws.max_volunteers,
    sr.status as round_status
  into v_slot
  from public.walk_slots ws
  join public.survey_rounds sr on sr.id = ws.round_id
  where ws.id = p_slot_id
  for update of ws;

  if not found then
    return json_build_object('error', 'Walk slot not found.');
  end if;

  if v_slot.round_status <> 'OPEN' then
    return json_build_object('error', 'This survey round is no longer open for volunteer signup.');
  end if;

  if (v_slot.walk_date + v_slot.start_time) <= (now() at time zone 'Asia/Singapore') then
    return json_build_object('error', 'This walk has already started.');
  end if;

  if not exists (
    select 1
    from public.slot_memberships
    where slot_id = p_slot_id
      and user_id = v_actor_id
      and status = 'ACTIVE'
  ) then
    return json_build_object('error', 'Only active group members can invite volunteers.');
  end if;

  select exists (
    select 1
    from public.profiles
    where id = p_invited_user_id
      and role = 'VOLUNTEER'
      and status = 'ACTIVE'
  ) into v_invitee_ok;

  if not v_invitee_ok then
    return json_build_object('error', 'Invitee must be an active onboarded volunteer.');
  end if;

  if exists (
    select 1
    from public.slot_memberships
    where slot_id = p_slot_id
      and user_id = p_invited_user_id
      and status = 'ACTIVE'
  ) then
    return json_build_object('error', 'This volunteer is already in the walk.');
  end if;

  if exists (
    select 1
    from public.slot_invitations
    where slot_id = p_slot_id
      and invited_user_id = p_invited_user_id
      and status = 'PENDING'
  ) then
    return json_build_object('error', 'This volunteer already has a pending invitation.');
  end if;

  select count(*)
  into v_active_count
  from public.slot_memberships
  where slot_id = p_slot_id
    and status = 'ACTIVE';

  select count(*)
  into v_pending_count
  from public.slot_invitations
  where slot_id = p_slot_id
    and status = 'PENDING';

  if v_active_count + v_pending_count >= v_slot.max_volunteers then
    return json_build_object('error', 'This walk has reached its volunteer limit.');
  end if;

  insert into public.slot_invitations (slot_id, invited_user_id, invited_by)
  values (p_slot_id, p_invited_user_id, v_actor_id)
  returning id into v_invitation_id;

  return json_build_object('success', true, 'invitation_id', v_invitation_id);
end;
$$;

create or replace function private.respond_to_slot_invitation(
  p_invitation_id uuid,
  p_response text
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation record;
begin
  if v_actor_id is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  select *
  into v_invitation
  from public.slot_invitations
  where id = p_invitation_id
  for update;

  if not found then
    return json_build_object('error', 'Invitation not found.');
  end if;

  if v_invitation.invited_user_id <> v_actor_id then
    return json_build_object('error', 'Not authorized');
  end if;

  if v_invitation.status <> 'PENDING' then
    return json_build_object('error', 'This invitation is no longer pending.');
  end if;

  if p_response = 'ACCEPTED' then
    return private.join_slot_with_observation_impl(
      v_invitation.slot_id,
      v_invitation.invited_user_id,
      v_invitation.id
    );
  elsif p_response = 'REJECTED' then
    update public.slot_invitations
    set status = 'REJECTED',
        responded_at = now(),
        updated_at = now()
    where id = v_invitation.id;

    return json_build_object('success', true, 'invitation_id', v_invitation.id);
  else
    return json_build_object('error', 'Invalid invitation response.');
  end if;
end;
$$;

create or replace function private.cancel_slot_invitation(
  p_invitation_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation record;
  v_is_admin boolean;
begin
  if v_actor_id is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  select *
  into v_invitation
  from public.slot_invitations
  where id = p_invitation_id
  for update;

  if not found then
    return json_build_object('error', 'Invitation not found.');
  end if;

  select exists (
    select 1
    from public.profiles
    where id = v_actor_id
      and role = 'ADMIN'
  ) into v_is_admin;

  if v_invitation.invited_by <> v_actor_id and not v_is_admin then
    return json_build_object('error', 'Not authorized');
  end if;

  if v_invitation.status <> 'PENDING' then
    return json_build_object('error', 'This invitation is no longer pending.');
  end if;

  update public.slot_invitations
  set status = 'CANCELLED',
      responded_at = now(),
      updated_at = now()
  where id = v_invitation.id;

  return json_build_object('success', true, 'invitation_id', v_invitation.id);
end;
$$;

create or replace function private.cancel_slot_with_draft_cleanup(
  p_slot_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_membership_id uuid;
  v_draft_ids uuid[];
  v_file_paths text[];
begin
  if v_actor_id is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  select id
  into v_membership_id
  from public.slot_memberships
  where slot_id = p_slot_id
    and user_id = v_actor_id
    and status = 'ACTIVE'
  for update;

  if v_membership_id is null then
    return json_build_object('error', 'You are not actively joined to this walk.');
  end if;

  if exists (
    select 1
    from public.observations
    where slot_id = p_slot_id
      and user_id = v_actor_id
      and status = 'SUBMITTED'
  ) then
    return json_build_object('error', 'You can''t cancel this walk after submitting your report.');
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into v_draft_ids
  from public.observations
  where slot_id = p_slot_id
    and user_id = v_actor_id
    and status = 'DRAFT';

  select coalesce(array_agg(distinct m.file_path), array[]::text[])
  into v_file_paths
  from public.media m
  left join public.sightings s on s.id = m.sighting_id
  where m.observation_id = any(v_draft_ids)
    or s.observation_id = any(v_draft_ids);

  delete from public.media m
  using public.sightings s
  where m.sighting_id = s.id
    and s.observation_id = any(v_draft_ids);

  delete from public.media
  where observation_id = any(v_draft_ids);

  delete from public.sightings
  where observation_id = any(v_draft_ids);

  delete from public.observations
  where id = any(v_draft_ids);

  update public.slot_memberships
  set status = 'CANCELLED',
      cancelled_at = now()
  where id = v_membership_id;

  update public.slot_invitations
  set status = 'CANCELLED',
      responded_at = now(),
      updated_at = now()
  where slot_id = p_slot_id
    and invited_by = v_actor_id
    and status = 'PENDING';

  return json_build_object(
    'success', true,
    'deleted_draft_count', coalesce(array_length(v_draft_ids, 1), 0),
    'file_paths', v_file_paths
  );
end;
$$;

create or replace function public.join_slot_with_observation(
  p_slot_id uuid,
  p_user_id uuid
)
returns json
language sql
security invoker
set search_path = private, public
as $$
  select private.join_slot_with_observation(p_slot_id, p_user_id);
$$;

create or replace function public.cancel_slot_with_draft_cleanup(
  p_slot_id uuid
)
returns json
language sql
security invoker
set search_path = private, public
as $$
  select private.cancel_slot_with_draft_cleanup(p_slot_id);
$$;

create or replace function public.create_slot_invitation(
  p_slot_id uuid,
  p_invited_user_id uuid
)
returns json
language sql
security invoker
set search_path = private, public
as $$
  select private.create_slot_invitation(p_slot_id, p_invited_user_id);
$$;

create or replace function public.respond_to_slot_invitation(
  p_invitation_id uuid,
  p_response text
)
returns json
language sql
security invoker
set search_path = private, public
as $$
  select private.respond_to_slot_invitation(p_invitation_id, p_response);
$$;

create or replace function public.cancel_slot_invitation(
  p_invitation_id uuid
)
returns json
language sql
security invoker
set search_path = private, public
as $$
  select private.cancel_slot_invitation(p_invitation_id);
$$;

revoke all on function public.join_slot_with_observation(uuid, uuid) from public;
revoke all on function public.cancel_slot_with_draft_cleanup(uuid) from public;
revoke all on function public.create_slot_invitation(uuid, uuid) from public;
revoke all on function public.respond_to_slot_invitation(uuid, text) from public;
revoke all on function public.cancel_slot_invitation(uuid) from public;

grant execute on function private.join_slot_with_observation(uuid, uuid) to authenticated;
grant execute on function private.cancel_slot_with_draft_cleanup(uuid) to authenticated;
grant execute on function private.create_slot_invitation(uuid, uuid) to authenticated;
grant execute on function private.respond_to_slot_invitation(uuid, text) to authenticated;
grant execute on function private.cancel_slot_invitation(uuid) to authenticated;

grant execute on function public.join_slot_with_observation(uuid, uuid) to authenticated;
grant execute on function public.cancel_slot_with_draft_cleanup(uuid) to authenticated;
grant execute on function public.create_slot_invitation(uuid, uuid) to authenticated;
grant execute on function public.respond_to_slot_invitation(uuid, text) to authenticated;
grant execute on function public.cancel_slot_invitation(uuid) to authenticated;
