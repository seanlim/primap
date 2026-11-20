-- Single round trip payload for /profile.
--
-- The page used to issue ten sequential PostgREST queries (profile, active
-- memberships, two observation queries, attendance, sightings, app settings,
-- open rounds, current-round slots and three count queries). The Vercel
-- functions run in iad1 while this database lives in ap-south-1, so every
-- sequential query costs ~250ms of network latency (~6s per navigation).
--
-- SECURITY INVOKER keeps row level security in force for every subquery: the
-- caller can only read rows they could already select with the anon key. That
-- also makes hardening search_path unnecessary (nothing runs with elevated
-- privileges), which matters because the RLS helpers below this function
-- (is_admin, is_active_slot_member) rely on the default public search_path.

create or replace function public.get_profile_page()
returns jsonb
language sql
stable
security invoker
as $$
with
  active_memberships as (
    select
      m.id as membership_id,
      m.slot_id,
      m.joined_at,
      jsonb_build_object(
        'id', s.id,
        'location_name', s.location_name,
        'walk_date', s.walk_date,
        'start_time', s.start_time,
        'end_time', s.end_time,
        'survey_rounds', case
          when r.id is null then null
          else jsonb_build_object('name', r.name)
        end
      ) as walk_slots
    from public.slot_memberships m
    join public.walk_slots s on s.id = m.slot_id
    left join public.survey_rounds r on r.id = s.round_id
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
    order by m.joined_at desc
    limit 20
  ),

  submitted_observations as (
    select
      o.id,
      o.slot_id,
      o.status,
      o.outcome,
      o.lat,
      o.lng,
      jsonb_build_object(
        'id', s.id,
        'location_name', s.location_name,
        'walk_date', s.walk_date,
        'start_time', s.start_time,
        'end_time', s.end_time,
        'survey_rounds', case
          when r.id is null then null
          else jsonb_build_object('name', r.name)
        end
      ) as walk_slots
    from public.observations o
    join public.walk_slots s on s.id = o.slot_id
    left join public.survey_rounds r on r.id = s.round_id
    where o.status = 'SUBMITTED'
      and o.slot_id in (select slot_id from active_memberships)
  ),

  -- Mirrors the page's previous client-side shaping: active memberships plus
  -- submitted reports for walks the volunteer is no longer an active member of,
  -- keeping only walks that have already ended, newest first, capped at 20.
  walk_history as (
    select
      merged.membership_id,
      merged.slot_id,
      merged.history_type,
      merged.walk_slots
    from (
      select
        a.membership_id,
        a.slot_id,
        'active'::text as history_type,
        a.walk_slots,
        (a.walk_slots->>'walk_date')::date as walk_date,
        (a.walk_slots->>'start_time')::time as start_time
      from active_memberships a
      union all
      select
        s.id,
        s.slot_id,
        'submitted'::text,
        s.walk_slots,
        (s.walk_slots->>'walk_date')::date,
        (s.walk_slots->>'start_time')::time
      from submitted_observations s
      where s.slot_id not in (select slot_id from active_memberships)
        and (
          ((s.walk_slots->>'walk_date')::date + (s.walk_slots->>'end_time')::time)
            at time zone 'Asia/Singapore'
        ) <= now()
    ) merged
    order by merged.walk_date desc, merged.start_time desc
    limit 20
  ),

  current_round_slots as (
    select s.id
    from public.walk_slots s
    where s.round_id = (
      select r.id
      from public.survey_rounds r
      where r.status = 'OPEN'
        and r.start_date <= (now() at time zone 'Asia/Singapore')::date
        and (now() at time zone 'Asia/Singapore')::date <= r.end_date
      order by r.start_date desc
      limit 1
    )
    and s.id in (select slot_id from active_memberships)
  )

select jsonb_build_object(
  'profile', (
    select to_jsonb(p)
    from public.profiles p
    where p.id = (select auth.uid())
  ),

  'submitted_observations', (
    select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb)
    from submitted_observations o
  ),

  'walk_history', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'membership_id', wh.membership_id,
          'slot_id', wh.slot_id,
          'history_type', wh.history_type,
          'walk_slots', wh.walk_slots
        )
        order by (wh.walk_slots->>'walk_date') desc, (wh.walk_slots->>'start_time') desc
      ),
      '[]'::jsonb
    )
    from walk_history wh
  ),

  'history_observations', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'slot_id', o.slot_id,
          'status', o.status,
          'outcome', o.outcome
        )
      ),
      '[]'::jsonb
    )
    from public.observations o
    where o.slot_id in (select slot_id from walk_history)
  ),

  'attendance', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('slot_id', a.slot_id, 'status', a.status)
      ),
      '[]'::jsonb
    )
    from public.slot_attendance a
    where a.user_id = (select auth.uid())
      and a.slot_id in (select slot_id from walk_history)
  ),

  'sightings', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'observation_id', sg.observation_id,
          'lat', sg.lat,
          'lng', sg.lng,
          'species', sg.species,
          'species_other', sg.species_other
        )
      ),
      '[]'::jsonb
    )
    from public.sightings sg
    where sg.observation_id in (select id from submitted_observations)
  ),

  'settings', (
    select jsonb_build_object(
      'required_walks_per_round', st.required_walks_per_round
    )
    from public.app_settings st
    limit 1
  ),

  'rounds', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'start_date', r.start_date,
          'end_date', r.end_date
        )
        order by r.start_date desc
      ),
      '[]'::jsonb
    )
    from public.survey_rounds r
    where r.status = 'OPEN'
  ),

  'stats', (
    select jsonb_build_object(
      'drafts_pending', count(*) filter (where o.status = 'DRAFT'),
      'reports_submitted', count(*) filter (where o.status = 'SUBMITTED'),
      'walks_attended', (
        select count(*)
        from public.slot_attendance a
        where a.user_id = (select auth.uid())
          and a.status = 'PRESENT'
          and a.slot_id in (select id from current_round_slots)
      )
    )
    from public.observations o
    where o.slot_id in (select id from current_round_slots)
  )
);
$$;

revoke all on function public.get_profile_page() from public;
grant execute on function public.get_profile_page() to authenticated;

comment on function public.get_profile_page() is
  'Payload for /profile in one query: profile, walk history, attendance, sightings and current-round stats.';
