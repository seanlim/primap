-- Run this file after creating the demo auth users in Supabase Auth:
--   admin@primap.demo
--   alice@primap.demo
--   bob@primap.demo
--   emily@primap.demo
--
-- The auth signup flow creates matching rows in public.profiles through
-- public.handle_new_user(). This script then assigns roles/statuses and
-- inserts demo records that depend on those profile ids.

do $$
declare
  missing_emails text[];
begin
  select coalesce(array_agg(required.email order by required.email), '{}'::text[])
  into missing_emails
  from (
    values
      ('admin@primap.demo'),
      ('alice@primap.demo'),
      ('bob@primap.demo'),
      ('emily@primap.demo')
  ) as required(email)
  left join public.profiles p on p.email = required.email
  where p.id is null;

  if array_length(missing_emails, 1) is not null then
    raise exception
      'Missing demo auth users. Create these accounts in Supabase Auth first: %',
      array_to_string(missing_emails, ', ');
  end if;
end
$$;

update public.profiles
set role = case email
      when 'admin@primap.demo' then 'ADMIN'::public.user_role
      else 'VOLUNTEER'::public.user_role
    end,
    status = case email
      when 'emily@primap.demo' then 'PENDING'::public.user_status
      else 'ACTIVE'::public.user_status
    end,
    full_name = case email
      when 'admin@primap.demo' then 'Dr. Andie'
      when 'alice@primap.demo' then 'Alice'
      when 'bob@primap.demo' then 'Bob'
      when 'emily@primap.demo' then 'Emily'
      else full_name
    end
where email in (
  'admin@primap.demo',
  'alice@primap.demo',
  'bob@primap.demo',
  'emily@primap.demo'
);

update public.survey_rounds
set created_by = (
  select id
  from public.profiles
  where email = 'admin@primap.demo'
)
where id in (
  '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3',
  'd2a7b401-b4ad-451f-9fcd-a09e6b89f267'
);

insert into public.slot_memberships (
  slot_id,
  user_id,
  status,
  joined_at,
  cancelled_at
)
values
  (
    '66c5b9df-2d86-4b88-b0b8-41513c0fb5fa',
    (select id from public.profiles where email = 'alice@primap.demo'),
    'ACTIVE',
    now() - interval '3 days',
    null
  ),
  (
    '3a78fc15-9661-42f7-82ad-44f61b3c64f9',
    (select id from public.profiles where email = 'bob@primap.demo'),
    'ACTIVE',
    now() - interval '2 days',
    null
  ),
  (
    'cd36b3b3-d954-44c5-8811-4e86f5a5eb36',
    (select id from public.profiles where email = 'alice@primap.demo'),
    'ACTIVE',
    now() - interval '5 days',
    null
  ),
  (
    'cd36b3b3-d954-44c5-8811-4e86f5a5eb36',
    (select id from public.profiles where email = 'bob@primap.demo'),
    'ACTIVE',
    now() - interval '5 days',
    null
  )
on conflict (slot_id, user_id) do update
set status = excluded.status,
    joined_at = excluded.joined_at,
    cancelled_at = excluded.cancelled_at;

insert into public.observations (
  id,
  slot_id,
  user_id,
  walk_completion,
  outcome,
  notes,
  lat,
  lng,
  status,
  submitted_at,
  completion_comment
)
values
  (
    '39da2398-b938-4051-973f-87f7b3bee6f2',
    'cd36b3b3-d954-44c5-8811-4e86f5a5eb36',
    (select id from public.profiles where email = 'alice@primap.demo'),
    'COMPLETED',
    'SIGHTED',
    'Demo submitted report with sightings for evaluator review.',
    1.38372869068871,
    103.821948497478,
    'SUBMITTED',
    now() - interval '2 days',
    null
  ),
  (
    'de18acdd-8b97-4c77-b979-b870b2e62246',
    'cd36b3b3-d954-44c5-8811-4e86f5a5eb36',
    (select id from public.profiles where email = 'bob@primap.demo'),
    'COMPLETED',
    'NOT_SIGHTED',
    'Demo submitted report without sightings.',
    null,
    null,
    'SUBMITTED',
    now() - interval '2 days',
    'No primates sighted during this walk.'
  ),
  (
    '7cdb514f-33c4-4495-8eab-fea6105e07a3',
    '66c5b9df-2d86-4b88-b0b8-41513c0fb5fa',
    (select id from public.profiles where email = 'alice@primap.demo'),
    'PARTIAL',
    'SIGHTED',
    'Demo draft report for the volunteer flow.',
    1.37213790257526,
    103.824665131246,
    'DRAFT',
    null,
    null
  )
on conflict (id) do update
set slot_id = excluded.slot_id,
    user_id = excluded.user_id,
    walk_completion = excluded.walk_completion,
    outcome = excluded.outcome,
    notes = excluded.notes,
    lat = excluded.lat,
    lng = excluded.lng,
    status = excluded.status,
    submitted_at = excluded.submitted_at,
    completion_comment = excluded.completion_comment,
    updated_at = now();

insert into public.sightings (
  id,
  observation_id,
  species,
  species_other,
  count,
  observed_at,
  lat,
  lng,
  notes
)
values
  (
    'f9e4b880-8350-4afe-a574-a0deed411207',
    '39da2398-b938-4051-973f-87f7b3bee6f2',
    'RBL',
    null,
    '1',
    now() - interval '2 days',
    1.38372869068871,
    103.821948497478,
    'Observed near the trail edge.'
  ),
  (
    'c1fe4d83-7349-441e-bedc-bdfeecd906bf',
    '39da2398-b938-4051-973f-87f7b3bee6f2',
    'LTM',
    null,
    '1',
    now() - interval '2 days',
    1.38310721382064,
    103.823000696963,
    'Second species recorded during the same walk.'
  )
on conflict (id) do update
set observation_id = excluded.observation_id,
    species = excluded.species,
    species_other = excluded.species_other,
    count = excluded.count,
    observed_at = excluded.observed_at,
    lat = excluded.lat,
    lng = excluded.lng,
    notes = excluded.notes;

insert into public.incidents (
  id,
  slot_id,
  reported_by,
  incident_type,
  description,
  lat,
  lng,
  resolved,
  resolved_notes
)
values
  (
    '97d45f21-9f57-4b9c-969d-19f52e879d78',
    'cd36b3b3-d954-44c5-8811-4e86f5a5eb36',
    (select id from public.profiles where email = 'alice@primap.demo'),
    'HABITAT_DAMAGE',
    'Demo incident for the admin incident review flow.',
    1.38264161066465,
    103.824183640687,
    false,
    null
  )
on conflict (id) do update
set slot_id = excluded.slot_id,
    reported_by = excluded.reported_by,
    incident_type = excluded.incident_type,
    description = excluded.description,
    lat = excluded.lat,
    lng = excluded.lng,
    resolved = excluded.resolved,
    resolved_notes = excluded.resolved_notes,
    updated_at = now();

delete from public.media
where id in (
  'eaee8218-dce3-463a-9cb2-bbbef9e39b52',
  '8061f963-8f84-4ac7-b597-b444a5f36c1e',
  '737b428b-1219-4d68-8d90-008302ad0f28'
);
